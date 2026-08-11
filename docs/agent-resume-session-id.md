# Cold restart resumes a session id that never became a conversation

> Handoff brief. Investigated 2026-08-11, **not fixed**. Written in English to match the rest of
> `docs/` and the code it quotes. The bug is cross-platform, so per the fork's cut rule the fix
> belongs on `vwill` and must not be offered to PR #111.

## Symptom

Open a claude agent node, **type nothing**, let the node die (switching project tabs unmounts it),
then reopen it. Instead of a usable agent you get:

```
No conversation found with session ID: <uuid>
```

The pane is left at a shell prompt with no agent running. Reported from real use; the error string
above was reproduced directly with `claude --resume <unknown-uuid> -p ping`.

## Root cause

**A claude session with no user turn never writes a transcript, so its id can never be resumed.**

Measured on this host, twice, with an explicitly passed id:

| Run | Session lifetime | How it ended | `~/.claude/projects/X--path-to-repo/<id>.jsonl` |
|---|---|---|---|
| 1 | 25 s, nothing typed | pane killed | not written |
| 2 | 25 s, nothing typed | `/exit` | not written |

The second run exists to rule out "the transcript is only flushed on a graceful exit". It is not a
flush problem: with no content, claude materializes no file at all. So the id is real at launch
time and unresolvable from the moment the process ends.

## Why nodeterm asks for it anyway

The id is **minted by nodeterm**, not by claude, and it *is* handed to claude on the first launch —
so this is not a case of inventing an id out of nothing.

- Mint, gated on the agent being claude *and* the CLI advertising the flag:
  `src/renderer/state/workspace.ts:378-379` (`uuid()`, deliberately not `crypto.randomUUID` — see
  the comment above it about Server Edition over plain HTTP).
- Handed to the first launch: `src/renderer/state/workspace.ts:383-386` → `withSessionId`
  (`src/shared/agents/config.ts:259-264`), which appends `--session-id <uuid>`.
- Persisted on the node as `data.agentSessionId` (`workspace.ts:420`, round-tripped at `:1079`
  and `:1144`).

The cold-restart decision, `src/renderer/nodes/TerminalNode.tsx:2343-2345`:

```js
const st = useAgentStatus.getState().byId[id]
const priorId = st?.sessionId || data.agentSessionId
const base = (priorId && resumeCommand(agentId, priorId)) || agentConfig(agentId)?.launchCmd
```

`resumeCommand` (`src/shared/agents/config.ts:272-288`) validates the id **syntactically only**
(`SAFE_SESSION_ID`). Nothing anywhere checks that the id resolves to a conversation. The
`|| launchCmd` fallback fires only when there is *no* id — an id that is present but dead has no
escape hatch.

### Both id sources are the same doomed uuid

Worth confirming at runtime before designing around it, but the code says the "live" source is no
safer than the persisted one. `SessionStart` is a managed hook (`src/shared/agents/hook-events.ts:26-27`)
normalized with the payload's `session_id` (`src/shared/agents/normalize.ts:121`, `:253`), and the
only writer of `st.sessionId` is the single Canvas wire at `src/renderer/canvas/Canvas.tsx:6981-6983`.
So on a local node with hooks installed, `st.sessionId` is very likely populated at launch — with
exactly the minted uuid. Both branches of the `||` then point at the same empty conversation.

## The trap: why deleting the fallback is wrong

`|| data.agentSessionId` was added deliberately, and the canonical comment is
`src/shared/agents/config.ts:92-107`. Before it, the id arrived **only** over the hook channel
(agent fires hook → POST → renderer). On an SSH node that POST rides the reverse tunnel, so a node
whose tunnel was down — or that simply never ran a tool — had no id at all. Measured after one host
reboot: **18 of 40 agent nodes relaunched as blank conversations while their transcripts sat intact
on disk.**

So the fix has to separate two cases that look identical at the call site:

- *minted, handed to claude, but never used* → resuming it is guaranteed to fail
- *a real conversation whose hook was lost* → resuming it is the whole point

A second constraint rules out the tempting "just always launch fresh and let it mint again":
`--session-id` **refuses an id that already exists** ("Session ID … is already in use.", measured
against claude 2.1.226 — see `src/shared/agents/config.ts:250-253`). Launch and relaunch cannot
collapse into one command shape.

## A second, worse instance of the same bug

`src/renderer/canvas/Canvas.tsx:5524-5536` — opening a hit from transcript search:

```js
const node = createAgentNode('claude', ...)   // mints a fresh agentSessionId
node.data = {
  ...node.data,                                // ...which this spread preserves
  initialCommand: withPermissionMode(cmd, 'claude', activePermissionMode())
}
```

Only `initialCommand` is replaced. The node keeps a **freshly minted `agentSessionId` that was
never handed to any claude**, while the command it actually runs resumes `hit.sessionId`. On a cold
restart with no `st.sessionId`, `TerminalNode.tsx:2344` prefers the ghost uuid — and this time the
cost is not an empty agent but a **real conversation, still on disk, silently abandoned**.

Any fix should cover this path too; arguably it should be fixed at the source, by not leaving a
minted id on a node whose command resumes something else.

## Infrastructure already available for a fix

There is a working transcript index in the core, currently feeding only the search palette:

- `src/core/transcript-index.ts` — background index of every transcript under `~/.claude/projects`
  plus managed accounts, refreshed on a timer and persisted; scans `<projectDir>/<sessionId>.jsonl`
  (`:50-70`). Exposed as `transcripts.search` (`src/shared/ipc.ts:32`, `src/preload/index.ts:427`).
- `src/core/transcript-reader.ts:204` — `resolveTranscriptPath(sessionId, accountId)`, id → file,
  with a per-hit access check. Already IPC-routed via `src/core/transcript-ipc.ts:56`. This is the
  natural gate for an "does this id resolve?" check before building `--resume`.

The transcript path encoding is confirmed on Windows: a checkout at `X:\path\to\repo` →
`~/.claude/projects/X--path-to-repo/<session-uuid>.jsonl`.

**Careful with SSH nodes**: their transcripts live on the remote host (`src/main/index.ts:1676`),
so a local existence check would wrongly reject exactly the case the fallback exists to protect.
Validation for those has to go through the remote reader (`src/main/remote-context-tail.ts`), or
the check has to be skipped — failing *open* — when the node is remote.

## Open questions to settle first

1. **Does `st.sessionId` really get set with no user turn?** The code says SessionStart carries it;
   confirm at runtime, because it decides whether the fix must cover one id source or both.
2. **Is the check allowed to be async at that call site?** `TerminalNode.tsx:2354-2356` already
   awaits `ensureActivePermissionMode`, so an await is probably acceptable — verify it does not
   widen the shell-startup race the surrounding code fights.
3. **What should a dead id degrade to?** Launching fresh loses nothing here (the conversation was
   empty), but it must not silently mint a *new* id onto a node whose old id might still be
   resolvable later, e.g. an SSH node whose tunnel is merely down right now.
4. **Should the minted id simply not be persisted until a hook confirms it?** That inverts the
   design and would reopen the 18-of-40 incident, so it needs a real argument, not a preference.

## Suggested starting point

Treat it as a debugging task, not a feature: `superpowers:systematic-debugging`, then TDD. The
mechanism is already established (above); the hard part is not the fix but proving the SSH path
does not regress. `src/shared/agents/resume.test.ts` and
`src/renderer/state/workspace.session-id.test.ts` are the existing tests that pin the current
behavior and are the natural place to add the failing case.
