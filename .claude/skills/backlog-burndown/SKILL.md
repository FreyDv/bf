---
name: backlog-burndown
description: Use when the owner wants to work the backlog down item by item - "close the backlog", "take the next item", "разгреби бэклог", "закрой следующий пункт". Opus orchestrates, Sonnet agents research and build through two workflows (at most 5 agents at once); the agent settles technical choices itself and asks the owner only about money, product and GitHub settings (ADR-063), and each item lands in main as its own squash-merged PR, merged by the agent on green CI, before the next one starts.
---

# backlog-burndown

One item at a time, fully closed, then the next. You (the main session) are the orchestrator and
must run on Opus; every worker is a Sonnet agent inside `.claude/workflows/backlog-prepare.js` and
`.claude/workflows/backlog-execute.js`, which cap themselves at 5 concurrent agents.

**Who decides (ADR-063).** You settle technical choices yourself, on your own recommendation, and
record each where it belongs (an ADR says "Decided by: агент по поручению владельца, ADR-063").
The owner decides only: new paid resources or DO spend; product and users (BDR, specs, personas);
writes to GitHub settings and secrets; anything the owner explicitly kept. When the owner asks
"help me choose" or "explain", explain and recommend - then wait for their answer. A deferral
("decide later") is an answer: record it as a `[NEEDS DECISION]` marker or a backlog row, never
drop it.

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

Split `brief.decisions` (after step 2's fixes): technical ones you settle yourself on your
recommendation (ADR-063) and list for the owner in step 7; only owner-level ones (see "Who decides")
go to the owner. If none are owner-level, skip to step 5.

For the owner-level ones, invoke the `drill-me` skill. The design tree is those decisions;
`brief.settled` is never re-asked. Each round: the whole frontier, numbered, each with your
recommendation, worded so "yes" accepts it. Lead with the plain-language `why`, then the options
with cost where there is one.

- Facts you are missing go to a Sonnet subagent (`Agent` with `model: "sonnet"`), never to the owner.
- A decision that contradicts an Accepted ADR/BDR means superseding it: say so; a BDR, or an ADR on an owner-level matter, the owner decides; a technical ADR you supersede yourself with a new record.
- New dependency, datastore, broker or paid service: its ADR becomes part of this item.
- Loop until the frontier is empty and the owner confirms you understand each other.

## Step 4 - Lock the decisions

Only when step 3 asked the owner anything: one `AskUserQuestion` that lists those decisions in a
line each and asks to confirm. Set
`metadata.source` to the elicitation point ids that gate the files this item writes
(`.claude/elicitation/points.json`): `spec.scope,spec.acceptance,spec.unknowns` for a spec,
`discover.materials,discover.decisions` for `docs/discovery/**`; records, personas and
`PRODUCT.md` are already settled by `docs/adoption-provenance.md`. The confirmed list is the
`decisions` object passed to step 6 - keys from the brief, values in the owner's words for the
owner-level ones and your recommendation for the technical ones.

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

The cluster is not production yet (ADR-059): the agent runs `kubectl`, `helm`, `argocd`,
`kubeseal` and `doctl kubernetes|registry` itself, without asking. Desired state still goes in as
files through GitOps; direct commands are for diagnosis, bootstrap and verification. A remote DB,
new paid DO resources and the rest of the DO account stay off limits; anything the owner must run
by hand is listed for them with the exact command.

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

## Step 7 - Tell the owner

In Russian, short: what changed (decision -> file), the technical choices you made and why,
checks you saw pass, what was not verified, backlog rows filed, `advice` worth their attention.
Do not ask; go on to step 8 (ADR-063).

## Step 8 - Push and PR

```
git push -u origin <branch>
gh pr create --base main --title "<pr.title>" --body "<pr.body>"
```

No AI or tool attribution in commits or PR text (AGENTS.md, Conventions). Wait for CI with
`gh pr checks <n> --watch` in the background and say you are waiting. A red check goes to one
Sonnet `Agent` with the failing log, then you review its commit, push again, wait again.

## Step 9 - Merge

Right before merging, check what failed - the owner asked for this in place of the GitHub failure mails
(2026-11-16):

1. `gh pr checks <n>`: every check of the pull request, not only the required ones, passed or was skipped.
2. `gh run list --status failure --limit 15`: no failed run on `main` or of a scheduled workflow
   (`cache-check`, `image-pins`, `ghcr-retention`) since the last merge. Read each with
   `gh run view <id> --log-failed` and fix it first, in this branch when it is caused here, otherwise as
   its own pull request (`image-pins` failing means a digest bump is due: `pnpm image:pins bump`).

Then, every check green -> merge it yourself: `gh pr merge <n> --squash` (ADR-003, ADR-063).
Never on a red or unfinished check, never `--delete-branch`, never `--admin` (AGENTS.md red
flag 7). Then
`git switch main && git pull --ff-only`.

For items whose DoD is a state in the cluster (synced ArgoCD app, running pod), verify it after
the merge yourself on the cluster (ADR-059); a miss reopens the row or files a new one.

## Step 10 - Next

Say in one line what closed and what it unblocked, then return to step 1. Stop when the queue is
empty or the owner says stop; on stop, leave the current item's branch pushed or clearly named
and its row `doing`.
