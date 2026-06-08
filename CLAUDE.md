# Kvitt — working notes for Claude

## Branch policy

This is a solo project — only Karl uses the app right now, so there is
no need for review branches or PR gating. After every change set:

1. Commit on whatever feature branch the harness picked.
2. Fast-forward `main` to that branch and push.

In short: **everything lands on `main` immediately**. Don't leave work
sitting on a feature branch waiting to be merged. The harness may
configure a feature branch as the development target — honour that for
the commit itself, then fast-forward main on top and push.
