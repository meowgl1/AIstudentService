// One-off local scraper for the RAG corpus (ADR 0009, docs/rag-build-plan.md section 3).
// Not a runtime component. Fetches the pre-vetted source list below, respects each
// site's robots.txt crawl-delay of 10s, drops pages that redirect to a login page,
// and writes raw HTML + a manifest to scratch/raw/ (gitignored, step 4 reads from there).
//
// Usage: node scripts/scrape-pages.mjs

import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import assert from "node:assert/strict";
import path from "node:path";

const CRAWL_DELAY_MS = 10_000; // all three hosts' robots.txt specify crawl-delay: 10
const USER_AGENT =
  "ATW306-StudentSupport-RAGBuilder/1.0 (academic project, one-off offline scrape, see docs/adr/0009)";
const OUT_DIR = path.resolve("scratch/raw");

// Pre-vetted against each host's robots.txt during the plan's source-inventory step
// (docs/rag-build-plan.md section 1) and ADR 0003 (team mapping). Team assigned here
// is the step-4 frontmatter value; `library.torrens.edu.au/home` is split by heading
// across LIBRARY_LEARNING and SUCCESS_COACH at extraction time, so it's listed once.
const SOURCES = [
  // STUDENT_FINANCE
  ["https://studenthub.torrens.edu.au/Hub/fees", "STUDENT_FINANCE"],
  ["https://www.torrens.edu.au/how-to-apply/fees-scholarships/tuition-fees", "STUDENT_FINANCE"],
  ["https://www.torrens.edu.au/how-to-apply/fees-scholarships/scholarships", "STUDENT_FINANCE"],
  ["https://www.torrens.edu.au/how-to-apply/fees-scholarships/scholarships/domestic", "STUDENT_FINANCE"],
  ["https://www.torrens.edu.au/how-to-apply/fees-scholarships/scholarships/international-scholarships", "STUDENT_FINANCE"],

  // ACCESSIBILITY
  ["https://studenthub.torrens.edu.au/Hub/Support/Accessibility", "ACCESSIBILITY"],
  ["https://www.torrens.edu.au/studying-with-us/student-support/accessibility", "ACCESSIBILITY"],

  // CAMPUS_LIFE (narrowed to international/relocation logistics)
  ["https://studenthub.torrens.edu.au/Hub/International-Students", "CAMPUS_LIFE"],
  ["https://studenthub.torrens.edu.au/Hub/Living-in-Australia", "CAMPUS_LIFE"],

  // LIBRARY_LEARNING: the homepage itself is a promo/links widget, not stable content
  // (see docs/rag-build-plan.md section 4 notes) - scrape the linked sub-pages instead.
  ["https://library.torrens.edu.au/getstarted", "LIBRARY_LEARNING"],
  ["https://library.torrens.edu.au/academicskills/apa/tool", "SUCCESS_COACH"],
  ["https://library.torrens.edu.au/genai", "SUCCESS_COACH"],

  // WIL_PLACEMENT (incl. folded Nursing Placement Coordinator)
  ["https://studenthub.torrens.edu.au/Hub/Study/Careers", "WIL_PLACEMENT"],
  ["https://www.torrens.edu.au/studying-with-us/employability/work-integrated-learning", "WIL_PLACEMENT"],

  // SUCCESS_COACH ("complete coach": original scope + folded Academic Skills)
  ["https://www.torrens.edu.au/studying-with-us/student-support/success-coaches", "SUCCESS_COACH"],
  ["https://library.torrens.edu.au/academicskills/home", "SUCCESS_COACH"],

  // IT_SUPPORT
  ["https://studenthub.torrens.edu.au/Hub/Online-Learning-Platform", "IT_SUPPORT"],
  ["https://studenthub.torrens.edu.au/Hub/student-email", "IT_SUPPORT"],
  ["https://studenthub.torrens.edu.au/Hub/student-portal", "IT_SUPPORT"],

  // STUDENT_SERVICES (catch-all, incl. folded HDR / First Nations / Student Engagement)
  ["https://studenthub.torrens.edu.au/Hub/Contact-Us", "STUDENT_SERVICES"],
  ["https://studenthub.torrens.edu.au/Hub/Courses", "STUDENT_SERVICES"],
  ["https://studenthub.torrens.edu.au/Hub/Results", "STUDENT_SERVICES"],
  ["https://studenthub.torrens.edu.au/Hub/Academic-Documents", "STUDENT_SERVICES"],
  ["https://studenthub.torrens.edu.au/Hub/Assessment-Extension-Info", "STUDENT_SERVICES"],
  ["https://studenthub.torrens.edu.au/Hub/Campuses", "STUDENT_SERVICES"],
  ["https://studenthub.torrens.edu.au/Hub/Key-Dates", "STUDENT_SERVICES"],
  ["https://studenthub.torrens.edu.au/Hub/orientation", "STUDENT_SERVICES"],
  ["https://studenthub.torrens.edu.au/Hub/Community", "STUDENT_SERVICES"],
  ["https://studenthub.torrens.edu.au/Hub/Community/SRC", "STUDENT_SERVICES"],
  ["https://studenthub.torrens.edu.au/Hub/Graduation", "STUDENT_SERVICES"],
  ["https://studenthub.torrens.edu.au/Hub/Courses/Higher-Degrees-by-Research", "STUDENT_SERVICES"],
  ["https://studenthub.torrens.edu.au/Hub/First-Nations-Students", "STUDENT_SERVICES"],
  ["https://studenthub.torrens.edu.au/Hub/subject-selection", "STUDENT_SERVICES"],
  ["https://www.torrens.edu.au/studying-with-us/student-support/first-year-onboarding", "STUDENT_SERVICES"],
];

