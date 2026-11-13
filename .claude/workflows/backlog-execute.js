export const meta = {
  name: 'backlog-execute',
  description: 'Implement one backlog item on the current branch with Sonnet agents, review it from 5 lenses, fix blockers, draft the PR',
  whenToUse: 'Step 6 of the backlog-burndown skill, after the owner settled every decision and the branch exists. args: { id, branch, decisions, brief, mode?, maxFixRounds? }',
  phases: [
    { title: 'Implement', detail: 'one Sonnet writer on the current branch, local commits only', model: 'sonnet' },
    { title: 'Review', detail: 'up to 5 read-only Sonnet reviewers, one lens each', model: 'sonnet' },
    { title: 'Fix', detail: 'one Sonnet fixer per round, then re-review of the lenses that blocked', model: 'sonnet' },
    { title: 'PR', detail: 'title and body for the orchestrator to open', model: 'sonnet' },
  ],
}

const MAX_CONCURRENT = 5
let active = 0
const waiting = []
const acquire = () => (active < MAX_CONCURRENT ? (active++, Promise.resolve()) : new Promise(r => waiting.push(r)))
const release = () => { const next = waiting.shift(); if (next) next(); else active-- }
async function run(prompt, opts) {
  await acquire()
  try { return await agent(prompt, { model: 'sonnet', ...opts }) } finally { release() }
}

const { id, branch, decisions, brief } = args || {}
if (!id || !branch || !decisions) throw new Error('args.id, args.branch and args.decisions are required')
// 'full' writes the change; 'review-only' reviews what the orchestrator already committed
// (interview-driven items: a spec, personas, PRODUCT.md, a BDR the owner dictated).
const mode = args.mode || 'full'
const maxFixRounds = args.maxFixRounds ?? 2

const CONTEXT = `Backlog item ${id}, branch ${branch} (already checked out in the working directory, based on main).

Owner decisions - binding, implement exactly these, add none of your own:
${JSON.stringify(decisions, null, 1)}

Research brief (facts and plan; where it disagrees with the decisions, the decisions win):
${JSON.stringify(brief || {}, null, 1)}`

const RULES = `Hard rules for this run:
- You cannot ask the owner. A choice the decisions do not cover is not yours: stop that part and list it in "needsOwner".
- Work only on branch ${branch}. Never push, never open or merge a PR, never switch branches, never rewrite history.
- Commits: Conventional Commits, one logical change each, ASCII hyphen only, NO AI or tool attribution, never --no-verify.
- Never write to a remote database or the DO account beyond the cluster; deliver a file instead. The cluster itself
  is not production (ADR-059): kubectl, helm, argocd, kubeseal are allowed, desired state still goes through deploy/. No new dependency unless
  a decision above names it and its ADR is part of this change.
- Do not write specs/**/spec.md or docs/discovery/** - the orchestrator owns those (elicitation guard).
- Never edit docs/standards/vendor/** or a vendored file; never loosen .dependency-cruiser.mjs.
- Documents in Russian, code and identifiers in English (AGENTS.md, Working language).
- Never claim a check passed that you did not run.`

const WORK = {
  type: 'object',
  properties: {
    commits: { type: 'array', items: { type: 'string' } },
    filesChanged: { type: 'array', items: { type: 'string' } },
    checks: { type: 'array', items: { type: 'object', properties: { cmd: { type: 'string' }, passed: { type: 'boolean' }, output: { type: 'string' } }, required: ['cmd', 'passed'] } },
    needsOwner: { type: 'array', items: { type: 'string' } },
    notDone: { type: 'array', items: { type: 'string' } },
    backlogRowsFiled: { type: 'array', items: { type: 'string' } },
  },
  required: ['commits', 'filesChanged', 'checks', 'needsOwner', 'notDone', 'backlogRowsFiled'],
}

let work = null
if (mode === 'full') {
  phase('Implement')
  work = await run(`${CONTEXT}

${RULES}

Implement ${id} completely, so its DoD in docs/backlog.md holds.
1. Read the owning skill(s) named in the brief (.claude/skills/<name>/SKILL.md) and follow their steps and output
   shape - adr-write / bdr-write for records, the spec skills, ddd-new-use-case for backend slices.
2. For backend code follow AIP-3 (domain -> application -> infrastructure -> adapters -> tests).
3. Close the row: status done, moved to docs/backlog-archive.md with a pointer to what it became; update
   the alignment scope count if it is one of its items; unblock rows that waited on it.
4. Anything you noticed that is not ${id}: one row via the add-to-backlog skill's format, never fixed here.
5. Run the checks from the brief's "verification" plus those that apply from AGENTS.md "Commands"
   (self-verify, spec-structure, spec-guard --audit, decision-records-check, and for code pnpm typecheck/lint/test/deps,
   for deploy/ pnpm charts and charts:test). Fix what fails. Commit.`, { label: `implement:${id}`, phase: 'Implement', schema: WORK, effort: 'high' })
  if (!work) throw new Error('implementer returned nothing')
  if (work.needsOwner.length) {
    log(`Implementer stopped on ${work.needsOwner.length} owner question(s); returning before review`)
    return { status: 'needs-owner', work }
  }
}

