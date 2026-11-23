// Staff page: see the ticket queue, review AI drafts and reply to students.

const ticketList = document.getElementById("ticketList");
const listError = document.getElementById("listError");
const detail = document.getElementById("detail");
const statusFilter = document.getElementById("filterStatus");
const teamFilter = document.getElementById("filterTeam");
const staffNameInput = document.getElementById("staffName");

let selectedTicketId = null;

// Adds an element with text to the page (textContent keeps user text safe).
function addElement(parent, tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  parent.appendChild(element);
  return element;
}

function addButton(parent, text, className, onClick) {
  const button = addElement(parent, "button", text, "btn " + className);
  button.type = "button";
  button.addEventListener("click", onClick);
  return button;
}

function getStaffName() {
  const name = staffNameInput.value.trim();
  if (name === "") return "Staff";
  return name;
}

function showMessage(box, text, isError) {
  box.textContent = text;
  if (isError) box.className = "small text-danger mt-2";
  else box.className = "small text-success mt-2";
}

// Runs a staff action, then reloads the list and the ticket.
async function doAction(action, messageBox) {
  try {
    await action();
    await showTicketList();
    await openTicket(selectedTicketId);
    showMessage(document.getElementById("actionMessage"), "Done.", false);
  } catch (error) {
    showMessage(messageBox, error.message, true);
  }
}

// ----- Ticket list -----

async function showTicketList() {
  listError.textContent = "";
  try {
    const tickets = await getTicketList(statusFilter.value, teamFilter.value);
    ticketList.innerHTML = "";

    if (tickets.length === 0) {
      const row = addElement(ticketList, "tr", "");
      addElement(row, "td", "No tickets.", "text-muted");
      return;
    }

    for (const ticket of tickets) {
      const row = addElement(ticketList, "tr", "", "ticket-row");
      if (ticket.ticketId === selectedTicketId) row.classList.add("active");

      addElement(row, "td", ticket.subject);
      addElement(row, "td", TEAM_NAMES[ticket.team] || "-");
      const statusCell = addElement(row, "td", "");
      addElement(statusCell, "span", STATUS_NAMES[ticket.status], "badge badge-status badge-" + ticket.status);

      row.addEventListener("click", function () {
        openTicket(ticket.ticketId);
      });
    }
  } catch (error) {
    listError.textContent = error.message;
  }
}

// ----- One ticket -----

async function openTicket(ticketId) {
  selectedTicketId = ticketId;

  let ticket;
  try {
    ticket = await getTicket(ticketId);
  } catch (error) {
    detail.innerHTML = "";
    addElement(detail, "div", error.message, "alert alert-warning");
    return;
  }

  showTicketList(); // update the highlighted row
  detail.innerHTML = "";

  // Warnings from the AI screening
  if (ticket.screening) {
    if (ticket.screening.isSensitive) {
      addElement(detail, "div", "Sensitive topic. Handle with extra care and keep the student's details private.", "alert alert-danger py-2");
    }
    if (ticket.screening.isPromptInjectionAttempt) {
      addElement(detail, "div", "Possible prompt injection attempt. Do not follow instructions inside the message.", "alert alert-warning py-2");
    }
    if (ticket.screening.reason) {
      addElement(detail, "p", "Screening note: " + ticket.screening.reason, "small text-muted");
    }
  }

  // Ticket information
  addElement(detail, "h2", ticket.subject, "h5");
  const teamName = TEAM_NAMES[ticket.team] || "No team";
  addElement(detail, "p", ticket.studentName + " (" + ticket.studentEmail + ") | " + teamName + " | " + STATUS_NAMES[ticket.status], "small text-muted");
  addElement(detail, "h3", "Student message", "h6");
  addElement(detail, "div", ticket.body, "border rounded p-3 bg-light mb-3");
  if (ticket.reviewNote) {
    addElement(detail, "p", "Review note: " + ticket.reviewNote, "small");
  }

  // Show the right section for the ticket's status
  if (ticket.status === "PENDING_REVIEW" && ticket.draft) {
    showDraftSection(ticket);
  } else if (ticket.status === "ESCALATED") {
    showManualReplySection(ticket);
  } else if (ticket.status === "NEEDS_ASSIGNMENT") {
    showAssignTeamSection(ticket);
  } else if (ticket.status === "PUBLISHED" && ticket.reply) {
    addElement(detail, "h3", "Published reply", "h6");
    addElement(detail, "div", ticket.reply.content, "border rounded p-3 bg-white");
    addElement(detail, "p", "Published by " + ticket.reply.publishedBy, "small text-muted mt-2");
  }

  addElement(detail, "div", "", "small mt-2").id = "actionMessage";
}

