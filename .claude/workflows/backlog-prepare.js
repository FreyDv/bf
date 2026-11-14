export const meta = {
  name: 'backlog-prepare',
  description: 'Research one backlog item with Sonnet agents and return the decision tree the owner must settle',
  whenToUse: 'Step 2 of the backlog-burndown skill, before the owner is grilled. args: { id: "SEC-1" }',
  phases: [
    { title: 'Research', detail: 'up to 5 read-only Sonnet researchers, one lens each', model: 'sonnet' },
    { title: 'Synthesize', detail: 'one brief: settled facts, open decisions with options, plan', model: 'sonnet' },
    { title: 'Critique', detail: 'what is missing, invented or decided without the owner', model: 'sonnet' },
  ],
}

// At most 5 agents run at once, whatever the host cap is. Every agent is Sonnet; the
// orchestrating session (Opus) only reads what this returns.
const MAX_CONCURRENT = 5
let active = 0
const waiting = []
const acquire = () => (active < MAX_CONCURRENT ? (active++, Promise.resolve()) : new Promise(r => waiting.push(r)))
const release = () => { const next = waiting.shift(); if (next) next(); else active-- }
async function run(prompt, opts) {
  await acquire()
  try { return await agent(prompt, { model: 'sonnet', ...opts }) } finally { release() }
}

const id = typeof args === 'string' ? args : args?.id
if (!id) throw new Error('args.id is required, e.g. { id: "SEC-1" }')
const ownerNotes = args?.notes ? `\nThe owner added: ${args.notes}\n` : ''

const COMMON = `You research backlog item ${id} of this repository (row in docs/backlog.md).${ownerNotes}
You are read-only: never edit, commit, push or run anything that changes state outside a scratch dir.
You cannot ask the owner anything. Facts are yours to find; decisions are the owner's - report
them as open, never settle them. Cite every claim with a repo path (and line) or a URL.
If the corpus is silent on something, say "no record of this" instead of guessing.`

const SOURCE = { type: 'object', properties: { claim: { type: 'string' }, source: { type: 'string' } }, required: ['claim', 'source'] }
const RESEARCH = {
  type: 'object',
  properties: {
    lens: { type: 'string' },
    relevant: { type: 'boolean' },
    facts: { type: 'array', items: SOURCE },
    openQuestions: { type: 'array', items: { type: 'string' } },
    conflicts: { type: 'array', items: SOURCE },
    notes: { type: 'string' },
  },
  required: ['lens', 'relevant', 'facts', 'openQuestions', 'conflicts'],
}

const LENSES = [
  { key: 'records', prompt: `Lens: the corpus. Read the ${id} row in full, then every ADR/BDR in docs/decision-records/,
specs/, docs/discovery/ (all entries, including old ones), docs/ideas/, docs/backlog-archive.md and docs/runbooks/
that touch its topic. Report: what is already decided (record number + status), what the row's DoD requires,
what is explicitly deferred to the owner, and any contradiction between records.` },
  { key: 'standards', prompt: `Lens: the two standards. Which skill in .claude/skills/ owns this kind of work (read the
descriptions and the owning SKILL.md in full) and what steps and outputs it requires. What SPEC.md rules (R-numbers),
docs/standards/** (method, security-baseline, checklists) and .claude/rules/*.md (rule IDs) demand for ${id}.
Report the exact required artifacts (record type, headings, files, guards that will check them).` },
  { key: 'code', prompt: `Lens: the current state of the code and infrastructure files. What already exists for ${id} in
apps/, packages/, deploy/, scripts/, .github/workflows/, compose.yaml, package.json, turbo.json; what is missing;
which commands from AGENTS.md "Commands" verify it. Run only read-only commands (ls, git log, grep, --help,
dry-run/lint/template). Report gaps against the DoD file by file.` },
  { key: 'dependencies', prompt: `Lens: dependencies and ripple. Which backlog rows ${id} waits on (blocked:<id>, "ждёт")
and whether they are done; which rows and records it unblocks or changes; which accepted ADR/BDR it would
contradict or need to supersede; which other specs or files must move with it (spec-impact style).` },
  { key: 'external', prompt: `Lens: outside facts. Only if ${id} involves an external product, service, library, chart,
version or price: find current stable versions with release dates (the repo needs a 7-day cooldown and exact pins,
ADR-005), prices relevant to the cloud budget, known limits and the official docs for the options the owner will
weigh. Use web search. If ${id} has no external element, return relevant=false at once with empty arrays.` },
]

