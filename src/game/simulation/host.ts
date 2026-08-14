import { runSimulation, type SimulationHooks } from './runner'
import type {
  HostMessage,
  SimulationConfig,
  SimulationProgress,
  SimulationReport,
  WorkerMessage,
} from './types'

export interface SimulationHandle {
  cancel: () => void
}

function runOnMainThread(
  config: SimulationConfig,
  onProgress: (p: SimulationProgress) => void,
  onDone: (r: SimulationReport) => void,
  onError: (message: string) => void,
): SimulationHandle {
  let cancelled = false
  const hooks: SimulationHooks = {
    shouldCancel: () => cancelled,
    onProgress,
  }
  const kick = () => {
    try {
      const report = runSimulation(config, hooks)
      if (!cancelled) onDone(report)
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    }
  }
  // Yield so the tap that started the run can paint.
  const id = setTimeout(kick, 0)
  return {
    cancel: () => {
      cancelled = true
      clearTimeout(id)
    },
  }
}

/**
 * Prefer a module worker so mobile UI stays responsive.
 * Fall back to the main thread if workers are unavailable.
 */
export function startSimulationHost(
  config: SimulationConfig,
  handlers: {
    onProgress: (p: SimulationProgress) => void
    onDone: (r: SimulationReport) => void
    onError: (message: string) => void
  },
): SimulationHandle {
  if (typeof Worker === 'undefined') {
    return runOnMainThread(config, handlers.onProgress, handlers.onDone, handlers.onError)
  }
  try {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (ev: MessageEvent<WorkerMessage>) => {
      const msg = ev.data
      if (msg.type === 'progress') handlers.onProgress(msg.progress)
      if (msg.type === 'done') {
        handlers.onDone(msg.report)
        worker.terminate()
      }
      if (msg.type === 'error') {
        handlers.onError(msg.message)
        worker.terminate()
      }
    }
    worker.onerror = (ev) => {
      handlers.onError(ev.message || 'Worker failed')
      worker.terminate()
    }
    worker.postMessage({ type: 'start', config } satisfies HostMessage)
    return {
      cancel: () => {
        worker.postMessage({ type: 'cancel' } satisfies HostMessage)
        worker.terminate()
      },
    }
  } catch {
    return runOnMainThread(config, handlers.onProgress, handlers.onDone, handlers.onError)
  }
}
