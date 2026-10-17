# Contributing

Quick reference for the team: git workflow and how to use the API.
For the full git guide (first-time repo setup, detailed best practices),
see [`docs/git-guide.md`](docs/git-guide.md).

## Getting the code

```bash
git clone <repo-url>
cd AIstudentService
```

## Staying in sync

Before starting new work, always pull the latest `main`:

```bash
git checkout main
git pull
```

## Branching

One branch per piece of work. Name it:

```
feat/<area>-<what>     e.g. feat/backend-ticket-creation
fix/<area>-<what>      e.g. fix/agent-routing-timeout
```

```bash
git checkout -b feat/frontend-ticket-form
```

## Committing

Format: `type(area): short description`

Types: `feat` `fix` `refactor` `test` `docs` `chore` `perf`

```bash
git add <files>
git commit -m "feat(backend): add ticket creation endpoint"
```

Rules:
- One logical change per commit.
- Present tense, imperative mood ("add", not "added").
- No "WIP", "misc", "updates" — be specific.
- Never commit `.env`, secrets, or `node_modules/`.

## Pushing and opening a PR

```bash
git push -u origin feat/frontend-ticket-form
```

Then open a PR on GitHub:
- Description: what changed, why, how to test it.
- Keep it small — aim for under ~400 lines changed. Split bigger work into more than one PR.
- Needs 1 approval and a green CI run before merging.
- Merge with **squash merge**.
- Never force-push to `main`.

## Pulling in someone else's changes

```bash
git checkout main
git pull
git checkout <your-branch>
git merge main
```

If you get conflicts, resolve them in your editor, then:

```bash
git add <resolved-files>
git commit
```

## Using the API

The API contract is `docs/api/openapi.yaml`. It is the source of truth — the
real backend, the frontend, and the database schema all follow from it.

Until the real backend exists, run it as a mock server:

```bash
npm install
npm run mock-api
```

This starts a mock server at `http://localhost:4010` using the example data
defined in the spec. Point your frontend/agent code at this URL during local
development.

```bash
curl http://localhost:4010/tickets/a1b2c3d4-5e6f-7890-abcd-ef1234567890
curl http://localhost:4010/tickets/a1b2c3d4-5e6f-7890-abcd-ef1234567890/status
curl http://localhost:4010
```

If you change `openapi.yaml`, validate it before committing:

```bash
npm run lint-api
```

Known gap: staff endpoints have no authentication yet (synthetic data only,
MVP). Don't rely on this for anything beyond local dev.

## Where to look next

- `README.md` — project overview and setup.
- `docs/api/openapi.yaml` — the API contract.
