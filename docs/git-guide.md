# Git Guide

Full reference for how we use git on this project. For the short version,
see `CONTRIBUTING.md` at the repo root — this file goes deeper and covers
first-time setup.

## 1. Creating the repository (one-time, done by the lead)

This has not been done yet. Steps:

1. Create an empty repository on GitHub (no README, no .gitignore, no
   licence — we already have these locally).
   - Via the web: GitHub → New repository → name it, set to private, don't
     initialise with any files.
   - Via CLI (if `gh` is installed and logged in):
     ```bash
     gh repo create <org-or-user>/AIstudentService --private --source=. --remote=origin
     ```
2. If you created it via the web instead, connect the local folder to it:
   ```bash
   cd AIstudentService
   git init
   git add .
   git commit -m "chore(repo): initial project structure"
   git branch -M main
   git remote add origin <repo-url>
   git push -u origin main
   ```
3. On GitHub, set up branch protection on `main` (Settings → Branches → add
   rule for `main`):
   - Require a pull request before merging (at least 1 approval).
   - Require status checks to pass before merging (once CI exists in
     `.github/workflows/`).
   - Require branches to be up to date before merging.
   - Do not allow force pushes to `main`.
   - Do not allow direct pushes to `main` — everything goes through a PR,
     including the lead's own changes.
4. Add the team as collaborators (or invite to the org/team if using one).

## 2. First-time setup (everyone else)

```bash
git clone <repo-url>
cd AIstudentService
npm install
```

Set your name and email if you haven't already (global, once per machine):

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

## 3. Daily workflow

```bash
git checkout main
git pull                          # start from the latest main
git checkout -b feat/backend-ticket-creation
# ... make changes ...
git add <files>
git commit -m "feat(backend): add ticket creation endpoint"
git push -u origin feat/backend-ticket-creation
# open a PR on GitHub
```

## 4. Branch naming

```
feat/<area>-<what>       new functionality
fix/<area>-<what>        bug fix
refactor/<area>-<what>   restructuring, no behaviour change
chore/<area>-<what>      tooling, deps, config
docs/<area>-<what>       documentation only
```

`<area>` is one of: `frontend`, `backend`, `agent`, `shared`, `docs`,
`infra`, `eval`. Keeps it obvious who/what a branch touches.

Examples:
```
feat/frontend-ticket-form
fix/agent-routing-timeout
refactor/backend-ticket-repository
chore/infra-docker-compose
```

Keep branches short-lived — days, not weeks. Long-lived branches drift from
`main` and cause painful merges.

## 5. Commit messages

Format: `type(area): short description`, present tense, imperative mood.

Types: `feat` `fix` `refactor` `test` `docs` `chore` `perf`

Good:
```
feat(backend): add ticket creation endpoint
fix(agent): handle empty FAQ search results
refactor(shared): extract ticket status enum
test(backend): add duplicate ticket detection cases
docs(api): document reject endpoint
chore(infra): add docker-compose for postgres
```

Bad (don't do this):
```
fixed stuff
WIP
updates
asdf
```

Rules:
- One logical change per commit. If your commit message needs "and", it's
  probably two commits.
- Commit often locally — squash merge on the PR cleans up the history
  anyway, so don't worry about having a messy branch.
- Never commit secrets, `.env` files, or `node_modules/` — check
  `.gitignore` covers it before adding new file types to the repo.

## 6. Pull requests

- One PR = one reviewable chunk of work. Aim for under ~400 lines changed.
  If a feature is bigger than that, split it (e.g. backend endpoint in one
  PR, frontend wiring in a follow-up).
- PR description covers: what changed, why, how to test it.
- Needs 1 approval + green CI before merging.
- Merge with **squash merge** — keeps `main`'s history to one commit per
  PR, regardless of how messy the branch's own commits were.
- Delete the branch after merging (GitHub can do this automatically on
  merge — enable it in repo settings).

## 7. Keeping your branch up to date

Prefer merge over rebase on this project — simpler to reason about in a
group, and we're not precious about a linear history since PRs get squashed
anyway.

```bash
git checkout main
git pull
git checkout <your-branch>
git merge main
```

If there's a conflict, git will tell you which files. Open them, look for
`<<<<<<<` / `=======` / `>>>>>>>` markers, pick the correct content, then:

```bash
git add <resolved-files>
git commit
```

## 8. Best practices / do's and don'ts

- **Never** commit `.env`, `*.pem`, `*.key`, or anything under `secrets/` —
  these are already in `.gitignore`. Double-check `git status` before
  committing if you've been handling credentials.
- **Never** force-push to `main`. Force-pushing your own feature branch
  (e.g. after a rebase) is fine.
- **Never** commit generated files that can be rebuilt (`node_modules/`,
  `dist/`, `.next/`, `__pycache__/`) — they're in `.gitignore` for a reason.
- Don't commit broken code to a shared branch. If CI is red, fix it before
  anyone else pulls.
- Don't leave a PR open and unreviewed for days — ping the team.
- If you're not sure whether something should be committed, ask before
  `git add .`-ing a whole directory blind.

## Quick command cheat-sheet

```bash
git status                      # what's changed
git pull                        # get latest from current branch's remote
git checkout -b feat/x-y        # new branch
git add <file>                  # stage a file
git commit -m "feat(x): y"      # commit staged changes
git push -u origin feat/x-y     # first push of a new branch
git push                        # subsequent pushes
git log --oneline -10           # recent history, compact
git diff                        # unstaged changes
git diff --staged               # staged changes
```
