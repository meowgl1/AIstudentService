# Routing
The routing step assigns one support team to each ticket that passes screening.
Sensitive tickets are sent to staff without an AI draft, while tickets marked as spam are discarded.
For this, it used "subject" and "body" values, and store the corrected team in "Ticket.team", using one of the "SupportTeam" values:
        - ACADEMIC
        - IT
        - ADMIN
        - FINANCE
        - STUDENT_SERVICES
"TicketStatus.ROUTING" indicates the ticket's current proccessing stage, it does not represent the team assignment.

The agent should route based on the main problem. If the problem is unclear or cannot be assigned with confidence, the ticket should be escalated for staff assignment rather that sent to a random team. The pipeline moves on to FAQ retrieval and draft creation after a team is assigned.

Before being submitted to the student, the ticket is still waiting staff approval.