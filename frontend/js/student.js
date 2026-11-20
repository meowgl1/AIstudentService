// Student page: submit a ticket and check its status.

const ticketForm = document.getElementById("ticketForm");
const submitResult = document.getElementById("submitResult");
const statusForm = document.getElementById("statusForm");
const statusResult = document.getElementById("statusResult");

// Adds an element with text to the page.
// textContent is used (not innerHTML) so user text cannot run as code.
function addElement(parent, tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  parent.appendChild(element);
  return element;
}

// 1. Submit a new ticket
ticketForm.addEventListener("submit", async function (event) {
  event.preventDefault(); // stop the page from reloading

  const ticket = {
    studentName: document.getElementById("studentName").value.trim(),
    studentEmail: document.getElementById("studentEmail").value.trim(),
    subject: document.getElementById("subject").value.trim(),
    body: document.getElementById("body").value.trim()
  };

  try {
    const result = await createTicket(ticket);
    submitResult.className = "alert alert-success mt-3";
    submitResult.textContent = "Ticket sent. Save your ticket ID to check your status: " + result.ticketId;
    document.getElementById("ticketId").value = result.ticketId; // fill in the status box for the student
    ticketForm.reset();
  } catch (error) {
    submitResult.className = "alert alert-danger mt-3";
    submitResult.textContent = error.message;
  }
});

// 2. Check the status of a ticket
statusForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  statusResult.innerHTML = ""; // clear the old result

  const ticketId = document.getElementById("ticketId").value.trim();

  try {
    const ticket = await getTicketStatus(ticketId);

    addElement(statusResult, "span", getStudentStatusName(ticket.status), "badge badge-status badge-" + ticket.status);

    if (ticket.status === "PUBLISHED" && ticket.reply) {
      // Show the reply that staff approved
      addElement(statusResult, "div", ticket.reply.content, "border rounded p-3 bg-white mt-3");
      addElement(statusResult, "p", "Answered by " + ticket.reply.publishedBy, "small text-muted mt-2 mb-1");

      // Show the FAQ sources, if there are any
      if (ticket.reply.sources && ticket.reply.sources.length > 0) {
        addElement(statusResult, "p", "Sources", "small fw-semibold mb-1");
        const list = addElement(statusResult, "ul", "", "small");
        for (const source of ticket.reply.sources) {
          addElement(list, "li", source.title);
        }
      }
    } else if (ticket.status === "DISCARDED") {
      addElement(statusResult, "p", "This ticket was closed. If you still need help, please submit a new ticket.", "text-muted mt-2");
    } else {
      addElement(statusResult, "p", "We are working on it. Check back later.", "text-muted mt-2");
    }
  } catch (error) {
    addElement(statusResult, "div", error.message, "alert alert-warning");
  }
});
