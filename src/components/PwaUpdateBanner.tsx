import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/** Soft prompt when a new service-worker build is waiting. */
export function PwaUpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      // Check immediately, then hourly — installed phones otherwise stick on old shells.
      void registration.update()
      window.setInterval(() => {
        void registration.update()
      }, 60 * 60 * 1000)
    },
  })
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (needRefresh) setDismissed(false)
  }, [needRefresh])

  if (!needRefresh || dismissed) return null

  return (
    <div className="pwa-update-banner" role="status">
      <p>A new Cosmic Idle build is ready.</p>
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
