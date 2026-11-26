import pg from "pg";
import type { Ticket, TicketListFilters, TicketListResult } from "./domain.js";

export interface TicketStore {
  create(ticket: Ticket, contentHash: string): Promise<void>;
  get(ticketId: string): Promise<Ticket | null>;
  list(filters: TicketListFilters): Promise<TicketListResult>;
  update(ticket: Ticket): Promise<void>;
  isDuplicate(studentEmail: string, contentHash: string, since: string): Promise<boolean>;
  logEvent(ticketId: string, eventType: string, details?: Record<string, unknown>): Promise<void>;
}

type DbRow = {
  ticket_id: string;
  status: Ticket["status"];
  student_name: string;
  student_email: string;
  subject: string;
  body: string;
  team: Ticket["team"];
  screening: Ticket["screening"];
  draft: Ticket["draft"];
  reply: Ticket["reply"];
  review_note: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function fromRow(row: DbRow): Ticket {
  return {
    ticketId: row.ticket_id,
    status: row.status,
    studentName: row.student_name,
    studentEmail: row.student_email,
    subject: row.subject,
    body: row.body,
    team: row.team,
    screening: row.screening,
    draft: row.draft,
    reply: row.reply,
    reviewNote: row.review_note,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export class MemoryTicketStore implements TicketStore {
  private readonly tickets = new Map<string, Ticket>();
  private readonly hashes = new Map<string, { email: string; hash: string; createdAt: string }>();

  async create(ticket: Ticket, contentHash: string) {
    this.tickets.set(ticket.ticketId, structuredClone(ticket));
    this.hashes.set(ticket.ticketId, { email: ticket.studentEmail.toLowerCase(), hash: contentHash, createdAt: ticket.createdAt });
  }

  async get(ticketId: string) {
    const ticket = this.tickets.get(ticketId);
    return ticket ? structuredClone(ticket) : null;
  }

  async list(filters: TicketListFilters) {
    let rows = [...this.tickets.values()];
    if (filters.status) rows = rows.filter((t) => t.status === filters.status);
    if (filters.team) rows = rows.filter((t) => t.team === filters.team);
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const total = rows.length;
    const start = (filters.page - 1) * filters.limit;
    return { tickets: structuredClone(rows.slice(start, start + filters.limit)), total };
  }

  async update(ticket: Ticket) {
    this.tickets.set(ticket.ticketId, structuredClone(ticket));
  }

  async isDuplicate(studentEmail: string, contentHash: string, since: string) {
    const sinceMs = new Date(since).getTime();
    return [...this.hashes.values()].some((r) =>
      r.email === studentEmail.toLowerCase() && r.hash === contentHash && new Date(r.createdAt).getTime() >= sinceMs
    );
  }

  async logEvent(_ticketId: string, _eventType: string, _details: Record<string, unknown> = {}) {
    // Memory mode is for local development and smoke tests only.
  }
}

export class PostgresTicketStore implements TicketStore {
  private readonly pool: pg.Pool;

  constructor(connectionString: string) {
    const ssl = process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false };
    this.pool = new pg.Pool({ connectionString, ssl });
    this.pool.on("error", (err) => console.error("Postgres pool error", err));
  }

  async create(ticket: Ticket, contentHash: string) {
    await this.pool.query(
      `INSERT INTO tickets (
        ticket_id, status, student_name, student_email, subject, body, team,
        screening, draft, reply, review_note, content_hash, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        ticket.ticketId, ticket.status, ticket.studentName, ticket.studentEmail, ticket.subject,
        ticket.body, ticket.team, ticket.screening, ticket.draft, ticket.reply, ticket.reviewNote,
        contentHash, ticket.createdAt, ticket.updatedAt,
      ]
    );
  }

  async get(ticketId: string) {
    const { rows } = await this.pool.query<DbRow>("SELECT * FROM tickets WHERE ticket_id = $1", [ticketId]);
    return rows[0] ? fromRow(rows[0]) : null;
  }

  async list(filters: TicketListFilters) {
    const where: string[] = [];
    const values: unknown[] = [];
    if (filters.status) { values.push(filters.status); where.push(`status = $${values.length}`); }
    if (filters.team) { values.push(filters.team); where.push(`team = $${values.length}`); }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const count = await this.pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM tickets ${clause}`, values);
    const pageValues = [...values, filters.limit, (filters.page - 1) * filters.limit];
    const limitParam = `$${pageValues.length - 1}`;
    const offsetParam = `$${pageValues.length}`;
    const result = await this.pool.query<DbRow>(
      `SELECT * FROM tickets ${clause} ORDER BY created_at DESC LIMIT ${limitParam} OFFSET ${offsetParam}`,
      pageValues
    );
    return { tickets: result.rows.map(fromRow), total: Number(count.rows[0]?.count ?? 0) };
  }

  async update(ticket: Ticket) {
    await this.pool.query(
      `UPDATE tickets SET
        status=$2, student_name=$3, student_email=$4, subject=$5, body=$6, team=$7,
        screening=$8, draft=$9, reply=$10, review_note=$11, updated_at=$12
       WHERE ticket_id=$1`,
      [
        ticket.ticketId, ticket.status, ticket.studentName, ticket.studentEmail, ticket.subject,
        ticket.body, ticket.team, ticket.screening, ticket.draft, ticket.reply, ticket.reviewNote,
        ticket.updatedAt,
      ]
    );
  }

  async isDuplicate(studentEmail: string, contentHash: string, since: string) {
    const { rowCount } = await this.pool.query(
      `SELECT 1 FROM tickets
       WHERE lower(student_email) = lower($1) AND content_hash = $2 AND created_at >= $3
       LIMIT 1`,
      [studentEmail, contentHash, since]
    );
    return (rowCount ?? 0) > 0;
  }

  async logEvent(ticketId: string, eventType: string, details: Record<string, unknown> = {}) {
    await this.pool.query(
      "INSERT INTO ticket_events (ticket_id, event_type, details) VALUES ($1, $2, $3)",
      [ticketId, eventType, details]
    );
  }
}

export function createTicketStoreFromEnv(): TicketStore {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn("DATABASE_URL is not set; using in-memory ticket storage for local development.");
    return new MemoryTicketStore();
  }
  console.log("Using PostgreSQL ticket storage.");
  return new PostgresTicketStore(databaseUrl);
}
