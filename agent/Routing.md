# Routing
The routing step assigns one support team to each ticket that passes screening.
Sensitive tickets are sent to staff without an AI draft, while tickets marked as spam are discarded.
For this, it used "subject" ans "body" values, and store the corrected team in "Ticket.team", using
one of the "SupportTeam" values:
        - ACADEMIC
        - IT
        - ADMIN
        - FINANCE
        - STUDENT_SERVICES
"TicketStatus.ROUTING" indicates the ticket's current proccessing stage, it is not represent the team assignment.

The agent should route based on the main problem with the ticket. If the problem is unclear or cannot be assigned with
confidence, the ticket should be escalated for staff assignment rather that sent to an random team. The pipeline moves
on to FAQ retrieval and draft creation after a team is assigned.
Before being submitted to the student, the document is still awaiting staff approval.