# Adoption provenance

Who answered each of the questions this standard must not decide by itself, and what
happened to the answer. One table, because the point of it is that a reviewer can read
every state in one pass - scattered across the artifacts they would never be compared.

Every row starts `pending`: this repo has not been through the questions yet. A row stays
legal there until the point is **reached** - until the adoption itself writes something, at a
path that point gates, that did not ship as a template.
`scripts/elicitation-provenance.mjs` fails from that moment on, because something was written
where the question belonged, so it was either asked or skipped. What this repository already
had before the adoption never counts: a brownfield repo arrives holding decision records and
specs it wrote years earlier, and its own history says nothing about who was asked what.

**States** - the full set and what each one costs is in
[`.claude/elicitation/README.md`](../.claude/elicitation/README.md):

| State         | Use it when                                                                             |
| ------------- | --------------------------------------------------------------------------------------- |
| `pending`     | the run has not reached this point                                                      |
| `human`       | a person answered - name them and date it                                               |
| `provisional` | you suggested, they will check later - **name the backlog row**, or the promise is lost |
| `inferred`    | you concluded it from the code and said so - most points refuse this                    |
| `absent`      | you wrote a stub rather than guess, and the gap is visible in the artifact              |

**Two kinds of row, and the difference decides what a row is worth later.** Most points here
belong to the repository - who it is for, how its records are kept, which profile it runs at -
and are asked once. Once such a row says a person answered and the row is **committed**, the
elicitation guard stops demanding the question again: a later session writing
`docs/decision-records/` or `docs/personas.md` is working under an answer this repository
already gave. The rest belong to a piece of work rather than to the repository - the scope of a
specification, the materials behind one discovery digest, the participants in one run - and no
committed row settles those. They are asked every time, and their row records the most recent
answer rather than a standing permission. `.claude/elicitation/points.json` declares which is
which as `scope`.

## The record