function slugify(url) {
  const { host, pathname } = new URL(url);
  const slug = `${host}${pathname}`
    .replace(/\/+$/, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return slug || host;
}

function isLoginRedirect(finalUrl) {
  return /\b(login|signin|sign-in|sso)\b/i.test(finalUrl);
}

// Pure-logic self-check (ponytail: smallest thing that fails if slug/redirect logic breaks).
function selfCheck() {
  assert.equal(slugify("https://studenthub.torrens.edu.au/Hub/fees"), "studenthub-torrens-edu-au-hub-fees");
  assert.equal(slugify("https://library.torrens.edu.au/home"), "library-torrens-edu-au-home");
  assert.equal(isLoginRedirect("https://studenthub.torrens.edu.au/login?returnUrl=/Hub/fees"), true);
  assert.equal(isLoginRedirect("https://studenthub.torrens.edu.au/Hub/fees"), false);
}

async function fetchOne(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    redirect: "follow",
  });
  return { status: res.status, finalUrl: res.url, body: await res.text() };
}

async function main() {
  selfCheck();
  await mkdir(OUT_DIR, { recursive: true });

  const manifest = [];
  for (const [url, team] of SOURCES) {
    const retrievedAt = new Date().toISOString();
    try {
      const { status, finalUrl, body } = await fetchOne(url);

      if (isLoginRedirect(finalUrl)) {
        console.log(`SKIP (login redirect): ${url}`);
        manifest.push({ url, team, retrievedAt, status: "skipped_login_redirect", httpStatus: status });
      } else if (status >= 400) {
        console.log(`SKIP (HTTP ${status}): ${url}`);
        manifest.push({ url, team, retrievedAt, status: "skipped_http_error", httpStatus: status });
      } else {
        const filename = `${slugify(url)}.html`;
        await writeFile(path.join(OUT_DIR, filename), body, "utf8");
        console.log(`OK: ${url} -> ${filename}`);
        manifest.push({ url, team, retrievedAt, status: "ok", httpStatus: status, filename });
      }
    } catch (err) {
      console.error(`ERROR: ${url} -> ${err.message}`);
      manifest.push({ url, team, retrievedAt, status: "error", error: err.message });
    }

    await sleep(CRAWL_DELAY_MS);
  }

  await writeFile(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
  const ok = manifest.filter((m) => m.status === "ok").length;
  console.log(`\nDone: ${ok}/${manifest.length} pages saved to ${OUT_DIR}`);
}

main();
