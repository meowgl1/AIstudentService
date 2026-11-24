// Smallest real check for server.ts's state machine: walks both terminal paths
// (assign -> approve -> PUBLISHED, and assign -> reject -> manual reply -> PUBLISHED)
// against a live instance. Run manually, not part of an automated suite.
//
// Usage: node --import tsx src/server.smoke.ts
import assert from "node:assert/strict";
import { app } from "./server.ts";

async function main() {
  const server = app.listen(0);
  const port = (server.address() as { port: number }).port;
  const base = `http://localhost:${port}`;

  async function call(method: string, path: string, body?: unknown) {
    const res = await fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, json: await res.json() };
  }

  // Path A: assign -> approve
  const created = await call("POST", "/tickets", {
    studentName: "Jordan Lee", studentEmail: "jordan@student.torrens.edu.au",
    subject: "Can't access unit", body: "My unit isn't showing on Blackboard."
  });
  assert.equal(created.status, 202);
  assert.equal(created.json.data.status, "NEEDS_ASSIGNMENT");
  const id = created.json.data.ticketId;

  const assigned = await call("PATCH", `/tickets/${id}/team`, { team: "IT" });
  assert.equal(assigned.json.data.status, "PENDING_REVIEW");

  const approved = await call("POST", `/tickets/${id}/approve`, { reviewedBy: "Priya" });
  assert.equal(approved.json.data.status, "PUBLISHED");

  const status = await call("GET", `/tickets/${id}/status`);
  assert.equal(status.json.data.reply.content, assigned.json.data.draft.content);
  console.log("PASS: create -> assign -> approve -> published, status reply matches draft");

  // Path B: assign -> reject -> manual reply
  const created2 = await call("POST", "/tickets", {
    studentName: "Sam", studentEmail: "sam@student.torrens.edu.au",
    subject: "Fee question", body: "When is my next payment due?"
  });
  const id2 = created2.json.data.ticketId;
  await call("PATCH", `/tickets/${id2}/team`, { team: "FINANCE" });
  const rejected = await call("POST", `/tickets/${id2}/reject`, { reason: "needs manual check" });
  assert.equal(rejected.json.data.status, "ESCALATED");

  const notYet = await call("POST", `/tickets/${id2}/approve`, {});
  assert.equal(notYet.status, 409, "approve must be blocked once escalated");

  const replied = await call("POST", `/tickets/${id2}/reply`, { content: "Handled manually.", repliedBy: "Priya" });
  assert.equal(replied.json.data.status, "PUBLISHED");
  console.log("PASS: create -> assign -> reject -> manual reply -> published, approve blocked after escalation");

  server.close();
  console.log("\nAll smoke checks passed.");
}

main().catch((err) => { console.error(err); process.exit(1); });
