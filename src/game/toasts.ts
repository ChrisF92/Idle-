/** Session toasts live on the presentation queue. Re-exported for existing imports. */

export {
  ACTION_TOAST_TTL_MS,
  TOAST_MAX_QUEUE,
  TOAST_TTL_MS,
  captureToastSnapshot,
  diffToasts,
  dismissToast,
  enqueueToasts,
  expireToasts,
  snapshotsEqual,
  toastTier,
  type PresentationNav as ToastNav,
  type QueuedToast,
  type ToastSnapshot,
  type ToastSpec,
} from './presentation'

export const TOAST_MAX_VISIBLE = 1