phase('Research')
log(`Researching ${id} through ${LENSES.length} lenses (max ${MAX_CONCURRENT} at once)`)
const research = (await parallel(LENSES.map(l => () =>
  run(`${COMMON}\n\n${l.prompt}`, { label: `research:${l.key}`, phase: 'Research', schema: RESEARCH, effort: 'medium' })
    .then(r => r && { ...r, lens: l.key })))).filter(Boolean)
if (research.length < LENSES.length) log(`Only ${research.length}/${LENSES.length} researchers returned`)

const OPTION = {
  type: 'object',
  properties: { label: { type: 'string' }, pros: { type: 'string' }, cons: { type: 'string' }, cost: { type: 'string' } },
  required: ['label', 'pros', 'cons'],
}
const BRIEF = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    summary: { type: 'string', description: 'two or three sentences, Russian, plain language' },
    kind: { type: 'string', enum: ['decision', 'build', 'owner-content', 'mixed'] },
    owningSkills: { type: 'array', items: { type: 'string' } },
    blockedBy: { type: 'array', items: { type: 'string' }, description: 'ids still not done; empty if ready' },
    settled: { type: 'array', items: SOURCE, description: 'already decided, must not be re-asked' },
    decisions: {
      type: 'array',
      description: 'every choice the owner must make, as a design tree',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          question: { type: 'string', description: 'Russian' },
          why: { type: 'string', description: 'why it matters, Russian' },
          options: { type: 'array', items: OPTION },
          recommendation: { type: 'string' },
          recommendationWhy: { type: 'string' },
          dependsOn: { type: 'array', items: { type: 'string' } },
          sources: { type: 'array', items: { type: 'string' } },
        },
        required: ['key', 'question', 'why', 'options', 'recommendation', 'recommendationWhy', 'dependsOn'],
      },
    },
    plan: { type: 'array', items: { type: 'object', properties: { step: { type: 'string' }, files: { type: 'array', items: { type: 'string' } } }, required: ['step'] } },
    gatedWrites: { type: 'array', items: { type: 'string' }, description: 'paths under specs/**/spec.md or docs/discovery/** this item writes' },
    liveActions: { type: 'array', items: { type: 'string' }, description: 'anything touching the cluster (allowed, ADR-059), the DO account or a remote DB (owner only)' },
    newDependencies: { type: 'array', items: { type: 'string' } },
    backend: { type: 'boolean', description: 'true if apps/backend or packages used by it change' },
    verification: { type: 'array', items: { type: 'string' }, description: 'commands that prove the DoD' },
    outOfScope: { type: 'array', items: { type: 'string' }, description: 'noticed, not this item: backlog candidates' },
    risks: { type: 'array', items: { type: 'string' } },
  },
  required: ['id', 'summary', 'kind', 'owningSkills', 'blockedBy', 'settled', 'decisions', 'plan', 'gatedWrites', 'liveActions', 'newDependencies', 'backend', 'verification', 'outOfScope', 'risks'],
}

phase('Synthesize')
const brief = await run(`${COMMON}

Merge the research below into one brief for the orchestrator, who will grill the owner with drill-me.
- "settled" holds only what an Accepted record or the owner already fixed; it is never asked again.
- "decisions" holds every real choice, each with 2-4 options, an honest recommendation and its sources.
  Order them as a design tree (dependsOn). A new dependency, a superseded ADR, a cost, a retention period,
  a security trade-off are decisions, not facts.
- Questions, why, summary in Russian; keys, paths, commands in English.

Research:
${JSON.stringify(research, null, 1)}`, { label: 'synthesize', phase: 'Synthesize', schema: BRIEF, effort: 'high' })
if (!brief) throw new Error('synthesizer returned nothing')

const CRITIQUE = {
  type: 'object',
  properties: {
    missingDecisions: { type: 'array', items: { type: 'string' } },
    decidedWithoutOwner: { type: 'array', items: { type: 'string' } },
    unsourcedClaims: { type: 'array', items: { type: 'string' } },
    wrongFacts: { type: 'array', items: SOURCE },
    dodGaps: { type: 'array', items: { type: 'string' } },
  },
  required: ['missingDecisions', 'decidedWithoutOwner', 'unsourcedClaims', 'wrongFacts', 'dodGaps'],
}

phase('Critique')
const critique = await run(`${COMMON}

Be the skeptic of this brief for ${id}. Check it against the repo yourself. Find: decisions the owner must make
that are missing; choices the brief quietly made for the owner (in "settled", "plan" or a recommendation stated
as fact); claims without a source; facts that are wrong; parts of the DoD the plan does not reach.
Return empty arrays where there is nothing - do not pad.

Brief:
${JSON.stringify(brief, null, 1)}`, { label: 'critique', phase: 'Critique', schema: CRITIQUE, effort: 'high' })

return { brief, critique, research }
