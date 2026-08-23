import { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { forceReloadApp } from '../pwaReload'
import { useOverlayLayer } from '../ui/overlay'

/** Soft prompt when a new service-worker build is waiting. */
export function PwaUpdateBanner() {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      registrationRef.current = registration ?? null
      void registration?.update()
    },
  })
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const ping = () => {
      void registrationRef.current?.update()
    }
    document.addEventListener('visibilitychange', ping)
    const id = window.setInterval(ping, 60 * 1000)
    return () => {
      document.removeEventListener('visibilitychange', ping)
      window.clearInterval(id)
    }
  }, [])

  useEffect(() => {
    if (needRefresh) setDismissed(false)
  }, [needRefresh])

  const showBanner = needRefresh && !dismissed
  useOverlayLayer({
    id: 'pwa-update',
    kind: 'update',
    open: showBanner,
    onClose: () => {
      setDismissed(true)
      setNeedRefresh(false)
    },
  })
  if (!showBanner) return null

  return (
    <div className="pwa-update-banner" role="status">
      <p>A new Hiveworks build is ready.</p>
      <div className="dev-tools-row">
        <button
          type="button"
          className="primary"
          onClick={() => {
            void updateServiceWorker(true)
          }}
        >
          Update
        </button>
        <button type="button" className="primary" onClick={() => void forceReloadApp()}>
          Reload latest build
        </button>
        <button
          type="button"
          onClick={() => {
            setDismissed(true)
            setNeedRefresh(false)
          }}
        >
          Later
        </button>
      </div>
    </div>
  )
}
