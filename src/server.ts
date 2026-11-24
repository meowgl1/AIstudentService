// Minimal backend to wire the frontend to a real HTTP server while the real
// pipeline (screening/routing/RAG/LLM, Leng's DB tables) isn't built yet.
// In-memory only - restarting the process clears all tickets.
//
// ponytail: no AI and no DB here. Team assignment auto-drafts a placeholder
// reply instead of calling agent/src/retriever.ts, just enough to exercise
// every state transition in docs/api/openapi.yaml. Swap this stub for the
// real pipeline once screening/routing/drafting exist.
//
// Usage: node --import tsx src/server.ts
import { randomUUID } from "node:crypto";
import express from "express";
import type { Request, Response } from "express";

const STATUSES = [
  "RECEIVED", "SCREENING", "DISCARDED", "ROUTING", "DRAFTING",
  "PENDING_REVIEW", "NEEDS_ASSIGNMENT", "ESCALATED", "PUBLISHED"
] as const;
type TicketStatus = typeof STATUSES[number];

const TEAMS = ["ACADEMIC", "IT", "ADMIN", "FINANCE", "STUDENT_SERVICES"] as const;
type SupportTeam = typeof TEAMS[number];

interface Source { title: string; sectionId: string; excerpt: string; sourceUrl?: string }
interface Draft { content: string; sources: Source[]; draftedAt: string }
interface PublishedReply extends Draft { publishedAt: string; publishedBy: string | null }

interface Ticket {
  ticketId: string;
  status: TicketStatus;
  studentName: string;
  studentEmail: string;
  subject: string;
  body: string;
  team: SupportTeam | null;
  screening: { isSpam: boolean; isSensitive: boolean; isPromptInjectionAttempt: boolean; needsHumanReview: boolean; reason: string | null } | null;
  draft: Draft | null;
  reply: PublishedReply | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
}

const tickets = new Map<string, Ticket>();

function ok(res: Response, data: unknown, status = 200, meta?: unknown) {
  res.status(status).json({ success: true, data, error: null, ...(meta ? { meta } : {}) });
}
function fail(res: Response, status: number, error: string) {
  res.status(status).json({ success: false, data: null, error });
}

function isNonEmptyString(v: unknown, maxLength: number): v is string {
  return typeof v === "string" && v.trim().length > 0 && v.length <= maxLength;
}

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
// Serves frontend/ directly so one Render web service hosts both the API and
// the static pages - same origin, no CORS to configure for the real deploy.
app.use(express.static("frontend"));

// POST /tickets
app.post("/tickets", (req: Request, res: Response) => {
  const { studentName, studentEmail, subject, body } = req.body ?? {};
  if (!isNonEmptyString(studentName, 120) || !isNonEmptyString(subject, 200) || !isNonEmptyString(body, 4000)) {
    return fail(res, 422, "Please check the form fields.");
  }
  if (typeof studentEmail !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studentEmail)) {
    return fail(res, 422, "Please check the form fields.");
  }

  const now = new Date().toISOString();
  const ticket: Ticket = {
    ticketId: randomUUID(),
    status: "NEEDS_ASSIGNMENT", // ponytail: real pipeline would run SCREENING/ROUTING first
    studentName, studentEmail, subject, body,
    team: null, screening: null, draft: null, reply: null, reviewNote: null,
    createdAt: now, updatedAt: now
  };
  tickets.set(ticket.ticketId, ticket);
  ok(res, { ticketId: ticket.ticketId, status: ticket.status }, 202);
});

// GET /tickets
app.get("/tickets", (req: Request, res: Response) => {
  const { status, team } = req.query;
  if (status && !STATUSES.includes(status as TicketStatus)) return fail(res, 422, "Invalid status.");
  if (team && !TEAMS.includes(team as SupportTeam)) return fail(res, 422, "Invalid team.");

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

  let list = [...tickets.values()];
  if (status) list = list.filter(t => t.status === status);
  if (team) list = list.filter(t => t.team === team);
  list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const total = list.length;
  const page_ = list.slice((page - 1) * limit, page * limit).map(t => ({
    ticketId: t.ticketId, subject: t.subject, status: t.status, team: t.team,
    createdAt: t.createdAt, updatedAt: t.updatedAt
  }));
  ok(res, page_, 200, { total, page, limit });
});

function getOr404(req: Request, res: Response): Ticket | undefined {
  const ticket = tickets.get(req.params.ticketId as string);
  if (!ticket) fail(res, 404, "Ticket not found.");
  return ticket;
}

