# Draft

Following the routing of a ticket and the retrieval of pertinent FAQ information,
the agent drafts a response based on that information. Draft.content stores the response text. Draft.sources contains the source title, section ID, and extract of its accompanying FAQ references. Draft.draftedAt stores the date and time when the draft was created.

Example:
    content: >-
        Hi Jordan, new unit enrolments can take up to 24 hours to sync
        with Blackboard. If it has been longer than that, contact IT
        support with your student ID and unit code so they can check the
        enrolment manually.
    sources:
        -title: Blackboard Access FAQ
        sectionId: faq-blackboard-access
        excerpt: >-
            New enrolments can take up to 24 hours to sync with
            Blackboard. If it has been longer than 24 hours, contact IT
            support.
    draftedAt: '2026-10-16T09:12:00Z'

The ticket should be escalated for human evaluation if the collected FAQ information is not sufficient to create a supported response. If not, the ticket is moved to PENDING_REVIEW.
Staff have the option to reject the draft and escalate the ticket, approve it for publishing, or review and change it. Only after staff approval and publication does the student receive the response.