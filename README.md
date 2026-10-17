# ATW306 AI Student Service

Student support ticket portal. A student submits one ticket in one portal.
The system screens it, routes it, drafts a reply from the official FAQ (RAG)
with sources, and a staff member reviews and approves every draft before the
student ever sees it. Sensitive tickets go straight to a human. Spam is
discarded.

## Local development

### Mock API

The API contract lives in `docs/api/openapi.yaml`. Before the real backend
exists, run it as a mock server so the frontend and agent work can start
against a realistic API:

```bash
npm install
npm run mock-api
```

This starts a mock server on `http://localhost:4010` that returns the
realistic example data defined in the spec (sample ticket, AI draft with FAQ
sources, published reply) instead of random placeholder values. Stop it with
`Ctrl+C`.

Try it:

```bash
curl http://localhost:4010/tickets/a1b2c3d4-5e6f-7890-abcd-ef1234567890
curl http://localhost:4010/tickets/a1b2c3d4-5e6f-7890-abcd-ef1234567890/status
curl http://localhost:4010/tickets
```

To check the spec itself is still valid after editing it:

```bash
npm run lint-api
```

### Backend, database, agent

Not set up yet — this section will grow as `backend/`, `agent/`, and
`docker-compose.yml` come online.

## Project structure

```
AIstudentService/
├── docs/              api/openapi.yaml, adr/
├── shared/            enums, Zod types, fixtures
├── frontend/
├── backend/
├── agent/             prompts/, src/
└── eval/
```
