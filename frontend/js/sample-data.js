// Fake server for testing without a backend (only used when USE_SAMPLE_DATA is true).
// Tickets are saved in the browser's localStorage.

const STORAGE_KEY = "sample_tickets";

const FAQ_SOURCE = {
  title: "Blackboard Access FAQ",
  sectionId: "faq-blackboard-access",
  excerpt: "New enrolments can take up to 24 hours to sync with Blackboard."
};

function getFirstTicket() {
  return {
    ticketId: "a1b2c3d4-5e6f-7890-abcd-ef1234567890",
    status: "PENDING_REVIEW",
    studentName: "Jordan Lee",
    studentEmail: "jordan.lee@student.torrens.edu.au",
    subject: "Can't access my unit in Blackboard",
    body: "I enrolled in SWE302 last week but the unit isn't showing up on Blackboard.",
    team: "ACADEMIC",
    screening: { isSpam: false, isSensitive: false, isPromptInjectionAttempt: false, needsHumanReview: false, reason: null },
    draft: {
      content: "Hi Jordan, new enrolments can take up to 24 hours to sync with Blackboard. If it has been longer, contact IT support with your student ID and unit code.",
      sources: [FAQ_SOURCE]
    },
    reply: null,
    reviewNote: null
  };
}

function loadTickets() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (error) {
    // localStorage not available, use the starting ticket
  }
  return [getFirstTicket()];
}

function saveTickets(tickets) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
  } catch (error) {
    // ignore
  }
}

function findTicket(tickets, ticketId) {
  for (let i = 0; i < tickets.length; i++) {
    if (tickets[i].ticketId === ticketId) return tickets[i];
  }
  throw new Error("Ticket not found.");
}

function publishReply(ticket, content, staffName, sources) {
  ticket.reply = {
    content: content,
    sources: sources,
    publishedAt: new Date().toISOString(),
    publishedBy: staffName
  };
  ticket.status = "PUBLISHED";
}

// Works like the real backend, but with fake data.
async function fakeServer(method, path, body) {
  const tickets = loadTickets();
  const parts = path.split("?")[0].split("/"); // "/tickets/ID/approve" -> ["", "tickets", "ID", "approve"]
  const ticketId = parts[2] ? decodeURIComponent(parts[2]) : null;
  const action = parts[3];

  // Submit a new ticket
  if (method === "POST" && !ticketId) {
    const newTicket = {
      ticketId: crypto.randomUUID(),
      status: "PENDING_REVIEW",
      studentName: body.studentName,
      studentEmail: body.studentEmail,
      subject: body.subject,
      body: body.body,
      team: "STUDENT_SERVICES",
      screening: { isSpam: false, isSensitive: false, isPromptInjectionAttempt: false, needsHumanReview: false, reason: null },
      draft: { content: "Hi " + body.studentName + ", [sample AI draft]", sources: [FAQ_SOURCE] },
      reply: null,
      reviewNote: null
    };
    tickets.push(newTicket);
    saveTickets(tickets);
    return { ticketId: newTicket.ticketId, status: "RECEIVED" };
  }

  // List tickets
  if (method === "GET" && !ticketId) {
    const params = new URLSearchParams(path.split("?")[1] || "");
    return tickets.filter(function (t) {
      if (params.get("status") && t.status !== params.get("status")) return false;
      if (params.get("team") && t.team !== params.get("team")) return false;
      return true;
    });
  }

  const ticket = findTicket(tickets, ticketId);

  if (method === "GET" && action === "status") {
    return { ticketId: ticket.ticketId, status: ticket.status, reply: ticket.reply };
  }
  if (method === "GET") {
    return ticket;
  }
  if (action === "draft") {
    ticket.draft.content = body.content;
  } else if (action === "approve") {
    publishReply(ticket, ticket.draft.content, body.reviewedBy, ticket.draft.sources);
  } else if (action === "reject") {
    ticket.status = "ESCALATED";
    ticket.reviewNote = body.reason;
  } else if (action === "reply") {
    publishReply(ticket, body.content, body.repliedBy, []);
  } else if (action === "team") {
    ticket.team = body.team;
    ticket.status = "DRAFTING";
  }
  saveTickets(tickets);
  return ticket;
}
