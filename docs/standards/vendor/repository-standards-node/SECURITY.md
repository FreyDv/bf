# Security policy

This repository ships a reference monorepo and the decisions behind it. It runs no
service and collects nothing. The realistic surface is what an adopter copies: the
session gates, the redirect handling, the CI templates and the supply-chain policy -
a weak default here becomes a weak default in every repository that adopts it.

## Reporting

Found a default that is unsafe once copied - a gate that can be walked past, a
redirect that survives a round trip, a workflow with more permission than it needs?
Email **bodurkalukasz@gmail.com** with the file and the scenario. You will get an
answer within **7 days**. Please do not open a public issue for anything exploitable
before it is fixed.

The starter's own guards are the first place to look: the boot pulse asserts them on
every push, so a report that makes the pulse red is the most useful shape a report
can take.

## Not secrets

No credentials or tokens live here. The starter's env is schema-validated at boot and
every value comes from the environment; a committed secret would be a security report,
not a convenience.
