/** Build-time capabilities and storage scoping for public and developer deployments. */

interface BuildModeEnv {
  DEV?: boolean
  VITE_HIVEWORKS_DEVTOOLS?: string
  VITE_HIVEWORKS_STORAGE_NAMESPACE?: string
}

export function resolveDevToolsAvailable(env: BuildModeEnv): boolean {
  return Boolean(env.DEV) || env.VITE_HIVEWORKS_DEVTOOLS === '1'
}

export function normalizeStorageNamespace(value?: string): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function scopedStorageKey(baseKey: string, namespace?: string): string {
  const safeNamespace = normalizeStorageNamespace(namespace)
  return safeNamespace ? `${baseKey}:${safeNamespace}` : baseKey
}

export const DEV_TOOLS_AVAILABLE = resolveDevToolsAvailable(import.meta.env)
export const STORAGE_NAMESPACE = normalizeStorageNamespace(
  import.meta.env.VITE_HIVEWORKS_STORAGE_NAMESPACE,
)

export function appStorageKey(baseKey: string): string {
  return scopedStorageKey(baseKey, STORAGE_NAMESPACE)
}
