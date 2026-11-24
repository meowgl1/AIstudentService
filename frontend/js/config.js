// Settings for the frontend.
// API_URL is the address of the backend.
//   Default ("") - same origin. Works both locally (src/server.ts serves this
//   folder on :3000) and on Render (one web service serves both).
//   Mock server (npm run mock-api): set to "http://localhost:4010" instead.
const API_URL = "";

// Set to true to use fake data saved in the browser (no backend needed).
const USE_SAMPLE_DATA = false;
