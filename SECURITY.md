# Security

**Reporting a vulnerability.** Use GitHub's private vulnerability reporting on this repository (Security tab ->
"Report a vulnerability") so the report reaches the owner without a public issue; do not open a public issue for
anything exploitable. Expect an acknowledgment within 3 business days.

**Scope.** This repository and whatever it deploys; third-party dependencies go to their own maintainers.

**No secrets in this repo.** Enforced by the gitleaks gate (`.github/workflows/gitleaks.yml`, `.gitleaks.toml`) -
a leaked secret is rotated, not deleted from history and forgotten.

**Baseline.** The security baseline (the axes of the standard's `security-baseline.md`) is recorded in
[ADR-037](docs/decision-records/adr/ADR-037-security-baseline.md). Agent access to remote databases, force-pushes and
CI secrets is write-blocked by `.claude/settings.json` and the hooks under `.claude/hooks/`.

**Embargo.** A fix for an undisclosed vulnerability is developed in the temporary private fork of a GitHub security
advisory, not in a public branch, issue or pull request. The owner lifts the embargo by publishing the advisory once
the fixed image is published.
