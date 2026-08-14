/// <reference lib="webworker" />

import { runSimulation } from './runner'
import type { HostMessage, SimulationConfig, WorkerMessage } from './types'

let cancelled = false

function post(msg: WorkerMessage): void {
  self.postMessage(msg)
}

self.onmessage = (ev: MessageEvent<HostMessage>) => {
  const msg = ev.data
  if (msg.type === 'cancel') {
    cancelled = true
    return
  }
  if (msg.type !== 'start') return
  cancelled = false
  const config: SimulationConfig = msg.config
  try {
    const report = runSimulation(config, {
      shouldCancel: () => cancelled,
      onProgress: (progress) => post({ type: 'progress', progress }),
    })
    post({ type: 'done', report })
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