const FINDINGS = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['blocker', 'advice'] },
          file: { type: 'string' },
          line: { type: 'integer' },
          rule: { type: 'string', description: 'rule ID, R-number, ADR or decision key' },
          problem: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['severity', 'file', 'problem', 'fix'],
      },
    },
    checksRun: { type: 'array', items: { type: 'string' } },
  },
  required: ['findings', 'checksRun'],
}

const LENSES = [
  { key: 'decisions', prompt: `Decision fidelity. Every owner decision is implemented exactly as stated, none is softened,
and nothing in the diff decides something the owner did not (a new option, a default, a number, a dependency).` },
  { key: 'standards', prompt: `Repository Standards. Record form (MADR, status, links), R4 single home of facts (docs/facts.json),
working language, backlog row closed and archived correctly, alignment scope count, spec/code coupling.
Run node scripts/self-verify.mjs, spec-structure --block, spec-guard --audit --block, decision-records-check --block.` },
  { key: 'architecture', prompt: `Architecture. Walk the AIP-6 checklist of .claude/rules/ai-protocol.md on the diff (and QRY rules
for list queries). Run pnpm deps. If the diff has no backend or package code, check placement and naming only.` },
  { key: 'correctness', prompt: `Correctness, as pre-pr-review would: read the diff as if a stranger wrote it. Run the checks that
apply (pnpm typecheck, lint, test, format:check, charts, charts:test, contracts:check). Bugs, broken commands,
wrong paths, dead links, docs that no longer match the code.` },
  { key: 'security', prompt: `Security and red flags (AGENTS.md "Red flags"). Secrets or keys, unpinned actions or images,
versions inside the 7-day cooldown, new dependencies without an ADR, remote writes, over-broad permissions in CI,
anything in security-baseline.md this change touches.` },
]

const reviewPrompt = (l) => `${CONTEXT}

You review branch ${branch}: run git diff main...HEAD and git log main..HEAD. You are read-only - never edit or commit.
${l.prompt}
Severity: blocker for a MUST/MUST NOT, a broken check, a wrong fact, or a departure from an owner decision; advice otherwise.
Return no findings rather than weak ones.`

const reviewAll = (lenses) => parallel(lenses.map(l => () =>
  run(reviewPrompt(l), { label: `review:${l.key}`, phase: 'Review', schema: FINDINGS, effort: 'medium' })
    .then(r => ({ lens: l.key, ...(r || { findings: [], checksRun: [], failed: true }) }))))

phase('Review')
let reviews = await reviewAll(LENSES)
const history = [reviews]
let round = 0
let fixes = []

const blockersOf = (rs) => rs.flatMap(r => r.findings.filter(f => f.severity === 'blocker').map(f => ({ ...f, lens: r.lens })))
while (blockersOf(reviews).length && round < maxFixRounds) {
  round++
  const blockers = blockersOf(reviews)
  log(`Round ${round}: fixing ${blockers.length} blocker(s)`)
  phase('Fix')
  const fix = await run(`${CONTEXT}

${RULES}

Fix these review blockers on branch ${branch}, commit each fix, rerun the checks they mention.
If a blocker would need a decision the owner did not make, do not fix it: put it in "needsOwner".
${JSON.stringify(blockers, null, 1)}`, { label: `fix:round-${round}`, phase: 'Fix', schema: WORK, effort: 'high' })
  fixes.push(fix)
  if (fix?.needsOwner?.length) break
  const again = LENSES.filter(l => blockers.some(b => b.lens === l.key))
  phase('Review')
  const rerun = await reviewAll(again)
  reviews = reviews.map(r => rerun.find(x => x.lens === r.lens) || r)
  history.push(rerun)
}

const remaining = blockersOf(reviews)
if (remaining.length) log(`${remaining.length} blocker(s) left after ${round} fix round(s) - the orchestrator decides`)

phase('PR')
const pr = await run(`${CONTEXT}

Write the pull request for branch ${branch} into main. Read git log main..HEAD and the diff.
English, no AI or tool attribution. Title: Conventional Commits, under 72 chars, mention ${id}.
Body sections: Summary (what and why, cite ADR/BDR numbers), Owner decisions (each, one line),
Changes (by file group), Checks run (command -> result, only ones actually run in this run's reports below),
Not verified, Follow-ups (backlog rows filed). Do not edit anything.

Reports:
${JSON.stringify({ work, fixes, reviews }, null, 1)}`, {
  label: 'pr-draft', phase: 'PR', effort: 'low',
  schema: { type: 'object', properties: { title: { type: 'string' }, body: { type: 'string' } }, required: ['title', 'body'] },
})

return {
  status: remaining.length ? 'blockers-left' : (fixes.some(f => f?.needsOwner?.length) ? 'needs-owner' : 'ready'),
  work, fixes, reviews, remainingBlockers: remaining,
  advice: reviews.flatMap(r => r.findings.filter(f => f.severity === 'advice')),
  reviewRounds: history.length, pr,
}
