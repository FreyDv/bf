# Security

**Reporting a vulnerability.** Open an issue titled `security contact` with no technical details; the owner replies
in the issue and agrees a private channel with you. Never put the details of anything exploitable in a public issue.
Expect an acknowledgment within 3 business days. GitHub's private vulnerability reporting is not enabled
(ADR-062).

**Scope.** This repository and whatever it deploys; third-party dependencies go to their own maintainers.

**No secrets in this repo.** Enforced by the gitleaks gate (`.github/workflows/gitleaks.yml`, `.gitleaks.toml`) -
a leaked secret is rotated, not deleted from history and forgotten.

**Baseline.** The security baseline (the axes of the standard's `security-baseline.md`) is recorded in
[ADR-037](docs/decision-records/adr/ADR-037-security-baseline.md). Agent access to remote databases, force-pushes and
CI secrets is write-blocked by `.claude/settings.json` and the hooks under `.claude/hooks/`.

**Embargo.** A fix for an undisclosed vulnerability is developed in the temporary private fork of a GitHub security
advisory, not in a public branch, issue or pull request. The owner lifts the embargo by publishing the advisory once
the fixed image is published.
