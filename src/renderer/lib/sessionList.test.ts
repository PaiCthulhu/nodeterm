import { describe, it, expect } from 'vitest'
import {
  buildSessionList,
  sessionStatusKind,
  isGroupCollapsed,
  projectSignalCounts,
  projectSignal,
  type ProjectInput,
  type SessionNodeInput
} from './sessionList'
import type { AgentNodeStatus } from '../state/agentStatus'

const node = (id: string, over: Partial<ProjectInput['nodes'][number]> = {}) => ({
  id,
  kind: 'terminal' as const,
  title: id,
  color: '#888',
  ...over
})

const projects = (): ProjectInput[] => [
  { id: 'p1', name: 'Alpha', color: '#111', cwd: '/a', nodes: [node('t1'), node('a1', { agentId: 'claude' })] },
  { id: 'p2', name: 'Beta', color: '#222', nodes: [node('t2'), node('s1', { kind: 'sticky' }), node('e1', { kind: 'editor' })] }
]

describe('sessionStatusKind', () => {
  it('maps agent states to status kinds', () => {
    expect(sessionStatusKind('working')).toBe('working')
    expect(sessionStatusKind('waiting')).toBe('attention')
    expect(sessionStatusKind('blocked')).toBe('attention')
    expect(sessionStatusKind('done')).toBe('done')
    expect(sessionStatusKind(undefined)).toBe('idle')
  })
})

describe('isGroupCollapsed', () => {
  it('defaults to expanded for the active project and collapsed for the rest', () => {
    expect(isGroupCollapsed({}, 'p1', true)).toBe(false)
    expect(isGroupCollapsed({}, 'p2', false)).toBe(true)
  })

  it('lets an explicit override win over the default', () => {
    expect(isGroupCollapsed({ p1: true }, 'p1', true)).toBe(true) // active but user collapsed
    expect(isGroupCollapsed({ p2: false }, 'p2', false)).toBe(false) // inactive but user expanded
  })

  it('with autoCollapse off, everything defaults to expanded (overrides still win)', () => {
    expect(isGroupCollapsed({}, 'p1', true, false)).toBe(false)
    expect(isGroupCollapsed({}, 'p2', false, false)).toBe(false) // inactive stays expanded
    expect(isGroupCollapsed({ p2: true }, 'p2', false, false)).toBe(true) // user collapsed
  })
})

describe('buildSessionList', () => {
  it('keeps store order (mirrors the tab bar) regardless of which project is active', () => {
    const groups = buildSessionList(projects(), null, 'p2', {}, '')
    expect(groups.map((g) => g.projectId)).toEqual(['p1', 'p2'])
    expect(groups.find((g) => g.projectId === 'p2')!.isActive).toBe(true)
  })

  it('keeps only terminal/agent nodes and flags agents', () => {
    const groups = buildSessionList(projects(), null, 'p1', {}, '')
    const p2 = groups.find((g) => g.projectId === 'p2')!
    expect(p2.ungrouped.map((s) => s.id)).toEqual(['t2']) // sticky + editor dropped
    const p1 = groups.find((g) => g.projectId === 'p1')!
    expect(p1.ungrouped.find((s) => s.id === 'a1')!.isAgent).toBe(true)
    expect(p1.ungrouped.find((s) => s.id === 't1')!.isAgent).toBe(false)
  })

  it('attaches status and unread from the status map', () => {
    const status: Record<string, AgentNodeStatus> = {
      a1: { unread: true, state: 'working', agentId: 'claude', session: 'fix bug', sessionId: 'sess-1' }
    }
    const groups = buildSessionList(projects(), null, 'p1', status, '')
    const a1 = groups[0].ungrouped.find((s) => s.id === 'a1')!
    expect(a1.statusKind).toBe('working')
    expect(a1.unread).toBe(true)
    expect(a1.session).toBe('fix bug')
    expect(a1.sessionId).toBe('sess-1')
    expect(a1.usesContext).toBe(true) // claude is USAGE_CAPABLE
  })

  it('uses live nodes for the active project instead of serialized ones', () => {
    const live = [node('t1', { title: 'renamed live' })]
    const groups = buildSessionList(projects(), live, 'p1', {}, '')
    const p1 = groups.find((g) => g.projectId === 'p1')!
    expect(p1.ungrouped.map((s) => s.title)).toEqual(['renamed live'])
  })

  it('nests sessions under their canvas group and separates ungrouped ones', () => {
    const proj: ProjectInput[] = [
      {
        id: 'p1',
        name: 'Alpha',
        color: '#111',
        nodes: [
          node('g1', { kind: 'group', title: 'Frontend', color: '#abc' }),
          node('t1', { parentId: 'g1' }),
          node('t2', { parentId: 'g1' }),
          node('t3'), // ungrouped
          node('t4', { parentId: 'missing' }) // dangling parent → ungrouped
        ]
      }
    ]
    const [p1] = buildSessionList(proj, null, 'p1', {}, '')
    expect(p1.groups).toHaveLength(1)
    expect(p1.groups[0]).toMatchObject({ id: 'g1', title: 'Frontend', color: '#abc' })
    expect(p1.groups[0].sessions.map((s) => s.id)).toEqual(['t1', 't2'])
    expect(p1.ungrouped.map((s) => s.id)).toEqual(['t3', 't4'])
  })

  it('keeps empty groups without a filter and hides them when filtering', () => {
    const proj: ProjectInput[] = [
      {
        id: 'p1',
        name: 'Alpha',
        color: '#111',
        nodes: [
          node('g1', { kind: 'group', title: 'Empty', color: '#abc' }),
          node('g2', { kind: 'group', title: 'Has match', color: '#def' }),
          node('t1', { title: 'special', parentId: 'g2' })
        ]
      }
    ]
    const unfiltered = buildSessionList(proj, null, 'p1', {}, '')
    expect(unfiltered[0].groups.map((b) => b.id)).toEqual(['g1', 'g2']) // empty g1 kept

    const filtered = buildSessionList(proj, null, 'p1', {}, 'spec')
    expect(filtered[0].groups.map((b) => b.id)).toEqual(['g2']) // empty g1 dropped
    expect(filtered[0].groups[0].sessions.map((s) => s.id)).toEqual(['t1'])
  })

  it('filters by title and session name, hiding empty projects only when filtering', () => {
    const status: Record<string, AgentNodeStatus> = { a1: { unread: false, session: 'special' } }
    const filtered = buildSessionList(projects(), null, 'p1', status, 'spec')
    expect(filtered.map((g) => g.projectId)).toEqual(['p1'])
    expect(filtered[0].ungrouped.map((s) => s.id)).toEqual(['a1'])

    const unfiltered = buildSessionList(projects(), null, 'p1', {}, '')
    expect(unfiltered.length).toBe(2) // both projects kept when no filter
  })
})

