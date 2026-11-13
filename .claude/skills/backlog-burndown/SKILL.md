---
name: backlog-burndown
description: Use when the owner wants to work the backlog down item by item - "close the backlog", "take the next item", "разгреби бэклог", "закрой следующий пункт". Opus orchestrates, Sonnet agents research and build through two workflows (at most 5 agents at once); every decision is grilled out of the owner with drill-me, and each item lands in main as its own squash-merged PR before the next one starts.
---

# backlog-burndown

One item at a time, fully closed, then the next. You (the main session) are the orchestrator and
must run on Opus; every worker is a Sonnet agent inside `.claude/workflows/backlog-prepare.js` and
`.claude/workflows/backlog-execute.js`, which cap themselves at 5 concurrent agents.

**The owner decides. You and the agents never do.** When the owner asks "help me choose" or
"explain", explain and recommend - then wait for their answer. A deferral ("decide later") is an
answer: record it as a `[NEEDS DECISION]` marker or a backlog row, never drop it.

Talk to the owner in Russian. Files follow AGENTS.md "Working language".

## Step 0 - Preconditions (once per session)

1. The session model is Opus. If not, ask the owner to run `/model opus` and stop.
2. `gh auth status` is logged in; `git status` is clean.
3. If the current branch is not `main` and has commits not on `origin/main`
   (`git log origin/main..HEAD`), that work lands first: offer to open its PR through steps 7-9
   below before taking a new item.
4. If `.claude/workflows/` or this skill are not on `origin/main` yet, they land first as their own PR.

## Step 1 - Pick the item

Read `docs/backlog.md`. The queue is the backlog order, top to bottom, across epics. Skip rows
that are `done`, and rows that wait on an id that is not `done` (`blocked:<id>`, "ждёт <id>").
A `doing` row is resumed, not restarted. Tell the owner in one line which item is next and why
it is unblocked, and take it unless they name another.

Report queue progress as `Progress: N/M (Z%)`, counted from the rows, at the start of every item.

## Step 2 - Prepare (workflow)

Run `Workflow({ scriptPath: ".claude/workflows/backlog-prepare.js", args: { id: "<ID>" } })`.
Add `notes` to `args` when the owner said something about the item already. While it runs,
say every 1-2 minutes what it is doing (`/workflows` shows the tree). Do not present
anything before it returns.

When it returns, read `brief` and `critique` yourself:
- fold `critique.missingDecisions` and `decidedWithoutOwner` into the decision list;
- drop or re-source claims in `unsourcedClaims` / `wrongFacts` - spot-check two or three against
  the repo yourself;
- if `brief.blockedBy` is not empty, tell the owner and go back to step 1.

## Step 3 - Grill the owner (drill-me)

Invoke the `drill-me` skill. The design tree is `brief.decisions` (after step 2's fixes);
`brief.settled` is never re-asked. Each round: the whole frontier, numbered, each with your
recommendation, worded so "yes" accepts it. Lead with the plain-language `why`, then the options
with cost where there is one.

- Facts you are missing go to a Sonnet subagent (`Agent` with `model: "sonnet"`), never to the owner.
- A decision that contradicts an Accepted ADR/BDR means superseding it: say so, the owner decides.
- New dependency, datastore, broker or paid service: its ADR becomes part of this item.
- Loop until the frontier is empty and the owner confirms you understand each other.

## Step 4 - Lock the decisions

One `AskUserQuestion` that lists every decision in a line each and asks to confirm. Set
`metadata.source` to the elicitation point ids that gate the files this item writes
(`.claude/elicitation/points.json`): `spec.scope,spec.acceptance,spec.unknowns` for a spec,
`discover.materials,discover.decisions` for `docs/discovery/**`; records, personas and
`PRODUCT.md` are already settled by `docs/adoption-provenance.md`. The confirmed list is the
`decisions` object passed to step 6 - keys from the brief, values in the owner's words.

## Step 5 - Branch and the writes only you may make

```
git switch main && git pull --ff-only && git switch -c <type>/<id-lowercase>
```

`<type>` is the Conventional Commits type of the main change (`docs`, `feat`, `ci`, `chore`).

The elicitation guard reads the transcript of the session that writes, so subagents cannot
write `specs/**/spec.md` or `docs/discovery/**`. You write those yourself, through the owning
skill (`spec-specify` + `spec-clarify` for SPEC-1, `discovery-digest` for raw material), and commit.
For interview-driven items (PERSONAS-1, PRODUCT-1, SPEC-1) run the owning skill
(`personas-write`, `product-write`, `bdr-write`, `spec-specify`) here in the main session -
the owner's words go in, not a draft - and use `mode: "review-only"` in step 6.

Live infrastructure (kubectl, doctl, the DO console, a remote DB) is never touched by an agent.
The change goes in as files through GitOps; anything the owner must run by hand is listed for
them with the exact command.

## Step 6 - Execute (workflow)

```
Workflow({ scriptPath: ".claude/workflows/backlog-execute.js",
           args: { id, branch, decisions, brief, mode: "full" | "review-only", maxFixRounds: 2 } })
```

On return, by `status`:
- `ready` - go on;
- `needs-owner` - back to step 3 with exactly those questions, then rerun step 6
  (with `resumeFromRunId` when the script and earlier inputs did not change);
- `blockers-left` - read them; fix small ones yourself or with one Sonnet `Agent`, take a decision
  to the owner, then rerun only what is needed.

Then check it yourself: `git log main..HEAD`, read the whole diff, run
`node scripts/self-verify.mjs` and the item's verification commands. Your reading is the review
the owner relies on; an agent's "passed" is a claim until you saw it.

## Step 7 - Show the owner

In Russian, short: what changed (decision -> file), checks you saw pass, what was not verified,
backlog rows filed, `advice` worth their attention. Ask: push and open the PR?

## Step 8 - Push and PR

```
git push -u origin <branch>
gh pr create --base main --title "<pr.title>" --body "<pr.body>"
```

No AI or tool attribution in commits or PR text (AGENTS.md, Conventions). Wait for CI with
`gh pr checks <n> --watch` in the background and say you are waiting. A red check goes to one
Sonnet `Agent` with the failing log, then you review its commit, push again, wait again.

## Step 9 - Merge

CI green -> ask the owner to merge. On yes: `gh pr merge <n> --squash` (ADR-003). Never
`--delete-branch` and never `--admin` (AGENTS.md red flag 7). Then
`git switch main && git pull --ff-only`.

For items whose DoD is a state in the cluster (synced ArgoCD app, running pod), verify it after
the merge with read-only commands the owner approves; a miss reopens the row or files a new one.

## Step 10 - Next

Say in one line what closed and what it unblocked, then return to step 1. Stop when the queue is
empty or the owner says stop; on stop, leave the current item's branch pushed or clearly named
and its row `doing`.
