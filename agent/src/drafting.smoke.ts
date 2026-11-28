import { draftReply } from "./drafting.js";
import type { RetrievedChunk } from "./retriever.js";

const chunks = [

    {

        title: "MyLearn Access FAQ",
        sectionId: "faq-MyLearn-access",
        excerpt:
        "New enrolments can take up to 24 hours to sync with MyLearn. If it has been longer than 24 hours, contact IT support.",
  
    },
    
] as RetrievedChunk[];

async function main(): Promise<void> {
  
    const supportedResult = await draftReply(
    
        {
      
            studentName: "Test Student",
            subject: "My new unit is not showing in MyLearn",
            body: "I enrolled in a unit yesterday, but it is not showing on my MyLearn dashboard. What should I do?",
    
        },
    
        chunks
  
    );

  
    if (
    
        supportedResult.outcome !== "DRAFT_READY" ||
        !supportedResult.draft ||
        supportedResult.draft.content.trim() === "" ||
        supportedResult.draft.sources.length === 0
    
    ) {
    
        throw new Error("Expected a draft with a source for the MyLearn ticket.");
    
    }

    console.log("Supported FAQ case passed.");

  const unsupportedResult = await draftReply(
    
    {
      
        studentName: "Test Student",
        subject: "Request to appeal my assessment result",
        body: "How long do I have to appeal my assessment result?",
    
    },
    
    chunks
  
    );

     if (
    
        unsupportedResult.outcome !== "NEEDS_HUMAN_REVIEW" ||
        unsupportedResult.draft !== null ||
        !unsupportedResult.reason
    
    ) {
    
        throw new Error("Expected human review when the FAQ does not answer the ticket.");
  
    }

    console.log("Unsupported FAQ case passed.");

}

main().catch((error: unknown) => {

    console.error(error);
    process.exitCode = 1;

});