describe('projectSignalCounts', () => {
  it('counts attention and unread across ungrouped and grouped sessions', () => {
    const proj: ProjectInput[] = [
      {
        id: 'p1',
        name: 'P1',
        color: '#123',
        nodes: [
          node('g1', { kind: 'group', title: 'G', color: '#abc' }),
          node('a'), // waiting → attention
          node('b', { parentId: 'g1' }), // blocked → attention
          node('c'), // done + unread → unread
          node('d'), // idle + unread → unread (state lost, unread persisted)
          node('e'), // working + unread → NOT counted (mirrors the row glyph precedence)
          node('f') // plain idle → neither
        ]
      }
    ]
    const status: Record<string, AgentNodeStatus> = {
      a: { unread: false, state: 'waiting' },
      b: { unread: true, state: 'blocked' }, // attention wins over unread
      c: { unread: true, state: 'done' },
      d: { unread: true },
      e: { unread: true, state: 'working' }
    }
    const [g] = buildSessionList(proj, null, 'p1', status, '')
    expect(projectSignalCounts(g)).toEqual({ attention: 2, unread: 2 })
  })

  it('returns zeros for a quiet project', () => {
    const [g] = buildSessionList(
      [{ id: 'p1', name: 'P1', color: '#123', nodes: [node('x')] }],
      null,
      'p1',
      {},
      ''
    )
    expect(projectSignalCounts(g)).toEqual({ attention: 0, unread: 0 })
  })
})

describe('projectSignal', () => {
  const node = (id: string): SessionNodeInput => ({
    id,
    kind: 'terminal',
    title: id,
    color: '#0a84ff'
  })

  it('is idle when the project has no nodes at all', () => {
    expect(projectSignal([], {})).toBe('idle')
  })

  it('is idle when no node has a status entry', () => {
    expect(projectSignal([node('a'), node('b')], {})).toBe('idle')
  })

  it('reports working when any node is working', () => {
    const st = { b: { unread: false, state: 'working' as const } }
    expect(projectSignal([node('a'), node('b')], st)).toBe('working')
  })

  it('attention wins over working, whatever the node order', () => {
    const st = {
      a: { unread: false, state: 'working' as const },
      b: { unread: false, state: 'blocked' as const }
    }
    expect(projectSignal([node('a'), node('b')], st)).toBe('attention')
    expect(projectSignal([node('b'), node('a')], st)).toBe('attention')
  })

  it('treats waiting as attention, same as blocked', () => {
    const st = { a: { unread: false, state: 'waiting' as const } }
    expect(projectSignal([node('a')], st)).toBe('attention')
  })

  // The tab already shows unread as a numeric badge; a second unread indicator beside it
  // would say the same thing twice.
  it('ignores unread — that is the numeric badge, not this glyph', () => {
    const st = { a: { unread: true } }
    expect(projectSignal([node('a')], st)).toBe('idle')
  })

  // A per-project check that never clears is noise: it is not actionable.
  it('collapses done into idle', () => {
    const st = { a: { unread: false, state: 'done' as const } }
    expect(projectSignal([node('a')], st)).toBe('idle')
  })

  it('ignores status entries for nodes outside this project', () => {
    const st = { elsewhere: { unread: false, state: 'working' as const } }
    expect(projectSignal([node('a')], st)).toBe('idle')
  })
})
