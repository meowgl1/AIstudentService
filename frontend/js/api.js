// This file talks to the backend. The pages call these functions
// instead of using fetch directly. The paths and fields come from
// docs/api/openapi.yaml.

// Support teams (same as SupportTeam in the OpenAPI file)
const TEAMS = ["ACADEMIC", "IT", "ADMIN", "FINANCE", "STUDENT_SERVICES"];

const TEAM_NAMES = {
  ACADEMIC: "Academic",
  IT: "IT",
  ADMIN: "Admin",
  FINANCE: "Finance",
  STUDENT_SERVICES: "Student Services"
};

// Status names shown to staff
const STATUS_NAMES = {
  RECEIVED: "Received",
  SCREENING: "Screening",
  ROUTING: "Routing",
  DRAFTING: "Drafting",
  NEEDS_ASSIGNMENT: "Needs team",
  PENDING_REVIEW: "Pending review",
  ESCALATED: "Escalated",
  PUBLISHED: "Published",
  DISCARDED: "Discarded"
};

// Simpler status names shown to students
function getStudentStatusName(status) {
  if (status === "PENDING_REVIEW") return "Waiting for staff review";
  if (status === "ESCALATED") return "With a staff member";
  if (status === "PUBLISHED") return "Answered";
  if (status === "DISCARDED") return "Closed";
  return "Being processed";
}

// Sends a request to the backend and returns the "data" part of the answer.
// Throws an error with a friendly message if something goes wrong.
async function sendRequest(method, path, body) {
  // Offline mode: use the fake server in sample-data.js
  if (USE_SAMPLE_DATA) {
    return fakeServer(method, path, body);
  }

  const options = {
    method: method,
    headers: { "Content-Type": "application/json" }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(API_URL + path, options);
  } catch (error) {
    throw new Error("Cannot reach the server. Is the backend or mock server running?");
  }

  let result = {};
  try {
    result = await response.json();
  } catch (error) {
    // the response had no JSON body
  }

  if (!response.ok || result.success === false) {
    if (result.error) throw new Error(result.error);
    if (response.status === 404) throw new Error("Ticket not found.");
    if (response.status === 409) throw new Error("This action is not allowed for the ticket's current status.");
    if (response.status === 422) throw new Error("Please check the form fields.");
    if (response.status === 429) throw new Error("Too many requests. Please wait and try again.");
    throw new Error("Something went wrong (error " + response.status + ").");
  }

  return result.data;
}

// ----- Student functions -----

function createTicket(ticket) {
  return sendRequest("POST", "/tickets", ticket);
}

function getTicketStatus(ticketId) {
  return sendRequest("GET", "/tickets/" + encodeURIComponent(ticketId) + "/status");
}

// ----- Staff functions -----

function getTicketList(status, team) {
  let path = "/tickets";
  const params = [];
  if (status) params.push("status=" + status);
  if (team) params.push("team=" + team);
  if (params.length > 0) path = path + "?" + params.join("&");
  return sendRequest("GET", path);
}

function getTicket(ticketId) {
  return sendRequest("GET", "/tickets/" + ticketId);
}

function saveDraft(ticketId, content, staffName) {
  return sendRequest("PATCH", "/tickets/" + ticketId + "/draft", { content: content, editedBy: staffName });
}

function approveTicket(ticketId, staffName) {
  return sendRequest("POST", "/tickets/" + ticketId + "/approve", { reviewedBy: staffName });
}

function rejectTicket(ticketId, reason, staffName) {
  return sendRequest("POST", "/tickets/" + ticketId + "/reject", { reason: reason, reviewedBy: staffName });
}

function sendManualReply(ticketId, content, staffName) {
  return sendRequest("POST", "/tickets/" + ticketId + "/reply", { content: content, repliedBy: staffName });
}

function assignTeam(ticketId, team) {
  return sendRequest("PATCH", "/tickets/" + ticketId + "/team", { team: team });
}
