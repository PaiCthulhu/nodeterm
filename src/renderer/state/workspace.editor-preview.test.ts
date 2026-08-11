import { describe, expect, it } from 'vitest'
import { flowToNodeStates, nodeStatesToFlow } from './workspace'

describe('editor markdown preview persistence', () => {
  it('round-trips the preview mode through save and load', () => {
    const [loaded] = nodeStatesToFlow([
      {
        id: 'editor-status',
        kind: 'editor',
        position: { x: 10, y: 20 },
        size: { width: 660, height: 460 },
        title: 'status.md',
        color: '#0a84ff',
        group: null,
        filePath: '/project/status.md',
        editorPreview: true
      }
    ])

    expect(loaded.data.editorPreview).toBe(true)
    expect(flowToNodeStates([loaded])[0].editorPreview).toBe(true)
  })

  it('loads legacy editor nodes in edit mode', () => {
    const [loaded] = nodeStatesToFlow([
      {
        id: 'editor-legacy',
        kind: 'editor',
        position: { x: 0, y: 0 },
        size: { width: 660, height: 460 },
        title: 'notes.md',
        color: '#0a84ff',
        group: null,
        filePath: '/project/notes.md'
      }
    ])

    expect(loaded.data.editorPreview).toBeUndefined()
    expect(flowToNodeStates([loaded])[0].editorPreview).toBeUndefined()
  })

  it('keeps a preview that was toggled back off out of edit mode', () => {
    const [loaded] = nodeStatesToFlow([
      {
        id: 'editor-off',
        kind: 'editor',
        position: { x: 0, y: 0 },
        size: { width: 660, height: 460 },
        title: 'notes.md',
        color: '#0a84ff',
        group: null,
        filePath: '/project/notes.md',
        editorPreview: false
      }
    ])

    expect(loaded.data.editorPreview).toBe(false)
    expect(flowToNodeStates([loaded])[0].editorPreview).toBe(false)
  })
})
