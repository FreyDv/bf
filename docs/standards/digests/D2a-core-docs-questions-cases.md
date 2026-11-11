# Repository Standards — product docs, FAQ, case studies, ideas, open questions — fact-preserving digest

Source base: `rs-core/` checkout of the Repository Standards project (repositorystandards.com, GitHub org `repository-standards`, core repo `repository-standards/core`, tag `1.0.19` present in the checkout). 45 source files digested in the order given: 8 top-level `docs/` pages, 6 case-study files, 4 ideas files, 27 open-questions files (README + 26 topics). Every section keeps the source's rules, reasoning, numbers, names and open doubts; "same as <doc>" marks a repeated point rather than dropping it.

Vocabulary used throughout the sources (defined where first given, repeated here for orientation):
- **Layer 1** = the stack-agnostic method/standard (core repo). **Layer 2** = optional per-technology best practices in a satellite "stack" repo (first: `repository-standards/node`).
- **Zone 1** = this project's own material (`docs/`, `tools/`, `site/`, `specs/`, `skills/`). **Shipped tree** = `standard/`, authored at the paths an adopting repo uses.
- **Drift** = the number `node scripts/self-verify.mjs` reports (distance from the manifest); **drift 0** = aligned.
- **Profiles** = `core` | `scale` (ADR-011, ADR-040); **adapt classes** = `copy` | `merge` | `fill` (manifest field).
- **Record** = ADR (technical) / BDR (business) decision record; **idea** = a maybe in `docs/ideas/<slug>.md`; **open question** = "I chose X, convince me of Y".

---

## docs/README.md — docs/ - about this product (zone 1)

- Purpose: index of the `docs/` folder — what the repository-standards project says about itself plus the standard's method manual.
- Rules / normative statements:
  - Client-authored templates and tool manuals do NOT live here; they live in the shipped tree `standard/docs/`.
  - The method manual (`docs/method/`) is adopted by clients **by reference from the living standard - always latest** (ADR-023).
  - Several pages are **generated** and CI fails when they are stale (see Facts).
- Definitions & vocabulary:
  - "zone 1" = this project's own documentation zone (vs. the shipped tree).
  - `open-questions/` = "the owner's provisional calls, openly seeking challengers - one file per topic, deliberations kept".
  - `case-studies/` = "anonymized field evidence - the cases that earned the rules".
  - `decision-records/` = this repo's own ADRs, "the decisions that shaped the standard, gist table in the index".
- Facts (the index table, one row per file):
  - `what-and-why.md` — the docs front page: what the product is, then the argument for why it exists.
  - `quick-start.md` — the first run: fetch, the prompt for each situation, prove it, update it.
  - `method/` (README at `method/README.md`) — adoption, assessment, taxonomy, decision checklist, ways of working (including `method/working-with-ai/README.md`), changelog process.
  - `ecosystem.md` — how the repos fit together: the engine, the map packs, how a stack plugs in.
  - `positioning.md` — "the one statement and pillars every surface quotes verbatim".
  - `personas.md` — who this product serves; "the roster the specs and backlog cite".
  - `faq.md` — short canonical answers to recurring adopter questions.
  - `skill-map.md` — **generated**: what each shipped procedure is for, grouped by the moment it fires, every description verbatim from the skill's frontmatter; `tools/skill-map.mjs --check` fails CI on a stale page or on a skill nobody grouped.
  - `file-map.md` — **generated**: what every shipped file is, why it exists, the rule it enforces; rendered from `standard.manifest.json` "so it cannot disagree with what self-verify checks"; `tools/file-map.mjs --check` fails CI on a stale copy.
  - `validation/` — two suites answering one question:
    - `validation/ai-prompting/` is **generated**: real cases run against real repositories, failures published with their fix or an open waiver, the portable subset offered as a benchmark to other standards; `tools/validation.mjs --check` fails CI on a stale render or a silently-unwaived failure.
    - `validation/human-prompting/` is the corpus of what people actually type and what the agent must say back unasked; anyone who hit a prompt the standard mishandled can add it. Its three fractions are **generated** into `validation/human-prompting/results.md`; `tools/human-prompting.mjs --check` fails CI on a stale page, a colliding prompt id, an observation citing a row that does not exist, or a run whose prose states a fraction its own rows do not support.
  - `facts.json` — the facts this repo restates on more than one surface, each with its source; `standard/scripts/facts-check.mjs` fails when a restatement stops agreeing.
- Cross-references: ADR-023; `tools/skill-map.mjs`, `tools/file-map.mjs`, `tools/validation.mjs`, `tools/human-prompting.mjs`, `standard/scripts/facts-check.mjs`, `standard.manifest.json`, `standard/docs/`.

---

## docs/quick-start.md — Quick start

- Purpose: the first run — the one-line prompt, the three other prompts, how to prove it, how to fetch without browsing, where each role goes next.
- Rules / normative statements:
  - "One line to your agent. There is nothing to install and nothing to build."
  - The adopt line is "the whole thing, and it is the whole line - there is no clause you have to remember."
  - The agent "asks you what it cannot work out for itself, because a hook refuses to write an artifact nobody was asked about."
  - The fetched checkout "is a cache you read, not a dependency you vendor, so add it to `.gitignore`".
  - "You need Node and `jq` on the machine for the shipped guards to work. Without `jq` the pre-execution guards deny every command rather than pass it unchecked."
  - If the agent is not Claude Code: skills ship in Claude Code's format; "Port them to your agent's own mechanism - strictly, not approximately, because a skill that paraphrases the loop is a loop that quietly does something else."
  - Read the role page "that is yours, not all three."
- Procedures (the four prompts):
  1. Adopt: `> adopt this repo to repositorystandards.com` — the agent reads the standard, works out whether the repo is new or has ten years of history, asks what it cannot infer.
  2. Score first (nothing is changed): `> score this repo against repositorystandards.com - count the work, do not do it`.
  3. Later, when the standard has moved: `> update me to the latest repositorystandards.com` — "It is a delta, not a re-scaffold, and your recorded deviations survive it."
  4. On a registered stack (both layers, one number): `> adopt this repo to repositorystandards.com with the Node stack`.
  - Prove it: `node scripts/self-verify.mjs` — "It exits non-zero on any failure and prints drift as a number."
  - Without browsing: `npx degit repository-standards/core .repository-standards` then `> adopt this repo to the standard in .repository-standards/`.
- Facts:
  - What you get back: "A tree in your repository: specs by capability, decision records, a persona roster, a backlog that feeds itself, and `scripts/`" — checkable by anyone including CI.
  - "That number is the contract: not 'we follow a standard', but 'we are this far from it, and here is the list'."
- Role routing table ("Now find yourself"):
  - Product Owner → `method/product-work.md`: "the four answers you are allowed to give, and what you must never be asked to do".
  - Developer → `method/dev-work.md`: raising a spec to buildable, the guard, "reading a refused plan as your to-do list".
  - Consultant (rolling out across a team/client) → `method/lead-work.md`: the order to do it in, the three objections, the two ways it goes wrong.
  - Anyone, mid-task → `method/working-with-specs.md`: find your situation, say the line.
  - Whole picture first → `method/ways-of-working.md` (walks the loop once, end to end). What the agent handles without being told → `method/agent-work.md`.
- Cross-references: `scripts/self-verify.mjs`, `degit`, `jq`, `.repository-standards/`, `method/*`.

---

## docs/positioning.md — Positioning & messaging - the one source every surface quotes

- Purpose: the single source of messaging; every surface quotes it verbatim.
- Rules / normative statements:
  - "the landing, the README, a deck, a pitch - they **quote** these lines, they never re-phrase them."
  - "If a surface needs different words, this file changes first (that change is a BDR-grade call). One source; the market hears one voice."
  - Usage rule: "A surface (landing, README, docs site, deck, post) may **shorten** a pillar, never **reword** it. New claims start here, not on the surface. The landing and README are checked against this file at every messaging pass."
  - "Say what the walk *ends at*, never that the walk itself is unusual."
- The one-liner (exact): "The missing layer between business, engineering and AI: one repository every role contributes to, and a standard that proves it still holds."
- Positioning statement (substance, keep wording): For **teams and solo builders who run their repositories with AI agents**, who need product knowledge (docs, specs, decisions) to stay true instead of scattering across tools, **repository-standards** is a **living, self-verifying engineering standard**: point a repo at it and it aligns, guides the build, and proves compliance — `align -> verify -> drift as a number`.
- Differentiation argument:
  - Unlike SDD workflows (Spec Kit, OpenSpec, BMAD), which standardise **how a change gets specified**, this standardises **the repository**.
  - Four things follow that none of them does: (1) the **decisions** behind the code are recorded and kept; (2) an existing repo is walked into line with **a standard** rather than into a workflow; (3) that standard **keeps moving and your repo trues up to it**; (4) how far you still are comes out as **a number your CI asserts**.
  - "The brownfield walk is one of the strongest reasons to use this and it is **not** what makes it different - the field does brownfield now. What differs is where the walk ends."
- The five messaging pillars (each with its "Proof"):
  1. **Every role contributes to the same place.** POs, business analysts, architects, developers, QA and the agents write into one repository, in plain language, instead of into Jira, Confluence, Miro and documents nobody opens again; "The repository stops being the developers' room." Proof: the behavioral spec tier, the clarify gate, the plain-language switch, language as a per-artifact configuration.
  2. **Executable, not aspirational.** Written to be *run* by an agent — hooks, gates, a compliance number CI asserts — not a wall document. Proof: `self-verify`, the clarify gate, the coupling guard.
  3. **The why survives.** Every technical and business decision recorded where the code is, so the next person or agent inherits the reasoning instead of re-litigating it. "This is the pillar the rest of the field does not have, and the one that pays back latest: a year on, the records are what stops a settled argument restarting." Proof: ADRs and BDRs in-repo, `adr-write` / `bdr-write`, "the altitude ladder that says which wins".
  4. **One repo, everything coherent.** Code, specs, decisions, product, personas kept together, updated in the same PR, readable by humans and loadable by agents. "Proximity is the mechanism; coherence is the outcome." Proof: living docs, same-PR coupling, the taxonomy.
  5. **It walks you there.** Greenfield scaffolds and goes; an existing repo is guided in prioritized waves, re-entered until drift 0 — "hand-holding is the product". Proof: the re-entrant align loop with the clarify gate, statuses.
- Target scenarios (who hears which pillar first):
  - Standard-bearer Staszek (architect, many repos) → pillar 2: drift as a number across a fleet.
  - Spec-first PO Paula → pillar 1 (writes behaviour in her own words, same repo, no tool to learn); then pillar 5 (the loop walks her from story to ready-to-develop without code).
  - Owner Olek → pillar 2 phrased as assurance: public and checkable, verifiable quality he can point at.
  - Buildable-truth Dev Darek → pillar 4: contracts instead of archaeology.
  - "Anyone who has watched a decision get re-argued" → pillar 3, "and it needs no persona: every engineer has lost that afternoon."
- Cross-references: `self-verify`, clarify gate, coupling guard, `adr-write`, `bdr-write`, BDR; named neighbours Spec Kit, OpenSpec, BMAD; personas.md.

---

## docs/personas.md — Personas - who repository-standards is built for

- Purpose: the standard's own persona roster, dogfooding `standard/docs/personas.md` and ADR-006.
- Rules / normative statements:
  - "every epic, skill, and doc in this repo must name which of these it serves."
  - Source-only: "a consuming repo writes its own product's roster".
  - Built **distrust-first, not identity-first**: each persona opens with what they fear, distrust, or need to see before they act; "Who / context" is the last line, not the first. Source and rationale in `standard/docs/personas.md`.
  - Position note on Olek: the role is **Owner** — deliberately not "project manager" (a PM runs delivery from inside; Olek sits above it and buys assurance) and not "sponsor" (too corporate for a persona who may simply own the whole company). "If a team has a PM persona, it is a variant of `Spec-first PO Paula`, not of Olek."
- The roster (Persona | Primary? | One-line):
  - `Standard-bearer Staszek` — **yes (primary)** — solutions architect / tech lead who adopts the standard across repos and runs the transitions.
  - `Spec-first PO Paula` — no — owns behavior and priorities; builds via stories and specs, never via code.
  - `Buildable-truth Dev Darek` — no — turns intent into buildable specs and code; hates re-litigating settled decisions.
  - `Coding agent` — no — the AI that reads the repo as context and executes the loop; "consumer, not customer".
  - `Owner Olek` — no — owns the company / project / teams; cannot audit code himself; buys **assurance**: a public, checkable standard proving his people ship quality.
- `Standard-bearer Staszek` (primary):
  - Distrust & friction: fears a big-bang alignment that stalls half-done and never resumes; distrusts a standard written as prose ("it drifts silently and nobody notices until an audit"); tooling that assumes greenfield breaks on the messy repo he actually has; a paid tracker bolted onto a hobby project feels like scope creep.
  - Jobs to be done: "When I inherit or revisit a messy repo, I want to point an agent at a reference and have it walk the repo there, so quality does not depend on my memory." "When the standard improves, I want each repo to update by delta and prove compliance, so upkeep is a command, not a project."
  - Goals: drift as a number per repo; one way of working everywhere; transitions guided, resumable, safe on brownfields.
  - Decisions influenced: ADR-005 (manifest), ADR-008/009 (zones, skill classes), ADR-010 (lifecycle + tracker), the project's naming.
  - Success signals: a repo untouched for months passes `self-verify` after one `update-to-latest` run; a new client repo reaches drift 0 in planned waves.
  - Anti-goals: IDE lock-in, a SaaS dependency, a ceremony layer ("Scrum-for-AI").
  - Who/context: senior dev / architect responsible for more than one repo (own products + client work); lives in the terminal with a coding agent.
- `Spec-first PO Paula`:
  - Distrust & friction: fears a spec going to build half-baked and returning as review ping-pong; jargon walls lock her out of her own product; worries a deferral she made gets silently dropped instead of routed to the technical pass; distrusts any tool expecting her to run an unknown command.
  - Jobs: "When I write a story, I want to be asked exactly the questions that make it buildable - and be allowed to defer the technical ones explicitly - so refinement happens once, not in review ping-pong." "When I read a decision, I want it explained plainly with examples, so I can gate it honestly."
  - Goals: see at a glance in-refinement vs ready-to-develop; trust acceptance criteria survive into tests.
  - Decisions influenced: ADR-006 (personas gate), the clarify gate (ADR-010), plain-language explainers, backlog/status conventions.
  - Success signals: zero specs reaching a developer with open clarifications; Paula answers or defers every clarify question without leaving the flow.
  - Anti-goals: writing YAML, choosing libraries, learning git internals.
  - Who/context: product owner without a compiler; thinks in users, behavior, priorities; works through chat and specs.
- `Buildable-truth Dev Darek`:
  - Distrust & friction: distrusts a descriptive spec he could not rebuild the system from ("narration, not a contract"); scaffolding debris left by a shipped feature reads as nobody finished; worst fear: docs that lie about the current system — "he will trust them exactly once before he stops trusting any of them."
  - Jobs: "When I pick up a ready-to-develop spec, I want every contract verbatim, so the agent and I can build and verify without archaeology." "When a change ripples, I want the guard to tell me which specs/ADRs it touches, so nothing rots."
  - Goals: same-PR spec+code coupling that stays green; decisions recorded once, re-litigated never.
  - Decisions influenced: ADR-002/003 (specs by capability, buildable), the spec-first loop and its gates, the coupling guard, stack picks in the registered stack repos (`stacks.json`).
  - Success signals: a capability rebuilt from its spec alone passes its tests; the coupling guard blocks a drifting PR before review does.
  - Anti-goals: process for its own sake; being the human linter.
  - Who/context: senior developer pairing with agents daily; wants contracts, not vibes.
- `Owner Olek`:
  - Distrust & friction: fears vendor lock-in to one contractor's private conventions he cannot audit; distrusts "trust me, it's clean"; worst case: discovering docs lied at a handover or audit; wary of paying for enterprise-grade process on a five-person company.
  - Jobs: "When I fund a team, I want their repos held to a standard that people better than me have already vetted, so I do not have to personally verify work I cannot read." "When a key developer leaves or an auditor asks questions, I want the repo to explain itself, so the company's knowledge is an asset I own, not a memory that walked out."
  - Goals: maintainable, transferable repositories; quality he can *point at* (a green self-verify, a pinned standard version) instead of take on faith; onboarding a new dev or agency without a month of tribal handover.
  - Decisions influenced: ADR-011 (the scale profile is his shape of the product; core keeps his solo projects cheap); naming and discovery — "his trust story only works if the standard will be publicly credible and community-reviewed - it is neither yet, and that gap is the work, not the claim"; the going-public bar (nothing in the repo the community should not see).
  - Success signals: he can ask any repo "are you compliant, and to which version?" and get a number; an external audit or handover starts from the repo itself; his teams' PRs cite the standard instead of debating taste.
  - Anti-goals: reading specs or records himself; choosing technologies; any dashboard that needs him to understand git.
  - Who/context: founder / company owner / head of a business unit; not hands-on technical; reads dashboards and outcomes, not diffs.
