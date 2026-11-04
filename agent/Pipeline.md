# Pipeline

After the backend validates and accepts a ticket, POST /tickets returns immediately with a
ticket reference. The pipeline runs in the background. The tickets moves to SCREENING, where it is checks.
Sensitive tickets skip the AI draft and go straight to a human. Spam is DICARDED.
Other tickets continued to ROUTING, where the agent assign a support team.
RAG then searches the FAQ for important information, and the DRAFTING prepares a reply with FAQ sources.
If the FAQ information is insufficient, the tickets is escalated for human review. Moreover, the ticket moves to PENDING_REVIEW.
The draft can be edited and approve by staff, moving the ticket to PUBLISHED, or reject it, moving it to ESCALATED for a manual staff reply.
The students can see the ticket's status and receives the reply only after it is published.