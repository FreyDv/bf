# Contributing

This repository is one layer of [Repository Standards](https://repositorystandards.com):
the Node and TypeScript picks, the reasoning behind them, and a starter that is verified
by being booted rather than by being described. The method itself lives in
[the core](https://github.com/repository-standards/core) - a change to how the standard
works belongs there, not here.

## What belongs here

- **A pick that is wrong for a real repository.** The most valuable contribution: name the
  repository shape it fails on, not the preference. Every decision carries an escape hatch
  for exactly this reason, and an escape hatch that nobody has needed is a hypothesis.
- **A default that is unsafe once copied.** See [SECURITY.md](SECURITY.md) - report it
  privately if it is exploitable.
- **An adapting note that does not survive contact with a brownfield repository.** The
  notes in [ADAPTING.md](ADAPTING.md) are the half that decides whether this is adoptable;
  a note that assumes a clean tree is worth less than no note.

## What does not

- A pick swapped for a preference. Each one is recorded with what it was chosen against;
  reopening it means engaging with that, not restating the alternative.
- A dependency added without a decision. Every pick that survives is in
  [DECISIONS.md](DECISIONS.md), and the escape hatch is part of the entry.

## The bar

A change to what the tree ships **moves the version** and the boot pulse must stay green -
that run is what makes "boot-verified" a fact rather than a slogan. If your change cannot
be proven by it, say what would prove it instead.

Pull requests sit on `main` and land by rebase, so each commit is published on its own and
needs a message that stands alone.