- `Coding agent`:
  - Distrust & friction: cannot act correctly on stale docs or dead scaffolding — no way to tell they are stale. Single point of failure: "a rule that lives only in someone's head or personal config, invisible to a fresh session (ADR-012 exists against exactly this)."
  - Jobs: "When I enter a repo, I want one entry point and honest indexes, so I load the right context without crawling." "When the user talks features, I want rules that tell me to start the loop unprompted, so process does not depend on the user knowing skill names."
  - Goals: deterministic navigation (taxonomy, indexes); mechanical gates it can obey (clarify gate, coupling guard, self-verify).
  - Decisions influenced: AGENTS.md-as-entry, honest folder indexes, living docs (R4), the enforcement stack.
  - Success signals: an agent fresh in the repo executes the loop correctly with no human prompting beyond the feature description.
  - Anti-goals: being trusted to "remember" anything not written down.
  - Who/context: Claude Code / Cursor / any agent reading `AGENTS.md` first; no memory between sessions; "the repo IS its context."
- Cross-references: ADR-002, ADR-003, ADR-005, ADR-006, ADR-008, ADR-009, ADR-010, ADR-011, ADR-012, R4; `self-verify`, `update-to-latest`, coupling guard, clarify gate, `stacks.json`, `AGENTS.md`, `standard/docs/personas.md`.

---

## docs/how-this-repo-works.md — How this repository runs itself

- Purpose: tour of the repo as a project run by the standard it publishes (own specs buildable, own decisions records, own backlog a file, own guards fail own PRs).
- Rules / normative statements:
  - Two zones, boundary enforced: `standard/` = "the tree an adopter receives, authored directly at client-repo paths"; everything else = this project's own life (docs, site, tooling, specs).
  - "There is nothing to keep in sync between them, because there is no second copy." `tree-check` fails the build if repo-own material leaks into the shipped tree or if the manifest promises a file the tree does not have.
  - `docs/method/` is "the only part an adopter reads from here rather than receiving"; adopted by reference, always at latest, "so there are not as many forks of the method as there are repositories" (ADR-023).
  - `docs/tree/` "used to be README files inside the shipped tree. They were removed because a manual copied into somebody's repository ages there and nobody edits it."
  - `skills/` never ships: `align-to-standards` runs from a checkout of this repo against yours; shipping it "would leave behind a skill for a transition that already happened."
  - `site/docs/` is generated and gitignored: "Editing the HTML there is editing an output."
  - It does not run the shipped workflows: `.github/` files under `standard/` are inert here on purpose ("a workflow running in the repository that publishes it would be testing the wrong tree"); own checks live in `.github/workflows/checks.yml`; `tree-check` enforces the separation.
  - It does not carry a technology opinion: "Layer 1 is stack-agnostic by rule", so TypeScript/Node/any ecosystem material belongs to a stack repository "and genuinely cannot land here."
- Rationale: ADR-014 (one authored tree) replaced a source-tree + generated-tree model because "Generation meant a script decided what adopters got, which meant the script was the standard and nobody could read it."
- Facts (directory map):
  - `standard/` — `AGENTS.md` (what their agent loads first), `specs/` (capability specs), `scripts/` (guards copied in and run by their CI), `.claude/skills/` (the lifecycle, as procedures).
  - `docs/` — `method/` (manual read FROM HERE, never copied), `tree/` (one page per shipped path, the "File anatomy" section), `decision-records/` (own ADRs), `open-questions/` (calls made on judgment, held open on purpose), `case-studies/` (times the loop caught something, and times it did not).
  - `specs/` — own capability specs ("the tooling you are using now"); `tools/` — checks this repo runs on itself, never shipped; `skills/` — transition skills, run from a checkout against your repo; `site/` — landing plus generated docs.
  - "The standard, applied to itself": own capability specs (e.g. `specs/verify-engine/spec.md`) — "buildable specs for real tools, which is the only honest way to show what 'buildable' means"; decision records — "thirty of them, each with what it settled and what it rejected"; open questions; personas (primary one marked); case studies. "The backlog, the sprints and the changelog are the same story in files rather than pages."
- Measurable claim: "this repository reports drift 0 against the manifest it publishes, its specs are coupled to its code by the same guard it ships, and every decision behind the tree you would adopt is written down and linked from the page describing the thing it decided. If that turns out not to be true anywhere, it is a bug worth an issue."
- Anti-pattern named: "A standard that its own authors do not follow is a document."
- Cross-references: ADR-014, ADR-023; `tree-check`, `checks.yml`, `align-to-standards`, `specs/verify-engine/spec.md`.

---

## docs/skill-map.md — What each skill is for (GENERATED)

- Purpose: generated catalogue (by `tools/skill-map.mjs`) of the shipped procedures, grouped by the moment they fire, descriptions verbatim from each skill's frontmatter.
- Rules / normative statements:
  - "Do not edit by hand: a hand-written catalogue of twenty procedures is a second source of truth, and this repo has watched that fail twice in tools/README.md alone." Change a skill's description and re-run the tool; `--check` fails CI on a stale page.
  - "If a description here does not match what the skill does, the skill is wrong, not this page."
  - Descriptions are "what an agent reads when deciding whether to run it".
  - The transition skills "live in this repository and are **never** copied into an adopted repo - they run *from* here, against somebody else's tree, and one of them runs before the target repo exists. Finding one inside an adopted repo is a hand-copy mistake, and `self-verify` warns about it."
  - Non-Claude agents: "The procedures are markdown, not a Claude feature. `.claude/skills/` is where Claude Code looks; another agent reads the same files from wherever it looks. The port is a path, not a rewrite" (see `tree/claude-skills.md`).
- Facts: **21 procedures ship into an adopted repo**; names terse on purpose; page grouped by moment, "because a reader arrives with a situation, not with an artifact name." The rule deciding whether a new skill earns its place lives in `tree/claude-skills.md`.
- Group 1 — Deciding what to build (before anything is specified; turns scattered material into something the loop can read):
  - `product-write`: when the repo needs to state what it is building and for whom — starting a product, "we never wrote down what this app actually does", a stale/empty PRODUCT.md, a recurring scope argument. Interviews for the frame, drafts it, marks what is still unknown rather than inventing it.
  - `personas-write`: when the repo needs to name who it is for — "we don't have personas", specs written against "the user", a roster that no longer matches reality, a feature argument stalling on who it serves. Interviews for real users, or reconstructs candidates from the code when nobody remembers.
  - `idea-write`: when someone floats something that might never ship ("what if we let hosts pre-approve repeat guests", "should we offer a paid tier", "I wonder whether we need multi-currency"). Captures it end-to-end (incl. provisional technical/business shape) in `docs/ideas/` without minting a record or a spec; moves it through `idea -> exploring -> approved | parked | dropped`.
  - `discovery-digest`: when someone hands over raw material rather than a request — meeting notes, a mail thread, a transcript, "here's what they said on the call", a half-decision nobody wrote down. Files it into the topic's dossier with provenance, flags contradictions with what is recorded, says whether the topic is ready to be specced. "Never writes specs itself."
  - `adr-write`: when a technical choice gets made that someone will argue about again ("we went with Postgres over Mongo", "we're dropping the queue", "let's use Fastify"). Drafts the record from what you say plus what the code and discovery notes show, then asks only what neither can answer. "This writes a record for a decision just taken; 'why did we do it this way?' about a past one is answered from the records that already exist, not by writing a new one."
  - `bdr-write`: when a product or business call gets made ("we're charging per seat, not per user", "we're not supporting self-hosting", "this launches to the agency segment first", "we decided to drop the free tier"). Drafts from what you say plus the product frame and discovery notes, then asks what neither can answer.
- Group 2 — Specifying a capability (`spec-update` is the one when work has already started; "going back to a spec mid-flight is normal, not a failure"):
  - `spec-specify`: when someone describes a feature/behaviour/something the product should do ("we need refunds", "users should be able to reset their password", "add a way to export bookings"). Turns it into that capability's living spec and goes straight into the clarify questions. "Reach for this before writing the code, not after it."
  - `spec-clarify`: right after a spec is drafted, or whenever one still has open questions ("let's clarify this spec", "answer the open questions before we plan it"). Asks one question at a time, each leading with a recommended answer accepted by saying yes; writes every answer into the spec — including a deliberate "decide that later", "which is an answer and gets recorded as one. Planning and building refuse to start until this reaches zero open questions."
  - `spec-impact`: before changing how something already works ("what breaks if we change the refund window?", "who else depends on this before I touch it?"). Finds everything the change ripples to across other capability specs, decision records and code.
  - `spec-update`: when behaviour is about to change and the spec must say how it works afterwards, before the code moves ("we're changing how cancellations work, spec it first", "this branch changes X, make the spec match"). "On a branch the spec is the target and the git diff is the delta; updates every affected spec, not only the one that came to mind."
- Group 3 — Planning and doing the work ("Everything these produce is deliberately temporary and removed when the work closes"):
  - `spec-plan`: when a spec is settled and the question is how to build it ("how would we do this?", "what is the approach?"). Produces the implementation plan; "refuses a spec that still has open questions rather than planning around them."
  - `spec-tasks`: once a plan exists ("break the plan into tasks", "what do we build first, and in what order?"). Groups tasks by requirement so each slice can be built and tested on its own, "with the tests the repo's testing decision calls for."
  - `spec-implement`: when tasks exist and it is time to build ("go ahead", "start on it", "implement this"). Executes in order, "tests before the code they cover, one phase at a time."
- Group 4 — Closing the work ("The step most loops skip"):
  - `spec-reconcile`: when a change is finished, before opening the PR ("I think that's done"). Makes spec, code and tests agree, "resolves any drift rather than merging around it, and deletes the plan and task scaffolding the work no longer needs."
  - `pre-pr-review`: before pushing a branch or opening a PR ("is this ready?", "can I push?"). Runs the repo's local checks, reads the diff as if someone else wrote it, fixes what it finds first. "A review after the push is a review of something already published."
  - `add-to-backlog`: when work surfaces that does not belong to this change (a bug mentioned in passing — "btw the export is broken", "we should fix that too", "park it", "not now but do not lose it"). Files one well-formed row with its source, the role that must act and what done looks like, ordered against what is already there, without interrupting. "This adds to the backlog and never reads it back: 'show me the backlog' is `show-backlog`."
- Group 5 — Running the cadence (optional; "a solo repo can run the whole loop above without ever opening a sprint"):
  - `sprint-open`: when a team picks up work for the next stretch ("let's start a sprint", "what are we doing this month", "pull the top three payment items into a sprint"). Creates the sprint with goal and agreed end date; moves chosen intents out of the backlog pool "so each one lives in exactly one place." Also owns reading an open sprint back as a status board ("how is the dispatch sprint going?") and mid-sprint edits (moving a status, reassigning a holder).
  - `sprint-close`: when a stretch ends ("close the sprint", "the sprint is over", "we shipped what we were going to"). Checks each intent against its definition of done, returns unfinished work to the backlog, "records the one measurement of the sprint that cannot be recovered afterwards."
  - `timeline-update`: when someone asks when work will land ("when does billing ship?", "are we on track?", "what does the next quarter look like?", "update the timeline"). Reads every sprint, derives throughput from closed ones, projects open sprints and backlog — "labelling every number as measured or estimated, and giving no date at all when the evidence supports none."
- Group 6 — Seeing where things stand ("Nothing here writes anything"):
  - `show-backlog`: when someone asks what the work state IS ("show me the backlog", "what is in the pool", "what are we working on", "where do things stand", "what is left" — in whatever language). Builds the repository's dashboard and hands back the page and headline numbers "instead of retyping the backlog file into chat. Filing new work is not this - `add-to-backlog` owns that."
- Group 7 — Staying on the standard:
  - `update-to-latest`: when someone wants a newer version of the standard ("update me to the latest", "bump the standard", "what changed since we adopted?"). "Applies only the delta between the tree this repo last aligned to and latest, adapted to this repo and preserving its recorded deviations - never a re-scaffold."
- Group 8 — Moving a repo onto the standard (never copied into an adopted repo):
  - `align-to-standards`: "The single entry point for moving any repo onto the standard." Opens with an intake (step 0): measure the repo's state, then one short question round (intent, technology + Layer 2 consent, appetite, plan-only vs execute); then routes by target state — empty repo → greenfield phase; existing unpinned repo → assessment-first onboarding; pinned repo → `update-to-latest` or a stack add — and reconciles the repo against the shipped tree in payoff-ordered waves until drift 0. "Never blind-copy; reconcile - copy-class artifacts land verbatim, merge/fill-class are adapted (the manifest's adapt classes)."
  - `record-run`: at the end of an `align-to-standards` run, success or failure — records the session as validation evidence for the human-prompting corpus (`prompts.md` + a scored `runs/*.json`). "One shape only, the full run fully anonymised, sent under the intake's adopt.evidence yes - the skill asks nothing at the close."
- Cross-references: `tools/skill-map.mjs`, `tree/claude-skills.md`, `self-verify`, all 21 shipped skills + 2 transition skills, `docs/ideas/`, adapt classes, `adopt.evidence` intake point, human-prompting corpus.

---

## docs/ecosystem.md — How it fits together

- Purpose: how the core and the stack repos relate, what a run looks like, how a new stack plugs in, how sites share one generator.
- Definitions & vocabulary (the navigation metaphor):
  - Core = "the navigation engine - it knows HOW to guide a repo (read the checklist, compare, propose waves, verify, count drift)".
  - Stack = "a map pack - it knows WHAT is true for one technology (the picks, the reference configs, the migration notes)".
  - "The engine never contains a street; the map never recalculates a route. Adding a technology means adding a map, never a second engine."
- Rules / normative statements:
  - "Officialdom is the registry: the router reads only `stacks.json`, so a stack is official exactly when the core lists it - wherever else lookalikes live."
  - "Everything starts from the core - one entry point, always".
  - Stack linkage "is discovery metadata, never a version requirement (ADR-022)".
  - Anti-explosion policy: "one stack per technology; variation is a profile or a subtractive adoption mode, never a sibling repo; a stack keeps a named owner and a live boot CI or is delisted."
  - Sites: "the generator lives in the core, and a repo describes its site as data (`site/site.config.json`: brand, top bar, page map) - one form, many sites, zero copied generators." A stack earns a site when its content justifies one; "until then GitHub renders its markdown just fine."
- Facts (the pieces):
  - `repository-standards` (github.com/repository-standards/core): the engine and methodology (Layer 1) — carries `SPEC.md` (the numbered rules), the shipped tree (`standard/`), the align router and its phases, `self-verify`, the stack registry (`stacks.json`).
  - `repository-standards/node` (github.com/repository-standards/node): a map pack (Layer 2, Node/TS) — carries `stack.manifest.json` (what compliant means), `DECISIONS.md` (why), `starter/` (the working reference), `ADAPTING.md` (how to migrate from theirs to ours).
- Procedures — what a run looks like:
  - **Greenfield with a stack** ("greenfield with node"): router runs the greenfield interview (product, personas, first records), degits the stack's `starter/`, copies `stack.manifest.json` in. "Born aligned to both layers."
  - **Brownfield**: router detects the technology from the repo's own evidence (`package.json`, `pyproject.toml`, ...), offers the registered practices, then walks the repo there in waves — (1) protection first (supply-chain policy, pins), (2) code-shaping (lint, strictness), (3) proof (test tiers), (4) automation (CI). "Every conflict resolves through the stack's `ADAPTING.md`; every wave closes with the repo's own build green."
  - **No registered stack for your technology**: router says so plainly, offers a researched best-practices document shaped like the node `DECISIONS` (dated, sourced) as the repo's own record, then offers — with consent — to file a **stack request** issue on the core repo so demand is counted (ADR-021). Layer 1 continues unchanged.
  - **Ever after**: the adopted repo carries both manifests; `self-verify` reports one drift number across both layers. "Drift 0 means aligned - to the method and to the stack."
- Procedure — plugging a new stack in ("four data files and a heartbeat - no procedures, no engine"):
  1. `stack.manifest.json` — the core manifest's schema plus `technology` and the core it belongs to (`registry` pointer).
  2. `DECISIONS.md` — per axis: the pick, a short why, the escape hatch.
  3. `starter/` — a working, boot-verified reference; "its CI keeps the claim a pulse, not a plaque."
  4. `ADAPTING.md` — per-entry migration notes: the target repo already has something in this spot; how to get from theirs to ours without breaking their build.
  5. Then one line in the core's `stacks.json` — the owner merges it, and the router starts offering the stack.
