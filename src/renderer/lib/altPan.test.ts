import { describe, it, expect } from 'vitest'
import { altPanKeydown, isAltRelease } from './altPan'

describe('altPanKeydown', () => {
  it('engages on a bare Alt press', () => {
    expect(altPanKeydown({ key: 'Alt', altKey: true })).toBe(true)
  })

  it('ignores the auto-repeat of a held Alt', () => {
    expect(altPanKeydown({ key: 'Alt', altKey: true, repeat: true })).toBe(false)
  })

  it('ignores any other key', () => {
    expect(altPanKeydown({ key: 'a', altKey: true })).toBe(false)
    expect(altPanKeydown({ key: 'Control', ctrlKey: true })).toBe(false)
  })

  // Alt+Tab, Ctrl+Alt+… and ⌘⌥… belong to the OS or to other bindings. Engaging a pan under them
  // would leave the canvas in grab mode after the user came back from wherever they went.
  it('ignores Alt combined with another modifier', () => {
    expect(altPanKeydown({ key: 'Alt', altKey: true, ctrlKey: true })).toBe(false)
    expect(altPanKeydown({ key: 'Alt', altKey: true, metaKey: true })).toBe(false)
    expect(altPanKeydown({ key: 'Alt', altKey: true, shiftKey: true })).toBe(false)
  })
})

describe('isAltRelease', () => {
  it('is the Alt keyup', () => {
    expect(isAltRelease({ key: 'Alt' })).toBe(true)
  })

  it('is not some other keyup', () => {
    expect(isAltRelease({ key: 'a' })).toBe(false)
  })

  // Modifier-blind on release, exactly like isSpaceRelease: a user who taps Ctrl mid-pan still gets
  // the Alt keyup, and a pan that never released would strand the canvas in grab mode.
  it('releases even when another modifier is down', () => {
    expect(isAltRelease({ key: 'Alt', ctrlKey: true })).toBe(true)
  })
})
