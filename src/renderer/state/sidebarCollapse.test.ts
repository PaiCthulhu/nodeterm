// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { parseCollapseMap, useSidebarCollapse, SIDEBAR_COLLAPSE_KEY } from './sidebarCollapse'

beforeEach(() => {
  localStorage.clear()
  useSidebarCollapse.setState({ collapsedByProject: {} })
})

describe('parseCollapseMap', () => {
  it('returns an empty map for absent storage', () => {
    expect(parseCollapseMap(null)).toEqual({})
  })

  it('survives corrupt JSON instead of throwing at boot', () => {
    expect(parseCollapseMap('{not json')).toEqual({})
  })

  it('rejects a non-object payload', () => {
    expect(parseCollapseMap('[1,2,3]')).toEqual({})
    expect(parseCollapseMap('"a string"')).toEqual({})
  })

  it('keeps only boolean entries', () => {
    expect(parseCollapseMap('{"p1":true,"p2":false,"p3":"yes","p4":null}')).toEqual({
      p1: true,
      p2: false
    })
  })
})

describe('useSidebarCollapse', () => {
  it('records an explicit choice and persists it', () => {
    useSidebarCollapse.getState().toggle('p1', false)
    expect(useSidebarCollapse.getState().collapsedByProject.p1).toBe(true)
    expect(parseCollapseMap(localStorage.getItem(SIDEBAR_COLLAPSE_KEY))).toEqual({ p1: true })
  })

  it('flips an existing choice back', () => {
    useSidebarCollapse.getState().toggle('p1', false)
    useSidebarCollapse.getState().toggle('p1', true)
    expect(useSidebarCollapse.getState().collapsedByProject.p1).toBe(false)
  })

  it('drops entries for projects that no longer exist', () => {
    useSidebarCollapse.getState().toggle('p1', false)
    useSidebarCollapse.getState().toggle('gone', false)
    useSidebarCollapse.getState().prune(['p1'])
    expect(useSidebarCollapse.getState().collapsedByProject).toEqual({ p1: true })
    expect(parseCollapseMap(localStorage.getItem(SIDEBAR_COLLAPSE_KEY))).toEqual({ p1: true })
  })

  it('does not touch the store when prune removes nothing', () => {
    useSidebarCollapse.getState().toggle('p1', false)
    const before = useSidebarCollapse.getState().collapsedByProject
    useSidebarCollapse.getState().prune(['p1'])
    // Same object identity: a new one here would re-render the sidebar on every projects change.
    expect(useSidebarCollapse.getState().collapsedByProject).toBe(before)
  })

  // The projects store starts empty and fills in asynchronously; pruning against that empty first
  // render used to wipe the whole persisted map on every boot.
  it('ignores an empty project list instead of wiping everything', () => {
    useSidebarCollapse.getState().toggle('p1', false)
    const before = useSidebarCollapse.getState().collapsedByProject
    useSidebarCollapse.getState().prune([])
    expect(useSidebarCollapse.getState().collapsedByProject).toBe(before)
    expect(parseCollapseMap(localStorage.getItem(SIDEBAR_COLLAPSE_KEY))).toEqual({ p1: true })
  })
})