- Sites: every repo may carry its own site (landing + docs, own scope: core sells the method; a stack sells its picks and starter); the top-bar switcher spans them all; with the org's path model each site lands at its own path under one domain.
- Anti-pattern named: a "generator graveyard" (prevented by the one-stack-per-technology policy).
- Cross-references: ADR-021, ADR-022; `stacks.json`, `SPEC.md`, `self-verify`, `site/site.config.json`, `stack.manifest.json`, `DECISIONS.md`, `starter/`, `ADAPTING.md`.

---

## docs/faq.md — FAQ - the questions every adopter asks

- Purpose: "the middle of the funnel: the landing page hooks, the FAQ unblocks, the docs teach." Short answers first, links to the long version.
- **Q: Which model should drive the transition?** The strongest you have, at the highest thinking setting — fewer iterations, fewer errors. "The judgment gates (decisions, spec-depth calls) are where model quality shows." Details: `method/adoption.md` (which model).
- **Q: I only have a weaker model. Can it do this?** Yes. The process is **re-runnable and lossless**: align resumes from measurement (`self-verify`), what is done stays done, every pass improves the repo. A weaker model needs more passes and more attention at the judgment gates, but finishes. "The falling drift number is your progress bar."
- **Q: My repo is years old and messy. Is it too late?** No — brownfield is a first-class path: `assess -> align -> onboard`, in prioritized waves, re-entered as many times as needed. "A multi-year repo is not aligned in one PR *by design*." Start: `method/adoption.md`.
- **Q: Do I need Jira or a paid tracker?** "No, and since 2026-08-02 you may not need a tracker at all." Three postures:
  - **A tracker, bridged**: GitHub Issues by default (free, unlimited); Jira and Linear plug in as adapters behind the same one-way bridge. The repo holds intents, the tracker holds execution history (ADR-010).
  - **In-repo, complete**: the pool, work sprints per team running in parallel, the person currently holding each item, blocking references, and a timeline that projects from measured throughput rather than estimates — all in markdown, all guarded (ADR-028, ADR-029, ADR-030). "A team that picks this needs no board and no wiki."
  - **Both** (common): the repo for what is true, the tracker for what management already reads.
  - What in-repo deliberately does **not** give: history of who held an item before, per-person throughput, burndown charts, time tracking — "Those are a tracker's job and the records say so rather than implying we forgot them." Use a tracker via the adapters if needed.
- **Q: I'm a solo developer. Isn't this enterprise ceremony?** Adopt the **core profile**: what keeps knowledge alive (specs, records, backlog, self-verify) without what carries it to people not in the room (contribution mechanics, UX research, work sprints). Size of the discount: "it is 9 manifest entries, not a different standard, and CI is **not** one of them - the spec-guard workflow is required at every profile (R16)." The flip to scale "is not a headcount: it is a flag plus the measured delta", firing when work is handed off asynchronously, when somebody contributes or reads status from outside the conversation, when there is a release audience that is not you, or when designing for users you are not (ADR-011, ADR-040). See `method/adoption.md` (profiles).
- **Q: What if I disagree with one of the standard's picks?** "Deviate deliberately: record a local superseding decision (ADR-004) and note the exception in the manifest so updates never silently overwrite it. The paved road is a default, not a cage."
- **Q: How is this different from Spec Kit, OpenSpec, BMAD, or Backstage?** They are spec-driven development frameworks, large and well maintained — as of 2026-08-02: Spec Kit 125k stars, OpenSpec 63k, BMAD 51k, all pushed to within days. "If what you want is a spec workflow, those are the answer and this is not competing for that." The difference is the unit: "**They standardise how a change gets specified. This standardises the repository**" — four things none does: records technical and business decisions; walks an undocumented repo into line with a standard rather than a workflow; the standard keeps moving and the repo trues up instead of adopting a workflow once; compliance is a number CI asserts.
  - "**Is the brownfield walk unique? No - and it is still one of the best reasons to use this.**" OpenSpec's stated philosophy is "built for brownfield not just greenfield", so "we work on existing repos" is not on its own an answer to "why you". What differs is where the walk ends: here, a living standard the repo keeps trueing up to, decisions recorded as ADRs/BDRs, capabilities specced, the remainder queued as a backlog, distance reported as a number; elsewhere it ends with a spec workflow adopted. "the destination is the differentiator, not the fact of walking."
  - Provenance: "The spec flow began as Spec Kit (MIT, provenance kept) and is now the standard's own extracted engine - upstream improvements are cherry-picked at release (ADR-015)."
- **Q: What about ProductSpec?** "The closest neighbour, and worth a straight answer rather than a dismissal." ProductSpec (github.com/gokulrajaram/ProductSpec) is "an open standard for software intent in the AI agent era": a schema-validated document format with a parser, CLI, GitHub Action, MCP server and agent skills; reaches further than a spec format — decision traces, reconciliation, repo health. Difference: "**ProductSpec standardises the intent document and validates it against a schema.** This standardises the *repository*" — what a repo must contain, how an existing one is walked into shape, what compliance means as a number — "with prose specs held true by guards rather than by a schema." If you want a portable machine-checkable intent format that travels between tools, ProductSpec is the more direct answer "and this is the wrong project to bend into that shape"; if a whole repository has no decisions recorded, no adopted conventions and no way to tell drift, "that is this one." Not mutually exclusive; nothing here is borrowed from it; "named because a reader deserves to find it from us rather than discover we omitted it."
- **Q: How do I know it worked?** `node scripts/self-verify.mjs` — compliance is a number, asserted in CI, against the manifest for the state recorded in `.standards-version`. When the standard moves, `update-to-latest` applies the delta and self-verify proves it again.
- **Q: What does drift 0 actually certify?** "Structure, not judgment." It checks that the recorded alignment state is well-formed and consistent with the manifest, that every required file and required heading is present, and that the shipped static guards exit zero. It does **not** check that your specs are good, that the decisions you should have recorded were recorded, or that a port of the skills to a non-Claude agent is faithful — those sit in the judgment tier, confirmed at review (`method/self-verify.md` draws the line). "Drift 0 is the floor. A repo can be drift 0 and still sloppy; it cannot be drift 0 and structurally missing the things the standard is built on."
- **Q: Who is using this?** "No public adopter yet - and that is the honest answer rather than a modest one." Mechanics were run on the author's own private repos; no named repo to inspect, no measured before/after; the project's own `backlog.md` carries "an adoption you can point at" as open work. The standard is on its first stable release line, tagged since 1.0.0 — everything before that resolved to the default branch. What can be checked today: "every guard in this repo is dependency-free, runs in CI on every pull request, and you can run all of it yourself in a clone before deciding anything. Adopt the mechanism because it holds when you test it, not because of a logo."
- Cross-references: ADR-004, ADR-010, ADR-011, ADR-015, ADR-028, ADR-029, ADR-030, ADR-040, R16; `scripts/self-verify.mjs`, `.standards-version`, `update-to-latest`, spec-guard workflow, `method/adoption.md`, `method/self-verify.md`, `backlog.md`; neighbours Spec Kit, OpenSpec, BMAD, Backstage, ProductSpec.

---

## docs/case-studies/README.md — Case studies - patterns and antipatterns, earned in the field

- Purpose: the *evidence* layer — real situations from production repos (anonymized), each distilled to the pattern/antipattern it proves and the rule the standard carries because of it. "when a rule in this standard feels arbitrary, the case that earned it should be here."
- Rules / normative statements:
  - **One file per case.** Shape: *Situation -> What happened -> The pattern / antipattern -> What the standard does about it -> Where it lives now (links)*. "Keep it under a page; the value is the distillation, not the war story."
  - **Anonymize hard.** Describe the *kind* of product ("an internal console at a property group", "a hospitality booking product") — never the name. "If a case cannot be told without identifying someone, it is not told." "no company or repository names, ever".
  - **Only cases that earn a rule.** "A story that does not end in a rule, a guard, or a record is a blog post, not a case study."
  - **Written when the lesson lands** — a case is added in the same PR that adds/changes the rule it justifies, and linked from that rule's home (README, ADR, or catalog row).
- Contents table (Case | Kind | One-liner):
  - `the-silently-skipped-clarify.md` — antipattern — a spec reached plan/tasks with open decisions because a loop step relied on being remembered.
  - `proposed-does-not-mean-maybe.md` — antipattern — a speculative direction was minted as `Proposed` records, making the decision log lie.
  - `enabling-work-out-of-the-spec.md` — pattern — an external IT dependency encoded in front-matter, mirrored as a blocking tracker Story.
  - `stacked-prs-on-a-moving-base.md` — antipattern — PRs stacked on feature branches "merged" into dead bases and dropped work.
  - `parallel-record-minting.md` — antipattern — two branches minted the same record number; the collision surfaced at review.

---

## docs/case-studies/enabling-work-out-of-the-spec.md — Enabling work, out of the spec (pattern)

- What happened: enterprise SSO slice in an internal console; before anything could be built, IT had to register the identity-provider application — a ticket to another team with lead time, blocking the first user story.
- The good version: the dependency was **not** written into the spec prose ("a spec describes the capability's behavior, and 'ask IT for an app registration' is not behavior; once satisfied it would be a fossil nobody should read"). It was encoded as a front-matter key (`needs_decision_records`-style) on the slice; the git -> tracker bridge emitted it as a **Story that blocks the affected user story**; someone picked it up in the tracker; when satisfied, the key was cleaned; "the spec never knew."
- The pattern: "*Enabling work is tracker-shaped, not spec-shaped.*" Tokens, access requests, agreements, data hand-offs gate development but are not part of the capability's truth. Front-matter -> tracker (blocking) -> cleanup keeps three honest places: the spec (behavior), the tracker (work state), git (history).
- Rule that came out: ADR-010 makes it the rule — enabling/organizational tasks go front-matter -> tracker as blocking Stories; spec prose never mentions them; the close/cleanup step removes satisfied keys.
- Where it lives: ADR-010 (phase 3), the capability spec template's Status note, ways-of-working "Status & close".

---

## docs/case-studies/parallel-record-minting.md — Parallel record minting (antipattern)

- What happened: two fast-moving branches in one repo, both recording decisions as they went; each minted the next free record number — the same one. A business-decision record numbered on one branch collided with a different decision carrying the same number already merged on `main`. Surfaced at review; fix was a renumbering commit and a re-read of every reference to the old number.
- The antipattern: "*Minting identifiers off a stale view.*" Root cause: record numbers are global, gapless, never reused — "which means the only safe moment to claim one is against current `main`, not against however old your branch is."
- Rules / mechanisms that came out: the records README states the discipline (gapless, never reused, check `main` before minting); the record index in each stream's README makes the current highwater number one glance away; "review treats a number collision as a blocker, not a nit."
- Where it lives: `decision-records/README.md` + the per-stream index (`adr/README.md`, `bdr/README.md`).

---

## docs/case-studies/proposed-does-not-mean-maybe.md — "Proposed" does not mean "maybe" (antipattern)

- What happened: a personal-brand SaaS in early product discovery; a whole go-to-market direction on the table (how selling would work, a template marketplace, a membership module) — "Exciting, plausible, and **undecided**." It got written up as ADRs and BDRs with status `Proposed`.
- Root cause: in MADR, `Proposed` means *a decision awaiting ratification*, not *an idea we might pursue*. The decision log implied forks had been reached and taken when nobody had decided anything; later readers would inherit commitments never made.
- The antipattern: "*Dressing speculation as records.*" It pollutes the decision log's one job — "being an honest ledger of forks actually taken" — "and it is worse than writing nothing, because it carries false authority."
- Mechanism that came out: a first-class **ideas space** (`docs/ideas/<slug>.md`) where a maybe is explored end-to-end (business and technical shape included) with its own statuses `idea -> exploring -> approved | parked | dropped`. "**No ADR/BDR/spec is minted until the idea is approved**; on approval it *graduates* into the normal flow and the idea doc links what it became."
- Where it lives: `standard/docs/ideas/` (page `tree/docs-ideas.md`), the taxonomy's "Ideas / discovery before a decision" section, ADR-010 (the lifecycle), the records README rule "not a record until approved".

---

## docs/case-studies/stacked-prs-on-a-moving-base.md — Stacked PRs on a moving base (antipattern)

- What happened: this very repository, mid-buildout; several substantial PRs in flight (an align-engine, an adoption checkmap, a modernize skill), each building on the previous one's branch "to save time". Branch B cut from A, C from B. When A was rebase-merged, B and C pointed at a base that no longer existed as history; they "merged" into dead bases; the rebase-merge dropped the children's commits from the mainline. "Three PRs' worth of work silently vanished from `main` and had to be recovered by hand into fresh PRs."
- The antipattern: "*Stacking on a moving base*" — basing work on a branch that will be rewritten (rebase- or squash-merged) instead of on `main`. "It looks efficient exactly until the parent lands."
- Rule that came out: a normative rule — "**base every PR on `main`**". When work genuinely must build on unmerged work: land the parent first, or carry the whole sequence in one PR as ordered commits ("the owner's preferred shape") — "never a chain of open PRs on each other's branches."
- Where it lives: R23 in `standard/SPEC.md`, mechanics in `standard/docs/conventions.md` (Branch and history), reasoning in ADR-026 — "so an adopting repo receives it, which it did not while the rule sat in this repo's own `CONTRIBUTING.md`. This repo's own history is the receipt."

---

## docs/case-studies/the-silently-skipped-clarify.md — The silently skipped clarify (antipattern)

- What happened: an internal console at a property group running spec-driven development with an agent: specify -> clarify -> plan -> tasks, mirrored one-way into a paid tracker. A slice went specify -> plan -> tasks with clarify never run; nobody noticed "because running it depended on someone *remembering* a command." Open decisions sat unresolved inside a spec that looked finished, on their way to a developer as "ready".
- The antipattern: "*Process by memory*: any loop step that fires only when a human recalls its name will be skipped, and the artifacts downstream will look done while carrying the gap. The user cannot be blamed - they never knew the step existed."
- Mechanism that came out: the loop is **AI-led and gated in layers** — five of them: (1) a skill-level precheck, (2) the gate script, (3) the policy doc that states the rule, (4) loaded context, (5) a script-level bridge precondition. Clarify chains automatically after specify; plan/tasks/mirror are mechanically blocked unless the spec has a `## Clarifications` section and zero open `[NEEDS CLARIFICATION]`; "the gate is what earns `Status: ready-to-develop`."
- Caveat stated: "None of the five is a Claude Code `hooks/`-mechanism hook - this repo's three shipped hooks guard unrelated risky Bash commands, and 'does a skill cover this request' is a judgment call no hook can make."
- Where it lives: `standard/specs/README.md` ("Make the loop self-triggering"), `standard/specs/enforcement.md` (the clarify gate, and the scripts that call it as a bridge precondition), ADR-010, the "loop runs itself" section of the AGENTS template.

---

## docs/ideas/README.md — Ideas

- Purpose: the space for things that might be worth building and are not decided.
- Rules / normative statements:
  - "**No records, no specs, no backlog items** until one is approved" — "a `Proposed` decision record means 'a fork awaiting ratification', not 'something we might do', and dressing speculation as a record implies a choice was made when none was." (same as case study proposed-does-not-mean-maybe)
  - Each idea lives in one file and carries its whole shape: the itch, who it serves, a provisional technical and business sketch, the unknowns that decide it. "Speculation is welcome there and nowhere else."
  - Statuses: `idea` → `exploring` → `approved` | `parked` | `dropped`. An approved idea **graduates** into the normal flow (a backlog intent, then a spec, then records) and its file flips to `graduated` with links.
  - "Parked and dropped files stay: the reason something was not built is worth more than the absence of a file, and the next person to have the same thought finds out what happened rather than starting over."
  - **The index moved**: every idea is a `type: idea` row in `backlog.md` (ADR-046), so the dashboard's Backlog tab shows it alongside build work and open questions; the `backlog.md` row links back to the idea's file for the whole shape.
- Cross-references: ADR-046, `backlog.md`, `docs/ideas/<slug>.md`, `idea-write`.

---

## docs/ideas/capability-stacks.md — Capability stacks - a layer that crosses technologies

- Status: **idea** | Date: 2026-08-03 | Owner: bodurkalukasz.
- The itch: the ecosystem has two layers (a method saying nothing about technology; a stack per technology saying everything about one). Web end-to-end testing fits neither: driving a browser is not a Node concern — Playwright talks to Chromium the same way whether the server is Node, Python, Go or Rust (the journeys, selector policy, trace and artifact handling, flake policy, the CI shape that boots an app and points a browser at it). Decided once, reused everywhere, "and today it lives inside the Node stack because that is where it was first needed." A Python team would either rewrite those decisions or read a Node repository for them — "Both are the failure this project exists to prevent, one layer up."
- What is technology-independent (table; "treating [testing] as one thing is how this idea would get built wrong"):
  - How much to test, and where each tier runs → **the method** (already a fork in the decision checklist) — a question every repository answers in the same words.
  - The runner, assertions, fixtures, CI wiring → **the technology stack** — "Vitest, pytest and `go test` are not variations of one thing".
  - Driving a browser end to end → **neither, today** — identical across server technologies, currently duplicated into whichever stack needs it first. This third row is the idea. Other candidates with the same shape: accessibility auditing, performance budgets, visual regression — "decided against a browser and a user, not against a runtime."
