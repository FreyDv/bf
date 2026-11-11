# Quick start

One sentence to your coding agent. Nothing to install, nothing to clone.

```
> start a new project on repositorystandards.com with the node stack
```

Already have a repository?

```
> take this repo onto repositorystandards.com with the node stack
```

## What happens next

The agent reads the standard, then reads this layer, then asks you the handful of things
it cannot work out for itself - what you are building, which of these picks apply, what you
already run that should stay. It does not hand you a folder to reconcile; it adapts.

That distinction is the whole reason this repository is small. It is **decisions and a
reference implementation**, not a framework you install. Nothing here has a version you
depend on.

## What you get

| | |
|---|---|
| **A running application** | Next.js and Fastify behind one proxy, sign-up through to a dashboard, tests at three tiers. A CI run boots it on every change, so "it works" is a result rather than a claim. |
| **Every pick argued** | Each choice names what it was chosen against and what would make you right to deviate. [The decisions](DECISIONS.md) is the whole of it - read the table, dig only where you disagree. |
| **A path for a repo that exists** | Per entry, from what you have to what this ships, in an order that does not break the build. That is [adapting](ADAPTING.md), and it is the half most standards skip. |

## If you would rather just read the code

Fair, and the starter is a real application:

```
npx degit repository-standards/node/starter my-app
cd my-app && pnpm install && pnpm dev
```

Sign-up to dashboard works with no setup. Treat it as reading rather than adopting: copying
a tree is how a repository ends up carrying decisions nobody made for it, and that is the
failure the standard exists to prevent. It does not stop being one because the tree is good.