// GET /tickets/{id}/status
app.get("/tickets/:ticketId/status", (req, res) => {
  const ticket = getOr404(req, res);
  if (!ticket) return;
  ok(res, {
    ticketId: ticket.ticketId,
    status: ticket.status,
    reply: ticket.status === "PUBLISHED" ? ticket.reply : null
  });
});

// GET /tickets/{id}
app.get("/tickets/:ticketId", (req, res) => {
  const ticket = getOr404(req, res);
  if (!ticket) return;
  ok(res, ticket);
});

// PATCH /tickets/{id}/team
app.patch("/tickets/:ticketId/team", (req, res) => {
  const ticket = getOr404(req, res);
  if (!ticket) return;
  if (ticket.status !== "NEEDS_ASSIGNMENT") return fail(res, 409, "Ticket is not in NEEDS_ASSIGNMENT.");
  const { team } = req.body ?? {};
  if (!TEAMS.includes(team)) return fail(res, 422, "Invalid team.");

  const now = new Date().toISOString();
  ticket.team = team;
  // ponytail: placeholder draft instead of calling the real RAG pipeline
  ticket.draft = {
    content: `Hi ${ticket.studentName}, thanks for reaching out. A member of the ${team} team will confirm the details shortly. (placeholder draft - no AI wired up yet)`,
    sources: [],
    draftedAt: now
  };
  ticket.status = "PENDING_REVIEW";
  ticket.updatedAt = now;
  ok(res, ticket);
});

// PATCH /tickets/{id}/draft
app.patch("/tickets/:ticketId/draft", (req, res) => {
  const ticket = getOr404(req, res);
  if (!ticket) return;
  if (ticket.status !== "PENDING_REVIEW") return fail(res, 409, "Ticket is not in PENDING_REVIEW, draft cannot be edited.");
  const { content } = req.body ?? {};
  if (!isNonEmptyString(content, 4000)) return fail(res, 422, "Please check the form fields.");

  ticket.draft = { content, sources: ticket.draft?.sources ?? [], draftedAt: ticket.draft?.draftedAt ?? new Date().toISOString() };
  ticket.updatedAt = new Date().toISOString();
  ok(res, ticket);
});

// POST /tickets/{id}/approve
app.post("/tickets/:ticketId/approve", (req, res) => {
  const ticket = getOr404(req, res);
  if (!ticket) return;
  if (ticket.status !== "PENDING_REVIEW") return fail(res, 409, "Ticket is not in PENDING_REVIEW, cannot be approved.");

  const now = new Date().toISOString();
  ticket.reply = { ...ticket.draft!, publishedAt: now, publishedBy: req.body?.reviewedBy ?? null };
  ticket.status = "PUBLISHED";
  ticket.updatedAt = now;
  ok(res, ticket);
});

// POST /tickets/{id}/reject
app.post("/tickets/:ticketId/reject", (req, res) => {
  const ticket = getOr404(req, res);
  if (!ticket) return;
  if (ticket.status !== "PENDING_REVIEW") return fail(res, 409, "Ticket is not in PENDING_REVIEW, cannot be rejected.");
  const { reason } = req.body ?? {};
  if (!isNonEmptyString(reason, 4000)) return fail(res, 422, "Please check the form fields.");

  ticket.status = "ESCALATED";
  ticket.reviewNote = reason;
  ticket.updatedAt = new Date().toISOString();
  ok(res, ticket);
});

// POST /tickets/{id}/reply
app.post("/tickets/:ticketId/reply", (req, res) => {
  const ticket = getOr404(req, res);
  if (!ticket) return;
  if (ticket.status !== "ESCALATED") return fail(res, 409, "Ticket is not ESCALATED, manual reply not applicable.");
  const { content } = req.body ?? {};
  if (!isNonEmptyString(content, 4000)) return fail(res, 422, "Please check the form fields.");

  const now = new Date().toISOString();
  ticket.reply = { content, sources: [], draftedAt: now, publishedAt: now, publishedBy: req.body?.repliedBy ?? null };
  ticket.status = "PUBLISHED";
  ticket.updatedAt = now;
  ok(res, ticket);
});

// Only listen when run directly (`tsx src/server.ts`), not when imported by the smoke test.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, () => console.log(`Stub backend listening on http://localhost:${PORT}`));
}

export { app };
