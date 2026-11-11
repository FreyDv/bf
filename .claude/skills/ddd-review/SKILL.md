---
name: ddd-review
description: Use before opening a pull request that touches backend code, or when asked "does this follow our architecture", "review the structure", "is this hexagonal enough", "check the rules". Reads the diff against every group of .claude/rules/architecture-rules.md using the AIP-6 checklist and reports violations with the rule ID, severity and the fix. Run it before pre-pr-review.
---

# ddd-review

A fresh-context read of the branch's backend diff against `.claude/rules/architecture-rules.md`, using the
checklist AIP-6 in `.claude/rules/ai-protocol.md`. List first, fix after; do not fix while reading.

1. `git diff --name-only main...HEAD` - group the changed files by module and layer.
2. Run the mechanical gates and report their output verbatim: the boundary check (ENF-1), the test suite,
   `node scripts/spec-guard.mjs --audit --block`. If the boundary check does not exist, that is the first
   finding (blocker).
3. Walk checklist items 1-9 of AIP-6 over every changed file; cite the rule ID for each finding.
4. Report a table `file | rule ID | finding | fix | severity` (`blocker` = MUST/MUST NOT broken or a gate
   failed; `advice` = SHOULD/AVOID). A diff with no blockers and green gates passes.
5. Fix the blockers, re-run step 2, then hand over to `pre-pr-review`.

Not a correctness or security review (that is `pre-pr-review` and CI), not a style pass, and not a place
to re-argue a rule: a rule that keeps being contested gets a superseding ADR, never a silent exception.
