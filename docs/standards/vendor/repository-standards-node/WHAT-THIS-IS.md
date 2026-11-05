# What this is

The **stack layer** of Repository Standards: the Node and TypeScript picks, the reasoning
behind each one, and a reference implementation that a CI run boots end to end on every
change.

It is decisions and files. Not a framework, not a dependency - nothing here has a version
your project resolves.

## Why it is a separate repository

The method moves slowly and technology does not. Splitting them lets the picks change at
technology speed while the way of working stays still, and it keeps the standard itself free
of any technology's vocabulary.

One stack per technology, by policy. Variation is a profile or an adoption mode inside this
repository, never a sibling repository - two repositories claiming the same technology is how
a standard forks in public.

The link back to the core is a **pointer, not a version range**. The standard is living and
latest is the only target, so there is no compatibility matrix to maintain and no core
release that has to wait for this one.

## What you actually get

| | |
|---|---|
| **The decisions** | Eighteen picks, grouped by area, each naming what it was chosen against and what would make you right to deviate. The escape hatch is part of the pick, not an afterthought - a paved road nobody may leave is a cage. |
| **A running application** | Next.js and Fastify behind one proxy, sign-up through to a dashboard, three test tiers, real dependencies in Docker rather than mocks. The weekly boot is what makes "it works" a result instead of a claim. |
| **A path for a repository that exists** | Per entry, from what you have to what this ships, in an order that keeps the build green. Most standards describe the destination and leave the journey to you. |

## How it is verified

The same engine that verifies the standard verifies this layer, reading the same manifest
schema, and reports **one drift number across both**. There is no separate compliance story
for the stack: a repository on the standard with the Node stack has one number, and it counts
what you took rather than what exists.

## What it deliberately does not decide

Your datastore, your query layer, your deploy target. Those are the least portable decisions
a repository makes, and a stack that picked them for you would be wrong for most readers
while sounding authoritative. The shape ships - container-ready, env-only config, stdout
logging - and the choice is a record you write.