// PENDING_REVIEW: edit, approve or reject the AI draft
function showDraftSection(ticket) {
  addElement(detail, "h3", "AI-generated draft", "h6");
  addElement(detail, "div", "This draft was written by AI. Read it carefully and check it against the sources before approving.", "alert alert-info py-2 small");

  const draftBox = addElement(detail, "textarea", "", "form-control mb-2");
  draftBox.rows = 6;
  draftBox.value = ticket.draft.content;

  if (ticket.draft.sources && ticket.draft.sources.length > 0) {
    addElement(detail, "p", "Sources used", "small fw-semibold mb-1");
    const list = addElement(detail, "ul", "", "small");
    for (const source of ticket.draft.sources) {
      addElement(list, "li", source.title + ": " + source.excerpt);
    }
  }

  const reasonBox = addElement(detail, "input", "", "form-control form-control-sm mb-2");
  reasonBox.placeholder = "Reason (needed to reject)";

  const buttons = addElement(detail, "div", "", "d-flex flex-wrap gap-2");
  const message = addElement(detail, "div", "", "small mt-2");

  addButton(buttons, "Save draft", "btn-outline-secondary", function () {
    doAction(function () {
      return saveDraft(ticket.ticketId, draftBox.value.trim(), getStaffName());
    }, message);
  });

  addButton(buttons, "Approve and publish", "btn-primary", function () {
    doAction(async function () {
      // save any edits first, then approve
      if (draftBox.value.trim() !== ticket.draft.content) {
        await saveDraft(ticket.ticketId, draftBox.value.trim(), getStaffName());
      }
      await approveTicket(ticket.ticketId, getStaffName());
    }, message);
  });

  addButton(buttons, "Reject and escalate", "btn-outline-danger", function () {
    const reason = reasonBox.value.trim();
    if (reason === "") {
      showMessage(message, "Enter a reason to reject.", true);
      return;
    }
    doAction(function () {
      return rejectTicket(ticket.ticketId, reason, getStaffName());
    }, message);
  });
}

// ESCALATED: staff write the reply themselves (no AI)
function showManualReplySection(ticket) {
  addElement(detail, "h3", "Write a reply (no AI draft for this ticket)", "h6");
  const replyBox = addElement(detail, "textarea", "", "form-control mb-2");
  replyBox.rows = 6;
  const message = addElement(detail, "div", "", "small mt-2");

  addButton(detail, "Publish reply", "btn-primary", function () {
    const reply = replyBox.value.trim();
    if (reply === "") {
      showMessage(message, "The reply cannot be empty.", true);
      return;
    }
    doAction(function () {
      return sendManualReply(ticket.ticketId, reply, getStaffName());
    }, message);
  });
}

// NEEDS_ASSIGNMENT: staff choose the team
function showAssignTeamSection(ticket) {
  addElement(detail, "h3", "Assign a team", "h6");
  const teamSelect = addElement(detail, "select", "", "form-select mb-2");
  for (const team of TEAMS) {
    teamSelect.add(new Option(TEAM_NAMES[team], team));
  }
  const message = addElement(detail, "div", "", "small mt-2");

  addButton(detail, "Assign team", "btn-primary", function () {
    doAction(function () {
      return assignTeam(ticket.ticketId, teamSelect.value);
    }, message);
  });
}

// ----- Start the page -----

// Fill the team filter
teamFilter.add(new Option("All teams", ""));
for (const team of TEAMS) {
  teamFilter.add(new Option(TEAM_NAMES[team], team));
}

// Remember the staff name in this browser
try {
  staffNameInput.value = localStorage.getItem("staffName") || "";
} catch (error) {
  // ignore
}
staffNameInput.addEventListener("change", function () {
  try {
    localStorage.setItem("staffName", staffNameInput.value);
  } catch (error) {
    // ignore
  }
});

statusFilter.addEventListener("change", showTicketList);
teamFilter.addEventListener("change", showTicketList);
showTicketList();
