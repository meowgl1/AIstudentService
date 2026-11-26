export const STATUSES = [
  "RECEIVED",
  "SCREENING",
  "DISCARDED",
  "ROUTING",
  "DRAFTING",
  "PENDING_REVIEW",
  "NEEDS_ASSIGNMENT",
  "ESCALATED",
  "PUBLISHED",
] as const;
export type TicketStatus = (typeof STATUSES)[number];

export const TEAMS = ["ACADEMIC", "IT", "ADMIN", "FINANCE", "STUDENT_SERVICES"] as const;
export type SupportTeam = (typeof TEAMS)[number];

export interface Source {
  title: string;
  sectionId: string;
  excerpt: string;
  sourceUrl?: string;
}

export interface ScreeningResult {
  isSpam: boolean;
  isSensitive: boolean;
  isPromptInjectionAttempt: boolean;
  needsHumanReview: boolean;
  reason: string | null;
}

export interface Draft {
  content: string;
  sources: Source[];
  draftedAt: string;
}

export interface PublishedReply extends Draft {
  publishedAt: string;
  publishedBy: string | null;
}

export interface Ticket {
  ticketId: string;
  status: TicketStatus;
  studentName: string;
  studentEmail: string;
  subject: string;
  body: string;
  team: SupportTeam | null;
  screening: ScreeningResult | null;
  draft: Draft | null;
  reply: PublishedReply | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketListFilters {
  status?: TicketStatus;
  team?: SupportTeam;
  page: number;
  limit: number;
}

export interface TicketListResult {
  tickets: Ticket[];
  total: number;
}

const ALLOWED_TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  RECEIVED: ["SCREENING"],
  SCREENING: ["DISCARDED", "ESCALATED", "ROUTING"],
  DISCARDED: [],
  ROUTING: ["DRAFTING", "NEEDS_ASSIGNMENT"],
  DRAFTING: ["PENDING_REVIEW", "ESCALATED"],
  PENDING_REVIEW: ["PUBLISHED", "ESCALATED"],
  NEEDS_ASSIGNMENT: ["DRAFTING"],
  ESCALATED: ["PUBLISHED"],
  PUBLISHED: [],
};

export function transitionTicket(ticket: Ticket, next: TicketStatus): Ticket {
  if (!ALLOWED_TRANSITIONS[ticket.status].includes(next)) {
    throw new Error(`Invalid ticket transition: ${ticket.status} -> ${next}`);
  }
  return { ...ticket, status: next, updatedAt: new Date().toISOString() };
}
