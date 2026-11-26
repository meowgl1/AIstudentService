import { z } from "zod";
import { STATUSES, TEAMS } from "./domain.js";

const staffName = z.string().trim().min(1).max(120).optional();

export const createTicketSchema = z.object({
  studentName: z.string().trim().min(1).max(120),
  studentEmail: z.string().trim().email().max(254),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(4000),
}).strict();

export const ticketIdSchema = z.string().uuid();

export const listTicketsQuerySchema = z.object({
  status: z.enum(STATUSES).optional(),
  team: z.enum(TEAMS).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const assignTeamSchema = z.object({ team: z.enum(TEAMS) }).strict();
export const editDraftSchema = z.object({
  content: z.string().trim().min(1).max(4000),
  editedBy: staffName,
}).strict();
export const approveSchema = z.object({ reviewedBy: staffName }).strict();
export const rejectSchema = z.object({
  reason: z.string().trim().min(1).max(4000),
  reviewedBy: staffName,
}).strict();
export const manualReplySchema = z.object({
  content: z.string().trim().min(1).max(4000),
  repliedBy: staffName,
}).strict();
