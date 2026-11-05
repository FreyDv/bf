# Perf history

Dated snapshots of perf measurements, one file per run, kept so we can see how
metrics move **across deployments**. Unlike `.results/` (gitignored, overwritten
each run), these are committed.

- Naming: `YYYY-MM-DD-<target>.json` (`local` = the production build served
  locally; any other name - `dev`, `qa`, `perf`, `prod`, ... - = the app deployed to
  that environment. The deployed targets are the trustworthy trend; local is
  machine-specific).
- Each file carries a `deploy` block (`ref`, `commit`, `note`) so a snapshot is
  tied to the code it measured.
- Each file also carries a `changesSincePrevious` block: `range`, `summary` (a
  plain-language account of what changed between this run and the previous
  same-target snapshot), `likelyCause` (the one-line "why the number moved"),
  and `keyCommits` (the supporting evidence). `keyCommits` is auto-filled from
  `git log <prev>..HEAD` over `apps` / `services` / `packages`, already filtered
  to perf-relevant subjects (cosmetic commits - a button, a footer colour, a
  format pass - are dropped). `summary` and `likelyCause` are an analysis
  written from those commits, not a raw dump.
- The `baseline*.json` files stay the rolling reference for `pnpm test:perf` /
  `pnpm test:perf:prod`; history files are an append-only archive and are **not**
  used by `compare.mjs`.

The runner writes a snapshot here **automatically** at the end of every run
(`run-perf.mjs` -> `archiveHistory`): `YYYY-MM-DD-<target>.json`, with `deploy.ref`
/ `deploy.commit` filled from git and `deploy.note` left empty. It never clobbers
an existing file for the same day (first run of the day wins), so after the run
open today's file and turn the auto-filled `keyCommits` into the `summary` and
`likelyCause` analysis (and write `deploy.note`: what deployed, what to expect).
Run again on a different day for the next point. Don't update the baselines unless
you intend to move the reference point.
