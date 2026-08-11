import { create } from 'zustand'

// Which projects the user collapsed in the sessions sidebar — PERSONAL, per machine: persisted in
// localStorage, deliberately never in the git-shared .nodeterm/project.json (same rule as
// state/viewMode.ts).
//
// This used to be transient React state, wiped on every project switch so the automatic behaviour
// (active project expanded, rest collapsed) always took back over. That made it impossible to keep
// a second project open while working in a first one: one click on another tab and it folded shut.
//
// A project with an EXPLICIT entry uses it, forever, including while it is the active one. A project
// with NONE follows the default in `isGroupCollapsed`, which is still driven by
// settings.sidebarAutoCollapse — so a project the user never touched behaves exactly as before.

export const SIDEBAR_COLLAPSE_KEY = 'nodeterm.sidebarCollapse'

/** Parses the persisted map, keeping only boolean entries. Exported for tests. */
export function parseCollapseMap(raw: string | null): Record<string, boolean> {
  try {
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Record<string, boolean> = {}
    for (const [id, v] of Object.entries(parsed)) if (typeof v === 'boolean') out[id] = v
    return out
  } catch {
    return {}
  }
}

function save(v: Record<string, boolean>): void {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSE_KEY, JSON.stringify(v))
  } catch {
    /* quota/private-mode: a collapse choice is a nicety, never fail the UI */
  }
}

interface SidebarCollapseState {
  /** true = collapsed, false = expanded. Absent = follow the default. */
  collapsedByProject: Record<string, boolean>
  toggle(projectId: string, currentlyCollapsed: boolean): void
  /** Forget projects that no longer exist, so the map can't grow without bound. */
  prune(existingIds: string[]): void
}

export const useSidebarCollapse = create<SidebarCollapseState>((set) => ({
  // localStorage guard: this module is also imported by node-environment vitest suites.
  collapsedByProject: parseCollapseMap(
    typeof localStorage === 'undefined' ? null : localStorage.getItem(SIDEBAR_COLLAPSE_KEY)
  ),

  toggle: (projectId, currentlyCollapsed) =>
    set((s) => {
      const next = { ...s.collapsedByProject, [projectId]: !currentlyCollapsed }
      if (typeof localStorage !== 'undefined') save(next)
      return { collapsedByProject: next }
    }),

  prune: (existingIds) =>
    set((s) => {
      // An EMPTY list is never a real "no projects left" — the workspace loads asynchronously, so
      // the first call after boot always arrives before hydration with nothing in it. Pruning on
      // that would wipe every saved choice before the projects it belongs to even exist.
      if (existingIds.length === 0) return s
      const keep = new Set(existingIds)
      const next: Record<string, boolean> = {}
      for (const [id, v] of Object.entries(s.collapsedByProject)) if (keep.has(id)) next[id] = v
      // Same object when nothing was dropped: this runs on every projects-store change, and a fresh
      // object each time would re-render the sidebar for nothing.
      if (Object.keys(next).length === Object.keys(s.collapsedByProject).length) return s
      if (typeof localStorage !== 'undefined') save(next)
      return { collapsedByProject: next }
    })
}))
