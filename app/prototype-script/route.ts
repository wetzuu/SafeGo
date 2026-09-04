import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-static";

export async function GET() {
  const scriptPath = path.join(process.cwd(), "prototype", "safego.js");
  const source = await readFile(scriptPath, "utf8");
  const executableSource = source
    .replace(
      "document.addEventListener('DOMContentLoaded', () => {",
      "(() => {",
    )
    .replace(/\}\);\s*$/, "})();");

  return new Response(executableSource, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