- For whom: the **consultant rolling this out** across teams that do not share a language; the **developer** on a stack that does not exist yet ("today they get 'no stack for Python' when most of what they need was never about Python").
- Provisional shape: a third kind of repository, `repository-standards/web-e2e`, adopted **alongside** a technology stack rather than instead of one; same manifest schema, same drift number; a repository would carry the method, its technology stack, and any capability stacks that apply. The registry would need a second list or an entry kind — "it currently says one stack per technology, which is exactly the rule that has no room for this."
- Open questions:
  - Who owns a file two stacks both want? `playwright.config.ts` is in the Node stack's manifest today; if a capability stack claims it, the technology stack has to stop, and the coupling must be expressed somewhere "or an adopter gets two entries for one path and a drift number that double-counts."
  - Does it survive its own generalisation? The Node stack's e2e journeys are sign-up and dashboard (specific to an app with authentication); what remains after removing app-specific parts "might be a config file and a policy, which is a document rather than a stack."
  - Is one example enough to generalise from? "The honest test is a second technology stack existing and needing the same thing; until then, moving it is speculative and leaving it in Node costs nothing."
  - Would the ecosystem read as three layers or as a pile? "Two layers are explainable in a sentence. A third that applies sometimes may cost more in comprehension than it saves in duplication."
- Graduation (unfilled template): Backlog intent `<id>` - spec `specs/<capability>/` - records `<ADR/BDR ids or "none">`.

---

## docs/ideas/dashboard-cross-repo-switcher.md — A switcher between a repository's dashboard and the stacks it pairs with

- Status: **approved** | Date: 2026-09-03 | Owner: bodurkalukasz.
- The itch: the docs site already answers "I'm reading the core, where's the Node stack's docs" with a "Repository Standards ▾" switcher in the header — core is "here", Node one click away (ADR-031). The dashboard had no equivalent: a viewer on core's dashboard (backlog, specs, changelog, documents) had no path to Node's dashboard short of knowing its URL, and the reverse.
- For whom: the **maintainer or a curious adopter** comparing where core and a stack each stand (drift, open backlog, changelog) without switching tabs to a URL they'd have to know.
- Provisional shape: a header control on the dashboard, same idea as the docs switcher; core default, other stacks (starting with Node) one click away. "Not proposing an aggregated, cross-repo dashboard - just a link between each repository's own."
- Open questions (first resolved by the implementation; second a conscious, tracked gap):
  - ~~The dashboard has no cross-repo notion today.~~ **Resolved.** `pages.yml` now builds every registered stack's dashboard into the same aggregate deployment it already builds landing and docs into (`site/<tech>/dashboard/`), passing `--registry stacks.json` to `generate-dashboard/index.mjs`. The generator reads the registry, marks the surface whose git remote matches the running repo as "here", and hands `page.js` a `meta.switcher` list rendered as a dropdown — the same same-origin-path mechanism `tools/docsite.mjs` already uses for the landing/docs switcher, "not a second list or a cross-repo fetch." A standalone build (no `--registry` — every existing `dashboard.yml`, including the node stack's own) renders no switcher, "so no adopter's output changes."
  - **The dashboard still has no capability spec.** `standard/scripts/generate-dashboard/**` remains `$unclaimed` in `specs/capability-map.json`. The change went in directly — "the coupling guard does not block an unclaimed path, and the owner asked for the feature built rather than gated on process - so the debt is real, not closed: a future pass should run `spec-specify` for this capability and only then flip this row to `graduated`."
- Graduation: Backlog intent `DASHBOARD-SWITCHER-1` (this same row) - spec: none yet, capability remains `$unclaimed` - records: none new, "extends the pattern already decided in ADR-031 rather than making a new decision."
- Cross-references: ADR-031, `pages.yml`, `dashboard.yml`, `generate-dashboard/index.mjs`, `page.js`, `tools/docsite.mjs`, `stacks.json`, `specs/capability-map.json`, `spec-specify`, coupling guard.

---

## docs/ideas/hermes-inspired-patterns.md — Patterns worth adopting from Hermes Agent

- Status: **idea** | Date: 2026-08-18 | Owner: bodurkalukasz.
- The itch: a comparison against NousResearch/hermes-agent (a real, shipping AI agent with persistent memory and self-authored skills) found most of what it does — skill libraries, decision provenance, drift-style reconciliation — "is already built here, usually more rigorously (measured, gated, precedence-ordered rather than a free 'confidence' field nobody enforces)." Two mechanisms in its actual source (not marketing) are not yet answered here and are concretely useful:
  - `cron/suggestions.py` — a usage-triggered, consent-gated, dedup-latched suggestion: the agent notices a recurring ask, proposes turning it into something durable, never acts without an explicit yes, never re-nags a dismissal.
  - `agent/curator.py` — a background pass, triggered by inactivity, that consolidates or archives only what an *agent itself* created, never anything the user authored, and never deletes — only archives.
- For whom: **Standard-bearer Staszek** — the recurring-work-to-skill question (`STACK-LIFE-1`) is his (he would otherwise notice a pattern by hand and decide whether it is worth a skill). **Coding agent** advances too: "a shape for the agent's own housekeeping, not a product feature end users see."
- Provisional shape (Pattern | What it would bring | Effort, cold start, S/M/L per ADR-029):
  - **A - usage-triggered skill suggestion**: answers `STACK-LIFE-1` ("does a stack's recurring work have a home") without inventing one from a single observed case (which the backlog item itself flags as armchair design). The loop counts it: same shape of request N times, in `record-run`'s or `align-to-standards`' own evidence, surfaces a proposal naming its source, and a dismissal is remembered so it never asks twice. "Raises the evidence bar `STACK-LIFE-1` is explicitly gated on." Effort **M** — not new infrastructure: `record-run` and the human-prompting corpus already capture per-run evidence; adds a dedup-keyed proposal step and a place to file the yes/no; "Bounded mainly by deciding what counts as 'recurring' without a second corpus to maintain."
  - **B - agent-scoped archive-only curation**: a narrower, explicit restatement of a rule already held (ADR-051: closing a backlog row relocates, never deletes) scoped one level deeper: "anything an *automated pass* tidies must be content that pass itself produced (e.g. its own stale discovery entries, superseded skill drafts), never anything a human wrote, and archive is the only destructive-looking verb available to it." Worth writing down before any automated cleanup exists, "not after one overreaches." Effort **S** — a principle to record (a rule, maybe folded into ADR-051 or its own short ADR), not a system; the backlog item is "decide and write the rule".
  - Both are patterns to fold into this project's own mechanisms: Pattern A extends `STACK-LIFE-1`'s evidence gate rather than replacing it; Pattern B is a scoping rule for automated tidying. "Neither implies new tooling by itself; sizes above are cold-start (ADR-029) and will be wrong until something in this shape actually gets built once."
- Open questions:
  - Does Pattern A duplicate `STACK-LIFE-1`, or complete it? `STACK-LIFE-1` is gated on `STACK-ALIGN-1` (the Layer 2 path has never executed on a real repo) "precisely because inventing skills from zero observed runs is armchair design." Pattern A is a candidate *mechanism* for the evidence-gathering `STACK-LIFE-1` waits on — approving it "might just mean folding it into that backlog row rather than shipping it standalone."
  - Where would Pattern B's rule live? A clause in ADR-051, its own ADR, or deferred until an automated cleanup tool is proposed and needs the boundary stated for real.
  - Is "recurring" measurable from what `record-run` already captures, or does Pattern A need its own counting field the corpus lacks?
- Graduation (unfilled template): Backlog intent `<id>` - spec `specs/<capability>/` - records `<ADR/BDR ids or "none">`.
- Cross-references: ADR-029, ADR-051, `STACK-LIFE-1`, `STACK-ALIGN-1`, `record-run`, `align-to-standards`, human-prompting corpus, personas Staszek and Coding agent.

---

## docs/open-questions/README.md — Open questions - decided, provisionally

- Purpose: index/front door for the owner's provisional calls — each "a call the owner made on judgment, at the simplicity-vs-universality boundary - good enough to ship, honestly held, and **actively open to a better answer**."
- Definitions & vocabulary:
  - "This is not indecision: each has a decision in force (linked). It is an invitation: argue a better option in an issue or PR referencing the entry."
  - Difference from neighbours: "an **ADR** records a fork taken; an **idea** is a feature that may never ship; an open question is a standing 'I chose X, convince me of Y'."
- Rules / normative statements:
  - "A winning challenge lands as a superseding record or rule change, and the resolved entry is deleted - the resolution lives in the record that settled it."
  - One file per topic; entries with real deliberation history keep it in an **Options weighed** section "for the future maintainer who would otherwise re-derive it."
  - History: "This was one flat file until it outgrew itself - as its own meta entry predicted it would."
  - **The index moved**: every topic is a `type: open-question` row in `backlog.md` (ADR-046); each row states the decision in force (or that there is none) and the doubt in one line, linking back to the topic file; "this folder still carries the deliberation, `backlog.md` carries the listing."
  - Front door for new maintainers: "A single author decided every entry above, which is the honest weakness of this project. Winning a challenge here is the most valuable contribution it takes - more than a feature, because a rule this project got wrong propagates into every repo that adopts it."
  - "You do not need to have used the standard to argue one." Bring evidence from how you actually work: "'we ran the other way for two years and here is what broke' ends an argument that abstract reasoning cannot."
  - Technology expertise belongs elsewhere: "Layer 1 is stack-agnostic by rule, so a TypeScript or Node opinion cannot land here no matter how right it is." It lands in `repository-standards/node` (owns its own picks and doubts); same for any future stack — one repo per technology.
- Cross-references: ADR-046, `backlog.md`, `repository-standards/node`.

---

## docs/open-questions/authoring-skills.md — How many skills co-author a document, and whether they are worth the ceiling

- Decision in force (2026-08-02): **one skill per document type** — `adr-write`, `bdr-write`, `product-write`, `personas-write`. Four descriptions each naming one situation, taking the shipped family from 15 to 19. All four shipped the same day; measured context cost 1,580 tokens for nineteen, against a prediction of about 1,490.
- How the answer changed: the entry first recommended two routing skills because `shipped-skills` put the ceiling at eight to ten (two cost less than four). That entry was revised: "the ceiling had no source, the parenthetical offered to support it named a collection shipping seventeen, and the context cost it feared measures at roughly 1,190 tokens for all fifteen - 0.6% of the window."
- The constraint that bites is **discriminability**, and it inverts the decision: `spec-specify` failed to fire on "we need refunds" at twelve skills and fires at fifteen, "because its description changed and nothing else did." Four sharp descriptions beat two covering two situations each — a routing `record-decision` must match both "we picked Postgres over Mongo yesterday" and "we decided to charge per seat", and "a description covering both is by construction vaguer than either alone." "The ceiling was pushing toward the design that fires less reliably."
- The doubt that remains: four sibling files can drift apart. This repo proved that "four times in one day with four copies of a command list - though those restated a single fact, so divergence was a defect by definition, while four question sets restate nothing and can differ legitimately. Weaker, not absent." Nothing checks it; mitigation: the four share one shape and get read together whenever one changes. Settled by "an actual divergence between two of them that turns out to be an oversight rather than a deliberate difference."
- Why anything is needed: the spec loop has six skills to produce one artifact; decisions, product frame and persona roster had templates and nothing that writes them *with* anyone — "when a form replaces a conversation: the sections get filled and the thinking does not." The elicitations differ:
  - An ADR wants: the forces that made this contestable, the options actually weighed and why the losers lost, the consequences someone will live with, how compliance is confirmed, what would reopen it.
  - A BDR wants: who it serves, what changes for them, what it costs, what we are deliberately not doing, how we would know we were wrong.
  - A product frame wants: the one sentence, the problem, the observable three-month outcome, the non-goals ("the question nobody answers unprompted").
  - A persona roster wants: jobs to be done, pains, anti-goals, which one wins ties.
  - "Hand all four the same eight prompts and you get a BDR that reads like an ADR with the wrong nouns."
- Options weighed:
  - **A - One skill per document type** — cleanest triggering ("a description is the only text a request is matched against"); cost: 19 shipped skills, about 300 tokens more context (measured), four files that can drift. **Chosen**, once the ceiling stopped being the deciding constraint.
  - **B - Two skills, routing inside** (was recommended, now rejected): `record-decision` asks the who-would-overrule question first then runs the right elicitation; `author-product` treats product frame and roster as one conversation (greenfield already runs them together; splitting asks the same person the same thing twice). Cost: two descriptions covering two situations each without becoming vague — "exactly the failure the description rewrite just fixed elsewhere." Once the ceiling did not bind, "this option was buying a worse trigger surface to save 300 tokens."
  - **C - No new skills; elicitation in the templates**: zero ceiling cost, where guidance lives today. Rejected on evidence: the audit still found the flow asking cold, "because a template is read by whoever already opened it - it cannot ask a question, and it cannot notice the user is agreeing with the worked example instead of describing their own product."
  - **D - One `author` skill for everything**, routing by artifact: "a description so broad it matches everything and therefore nothing usefully" — the same failure as `spec-specify` reading "create or update a capability spec".
- What settled it: whether a routing description could fire reliably on both sentences was never answered directly, because the constraint that made routing attractive did not hold; the argument for A was already settled elsewhere — "a description that names one situation fires, a description that names two is vaguer than either."
- What would reopen it: "a real user's sentence matching the wrong one of the four, with the descriptions that did it" — needs a repo using them.
- Related: `shipped-skills` (revised: constraint is discriminability, not count); `AUTHORING-SKILLS-1` in `backlog.md` (the standing doubt, the only id this decision still has); the build rows it gated (`AUTHOR-1..4`) left at the 0.9.0 cut once all four skills shipped.

---

## docs/open-questions/case-anonymization.md — Case-study anonymization at kind-of-product granularity

- Decided: describe the situation, never the company or the repo.
- Doubt: "the line between useful context and identifiable is judgment per case, unwritten."
- A better answer would: "a two-rule test a contributor can apply without asking."
- Cross-references: case-studies/README.md (same anonymization rule).

---

## docs/open-questions/checklist-name.md — checklist.md as the decisions-to-make name

- Decided: `checklist.md` (was `catalog.md` — "the library sense of 'catalog' belongs to the record indexes"). Now at `docs/method/checklist.md` since the method manual got one home (ADR-023).
- Doubt: "checklist" undersells that each row carries a paved-road default; alternatives were `forks.md` and `decide.md`.
- A better answer would: "a name that says 'choices you must consciously make, defaults included' in one word."
- Cross-references: ADR-023, `docs/method/checklist.md`.

---

## docs/open-questions/conformance-is-a-degree.md — Is conformance a threshold, or a percentage?

- Status: **open** | Opened: 2026-08-03.
- The question: the spec is written in MUST and SHOULD (reads as a threshold: conforms or not); the tooling says otherwise — `self-verify` reports **drift as a number**, the manifest marks entries `required` or not, profiles say not everything applies to everyone. "If the honest answer is 'nothing is universally required, a repository is some percentage adapted', then the MUST language is describing a bar that does not exist."
- Why it is not obvious:
  - The percentage needs a denominator, and has one: `self-verify` now reports **adoption beside drift** — adopted over applicable, where applicable is the manifest's own entry list. "the same file that says what ships says what counts." Open: whether the spec's MUST language should follow, or whether a threshold and a percentage are both worth having.
  - "A number without a bar does not act on anyone. 'You are at 62%' is a dashboard. 'This capability spec names no persona and the guard fails' is a change somebody makes." Individual items are binary even though the total is a count.
  - Degrees are already partly built (strongest argument the framing is out of date, not the mechanism): `core|scale` profiles, per-entry `required`, `adapt` classes of copy and merge, and R7 as it now stands — "decide the areas that apply, say so once for the areas that do not."
- What would settle it: "A repository adopting partially on purpose, and reporting whether the number or the failures is what actually changed their behaviour. If it is the number, the threshold framing is ceremony. If it is the failures, the percentage is a summary of them and not a replacement."
- Related: ADR-011 (profiles — first admission not everything applies to everyone); ADR-025 (latest is the only target, "which already removed one kind of threshold").
- Cross-references: R7, `self-verify`, manifest `required`, adapt classes.

---

## docs/open-questions/default-tracker.md — GitHub Issues as the default tracker

