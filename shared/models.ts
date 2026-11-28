import OpenAI from "openai";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

let client: OpenAI | undefined;

export function getOpenRouterClient(): OpenAI {
  
    if (!client) {
    
        const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      
        throw new Error("OPENROUTER_API_KEY is not set.");
    
    }

    client = new OpenAI({
      
      apiKey,
      baseURL: OPENROUTER_BASE_URL,
    
    });
  }

  return client;
}

export const models = {
  screening:
    process.env.OPENROUTER_SCREENING_MODEL ||
    "anthropic/claude-haiku-4.5",
  routing:
    process.env.OPENROUTER_ROUTING_MODEL ||
    "anthropic/claude-haiku-4.5",
  drafting:
    process.env.OPENROUTER_DRAFTING_MODEL ||
    "anthropic/claude-sonnet-5",
} as const;