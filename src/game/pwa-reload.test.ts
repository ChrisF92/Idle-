import { describe, expect, it } from 'vitest'
import { APP_BUILD } from '../buildMeta'
import { nextReloadHref } from '../pwaReload'

describe('PWA reload', () => {
  it('busts cache even when the build id is unchanged', () => {
    const once = nextReloadHref('https://chrisf92.github.io/Idle-/pr-preview/pr-61/', 100)
    const again = nextReloadHref(once, 200)
    expect(once).toContain(`v=${APP_BUILD}`)
    expect(once).toContain('_=100')
    expect(again).toContain('_=200')
    expect(again).not.toBe(once)
  })
})
