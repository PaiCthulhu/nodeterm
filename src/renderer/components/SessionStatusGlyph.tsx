import { IconBellFilled, IconCircleCheck } from './icons'
import type { StatusKind } from '../lib/sessionList'

export interface SessionStatusGlyphProps {
  statusKind: StatusKind
  /** Finished (or reset) while the user wasn't looking. */
  unread: boolean
  /** Tooltip for the plain-dot and icon states (the row passes its state label). */
  label?: string
}

/**
 * The status glyph, shared by a sidebar row and a project tab.
 *
 * One component with four branches rather than two near-copies, because the precedence between
 * them is the whole design and it must not drift between the two places that show it.
 *
 * A caller that wants fewer states does not need a mode flag — it just never feeds the branches it
 * does not want. The tab bar passes `unread={false}` and never passes `'done'`, because it carries
 * unread as its own numeric badge (see `projectSignal`).
 */
export function SessionStatusGlyph({
  statusKind,
  unread,
  label
}: SessionStatusGlyphProps): JSX.Element {
  if (statusKind === 'attention') {
    // Needs-you rings a bell — louder than one more colored dot.
    return (
      <span className="ss-bell" title={label}>
        <IconBellFilled />
      </span>
    )
  }
  if (statusKind !== 'working' && unread) {
    // Finished (or reset to idle) while the user wasn't looking: the SAME check glyph,
    // but accent-blue and pulsing until they visit the node. Working/attention win —
    // a new turn or a permission prompt is more urgent than an old unread mark.
    return (
      <span className="ss-check ss-check--unread" title="Finished — new for you">
        <IconCircleCheck />
      </span>
    )
  }
  if (statusKind === 'done') {
    // Completion glyph: a check icon scans better than one more dot.
    return (
      <span className="ss-check" title={label}>
        <IconCircleCheck />
      </span>
    )
  }
  return <span className={`ss-dot ss-dot--${statusKind}`} title={label} />
}
