import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const required = [
  "package.json",
  "app/page.tsx",
  "app/globals.css",
  "app/api/session/route.ts",
  "app/api/meeting/[meetingId]/transcript/route.ts",
  "app/api/meeting/[meetingId]/ask/route.ts",
  "lib/vexa.ts",
  "lib/llm.ts",
  "lib/auth.ts",
  ".env.example",
  "README.md",
];

const missing = required.filter((file) => !existsSync(join(root, file)));
if (missing.length) {
  console.error(`Missing required files: ${missing.join(", ")}`);
  process.exit(1);
}

const page = readFileSync(join(root, "app/page.tsx"), "utf8");
const vexa = readFileSync(join(root, "lib/vexa.ts"), "utf8");
const llm = readFileSync(join(root, "lib/llm.ts"), "utf8");
const readme = readFileSync(join(root, "README.md"), "utf8");
const checks = [
  ["meeting ID field", page.includes("Meeting ID")],
  ["transcript feed", page.includes("Transcript")],
  ["question box", page.includes("ask-heading")],
  ["answer panel", page.includes("answer-heading")],
  ["action items", page.includes("actions-heading")],
  ["Vexa base URL", vexa.includes("VEXA_BASE_URL")],
  ["Vexa API key", vexa.includes("VEXA_API_KEY")],
  ["LLM compatible endpoint", llm.includes("/chat/completions")],
  ["demo transcript fallback", vexa.includes("demoTranscript")],
  ["provider documentation", readme.includes("Vercel deployment") && readme.includes("Known limitations")],
];
const failed = checks.filter(([, passed]) => !passed).map(([name]) => name);
if (failed.length) {
  console.error(`Validation failed: ${failed.join(", ")}`);
  process.exit(1);
}
console.log(`Validation passed: ${checks.length} prototype checks.`);