- Decided: ADR-010 — free and unlimited wins for the default; Jira and Linear as adapters behind one one-way bridge.
- Doubt: GitHub Issues is the weakest PO experience of the three; Linear's free cap (250 active issues) may bite mid-project; the bridge convention is field-proven against Jira only.
- A better answer would: evidence from a second bridge implementation, or a default that serves POs better at zero cost.
- Cross-references: ADR-010; faq.md tracker answer (same as faq).

---

## docs/open-questions/docs-funnel.md — One source, two surfaces

- Decided: the human docs site renders from the same md agents read; "no separately authored documentation, ever."
- Doubt: folder READMEs written for in-place reading may not sequence into a nextjs.org/docs-style learning path without glue.
- A better answer would: an IA that reuses the files verbatim and still teaches in order — or honest evidence that a thin authored overlay is unavoidable.

---

## docs/open-questions/engine-cherry-pick.md — Engine improvements are cherry-picked by hand (ADR-015)

- Decided: the five engine prompts (specify, clarify, plan, tasks, implement) are extracted as the standard's own skills; no byte-diffability with github/spec-kit; "sync means reading upstream's prompt changes at release time."
- Why: the vendored area cost a third of the repo's markdown, committed twice, for a surface the loop half-used — a 326-line script nothing invoked, ~600 lines of hook boilerplate scanning for a file that never shipped, two skill families competing for the same verbs.
- Options weighed: status quo vendoring (weight plus a hand-maintained 15-file render per sync); no vendoring at all, clients run upstream's CLI (re-creates what ADR-013 rejected: unpatched layouts, no gate, a Python toolchain at adoption, exposure to an upstream that ships ~10 releases per 8 days and has had one breaking change and one near-abandonment scare).
- Doubt: without a mechanical diff, the five prompts could quietly fall behind upstream's state of the art.
- A better answer would: a few release sprints proving the cherry-pick check stays cheap — or evidence it does not, "which reopens vendoring with better tooling."
- Cross-references: ADR-013, ADR-015; faq.md (Spec Kit provenance, same point).

---

## docs/open-questions/folder-readmes.md — Folder self-description - who says what, and where

- Decided (revised 2026-08-02): "the two describe different things, and only one of them is written by hand."
  - **The manifest says what a thing is and why it exists** — every entry carries a purpose, an adapt class, a profile and the rule it enforces; `self-verify` reads exactly that data to decide compliance.
  - **`docs/file-map.md` is generated from it**, so a one-page view cannot disagree with what it describes; `tools/file-map.mjs --check` fails CI on a stale copy.
  - **A folder's `README.md` carries only the local editorial rule** — "*what goes in here, what does not, and the trap specific to this folder.* Short. It must not restate what the map says."
- Why not one or the other: the original entry chose per-folder READMEs and named the doubt (bloat; one file serving two audiences serves neither). Both halves were true; resolution: "two questions wearing one name":
  - **Orientation** (what is this folder) wants one page readable end to end and comparable; a per-folder README is the worst shape — "N clicks, no comparison, and N places for the same sentence to drift."
  - **The local rule** (does my new file belong here) is needed when someone is adding a file — in the folder, not on a docs site; "A central page cannot reach them there."
  - Splitting by *question* rather than *audience* removes the redundancy: "neither file says what the other says."
- Where an agent reaches this (decides what "explain it more thoroughly in the documentation" is allowed to mean):
  - "The rendered docs site is gitignored." `site/docs/` does not exist in a clone; an agent never sees it. "Anything an agent must know has to be **markdown in the repo**, or it may as well not exist."
  - `docs/file-map.md` is markdown; `AGENTS.md` links it **directly**, not only via the docs hub — "one hop, because two is one too many for the file that exists to orient someone who is lost."
  - A folder README needs no pointer; an agent inside a directory already has it — "the cheapest context available."
- What this cost: the manifest data is now load-bearing for readers; generating the page "immediately exposed pinning language in four manifest purposes that a same-day sweep of the prose had missed - an argument for the derived view, and a warning that the manifest is now prose people read."
- The doubt that survives: "Nothing checks that a folder README stays inside its lane" — a future author explaining *what a folder is* recreates the duplication and no guard notices ("A guard would have to judge what a paragraph is about"); held by review. And "an adopted repo gets no map at all" — `MAP-1` in `backlog.md`: the generator is zone 1 only because that is where it was written.
- Cross-references: `docs/file-map.md`, `tools/file-map.mjs`, `standard.manifest.json`, `AGENTS.md`, `MAP-1`; docs/README.md (same generated-file-map point).

---

## docs/open-questions/genesis-history.md — Genesis history for the org move

- Decided: if the repos move to the `repository-standards` org, they start clean-slate — no transfer of the build-era history and its 51 PRs. The genesis is a curated commit sequence in dependency order (spec -> entry -> records -> specs -> skills -> verify -> surface), each commit a chapter, with honest dates. The product's past lives in the CHANGELOG, which travels; the old repo stays as the owner's private archive.
- Why: "git is mechanics, the changelog is the history - the repo's own doctrine. A dependency-ordered sequence is also documentation an agent can walk: what stands on what."
- Options weighed: transferring full history (drags scaffolding-era noise into a repo that sells clarity); synthetic backdated history simulating an evolution that never happened ("theatre - order may be narrative, timestamps may not lie"); plain squash to one commit (loses the didactic sequence for free).
- The boundary that stays: rationale and considered alternatives live in records and in this catalog — never in PR comments or commit bodies alone. "R3 and ADR-012 bind the genesis too: knowledge existing only in a conversation does not exist." This catalog is itself the distillation of one such conversation, made durable before it expired.
- A better answer would: proof from executing it — a genesis sequence agents navigate better, or evidence nobody reads history and one commit would have done.
- Applied a second time, narrower (2026-08-10, cutting 0.9.0): the org-move pass rewrote everything up to 0.8.13 from scratch; this one touched only the 270 commits since: six existed solely to correct the commit immediately before them (three self-review follow-ups, three manifest-hash regenerations). Each was merged into the commit it corrected, taking that commit's tree and the later correcting commit's date; the other 264 keep their own words, order and dates. "No commit was reordered or re-narrated, and the resulting tree is byte-identical to the branch before the fold - only which commit a diff belongs to changed, never what the diff contains." Same doctrine at release-cut granularity.
- Applied a third time (2026-08-19, cutting 1.0.0): this pass changed bytes, deliberately, in one dimension: releases that had shipped as 1.0.0-1.0.13 and 1.1.0-1.1.25 were renumbered to 0.8.0-0.8.13 and 0.9.0-0.9.25 in every commit since the tree first shipped — version strings in blobs and commit messages, release-cut subjects, changelog headings, the manifest's own hashes recomputed where a hashed file's bytes moved. Reason: "the line was called 1.x before it had earned stability, and cutting a real 1.0.0 on top would have given one name to two different trees." Left untouched: external versions the standard merely cites (Conventional Commits 1.0.0, Keep a Changelog 1.1.2) and illustrative examples. Alongside: three more fixups folded under the second pass's rule, eight subjects given the Conventional Commits prefix they lacked (words kept), five commit references in documents re-pointed at the hashes the replay produced (two of which the second pass had already orphaned). "Order, authorship and dates are untouched everywhere: order may be narrative, timestamps may not lie."
- Cross-references: R3, ADR-012, CHANGELOG; version history 0.8.x / 0.9.x / 1.0.0.

---

## docs/open-questions/ideas-slugs.md — Ideas are slugs, not numbers

- Decided: `docs/ideas/<slug>.md` — "numbers are for records, and an idea must not look decided (ADR-010)."
- Doubt: referencing ideas in conversation is wordier than "IDEA-7", and renames break links.
- A better answer would: stable reference without the false authority of a record id.
- Cross-references: ADR-010; ideas/README.md.

---

## docs/open-questions/layers-beyond-technology.md — Whether a layer has to be a technology

- Decided: it does. R20 defines the second layer as "optional technology best practices living in per-technology stack repos"; ADR-016 makes each a satellite repo behind a registry; `stacks.json` states the policy — one stack repo per technology, named for the technology, variation expressed as a profile or an adoption mode inside the stack, never a sibling repo. Data shape agrees: the core manifest declares `layer: 1`; a stack manifest carries no layer at all — `technology` is the only field naming what it is.
- Doubt: the axis was fixed when the only second layer anyone wanted was Node/TS; a technology is not the only body of practice that is reusable, opinionated, and badly served by being flattened into Layer 1. Candidates the owner named on 2026-08-10:
  - **UX and product design** — the split already happened without being decided: Layer 1 took the half that produces documents (`docs/personas.md`, a journey template with stages and pains, a research template whose method row lists usability tests) and left out the half with tooling and gates (a design system as source of truth, Figma-to-code handoff, an accessibility baseline something could check). "The line between the two is 'does it render as markdown', which is not a principle anyone would defend out loud."
  - **QA as its own practice** — "already mislocated": no numbered rule in SPEC.md prescribes a test discipline; the only place testing is described is the node stack's manifest: `vitest.config.ts` (unit and integration as separate projects), `playwright.config.ts` (the e2e tier), `docker-compose.test.yml` (ephemeral real dependencies rather than mocks). The *tools* are Node's; the *discipline* (tiers, real dependencies over mocks, what each tier may assume) is not — a Python or Go repo cannot adopt it without a Python or Go stack existing first.
  - **The agent harness itself** — mislocated in the opposite direction: Layer 1 ships one vendor's product inside the layer that calls itself stack-agnostic: `standard/.claude/settings.json`, the guards in `standard/.claude/hooks/`, every shipped skill. "QA sits in Layer 2 wearing Node's clothes; the harness sits in Layer 1 wearing the method's."
  - **Security and compliance, data and analytics, operations** — each a practice teams run with artifacts a repo should carry; each has the same two options today: argue it into Layer 1 for everyone, or leave it out.
- The harness candidate splits three ways (sharpest evidence "one practice, one layer" may be too coarse):
  1. Doctrine, vendor-agnostic — `method/working-with-ai/` reads correctly next to the method and should not move.
  2. Repo-resident harness files — `.claude/` and its hooks: behaves like a stack's `files[]` entries; the only half a satellite could carry today.
  3. The developer's machine — no home in any layer: a context budget configured per person (auto-compact window, a cap on tool output, hooks that trim a command before it runs and save a handoff before a compact) lives in the user's own agent config outside every repository. "A manifest entry is a **path in the adopted repo**, so this half cannot be an entry, cannot be counted in drift, and would need a check that runs against a machine rather than a checkout - something the ecosystem has no concept of." UX and QA do not have this problem.
- What would have to move if the answer is "no":
  - **R20 and the registry key**: the rule names technology explicitly, `stacks.json` keys on `technology`, a stack manifest has no field for anything else. A practice layer needs a non-technology name and a registry that admits it.
  - **Precedence when two layers claim the same path** — and it is the same item as the drift number: the engine makes an explicit non-decision; `self-verify` warns that two manifests declare one path, checks it **once per declaration** ("so it counts twice"), and says the two owners disagree and should be told (`standard/scripts/self-verify.mjs`, ADR-037). Holds while a collision is a rare accident between two technologies; stops holding when practice layers are normal — a QA layer and a technology stack both owning part of `vitest.config.ts`, both officially — "so there is nobody to report to, and the number inflates by exactly the count of shared paths."
  - **The drift number**: one drift across both layers today. Three layers either stay one number (a UX gap indistinguishable from a missing CHANGELOG) or the number splits — "a change to the one metric the whole product reports." Whatever answers precedence answers this.
  - **Detection, which practice layers do not have**: brownfield *detects* technology from `package.json`, `pyproject.toml` then offers the stack (ecosystem.md). No file proves a repo "does UX"; nothing in a checkout says which harness its developers run. A practice layer can only be **chosen from a menu**; the router has no concept of a layer that must be offered rather than inferred — "a practice layer can sit in the registry and never be proposed to anybody."
  - **The bar for staying official**: today concrete — a working `starter/` with live boot CI, or delisted. A UX or harness layer has no boot to verify. Either each kind of layer states its own pulse (a guard suite that passes, an accessibility baseline that runs) "or the bar quietly does not apply to the new kinds, which is the failure the policy was written to prevent."
- On naming, if the answer is no: name a practice layer for the practice (`qa`, `ux`, `claude-code`). Two shapes floated 2026-08-10 rejected in writing "because both will be proposed again": an `ai-` prefix "carries no information in a product that is AI-first end to end"; `ways-of-working` is already the name of a Layer 1 document (`method/ways-of-working.md`).
- A better answer would: come from someone who runs one of these practices professionally saying what they would want carried in a repo. Two cheaper probes first: `STACKS-2` (a second technology stack) tests whether the seam is about technology or just "something the core does not know"; the QA case can be examined today from the tree, "by asking which node entries are Node's and which are only wearing Node's clothes." The harness candidate is the exception to waiting: the one practice this desk runs professionally, with a configured instance already existing to be read; also the probe isolating the hardest part — "a practice whose content does not fit in a repository at all".
- Cross-references: R20, ADR-016, ADR-037, `stacks.json`, `standard/scripts/self-verify.mjs`, `standard/.claude/settings.json`, `standard/.claude/hooks/`, `method/working-with-ai/`, `method/ways-of-working.md`, `STACKS-2`, ecosystem.md.

---

## docs/open-questions/npm-as-a-channel.md — Whether the standard ships an npm package at all

- Decided: **no npm package, for now (2026-08-09).** The backlog used to say "publish the npm package with the positioning one-liner" (`DISCO-1`) — stating the answer before either settling criterion had happened. Corrected: `DISCO-1` no longer names npm; there is still no `package.json` to publish.
- Not permanent: neither criterion in "What would settle it" is met — no evidence the discovery channel runs through npm (the 2026-08-02 landscape check found comparison articles, not registries), and no non-author adopter has hit the `degit` line as friction (no non-author adopter exists yet). Timing still holds: the standard carried no tag, so a package published then would carry a version ahead of the thing it distributes. "absent either signal, the default is not to build the thirty lines."
- What is proposed: the standard ships as a markdown tree fetched with `degit`; an npm package could not ship the tree as a dependency ("nothing imports it"); it would be a **thin CLI** fetching the tree and pointing the agent at the align skill: `npx repository-standards` instead of `npx degit repository-standards/core .repository-standards`. "Roughly thirty lines."
- For: npm is a search surface (registries, awesome-lists, roundups index it; a repo alone is indexed by GitHub search only); the quickstart becomes one command (current one is a two-part incantation with a target directory and a `.gitignore` note); `package.json` is a canonical description with keywords in a format scrapers, registries and training corpora read the same way.
- Against: it implies Node (the standard is stack-agnostic; a Python or Go team would first meet an npm command — guards are already Node, but they run *after* adoption, this would be the front door); a second version number (npm version and `.standards-version` must agree, nothing checks it — "This repo has spent a lot of effort on exactly that class of drift"); a second thing to maintain and break (a stale package fetching a moved path fails undetectably).
- What would settle it ("Not preference"): evidence that people look (target queries or listings routing through npm — the 2026-08-02 check is weak evidence *against*); or a real adopter saying the degit line was the friction.
- Timing: publishing claims a name; npm names are effectively permanent; the package would be published against a standard with no tag yet. "Whatever the answer, it comes after the first tag."
- Related: `DISCO-1` in `backlog.md`; the landscape check lives in the owner's private research space; the finding it carried into the repo is the FAQ's corrected comparison.
- Cross-references: `degit`, `.standards-version`, `DISCO-1`, faq.md, staying-current.md (ADR-025 floated npm as part of the same channel).

---

## docs/open-questions/one-tree.md — One authored tree (ADR-014)

- Decided: a single authored `standard/` tree, shipped as-is at the paths a real repo uses — no source/dist split, no build step, no reflect machinery.
- Why ("measured, not felt"): the old pair held 47 committed byte-duplicates and 27 hand-synced "divergent" pairs that the drift tool never content-compared; four live drifts shipped that way in one day, including a skeleton that failed its own self-verify; every change paid twice (48 dist path-touches vs 93 source in the last 20 commits before the collapse).
- Options weighed:
  - Keep the pair — "the duplication and the unverifiable class were the finding, not a style choice".
  - Author in dist for the copy class only — kills the cheap half, keeps the 27 hand-synced pairs where every real drift lived.
  - Build dist at release, commit nothing — kills the degit one-liner; demands mechanizing 27 hand transforms first.
  - **One committed tree (chosen)** — "zero duplication by construction; drift between copies becomes impossible rather than detected".
- Worth remembering: the owner had resolved "dist/ stays" earlier the same day (dist reads as generated output); the measurement overturned it — "reflect never actually built the divergent 35%, so the 'output' framing did not hold. A resolution reversed within a day, by evidence, is this file's genre working as intended."
- Doubt: template shells and hand-authored docs now mix in one tree, distinguished only by the manifest's `adapt` field; a browsing reader cannot tell "fill this in" from "read as-is" without it.
- A better answer would: evidence from the first real adoption that the mix confuses nobody — or a marker convention cheaper than a second tree.
- Cross-references: ADR-014, adapt classes; how-this-repo-works.md (same decision).

