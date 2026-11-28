import { routeTicket } from "./routing.js";

async function main(): Promise<void> {

    const itResult = await routeTicket(
 
        "MyLearn login problem",
        "I cannot log in to MyLearn because my account is not accepting my password."
  
    );

  
    if (itResult.team !== "IT" || !itResult.reason.trim()) {
  
      throw new Error("Expected the MyLearn login ticket to route to IT with a reason.");
  
    }

    console.log("IT routing case passed.");

    const financeResult = await routeTicket(
    
        "Fee payment",
        "I have a question about a fee shown on my invoice."
  
    );

    if (financeResult.team !== "FINANCE" || !financeResult.reason.trim()) {
        
        throw new Error("Expected the invoice ticket to route to FINANCE with a reason.");
  
    }

    console.log("Finance routing case passed.");

}

main().catch((error: unknown) => {

    console.error(error);
    process.exitCode = 1;

});