| Point                     | State       | Answered by                                                                                                                                                                                                                                                                                                                                  | When       | Landed in                                                                     | Backlog row |
| ------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------- | ----------- |
| `adopt.language` | human | the owner (FreyDv), card 1: code and commits in English, docs and specs in Russian | 2026-11-05 | AGENTS.md (Conventions / Working language) | - |
| `adopt.layout` | human | the owner (FreyDv), card 3: move ours into the standard's layout | 2026-11-05 | docs/adoption-intake.md | - |
| `adopt.profile`           | human       | the owner (FreyDv), card 3: confirm core (one author, no hand-off)                                                                                                                                                                                                                                                                           | 2026-11-05 | standard.manifest.json (profile)                                              | -           |
| `adopt.stack` | human | the owner (FreyDv), card 2: apply the Node stack; deferred by the clean slate (ADR-006) - the stack layer lands with the stack ADR | 2026-11-05 | - | STACK-1 |
| `adopt.intent`            | human       | the owner (FreyDv), card 1 of the intake round in the Claude Code session                                                                                                                                                                                                                                                                    | 2026-11-05 | docs/adoption-intake.md                                                       | -           |
| `adopt.evidence`          | human       | the owner (FreyDv), card 1: send nothing                                                                                                                                                                                                                                                                                                     | 2026-11-05 | docs/adoption-intake.md (Evidence line)                                       | -           |
| `adopt.continue`          | human       | the owner (FreyDv), checkpoint after wave one: stop here                                                                                                                                                                                                                                                                                     | 2026-11-05 | the run record                                                                | -           |
| `adopt.existing-material` | human | the owner (FreyDv), card 4: route it now | 2026-11-05 | docs/adoption-intake.md (nothing carried over: ADR-006) | - |
| `adopt.records` | human | the owner (FreyDv), card 4: rewrite docs/ADR.md into the standard's shape; for the missing records they answered off the list, verbatim: "Это проект только показывает наброски это новый проект делай все что бы будущая работа была по этим стандартам которые ты анализировал" - draft them so future work follows the analysed standards | 2026-11-05 | docs/decision-records/ | - |
| `adopt.personas`          | provisional | the owner (FreyDv), card 4: suggest from the code, check later                                                                                                                                                                                                                                                                               | 2026-11-05 | docs/personas.md                                                              | PERSONAS-1  |
| `adopt.tracker`           | human       | the owner (FreyDv), card 3: fold everything into docs/backlog.md                                                                                                                                                                                                                                                                             | 2026-11-05 | docs/backlog.md                                                               | -           |
| `adopt.backlog`           | human       | the owner (FreyDv), card 3: seed it, each row naming the role                                                                                                                                                                                                                                                                                | 2026-11-05 | docs/backlog.md                                                               | -           |
| `adopt.guards`            | human       | the owner (FreyDv), card 5: take the standard's guard set with the three recorded adaptations                                                                                                                                                                                                                                                | 2026-11-05 | .claude/settings.json, docs/adoption-intake.md                                | -           |
| `adopt.commit-plan`       | inferred    | per concern - the standard's recommendation, read against this repo's one-commit-per-PR history; the branch is split that way                                                                                                                                                                                                                | 2026-11-05 | the adoption branch                                                           | -           |
| `green.product`           | human       | the owner (FreyDv), card 6: told the product in their own words (verbatim in docs/discovery/standards-adoption/)                                                                                                                                                                                                                             | 2026-11-05 | PRODUCT.md                                                                    | PRODUCT-1   |
| `green.conventions` | human | the owner (FreyDv), card 5, verbatim: "я хочу что бы мы соответствовали стандарту но я хочу squash-merge nvmrc = 26" - the standard's defaults apply (no AI attribution, exact pins + cooldown); squash-merge and Node 26 are the two recorded deviations | 2026-11-05 | AGENTS.md (Conventions), standard.manifest.json (exceptions), ADR-027/ADR-031 | - |
| `green.stack` | human | the owner (FreyDv), card 7: confirm core; the technology itself was reopened by the clean slate (ADR-006) | 2026-11-05 | - | STACK-1 |
| `spec.scope`              | human       | the owner (FreyDv), card 6, off the list: make the project ready for the standard now; they accept cleaning up conflicts and starting over to follow the standard flow and DDH                                                                                                                                                               | 2026-11-05 | specs/**/spec.md                                                              | SPEC-1      |
| `spec.acceptance`         | human       | the owner (FreyDv), card 6: "I will formulate it myself"; the section carries a NEEDS INPUT marker until they do                                                                                                                                                                                                                             | 2026-11-05 | specs/**/spec.md (Acceptance criteria)                                        | SPEC-1      |
| `spec.unknowns`           | absent      | the owner (FreyDv), card 6: leave them open; typed NEEDS DECISION markers with owners                                                                                                                                                                                                                                                        | 2026-11-05 | specs/**/spec.md                                                              | SPEC-1      |
| `discover.materials`      | human       | the owner (FreyDv), card 5: the listed sources - the opening request, the card answers, the agent-memory rules, docs/aws-*.md, docs/ADR.md                                                                                                                                                                                                   | 2026-11-05 | docs/discovery/standards-adoption/                                            | -           |
| `discover.decisions`      | human       | the owner (FreyDv), card 5: all the listed decisions are settled (Accepted); superseded ones stay Superseded                                                                                                                                                                                                                                 | 2026-11-05 | docs/decision-records/                                                        | -           |

<!-- The table is parsed by position, six cells per row. Add columns to the right if you
     need them; do not reorder these. `-` means not applicable, never "I did not fill it in". -->

## Questions this run asked that no point declares

The declared points are a floor, not a ceiling. They are the questions that can be
_enforced_ - the hook refuses a write for a point that exists, and it can only refuse what
somebody wrote down. Every repository is different, and the questions worth asking here are
mostly ones no list anticipated: ask them, lead with the answer that converges on the
standard, and record them below.

This table is how the standard learns. A question invented in a real adoption, answered by a
real owner, is better evidence for what belongs in the point list than anything written at a
desk - `adopt.tracker` got into the list exactly that way, from a live run on 2026-08-19 that
asked where tracked work lives and recommended keeping the repository's parallel tracker.
When rows accumulate here, send them to the standard.

| Question asked | Which answer led | What was chosen | Worth declaring? |
| -------------- | ---------------- | --------------- | ---------------- |
| -              | -                | -               | -                |