---

## docs/open-questions/own-specs.md — The repo specs its own tooling

- Decided: `specs/` carries tree-guard, verify-engine, web-surface and spec-engine — the buildable method dogfooded on the repo's own scripts, guarded by spec-structure in CI.
- Why: "'follows its own rules' was a claim without an artifact"; the specs caught their first real bug on day one — a spec illustrating a dead link with a live dead link, which the repo's own link gate refused.
- Doubt: specs for scripts of a few hundred readable lines risk documentation theatre; four living specs must stay true as the tooling evolves "or the flagship example rots."
- A better answer would: the first tooling change that lands spec-first and catches a real contradiction — or proves the specs dead weight, "which retires them as an honest negative result in the case studies."
- Cross-references: `specs/` (tree-guard, verify-engine, web-surface, spec-engine), spec-structure guard, link gate; how-this-repo-works.md.

---

## docs/open-questions/personas-gate.md — Personas stay a hard gate even solo

- Decided: in the profiles split, the gate is core, the full roster is scale; "a capability spec that serves nobody fails the structure guard (R10, ADR-006)."
- Doubt: for a one-person tool the ceremony may exceed the value; for repos with no product surface (an internal service, a library) a persona gate may deserve a separate product profile rather than core.
- A better answer would: a solo case study showing the one-persona gate caught (or never caught) a real mistake.
- Cross-references: R10, ADR-006, ADR-011 profiles; personas.md.

---

## docs/open-questions/profiles.md — One repo, two profiles (core / scale)

- Decided: ADR-011 — a `profile` field per manifest entry, views rendered, never a second repo. The same axis serves the stack layer: satellites reuse core|scale verbatim instead of inventing light/corporate. ADR-040 replaced the trigger: "`scale` binds on what leaves the room, not on a second contributor."
- Doubt: the split may be too weak to carry what the docs put on it. Measured on the tree: 9 entries are `scale`, and only R11's blocking coupling guard and R16's `spec-guard` step carry a *(scale)* marker. ADR-040 made the picker say so plainly rather than move entries, "because nothing observed yet says which way they should move. A regulated `audit` third profile still looms."
- A better answer would: an adoption by a repo with two to five people — the range the binary decides hardest and one the validation suite has never covered; "Every field run inferred its profile from committer counts, and the smallest team any of them records is 38 authors."
- Cross-references: ADR-011, ADR-040, R11, R16; faq.md (9 manifest entries, same figure).

---

## docs/open-questions/rebase-merge.md — Rebase-merge as the paved road

- Decided: ADR-026 / R23 — `main` stays linear; a branch is updated by rebasing onto its base, never by merging the base back in; a PR lands by rebase-merge, with squash-merge as the sanctioned alternative for repos that will not hold the per-commit hygiene bar.
- Why: "the two hard parts are not contestable - back-merges muddy history and poison a bisect, and rewriting history someone else builds on destroys their work." The remaining choice is what the mainline should read like; one-finished-unit-per-PR stays readable at commit resolution "without asking anyone to learn `--first-parent`."
- Doubt: rebase-merge is the most demanding option, chosen for a standard whose adopters are often solo or small teams; squash-merge asks nothing of the contributor and delivers most of the benefit — a strong argument says squash should be the default and rebase-merge the opt-in. Real costs: GitHub's rebase-and-merge mints new SHAs, drops signature verification, lands commits in a form CI never tested. The option that dominates on the merits — semi-linear (rebase, then `--no-ff`) — "is excluded only because GitHub does not offer it, which is a tooling accident, not a principle."
- A better answer would: adoption data. If aligned repos keep recording "we squash" as their branching ADR, the default is wrong and should flip. If GitHub ships semi-linear merge, that becomes the paved road and this entry resolves into a superseding record.
- Cross-references: ADR-026, R23; case study stacked-prs-on-a-moving-base.md.

---

## docs/open-questions/shipped-skills.md — How many lifecycle skills ship into every adopted repo

- Decided (revised 2026-08-02): "the count is not the constraint. **Discriminability is.** A skill earns its place when its description names a situation no other skill's description names; it costs something only when it overlaps one. Ten skills with blurred descriptions are worse than twenty with sharp ones, and the number on its own predicts nothing." Currently 21 ship — "That is a report, not a budget."
- Additions history:
  - `show-backlog` (2026-08-13): most recent; the first the entry asked for by name — field evidence of a real user's sentence matching no description arrived: on an adopted repo that had taken the dashboard entry, "show me the backlog" matched no skill, so the backlog file got read and summarised into chat while the page that renders it went unmentioned. `add-to-backlog` is the near neighbour; "the boundary is the direction of travel: it files work, this one only reads. Both descriptions now say so explicitly."
  - `record-run` (2026-08-09): the human-prompting corpus's README names its worst weakness as every number coming from people who wrote the standard; nothing closed that loop from inside a real adoption run — "the gap was in reflexivity, not routing". Its description triggers at the close of an `align-to-standards` session, a moment no other skill claims.
  - **Correction (2026-09-03)**: `record-run` shipped into the client tree for three weeks and should not have — a re-adoption or re-entrant wave re-running it from the shipped copy would offer to record the same session twice, and a real run reported never having asked for it (the shipped instance sat unused in a repo whose owner had excepted it, `ADOPT-DEFAULTS-1`). It now lives at `skills/record-run/`, run from this repo's checkout alongside `align-to-standards`, and no longer counts toward the 21.
  - `idea-write` (2026-08-03): `adr-write` and `bdr-write` both named `docs/ideas/` as where not-yet-decided speculation belongs and neither wrote to it — "a real gap in the loop's own routing, found by testing every skill's promised behavior against a real repo". Triggers on "floating"/"wondering"/"might never ship" language, distinct from `bdr-write`'s "a call gets made" and `add-to-backlog`'s "work surfaces".
- Why the previous answer (ceiling of eight to ten, passed twice without deciding) was wrong:
  - **It had no source**: "Respected skill collections treat eight to ten as the ceiling" had no citation, and the supporting parenthetical said Anthropic's flagship collection ships **17**.
  - **The cost it implied is not measurable**: measured 2026-08-02, the 15 then shipping came to **4,772 characters, roughly 1,190 tokens** — about 0.6% of a 200k window; the four authoring skills added the same day took it to **6,319 characters, roughly 1,580 tokens**, about 0.8%. The ~300-token prediction held. "Whatever the constraint is, it is not size."
  - **The real failure was observed and was not about count**: `spec-specify` did not fire on "we need refunds" because its description read "Create or update a capability spec from a natural-language description" — a definition of the artifact. Rewriting it fixed it with the count unchanged. "what breaks is a description that names no situation, and it breaks at fifteen skills exactly as it would at five."
- What replaces it — two questions before any skill ships, neither arithmetic:
  1. "Does its description name a situation, in words a user would type?" Not the artifact — the moment someone reaches for it.
  2. "Is that situation already named by another skill?" If two descriptions could both match one sentence, one loses it at random: merge them, or sharpen both until the boundary is obvious. "A family that passes both can grow. One that fails either is already too big, whatever the number says."
- Downstream: `authoring-skills` had recommended two routing skills to respect the ceiling; with the ceiling reframed, the recommendation inverts to one skill per document type.
- The doubt that survives: "nothing has yet failed in a way the count could explain." Every miss was a description naming no situation; every fix was rewording. What would test the rule: "a miss no sharpening separates - two situations a user genuinely distinguishes, where every wording of one description keeps taking sentences meant for the other." If that arrives, discriminability is not sufficient and something has to bound the family. The four authoring skills carry a different risk (sibling drift), stated in `authoring-skills`.
- Cross-references: `show-backlog`, `add-to-backlog`, `record-run`, `idea-write`, `adr-write`, `bdr-write`, `spec-specify`, `align-to-standards`, `skills/record-run/`, `ADOPT-DEFAULTS-1`, authoring-skills.md, skill-map.md.

---

## docs/open-questions/stack-lifecycle-skills.md — Whether a stack ships its own skills, or only data

- Status: **Open.** Layer 2 ships **four data files** (`stack.manifest.json`, `DECISIONS.md`, `starter/`, `ADAPTING.md`) and no procedures; Layer 1 ships 19 lifecycle skills (count as written in this entry). "The asymmetry was never decided; it is what fell out of building the core first."
- What is missing: adoption is covered thinly but genuinely — `skills/align-to-standards/stack.md` is 41 lines against the core router's 313 and consumes the stack's data files rather than carrying technology knowledge ("That split is right and should stay"). No home exists for **the technology's recurring work**: adding a dependency under R21's exact-pin-plus-cooldown rule; a framework major upgrade ("the case where `DECISIONS.md`'s escape hatches matter most and where nobody reads them"); adding or moving a test tier; a migration in the stack's idiom. Layer 1 treats this class as skills (`spec-impact`, `add-to-backlog`, `pre-pr-review`); "Layer 2 treats it as nothing."
- The mechanism already exists unnamed: `stack.manifest.json` is the core manifest's schema plus `technology` and the `registry` back-pointer; the core manifest ships `.claude/skills` as a `copy`-class `files[]` entry, so a stack can ship skills by the same mechanism today with no code change — "latent and undocumented"; an argument for yes, and a reason to decide deliberately: "a mechanism that works by accident gets used inconsistently by the second stack."
- Questions needing answers:
  1. Do stack skills ship into the adopting repo, or stay in the stack checkout? Lifecycle skills ship and stay (ADR-009); transition skills never ship. Probably both kinds exist and the ADR-009 split applies — "that should be stated, not assumed."
  2. How do two skill families avoid colliding? Nineteen core skills plus a stack's share one namespace and one description-matching surface; the constraint is **discriminability** (`shipped-skills`): `add-dependency` competing with nothing is fine; one named `update-to-latest` is not. Naming rules belong in whatever answers this.
  3. Who owns the port to non-Claude agents? R22 makes core procedures normative and requires a strict port; if a stack ships procedures the same obligation follows and the stack repo must carry it.
  4. Does a stack get its own `AGENTS.md` section, or merge into the repo's? The manifest has a `merge` class; nothing says which side wins on conflict.
- What would settle it: "Running it once." `STACK-ALIGN-1` (the node satellite aligning to Layer 1) is still `todo`, so the Layer 2 path has never executed in either direction on any repo; "Every question above is currently being answered from the armchair." Order that makes sense: align the satellite first, do the technology work by hand while watching what recurs, let the skills fall out of what was repeated — "Writing them first would be inventing a lifecycle for a layer whose lifecycle nobody has lived through yet."
- Related: `STACK-ALIGN-1`, `STACKS-2` in `backlog.md`; ADR-016 (one repo per technology); ADR-022 (linked, never version-locked); ADR-009 (lifecycle vs transition split).
- Cross-references: R21, R22, ADR-009, ADR-016, ADR-022; `skills/align-to-standards/stack.md`; hermes-inspired-patterns.md (`STACK-LIFE-1`).

---

## docs/open-questions/stack-offer-on-adoption.md — Who decides Layer 2 during an adoption

