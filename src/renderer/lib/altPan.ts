/**
 * Alt-to-pan — the same gesture as space-pan (see ./spacePan), on a key that is free while typing.
 *
 * Alt, and not Ctrl: Ctrl is xyflow's `multiSelectionKeyCode`, and Ctrl+click to add to a selection
 * is Photoshop/Figma muscle memory. Taking it for panning would trade a reflex the user already has
 * for one they would have to learn.
 *
 * Unlike space, Alt is not a character, so there is no typing-target check here: holding it over a
 * focused terminal types nothing. The decisions that DO matter are the repeat and the combos, and
 * both are testable without a DOM.
 */

/** The event shape this reads — a `KeyboardEvent` satisfies it, and so does a test literal. */
export interface AltKeyEvent {
  key: string
  /** True for the auto-repeat that follows a held key. */
  repeat?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
}

/**
 * Should this keydown engage alt-pan?
 *
 * Refused, each for its own reason:
 *  - anything that is not the Alt key itself;
 *  - the auto-REPEAT of a held key, so engaging happens once per press, not sixty times a second;
 *  - Alt under ANOTHER modifier — Ctrl+Alt/⌘⌥ and the like belong to other bindings, and engaging
 *    there would hand the canvas a pan the user never asked for. This clause does NOT protect
 *    Alt+Tab: that starts as a plain Alt keydown, which this function happily accepts. What
 *    actually saves Alt+Tab is the `blur` listener in Canvas.tsx — the OS switches focus away
 *    before the matching keyup ever reaches this window, so the window-blur release is what keeps
 *    the canvas from getting stuck in grab mode, not this check.
 */
export function altPanKeydown(e: AltKeyEvent): boolean {
  if (e.key !== 'Alt') return false
  if (e.repeat) return false
  if (e.ctrlKey || e.metaKey || e.shiftKey) return false
  return true
}

/** Is this keyup the release of Alt? Modifier-blind on purpose — same reason as `isSpaceRelease`. */
export function isAltRelease(e: AltKeyEvent): boolean {
  return e.key === 'Alt'
}
