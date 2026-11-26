import assert from "node:assert/strict";
import { createApp } from "./server.js";
import { MemoryTicketStore } from "./store.js";

async function main() {
  const app = createApp(new MemoryTicketStore());
  const server = app.listen(0);
  const port = (server.address() as { port: number }).port;
  const base = `http://localhost:${port}`;

  async function call(method: string, path: string, body?: unknown) {
    const res = await fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, json: await res.json() as any };
  }

  async function waitForStatus(ticketId: string, expected: string) {
    for (let i = 0; i < 30; i++) {
      const response = await call("GET", `/tickets/${ticketId}/status`);
      if (response.json.data.status === expected) return response;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`Ticket ${ticketId} did not reach ${expected}`);
  }

  const created = await call("POST", "/tickets", {
    studentName: "Jordan Lee",
    studentEmail: "jordan@student.torrens.edu.au",
    subject: "Can't access unit",
    body: "My unit isn't showing on Blackboard.",
  });
  assert.equal(created.status, 202);
  assert.equal(created.json.data.status, "RECEIVED");
  const id = created.json.data.ticketId;
  await waitForStatus(id, "NEEDS_ASSIGNMENT");

  const duplicate = await call("POST", "/tickets", {
    studentName: "Jordan Lee",
    studentEmail: "jordan@student.torrens.edu.au",
    subject: "Can't access unit",
    body: "My unit isn't showing on Blackboard.",
  });
  assert.equal(duplicate.status, 409);

  const assigned = await call("PATCH", `/tickets/${id}/team`, { team: "IT" });
  assert.equal(assigned.json.data.status, "PENDING_REVIEW");

  const approved = await call("POST", `/tickets/${id}/approve`, { reviewedBy: "Priya" });
  assert.equal(approved.json.data.status, "PUBLISHED");

  const status = await call("GET", `/tickets/${id}/status`);
  assert.equal(status.json.data.reply.content, assigned.json.data.draft.content);
  console.log("PASS: create -> background states -> assign -> approve -> published");

  const created2 = await call("POST", "/tickets", {
    studentName: "Sam",
    studentEmail: "sam@student.torrens.edu.au",
    subject: "Fee question",
    body: "When is my next payment due?",
  });
  const id2 = created2.json.data.ticketId;
  await waitForStatus(id2, "NEEDS_ASSIGNMENT");
  await call("PATCH", `/tickets/${id2}/team`, { team: "FINANCE" });

  const rejected = await call("POST", `/tickets/${id2}/reject`, { reason: "needs manual check", reviewedBy: "Priya" });
  assert.equal(rejected.json.data.status, "ESCALATED");

  const notYet = await call("POST", `/tickets/${id2}/approve`, {});
  assert.equal(notYet.status, 409);

  const replied = await call("POST", `/tickets/${id2}/reply`, { content: "Handled manually.", repliedBy: "Priya" });
  assert.equal(replied.json.data.status, "PUBLISHED");
  console.log("PASS: reject -> escalate -> manual reply -> published");

  server.close();
  console.log("All backend smoke checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