- Decided: the router asks, and never applies a stack on its own. The intake's question round covers "technology + Layer 2 consent"; the technology is looked up in `stacks.json` before any offer; reconciliation runs later in its own phase — "Consent is gathered here; the actual stack reconciliation runs later" (`skills/align-to-standards/SKILL.md`). R20 makes the two layers adoptable independently, "so declining is a first-class answer rather than a failure to comply."
- Doubt: the path has almost never been walked, and where it was, the user was not the one who answered. Two run shapes in the validation suite, neither testing the gate:
  - **The user names the stack**: the corpus's most-run entry line is `A26` ("take this repo onto repositorystandards.com with the node stack"), supplying consent in its opening words — "detection is never exercised, only obedience." `A2`, the shipped stack-named line, has not been run at all.
  - **Nobody names it**: `RET1` (entry line retired 2026-08-19, ending "interview me for what you need") ran twice against `hagopj13/node-express-boilerplate` — the only entry line ever run where the repo matches the registered technology and the prompt says nothing about a stack. Both times Layer 2 ended unapplied and something other than the user's answer decided it: once the agent judged it itself ("adopting that stack wholesale would be a rewrite of the product rather than an alignment of it"), once the owner had declared Layer 1 only before the question could arise. The three JS/TS adoptions in the AI-prompting suite (`honojs/hono`, `drizzle-team/drizzle-orm`, `usebruno/bruno`) record no observation about a Layer 2 offer; their single stack mention is a Layer 1 deny-list entry being adapted.
  - So no run had recorded a registered stack being detected, offered cold, accepted and applied; `STACK-ALIGN-1` says the same from the other side. Runs show the offer **declined** in every form (agent's judgment, declared profile, non-matching technology) — "a decent sign that nothing gets applied silently, and no evidence at all about the accept path."
- Update 2026-09-03: one run walked the accept path — the h adoption (`validation/human-prompting/runs/2026-09-03-h-monorepo-adoption.json`, transcript alongside). "It settles the first half and reopens the second: the gate fires, and asking at intake, as it is done today, is not the right default."
- A better answer would: an adoption where a registered technology is detected rather than announced — one run on a registry-matching repo, driven from `A1` or `A2`, with a user who says yes, recording verbatim what the router said about the stack, whether it asked before touching anything, and whether `stack.manifest.json` landed. `FIELD-1` territory; settles both halves: whether the gate fires, and whether asking is the right default.
- Options in view (listed, not weighed):
  1. **Ask at intake** (in force): one question round covers everything; costs an answer from someone who may not have one yet — the tension `greenfield.md` records when it says the process is not stack-first.
  2. **Auto-apply on an unambiguous match**: fewer questions; Layer 2 is where most mechanical value sits. Against: a stack rewrites lint, type and test tooling (the largest diff any adoption produces), and "`hono` refusing the pnpm requirement over bun is exactly the case that would have been forced through."
  3. **Detect, say nothing, offer at the end**: Layer 1 lands first, stack proposed against a repo at drift 0 when the user can see what the machine does. Against: the technology is known at intake; holding it back is a question asked twice.
  4. **Ask at intake, as its own declared question, and say when it lands** (added after the h run): `adopt.stack` declared in `points.json` on the brownfield path, asked on its own with the detected technology and the stack's conflicting picks in front of the user; the application announced — a stack section in the run summary and the PR body, and a commit a reviewer reads as "the Node stack is in". Against: one more question round; "it does nothing for the 12:14 case if the announcement is text the user has to scroll to."
- What the accept path looked like (2026-09-03): a private monorepo on the registered technology, driven from `A1` by its owner. The router detected TypeScript on pnpm, looked the stack up, offered it at 09:55 as the second of four questions in one card headed `[technology / Layer 2]` with no point id (none declared — `points.json` has `green.stack` on the greenfield path and nothing on this one). The recommended option was **Layer 1 only now**, because the stack's picks (Biome, Better Auth, CSS Modules) conflict with the repo's (ESLint + Prettier, Cognito, NativeWind). The owner chose **Layer 1 + Node stack**. The layer landed as `stack.manifest.json`, `.nvmrc`, two workspace keys and two stack exceptions, in one commit among nine authored at 11:05 UTC, seventy minutes after the answer. At 12:14 the owner asked how the Node stack had been taken into account "because I do not see it"; at day's end, asked to contribute this evidence, they wrote the layer had not been adopted and had never been asked about. "The transcript contradicts the first half and the tree contradicts the second, and that is the finding, not a correction of it: the consent existed and was not real to the person who gave it; the application existed and was invisible to the person who reviewed it. From the owner's chair this is indistinguishable from the silent-apply failure option 2 is feared for, reached by the opposite route."
- Conclusions: the gate fires and nothing is applied on its own (first half answered); asking is right, "asking *like this* is not." Three things needed, in the order they would have helped:
  1. **A declared point**: the only point gating `stack.manifest.json` is `green.stack` (greenfield; question "Which stack, and which profile - core or scale?") and this run never asked it; it satisfied the guard by filing the 09:55 answer under `green.stack` in the provenance ledger, where the ledger's own "asked, no point declares it" table had to note the discrepancy. "The gate held on a borrowed point: the guard cannot tell a brownfield offer from a greenfield one, so a replay cannot assert which was made, and the intake's own offer has no id to be filed under."
  2. **Its own question**: the stack was the one answer of twelve the owner gave against the recommendation, and the one they did not remember. "A question that changes the build tooling does not belong in a card with the language of the docs."
  3. **A visible landing**: nothing between 09:55 and the pull request said "the Node stack is in" — not the run summary, not the PR body, not a commit message. "What the layer produced is a manifest; a manifest is not something anyone sees."
- Backlog: the work is `STACK-OFFER-2`; `STACK-OFFER-1` keeps its decision with one accept-path data point; its doubt narrows to whether option 4 is enough.
- Cross-references: R20, `stacks.json`, `skills/align-to-standards/SKILL.md`, `greenfield.md`, `points.json` (`green.stack`, proposed `adopt.stack`), provenance ledger, `A1`, `A2`, `A26`, `RET1`, `FIELD-1`, `STACK-ALIGN-1`, `STACK-OFFER-1`, `STACK-OFFER-2`, validation runs (hono, drizzle-orm, bruno, node-express-boilerplate, h monorepo adoption).

---

## docs/open-questions/stacks-satellite.md — Stacks as satellite repos (ADR-016)

- Decided: technology best practices live in one repo per technology (`repository-standards/<technology>`), official only when listed in the core's `stacks.json` registry. First satellite: repository-standards/node.
- Options weighed:
  - Keep `stacks/` in the core — two release clocks in one version axis (Next majors would force standard releases); the starter needs living CI in a repo whose rule is that workflows never run; measured coupling was 3 links.
  - Monorepo of packages (`@core`, `@env-node`) — two version axes plus workspace machinery in one repo: "both costs, neither benefit".
  - **Satellite repos + registry (chosen)** — each layer on its own clock; the starter gets real CI; a new technology is one repo plus one registry line.
- Naming deliberation: `env-node` (owner's first instinct; "env" reads as environment variables), bare `node` (prettiest degit, but the family scatters and the name says nothing), `stack-node` (the project's own vocabulary). First settled as standalone `repository-standards-<technology>`, noting it would shorten if the org migration happened; it did: repos live in the `repository-standards` organization, so each is named for its technology alone — `repository-standards/node`; "inside this org it says everything it needs to."
- Governance (research, not hope): officialdom = the registry file the owner alone merges (the Homebrew core-vs-taps model); copycat repos elsewhere expected and harmless — Terraform's "verified" badge and npm's @types prove "the signal is curation, never naming policing." Anti-explosion policy in the registry itself: one stack per technology; variation is a profile or a subtractive adoption mode (the Rails `--api` shape), never a sibling repo — "Yeoman's twelve near-identical Backbone generators are the grave this rule fences off."
- Doubt: two repos to maintain with different kinds of care; the registry is a solo-merge gate with no policy for a second maintainer.
- A better answer would: the second stack (Python, evidence-gated) landing as exactly one new repo plus one registry line with the core untouched — or failing to, which reopens the seam.
- Cross-references: ADR-016, `stacks.json`; ecosystem.md (same policy); `STACKS-2`.

---

## docs/open-questions/status-frontmatter.md — Spec Status lives in front matter

- Decided: `in-refinement -> ready-to-develop -> in-development -> live`; "the clarify gate flips readiness mechanically and is the authority - Status is the human-readable mirror."
- Doubt: once a tracker mirrors the work, status exists in two places; the mirror is one-way by design, but humans read both and one will lag.
- A better answer would: one rendered view that makes the lag invisible, or a convention for which surface answers "what's the status?" per audience.
- Cross-references: clarify gate, ADR-010 tracker mirror; case study the-silently-skipped-clarify.md (`Status: ready-to-develop` earned by the gate).

---

## docs/open-questions/staying-current.md — How a repo finds out the standard moved

- Status: "**Open, and the doubt is structural rather than a matter of tooling.**" ADR-025 named a channel — a Renovate custom manager watching `.standards-version`, plus a shipped watch workflow for repos without a bot — and the workflow is built and shipped. Unresolved: "**the channel is release-based while the standard is main-based**, and those are different things."
- The mismatch: `standards-update-watch.yml` asks GitHub for `releases/latest` and compares to the repo's recorded state — "a good, quiet design: it fires rarely and only on a deliberate milestone." But ADR-025 says the target of every align and update is **latest**, references resolve at `main` deliberately, and `main` *is* the living standard. Between releases `main` moves ("sometimes a great deal, as it did on 2026-08-02") and no adopter is told; "A repo can be months behind the standard it follows and see a green watch the whole time." The notification answers "has a milestone been cut" when the design implies "has the thing I true up to changed".
- Why not watch `main`: fires on every commit including a FAQ typo; "An adopter who gets told to update fourteen times in a week stops reading the notification, and a channel nobody reads is worse than none - it is the same failure mode as a gate that fires when nothing is wrong." Middle ground: not every `main` change is worth attention and nothing distinguishes them; a rule change touches every adopted repo, a reworded FAQ touches none; the manifest names what an aligned repo must have and `CHANGELOG.md` is written per change, "so the signal may exist without a new mechanism."
- Options, none chosen:
  - **A - Releases only** (ships today): quiet and deliberate; silent as long as no tag is cut, "which pre-1.0 has been forever."
  - **B - Watch `main`**: always current, unusable in practice.
  - **C - Watch the manifest, not the repo**: fire when `standard.manifest.json` changes; prose silent, requirement changes speak; under-reports: a rule can tighten in `SPEC.md` with the manifest untouched.
  - **D - The maintainer marks adopter-affecting changes**, channel watches the mark: most accurate; "depends on a human remembering - the class of thing this project usually refuses to rely on."
  - **E - Drop the notification; re-run alignment on a cadence**: the owner's framing is that adoption is not work-done — point at the standard again every couple of months and take the delta; a habit rather than a channel, no mechanism; "a repo is only as current as its last deliberate run."
- What settles it: "Not argument. **One adopter running behind for a while, and someone noticing what they missed and how they found out.**" `FIELD-1` territory; until a non-owned repo has been out of date a month or two, "every option above is a guess about a cost nobody has paid." Until then the shipped watch stays: "honest about having nothing to say when no release exists, which is the correct behaviour for a mechanism whose premise is unresolved."
- Related: ADR-025 (the decision this implements and does not fully satisfy); `standard/.github/workflows/standards-update-watch.yml`; `npm-as-a-channel` (ADR-025 floated npm as part of the same channel).
- Cross-references: ADR-025, `.standards-version`, Renovate, `standard.manifest.json`, `SPEC.md`, `CHANGELOG.md`, `FIELD-1`.

---

## docs/open-questions/tracker-history.md — Work history lives in the tracker + git, not in repo files

- Decided: ADR-010 — the repo holds intents and living truth; the tracker holds execution state and history; plan/tasks are deleted at close.
- Why: "dead scaffolding is noise agents keep reading; git already is a ledger."
- Doubt ("the owner went back and forth"): kills who-did-what-when visibility inside the repo; regulated shops may need in-repo history.
- A better answer would: "a cheap archive overlay that preserves auditability without teaching agents to read debris - if it can stay optional and out of context windows."
- Cross-references: ADR-010; faq.md (what in-repo does not give); skill-map `spec-reconcile` (deletes scaffolding).

---

## docs/open-questions/twenty-rules.md — Twenty rules

- Decided: the whole normative core is one page — numbered MUST/SHOULD rules in `standard/SPEC.md`; the manifest is its machine-readable projection, each entry citing the rule it enforces. Started at twenty; each later rule joined when a real normative gap surfaced in the field: supply-chain pinning (ADR-017), agent-portable procedures (ADR-019), branch and history (ADR-026), the database schema and its typed twin (ADR-027).
- Why: "every standard that won stays this small - semver has 11 rules, Conventional Commits 16, Keep a Changelog 7 principles. The cautionary tale is RUP, which grew until nobody could apply it."
- Doubt: the count sits past the top of the winners' range and only ever grew; several rules bundle more than one MUST (R11 carries the map, the same-PR rule and the guard; R16 three gates; R23 four); judgment-tier rules cannot be script-checked, "which blurs what 'drift 0' certifies."
- A better answer would: first adoptions showing which rules never bite — candidates to merge or demote to guidance. "The rule numbers are stable by contract, so merging means retiring a number, never renumbering."
- Cross-references: `standard/SPEC.md`, R11, R16, R23, ADR-017, ADR-019, ADR-026, ADR-027; faq.md (drift 0 certifies structure).

---

## docs/open-questions/work-periods.md — What to call a bounded period of work - and whether to have one

- Decided: `sprint`, as `docs/sprints/<team>/<slug>.md` — a container with its own goal and an agreed end date, several active in parallel, one per team. An intent moved into a sprint leaves the backlog pool and cannot sit in two sprints at once. Artifact settled in ADR-028; name in ADR-041.
- Overturned once already ("which is the point of it"): the first answer was `cycle`, chosen against `sprint` because borrowing the word borrows the ceremony. "It lost to use." Readers stopped at the unfamiliar word and spent their first question asking whether it was a sprint; the dashboard made the cost visible — a page built for people who never open the repository had a tab whose label needed a sentence. "A design argument lost to an observation, which is the only way it should have lost."
- Path deliberation: `docs/teams/<team>/sprints/` reads naturally team-first and lost on one argument: every other folder under `docs/` is named for the kind of thing inside (`runbooks/`, `journeys/`, `ideas/`, `research/`, `discovery/`); `teams/` would be the first naming an organizational unit and would invite everything else a team has to live under it. "The artifact kind stays the folder; the team is a partition inside it." Worth overturning if a second team needs genuinely per-team configuration rather than just its own files.
- The doubt that remains: the borrowed word carries expectations the standard does not meet — someone who knows Scrum will look for points, a velocity commitment and a fixed timebox, and find none. "That cost is real; it is paid once per reader, in one clause, where `cycle` charged every reader the same question forever."
- Why not the obvious ones:
  - `cycle` — the pick until 2026-08-07: Linear uses it for almost exactly this, expected to arrive pre-explained; in use "it read as a new word for a thing people already had a word for."
  - `wave` — already spoken for: brownfield alignment runs in waves; one word meaning two bounded things "is exactly the collision this project keeps finding in its own files."
  - `track` — carries parallelism, loses the time bound and the goal.
  - `iteration` — accurate and neutral, as unfamiliar as `cycle` without Linear's precedent — "the same tax for less."
- What a better answer would have to do: name a period that (1) has an owner and a goal, (2) has an end date agreed rather than fixed by a framework, (3) can run in parallel with several others under one backlog, (4) does not smuggle in a methodology. `sprint` fails (4) on its face and is kept anyway, "because ADR-041 denies the methodology explicitly and in one place, and because the word is understood before the sentence explaining it." A candidate doing all four **and** recognised on sight would win.
- The question underneath: whether the standard should carry work periods at all. Counter-argument: the backlog with a definition of done per item already keeps knowledge alive; periods are coordination, which is `scale`-profile territory — it landed scale-only; "a solo repo never meets it." Argument for: timeline — with periods carrying goals and dates, a skill can read every team's folder and derive when the project lands, and a closing skill records finished-vs-planned; "That turns estimation into arithmetic over the repo's own history rather than a meeting. Without periods there is nothing to derive it from."
- Options weighed (summary): `sprint` (rejected once for ceremony, chosen 2026-08-07 for recognition, ceremony denied in the record); `cycle` (chosen 2026-08-02, overturned by use); `wave` (collides with alignment waves); `track` (loses the time bound); `milestone` (GitHub already owns the term, implies a fixed date rather than an agreed one); `iteration` (unfamiliar without a precedent).
- Cross-references: ADR-028, ADR-041, `docs/sprints/<team>/<slug>.md`, scale profile, `sprint-open`/`sprint-close`/`timeline-update` (skill-map), faq.md in-repo posture.

---

## Cross-cutting index

Each entry lists the digested docs that name or discuss it (short names: `README` = docs/README.md; `OQ:` = docs/open-questions/; `CS:` = docs/case-studies/; `ID:` = docs/ideas/).

### Rule IDs (standard/SPEC.md)
- **R3** (knowledge existing only in a conversation does not exist) — OQ:genesis-history.
- **R4** (living docs) — personas (Coding agent).
- **R7** (decide the areas that apply, say so once for those that do not) — OQ:conformance-is-a-degree.
- **R10** (a capability spec that serves nobody fails the structure guard) — OQ:personas-gate.
- **R11** (capability map + same-PR rule + coupling guard; blocking guard carries a *(scale)* marker) — OQ:profiles, OQ:twenty-rules.
- **R16** (spec-guard workflow required at every profile; three gates; `spec-guard` step carries a *(scale)* marker) — faq, OQ:profiles, OQ:twenty-rules.
- **R20** (Layer 2 = optional technology best practices in per-technology stack repos; layers adoptable independently) — OQ:layers-beyond-technology, OQ:stack-offer-on-adoption.
- **R21** (exact-pin-plus-cooldown for dependencies) — OQ:stack-lifecycle-skills.
- **R22** (core procedures normative; strict port to non-Claude agents) — OQ:stack-lifecycle-skills (also quick-start and skill-map state the strict-port rule without the number).
- **R23** (base every PR on `main`; linear main; rebase-merge; four MUSTs) — CS:stacked-prs-on-a-moving-base, OQ:rebase-merge, OQ:twenty-rules.

### ADRs (docs/decision-records/)
- ADR-002 / ADR-003 (specs by capability; buildable not descriptive) — personas (Darek).
- ADR-004 (standard decisions by reference; deviate via local superseding decision) — faq.
- ADR-005 (align engine is a manifest) — personas (Staszek).
- ADR-006 (personas are a validation gate) — personas, OQ:personas-gate.
- ADR-008 (standard repo three zones) — personas (Staszek).
- ADR-009 (skills: lifecycle vs transition) — personas (Staszek), OQ:stack-lifecycle-skills.
- ADR-010 (artifact lifecycle and tracker; one-way bridge; enabling work front-matter -> tracker; plan/tasks deleted at close; ideas not records) — personas, faq, CS:enabling-work-out-of-the-spec, CS:proposed-does-not-mean-maybe, CS:the-silently-skipped-clarify, OQ:default-tracker, OQ:ideas-slugs, OQ:tracker-history.
- ADR-011 (one standard, two profiles) — faq, personas (Olek), OQ:conformance-is-a-degree, OQ:profiles.
- ADR-012 (in-repo instructions are the source of truth) — personas (Coding agent), OQ:genesis-history.
- ADR-013 (Spec Kit is an engine by reference — rejected re-creation) — OQ:engine-cherry-pick.
- ADR-014 (one authored tree) — how-this-repo-works, OQ:one-tree.
- ADR-015 (spec engine extracted; upstream cherry-picked at release) — faq, OQ:engine-cherry-pick.
- ADR-016 (stacks are satellite repos) — OQ:layers-beyond-technology, OQ:stack-lifecycle-skills, OQ:stacks-satellite.
- ADR-017 (consumed versions pinned exact) — OQ:twenty-rules.
- ADR-019 (lifecycle procedures are agent-portable) — OQ:twenty-rules.
- ADR-021 (adoption feeds the standard; stack request issue) — ecosystem.
- ADR-022 (stacks linked, not version-locked) — ecosystem, OQ:stack-lifecycle-skills.
- ADR-023 (method docs live beside the tree; adopted by reference, always latest) — README, how-this-repo-works, OQ:checklist-name.
- ADR-025 (the standard is living; latest is the target) — OQ:conformance-is-a-degree, OQ:staying-current, OQ:npm-as-a-channel.
- ADR-026 (rebase-merge onto a linear main) — CS:stacked-prs-on-a-moving-base, OQ:rebase-merge, OQ:twenty-rules.
- ADR-027 (database schema in repo with a typed twin) — OQ:twenty-rules.
- ADR-028 (work cycles live in the repo, bind only at scale) — faq, OQ:work-periods.
- ADR-029 (measurement forecasts; sizes only cold start; S/M/L) — faq, ID:hermes-inspired-patterns.
- ADR-030 (current holder is cycle state, not history) — faq.
- ADR-031 (one domain, surface-first URLs; header switcher) — ID:dashboard-cross-repo-switcher.
- ADR-037 (a repo may register more than one stack; path collisions counted once per declaration) — OQ:layers-beyond-technology.
- ADR-040 (scale profile binds on reach, not headcount) — faq, OQ:profiles.
- ADR-041 (the bounded period of work is called a sprint) — OQ:work-periods.
- ADR-046 (backlog is the one index; open questions and ideas get a type) — ID:README, OQ:README.
- ADR-051 (closing a backlog row is a relocation, not a deletion) — ID:hermes-inspired-patterns.
- "thirty" decision records in total at the time of how-this-repo-works (the checkout holds ADR-001..ADR-062).

### Skills
- Shipped lifecycle skills (21 into every adopted repo; skill-map is the verbatim catalogue):
  - `product-write`, `personas-write` — skill-map, OQ:authoring-skills.
  - `idea-write` — skill-map, OQ:shipped-skills (added 2026-08-03 to close the routing gap).
  - `discovery-digest` — skill-map.
  - `adr-write`, `bdr-write` — positioning (pillar 3 proof), skill-map, OQ:authoring-skills, OQ:shipped-skills.
  - `spec-specify` — skill-map, ID:dashboard-cross-repo-switcher (debt), OQ:authoring-skills, OQ:shipped-skills ("we need refunds" miss).
  - `spec-clarify` — skill-map; the clarify gate: positioning, personas, CS:the-silently-skipped-clarify, OQ:status-frontmatter.
  - `spec-impact` — skill-map, OQ:stack-lifecycle-skills.
  - `spec-update`, `spec-plan`, `spec-tasks`, `spec-implement`, `spec-reconcile` — skill-map (reconcile also OQ:tracker-history by substance).
  - `pre-pr-review` — skill-map, OQ:stack-lifecycle-skills.
  - `add-to-backlog` — skill-map, OQ:shipped-skills, OQ:stack-lifecycle-skills.
  - `sprint-open`, `sprint-close`, `timeline-update` — skill-map; the artifact and name: OQ:work-periods, faq.
  - `show-backlog` — skill-map, OQ:shipped-skills (added 2026-08-13 on field evidence).
  - `update-to-latest` — quick-start, personas (Staszek), skill-map, faq, OQ:stack-lifecycle-skills (name-collision example).
- Transition skills (run from a checkout of the core, never shipped): `align-to-standards` — how-this-repo-works, skill-map, ID:hermes-inspired-patterns, OQ:shipped-skills, OQ:stack-lifecycle-skills (`stack.md`, 41 lines vs router 313), OQ:stack-offer-on-adoption (`SKILL.md`, `greenfield.md`). `record-run` — skill-map, ID:hermes-inspired-patterns, OQ:shipped-skills (moved to `skills/record-run/` on 2026-09-03).
- Rejected/hypothetical skill names: `record-decision`, `author-product`, `author` (OQ:authoring-skills); `add-dependency` (OQ:stack-lifecycle-skills).

### Scripts, guards, workflows, tools
- `scripts/self-verify.mjs` / `standard/scripts/self-verify.mjs` (drift as a number; adoption beside drift; warns about hand-copied transition skills; collision counted once per declaration) — quick-start, positioning, personas, how-this-repo-works, skill-map, ecosystem, faq, OQ:conformance-is-a-degree, OQ:folder-readmes, OQ:layers-beyond-technology, OQ:one-tree.
- `tools/skill-map.mjs --check` — README, skill-map. `tools/file-map.mjs --check` — README, OQ:folder-readmes. `tools/validation.mjs --check`, `tools/human-prompting.mjs --check` — README. `standard/scripts/facts-check.mjs` + `docs/facts.json` — README.
- `tree-check` — how-this-repo-works. `spec-structure` guard — OQ:own-specs. Link gate — OQ:own-specs. Spec-guard workflow (`spec-guard.yml`) — faq, OQ:profiles. Coupling guard — positioning, personas, how-this-repo-works, ID:dashboard-cross-repo-switcher (does not block `$unclaimed` paths), OQ:profiles, OQ:twenty-rules.
- Clarify gate scripts / bridge precondition (`standard/specs/enforcement.md`) — CS:the-silently-skipped-clarify.
- `standard/scripts/generate-dashboard/index.mjs` (+ `page.js`, `--registry stacks.json`, `meta.switcher`), `pages.yml`, `dashboard.yml`, `tools/docsite.mjs` — ID:dashboard-cross-repo-switcher.
- `standard/.github/workflows/standards-update-watch.yml` (polls `releases/latest`), Renovate custom manager on `.standards-version` — OQ:staying-current.
- `.github/workflows/checks.yml` (this repo's own checks) — how-this-repo-works.
- `standard/.claude/settings.json`, `standard/.claude/hooks/` (three shipped hooks guarding risky Bash commands) — OQ:layers-beyond-technology, CS:the-silently-skipped-clarify; the hook that "refuses to write an artifact nobody was asked about" — quick-start.
- `degit` (`npx degit repository-standards/core .repository-standards`) — quick-start, ecosystem (greenfield degits `starter/`), OQ:npm-as-a-channel, OQ:one-tree, OQ:stacks-satellite. `jq` (guards deny every command without it) — quick-start.
- Retired engine debris: a 326-line script nothing invoked, ~600 lines of hook boilerplate — OQ:engine-cherry-pick.

### Files and paths
- `standard/SPEC.md` — ecosystem, CS:stacked-prs-on-a-moving-base, OQ:twenty-rules, OQ:layers-beyond-technology (no test-discipline rule), OQ:staying-current.
- `standard.manifest.json` / manifest fields (`required`, `adapt`, `profile`, `layer: 1`, `files[]`, purpose, rule) — README, OQ:conformance-is-a-degree, OQ:folder-readmes, OQ:layers-beyond-technology, OQ:one-tree, OQ:profiles, OQ:staying-current, OQ:stack-lifecycle-skills.
- `stacks.json` (registry; official = listed) — personas (Darek), ecosystem, ID:dashboard-cross-repo-switcher, OQ:layers-beyond-technology, OQ:stack-offer-on-adoption, OQ:stacks-satellite.
- Stack files `stack.manifest.json`, `DECISIONS.md`, `starter/`, `ADAPTING.md` — ecosystem, OQ:stack-lifecycle-skills, OQ:stack-offer-on-adoption, OQ:layers-beyond-technology. Node stack entries `vitest.config.ts`, `playwright.config.ts`, `docker-compose.test.yml`, `.nvmrc` — OQ:layers-beyond-technology, ID:capability-stacks, OQ:stack-offer-on-adoption.
- `.standards-version` — faq, OQ:npm-as-a-channel, OQ:staying-current.
- `backlog.md` (the one index; `type: idea` / `type: open-question` rows) — faq, ID:README, OQ:README, OQ:authoring-skills, OQ:folder-readmes, OQ:npm-as-a-channel, OQ:stack-lifecycle-skills, OQ:stack-offer-on-adoption.
- `AGENTS.md` (entry point; links file-map directly; "loop runs itself" section) — personas, how-this-repo-works, OQ:folder-readmes, OQ:stack-lifecycle-skills, CS:the-silently-skipped-clarify.
- `docs/file-map.md` — README, OQ:folder-readmes. `docs/skill-map.md` — README, skill-map. `docs/facts.json` — README.
- `docs/method/` pages: `adoption.md`, `product-work.md`, `dev-work.md`, `lead-work.md`, `working-with-specs.md`, `ways-of-working.md`, `agent-work.md`, `self-verify.md`, `checklist.md`, `working-with-ai/` — README, quick-start, faq, OQ:checklist-name, OQ:layers-beyond-technology.
- `docs/ideas/<slug>.md` / `standard/docs/ideas/` — CS:proposed-does-not-mean-maybe, ID:README, OQ:ideas-slugs, OQ:shipped-skills.
- `docs/sprints/<team>/<slug>.md` (rejected `docs/teams/<team>/sprints/`) — OQ:work-periods.
- `decision-records/README.md`, `adr/README.md`, `bdr/README.md` (record indexes, highwater number) — CS:parallel-record-minting.
- `standard/docs/conventions.md` (Branch and history) — CS:stacked-prs-on-a-moving-base. `standard/docs/personas.md` — personas. `standard/specs/README.md`, `standard/specs/enforcement.md` — CS:the-silently-skipped-clarify. Capability spec template Status note — CS:enabling-work-out-of-the-spec.
- `specs/` (own specs: tree-guard, verify-engine, web-surface, spec-engine) — how-this-repo-works, OQ:own-specs. `specs/capability-map.json` (`$unclaimed`) — ID:dashboard-cross-repo-switcher.
- `site/site.config.json` — ecosystem. `site/docs/` (generated, gitignored) — how-this-repo-works, OQ:folder-readmes. `site/<tech>/dashboard/` — ID:dashboard-cross-repo-switcher.
- `points.json` (`green.stack`; proposed `adopt.stack`), provenance ledger, intake point `adopt.evidence` — skill-map (record-run), OQ:stack-offer-on-adoption.
- `validation/human-prompting/` (prompts.md, runs/*.json, results.md, transcripts) and `validation/ai-prompting/` — README, skill-map, OQ:shipped-skills, OQ:stack-offer-on-adoption, OQ:profiles.
- `CHANGELOG.md` — how-this-repo-works, OQ:genesis-history, OQ:staying-current. `CONTRIBUTING.md` (where R23 once sat) — CS:stacked-prs-on-a-moving-base. `package.json` (none exists) — OQ:npm-as-a-channel.

### Backlog / validation identifiers
- `MAP-1` (adopted repo gets no file map) — OQ:folder-readmes.
- `DISCO-1` (no longer names npm) — OQ:npm-as-a-channel.
- `STACK-ALIGN-1` (node satellite aligning to Layer 1; still `todo`) — ID:hermes-inspired-patterns, OQ:stack-lifecycle-skills, OQ:stack-offer-on-adoption.
- `STACKS-2` (second technology stack, Python, evidence-gated) — OQ:layers-beyond-technology, OQ:stack-lifecycle-skills (and by substance OQ:stacks-satellite).
- `STACK-LIFE-1` (does a stack's recurring work have a home) — ID:hermes-inspired-patterns.
- `STACK-OFFER-1`, `STACK-OFFER-2` — OQ:stack-offer-on-adoption.
- `FIELD-1` (field adoption evidence) — OQ:stack-offer-on-adoption, OQ:staying-current.
- `AUTHORING-SKILLS-1`, `AUTHOR-1..4` (left at the 0.9.0 cut) — OQ:authoring-skills.
- `DASHBOARD-SWITCHER-1` — ID:dashboard-cross-repo-switcher.
- `ADOPT-DEFAULTS-1` (owner excepted record-run) — OQ:shipped-skills.
- "an adoption you can point at" (open work) — faq.
- Entry lines `A1`, `A2`, `A26`, `RET1` (retired 2026-08-19); run `2026-09-03-h-monorepo-adoption`; repos `hagopj13/node-express-boilerplate`, `honojs/hono`, `drizzle-team/drizzle-orm`, `usebruno/bruno` — OQ:stack-offer-on-adoption.

### External projects and tools named
- Spec Kit (125k stars at 2026-08-02; MIT; origin of the spec flow) — positioning, faq, OQ:engine-cherry-pick. OpenSpec (63k; "built for brownfield not just greenfield") — positioning, faq. BMAD (51k) — positioning, faq. Backstage — faq. ProductSpec (github.com/gokulrajaram/ProductSpec) — faq.
- NousResearch/hermes-agent (`cron/suggestions.py`, `agent/curator.py`) — ID:hermes-inspired-patterns.
- GitHub Issues (default), Jira, Linear (250 active-issue free cap; "cycle" vocabulary) — faq, OQ:default-tracker, OQ:work-periods. Renovate — OQ:staying-current. MADR (`Proposed` semantics) — CS:proposed-does-not-mean-maybe.
- Playwright/Chromium, Vitest, pytest, `go test` — ID:capability-stacks, OQ:layers-beyond-technology. Biome, Better Auth, CSS Modules vs ESLint + Prettier, Cognito, NativeWind; pnpm vs bun — OQ:stack-offer-on-adoption. Figma — OQ:layers-beyond-technology.
- Homebrew core-vs-taps, Terraform "verified", npm `@types`, Rails `--api`, Yeoman's Backbone generators — OQ:stacks-satellite. semver (11 rules), Conventional Commits (16; v1.0.0 cited), Keep a Changelog (7 principles; v1.1.2 cited), RUP — OQ:twenty-rules, OQ:genesis-history. nextjs.org/docs — OQ:docs-funnel. Anthropic's flagship skill collection (17 skills) — OQ:shipped-skills.
- Claude Code / Cursor (agents; `.claude/skills/` location) — personas, quick-start, skill-map, OQ:layers-beyond-technology.

### Recurring concepts
- **Drift as a number / drift 0 / `align -> verify -> drift`** — quick-start, positioning, personas, how-this-repo-works, ecosystem, faq, OQ:conformance-is-a-degree, OQ:layers-beyond-technology, OQ:twenty-rules, ID:capability-stacks. **Adoption percentage** (adopted over applicable) — OQ:conformance-is-a-degree.
- **Structure vs judgment tier** (what drift 0 certifies) — faq, OQ:twenty-rules.
- **Clarify gate / `## Clarifications` / `[NEEDS CLARIFICATION]` / `Status: ready-to-develop`** — positioning, personas, skill-map, CS:the-silently-skipped-clarify, OQ:status-frontmatter.
- **Spec Status lifecycle** `in-refinement -> ready-to-develop -> in-development -> live` — OQ:status-frontmatter, personas (Paula).
- **Ideas lifecycle** `idea -> exploring -> approved | parked | dropped` (+ `graduated`) — skill-map, CS:proposed-does-not-mean-maybe, ID:README.
- **Profiles core/scale; 9 scale entries; ADR-040 trigger; possible `audit` profile** — faq, personas (Olek), OQ:conformance-is-a-degree, OQ:personas-gate, OQ:profiles, OQ:work-periods, ecosystem, OQ:stacks-satellite.
- **Layer 1 / Layer 2; one stack per technology; variation as profile/adoption mode** — how-this-repo-works, ecosystem, OQ:README, OQ:layers-beyond-technology, OQ:stack-lifecycle-skills, OQ:stack-offer-on-adoption, OQ:stacks-satellite, ID:capability-stacks, quick-start.
- **Two zones / one authored tree / no second copy** — README, how-this-repo-works, OQ:one-tree, OQ:folder-readmes.
- **Adapt classes copy / merge / fill** — skill-map, OQ:conformance-is-a-degree, OQ:one-tree, OQ:folder-readmes, OQ:stack-lifecycle-skills.
- **Discriminability (descriptions name a situation; no two overlap)** — OQ:authoring-skills, OQ:shipped-skills, OQ:stack-lifecycle-skills.
- **Process by memory vs AI-led, gated loop (five layers)** — CS:the-silently-skipped-clarify, personas (Coding agent).
- **Enabling work is tracker-shaped** — CS:enabling-work-out-of-the-spec.
- **Record numbers gapless, never reused, minted against `main`** — CS:parallel-record-minting.
- **Base PRs on `main`; rebase-merge; squash sanctioned alternative** — CS:stacked-prs-on-a-moving-base, OQ:rebase-merge.
- **Living standard; latest is the target; release-based vs main-based channel** — README, how-this-repo-works, faq, OQ:conformance-is-a-degree, OQ:staying-current.
- **Waves (protection -> code-shaping -> proof -> automation), re-entrant align, intake question round, consent** — ecosystem, faq, positioning, skill-map, OQ:stack-offer-on-adoption, OQ:work-periods (name collision).
- **Three postures for tracking (bridged / in-repo / both)** — faq, OQ:default-tracker, OQ:tracker-history.
- **Anonymization (kind of product, never the name)** — CS:README, OQ:case-anonymization, skill-map (record-run).
- **Generated pages that CI checks** — README, skill-map, OQ:folder-readmes, OQ:docs-funnel.
- **One messaging source (quote, never reword)** — positioning. **One source, two surfaces** — OQ:docs-funnel.
- **Git is mechanics, the changelog is the history; order may be narrative, timestamps may not lie** — OQ:genesis-history.
- **Hooks require Node + jq; deny-by-default without jq** — quick-start.
- **No public adopter yet / single-author weakness** — faq, OQ:README, OQ:npm-as-a-channel, OQ:profiles (smallest field-run team 38 authors).

### Dates and version facts
- 2026-08-02: tracker optional posture; landscape check (Spec Kit/OpenSpec/BMAD star counts; discovery via comparison articles); shipped-skills and folder-readmes revisions; authoring skills shipped (15 -> 19); skill context measured (4,772 chars / ~1,190 tokens; 6,319 chars / ~1,580 tokens); `cycle` chosen; a large `main` move.
- 2026-08-03: capability-stacks idea; conformance question opened; `idea-write` added.
- 2026-08-07: `sprint` replaces `cycle`.
- 2026-08-09: no-npm decision; `record-run` added.
- 2026-08-10: 0.9.0 cut (270 commits, six fixups folded, 264 untouched); layer candidates named.
- 2026-08-13: `show-backlog` added on field evidence.
- 2026-08-18: hermes-inspired-patterns idea.
- 2026-08-19: 1.0.0 cut (1.0.0-1.0.13 and 1.1.0-1.1.25 renumbered to 0.8.0-0.8.13 and 0.9.0-0.9.25); `RET1` entry line retired.
- 2026-09-03: dashboard-cross-repo-switcher approved; `record-run` moved out of the shipped tree; h monorepo adoption run (stack offered 09:55, landed 11:05 UTC, questioned 12:14).
- Versions: first stable line tagged since 1.0.0 (faq); checkout tag 1.0.19; build-era history 51 PRs (genesis); 21 shipped skills (skill-map, shipped-skills) vs "19 lifecycle skills" as written in OQ:stack-lifecycle-skills and OQ:authoring-skills (counts as of their writing).
