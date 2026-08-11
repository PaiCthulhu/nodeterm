import { describe, it, expect } from 'vitest'
import { createAgentStatusSession } from './agentStatus'
import { sessionStatusKind } from '../lib/sessionList'

/**
 * Switching project tabs unmounts every TerminalNode of the project you left (Canvas rebuilds
 * `nodes` from the newly active project alone), while the tmux session behind each one keeps
 * running. That unmount is a DETACH, not a deletion — a distinction the store has to make, because
 * the two want opposite things: a deletion must forget the node, a detach must remember it.
 *
 * Wiping the live `state` on detach is what made every session in the project you just left fall
 * back to the grey `idle` dot the instant you clicked another tab, even with the agent still
 * working — `sessionStatusKind(undefined)` has no way to tell "not running" from "nobody is
 * looking". Nothing restores it either: `state` is deliberately left out of the persisted fields,
 * and the renderer never re-reads the main-process mirror that does keep the truth.
 *
 * Keeping the entry is safe because the status feed is NOT per-node: `api.onAgentStatus` lives on
 * Canvas, which survives the tab switch and dispatches by nodeId, so a detached node's hook events
 * keep landing. The stale-working sweeper stays the safety net for an agent that dies silently.
 */
describe('detach: a node leaving the canvas is not a node going idle', () => {
  it('keeps the live state so the session dot still reads working', () => {
    const { store } = createAgentStatusSession()
    store.getState().setState('n1', 'working', 'claude')

    store.getState().detach('n1')

    expect(store.getState().byId['n1'].state).toBe('working')
    expect(sessionStatusKind(store.getState().byId['n1'].state)).toBe('working')
  })

  it('keeps a needs-you node on attention, approval ticket included', () => {
    const { store } = createAgentStatusSession()
    store.getState().setState('n1', 'blocked', 'claude', false, 'ticket-1')

    store.getState().detach('n1')

    const st = store.getState().byId['n1']
    expect(sessionStatusKind(st.state)).toBe('attention')
    // The agent is still holding the hook open — the ticket outlives the header that answers it.
    expect(st.pendingId).toBe('ticket-1')
  })

  it('releases the focused-node claim, so unread decisions stop crediting it', () => {
    const { store } = createAgentStatusSession()
    store.getState().setState('n1', 'working', 'claude')
    store.getState().setActive('n1', true)

    store.getState().detach('n1')

    expect(store.getState().activeId).toBeNull()
  })

  it('leaves another node holding focus alone', () => {
    const { store } = createAgentStatusSession()
    store.getState().setActive('n2', true)

    store.getState().detach('n1')

    expect(store.getState().activeId).toBe('n2')
  })

  it('does not resurrect a node that was never tracked', () => {
    const { store } = createAgentStatusSession()

    store.getState().detach('ghost')

    expect(store.getState().byId['ghost']).toBeUndefined()
  })

  it('still forgets the node on a real deletion', () => {
    const { store } = createAgentStatusSession()
    store.getState().setState('n1', 'working', 'claude')

    store.getState().remove('n1')

    expect(store.getState().byId['n1']).toBeUndefined()
    expect(sessionStatusKind(store.getState().byId['n1']?.state)).toBe('idle')
  })
})
