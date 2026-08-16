import { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { forceReloadApp } from '../pwaReload'

interface PwaUpdateBannerProps {
  /** Required onboarding covers More — keep Reload tappable above the overlay. */
  escapeHatch?: boolean
}

/** Soft prompt when a new service-worker build is waiting. */
export function PwaUpdateBanner({ escapeHatch = false }: PwaUpdateBannerProps) {
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
  if (!showBanner && !escapeHatch) return null

  return (
    <div className="pwa-update-banner" role="status">
      <p>
        {showBanner
          ? 'A new Hiveworks build is ready.'
          : 'Reload if this screen is from an older build.'}
      </p>
      <div className="dev-tools-row">
        {showBanner ? (
          <button
            type="button"
            className="primary"
            onClick={() => {
              void updateServiceWorker(true)
            }}
          >
            Update
          </button>
        ) : null}
        <button type="button" className="primary" onClick={() => void forceReloadApp()}>
          Reload latest build
        </button>
        {showBanner ? (
          <button
            type="button"
            onClick={() => {
              setDismissed(true)
              setNeedRefresh(false)
            }}
          >
            Later
          </button>
        ) : null}
      </div>
    </div>
  )
}
