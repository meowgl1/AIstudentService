import { createHash, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import express from "express";
import type { Request, Response } from "express";
import { ZodError } from "zod";
import { transitionTicket, type Ticket } from "./domain.js";
import { createTicketStoreFromEnv, type TicketStore } from "./store.js";
import {
  approveSchema,
  assignTeamSchema,
  createTicketSchema,
  editDraftSchema,
  listTicketsQuerySchema,
  manualReplySchema,
  rejectSchema,
  ticketIdSchema,
} from "./validation.js";

const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = Number(process.env.TICKET_RATE_LIMIT ?? "5");

function ok(res: Response, data: unknown, status = 200, meta?: unknown) {
  res.status(status).json({ success: true, data, error: null, ...(meta ? { meta } : {}) });
}

function fail(res: Response, status: number, error: string) {
  res.status(status).json({ success: false, data: null, error });
}

function contentHash(studentEmail: string, subject: string, body: string) {
  const normalise = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
  return createHash("sha256")
    .update(`${normalise(studentEmail)}\n${normalise(subject)}\n${normalise(body)}`)
    .digest("hex");
}

async function loadTicket(store: TicketStore, req: Request, res: Response) {
  const parsedId = ticketIdSchema.safeParse(req.params.ticketId);
  if (!parsedId.success) {
    fail(res, 404, "Ticket not found.");
    return null;
  }
  const ticket = await store.get(parsedId.data);
  if (!ticket) fail(res, 404, "Ticket not found.");
  return ticket;
}

async function saveTransition(
  store: TicketStore,
  ticket: Ticket,
  next: Ticket["status"],
  eventType: string,
  details: Record<string, unknown> = {},
) {
  const updated = transitionTicket(ticket, next);
  await store.update(updated);
  await store.logEvent(updated.ticketId, eventType, { from: ticket.status, to: next, ...details });
  return updated;
}

// Temporary bridge until Santiago's screening/routing pipeline is merged.
// It preserves the agreed state order and hands the ticket to staff assignment.
async function runPreAgentStub(ticketId: string, store: TicketStore) {
  let ticket = await store.get(ticketId);
  if (!ticket || ticket.status !== "RECEIVED") return;
  ticket = await saveTransition(store, ticket, "SCREENING", "status_changed", { mode: "stub" });
  ticket = await saveTransition(store, ticket, "ROUTING", "status_changed", { mode: "stub" });
  await saveTransition(store, ticket, "NEEDS_ASSIGNMENT", "routing_needs_assignment", { mode: "stub" });
}

export function createApp(store: TicketStore = createTicketStoreFromEnv()) {
  const app = express();
  const attemptsByIp = new Map<string, number[]>();

  app.set("trust proxy", 1);
  app.use(express.json({ limit: "32kb" }));
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
  app.use(express.static("frontend"));

  app.post("/tickets", async (req: Request, res: Response) => {
    const ip = req.ip || "unknown";
    const nowMs = Date.now();
    const recent = (attemptsByIp.get(ip) ?? []).filter((t) => nowMs - t < RATE_LIMIT_WINDOW_MS);
    if (recent.length >= RATE_LIMIT_MAX) {
      const retryAfter = Math.max(1, Math.ceil((RATE_LIMIT_WINDOW_MS - (nowMs - recent[0])) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      return fail(res, 429, "Too many requests. Please wait and try again.");
    }
    recent.push(nowMs);
    attemptsByIp.set(ip, recent);

    const parsed = createTicketSchema.safeParse(req.body ?? {});
    if (!parsed.success) return fail(res, 422, "Please check the form fields.");

    const hash = contentHash(parsed.data.studentEmail, parsed.data.subject, parsed.data.body);
    const duplicateSince = new Date(nowMs - DUPLICATE_WINDOW_MS).toISOString();
    if (await store.isDuplicate(parsed.data.studentEmail, hash, duplicateSince)) {
      return fail(res, 409, "A matching ticket was submitted recently.");
    }

    const now = new Date(nowMs).toISOString();
    const ticket: Ticket = {
      ticketId: randomUUID(),
      status: "RECEIVED",
      ...parsed.data,
      team: null,
      screening: null,
      draft: null,
      reply: null,
      reviewNote: null,
      createdAt: now,
      updatedAt: now,
    };

    await store.create(ticket, hash);
    await store.logEvent(ticket.ticketId, "ticket_created", { ip });
    ok(res, { ticketId: ticket.ticketId, status: ticket.status }, 202);

    queueMicrotask(() => {
      void runPreAgentStub(ticket.ticketId, store).catch((error) =>
        console.error(`Background pipeline failed for ${ticket.ticketId}`, error),
      );
    });
  });

  app.get("/tickets", async (req: Request, res: Response) => {
    const parsed = listTicketsQuerySchema.safeParse(req.query);
    if (!parsed.success) return fail(res, 422, "Invalid query parameter.");

    const result = await store.list(parsed.data);
    const summaries = result.tickets.map((ticket) => ({
      ticketId: ticket.ticketId,
      subject: ticket.subject,
      status: ticket.status,
      team: ticket.team,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    }));
    ok(res, summaries, 200, { total: result.total, page: parsed.data.page, limit: parsed.data.limit });
  });

  app.get("/tickets/:ticketId/status", async (req, res) => {
    const ticket = await loadTicket(store, req, res);
    if (!ticket) return;
    ok(res, {
      ticketId: ticket.ticketId,
      status: ticket.status,
      reply: ticket.status === "PUBLISHED" ? ticket.reply : null,
    });
  });

  app.get("/tickets/:ticketId", async (req, res) => {
    const ticket = await loadTicket(store, req, res);
    if (!ticket) return;
    ok(res, ticket);
  });

  app.patch("/tickets/:ticketId/team", async (req, res) => {
    let ticket = await loadTicket(store, req, res);
    if (!ticket) return;
    if (ticket.status !== "NEEDS_ASSIGNMENT") return fail(res, 409, "Ticket is not in NEEDS_ASSIGNMENT.");

    const parsed = assignTeamSchema.safeParse(req.body ?? {});
    if (!parsed.success) return fail(res, 422, "Invalid team.");

    ticket = { ...ticket, team: parsed.data.team };
    ticket = await saveTransition(store, ticket, "DRAFTING", "team_assigned", { team: parsed.data.team });

    // Temporary draft keeps the frontend usable until Santiago's real drafting step is merged.
    const draftedAt = new Date().toISOString();
    ticket = {
      ...ticket,
      draft: {
        content: `Hi ${ticket.studentName}, thanks for reaching out. A member of the ${parsed.data.team} team will confirm the details shortly. (temporary draft - AI drafting not wired yet)`,
        sources: [],
        draftedAt,
      },
      updatedAt: draftedAt,
    };
    await store.update(ticket);
    ticket = await saveTransition(store, ticket, "PENDING_REVIEW", "draft_ready", { mode: "stub" });
    ok(res, ticket);
  });

  app.patch("/tickets/:ticketId/draft", async (req, res) => {
    let ticket = await loadTicket(store, req, res);
    if (!ticket) return;
    if (ticket.status !== "PENDING_REVIEW") return fail(res, 409, "Ticket is not in PENDING_REVIEW, draft cannot be edited.");

    const parsed = editDraftSchema.safeParse(req.body ?? {});
    if (!parsed.success) return fail(res, 422, "Please check the form fields.");

    ticket = {
      ...ticket,
      draft: {
        content: parsed.data.content,
        sources: ticket.draft?.sources ?? [],
        draftedAt: ticket.draft?.draftedAt ?? new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    };
    await store.update(ticket);
    await store.logEvent(ticket.ticketId, "draft_edited", { editedBy: parsed.data.editedBy ?? null });
    ok(res, ticket);
  });

  app.post("/tickets/:ticketId/approve", async (req, res) => {
    let ticket = await loadTicket(store, req, res);
    if (!ticket) return;
    if (ticket.status !== "PENDING_REVIEW" || !ticket.draft) {
      return fail(res, 409, "Ticket is not in PENDING_REVIEW, cannot be approved.");
    }

    const parsed = approveSchema.safeParse(req.body ?? {});
    if (!parsed.success) return fail(res, 422, "Please check the form fields.");

    const now = new Date().toISOString();
    ticket = {
      ...ticket,
      reply: {
        ...ticket.draft,
        publishedAt: now,
        publishedBy: parsed.data.reviewedBy ?? null,
      },
      updatedAt: now,
    };
    await store.update(ticket);
    ticket = await saveTransition(store, ticket, "PUBLISHED", "draft_approved", { reviewedBy: parsed.data.reviewedBy ?? null });
    ok(res, ticket);
  });

  app.post("/tickets/:ticketId/reject", async (req, res) => {
    let ticket = await loadTicket(store, req, res);
    if (!ticket) return;
    if (ticket.status !== "PENDING_REVIEW") return fail(res, 409, "Ticket is not in PENDING_REVIEW, cannot be rejected.");

    const parsed = rejectSchema.safeParse(req.body ?? {});
    if (!parsed.success) return fail(res, 422, "Please check the form fields.");

    ticket = { ...ticket, reviewNote: parsed.data.reason, updatedAt: new Date().toISOString() };
    await store.update(ticket);
    ticket = await saveTransition(store, ticket, "ESCALATED", "draft_rejected", {
      reviewedBy: parsed.data.reviewedBy ?? null,
      reason: parsed.data.reason,
    });
    ok(res, ticket);
  });

  app.post("/tickets/:ticketId/reply", async (req, res) => {
    let ticket = await loadTicket(store, req, res);
    if (!ticket) return;
    if (ticket.status !== "ESCALATED") return fail(res, 409, "Ticket is not ESCALATED, manual reply not applicable.");

    const parsed = manualReplySchema.safeParse(req.body ?? {});
    if (!parsed.success) return fail(res, 422, "Please check the form fields.");

    const now = new Date().toISOString();
    ticket = {
      ...ticket,
      reply: {
        content: parsed.data.content,
        sources: [],
        draftedAt: now,
        publishedAt: now,
        publishedBy: parsed.data.repliedBy ?? null,
      },
      updatedAt: now,
    };
    await store.update(ticket);
    ticket = await saveTransition(store, ticket, "PUBLISHED", "manual_reply_published", { repliedBy: parsed.data.repliedBy ?? null });
    ok(res, ticket);
  });

  app.use((error: unknown, _req: Request, res: Response, _next: unknown) => {
    if (error instanceof ZodError) return fail(res, 422, "Please check the form fields.");
    console.error(error);
    return fail(res, 500, "Internal server error.");
  });

  return app;
}

const app = createApp();

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, () => console.log(`Backend listening on http://localhost:${PORT}`));
}

export { app };
