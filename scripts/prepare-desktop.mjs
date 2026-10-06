// Completes the Next.js standalone server so the desktop app can run it:
// copies static assets and public files next to server.js (Next leaves these out by default).
import { cpSync, existsSync, rmSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const standalone = path.join(root, ".next", "standalone");

if (!existsSync(path.join(standalone, "server.js"))) {
  console.error('No standalone build found. Run "npm run build" first.');
  process.exit(1);
}

cpSync(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), { recursive: true });
if (existsSync(path.join(root, "public"))) {
  cpSync(path.join(root, "public"), path.join(standalone, "public"), { recursive: true });
}
// Image optimization is disabled, so the native sharp binaries are dead weight.
for (const dir of ["sharp", "@img"]) {
  rmSync(path.join(standalone, "node_modules", dir), { recursive: true, force: true });
}
// Never ship local secrets inside the app bundle.
for (const f of [".env", ".env.local", ".env.production", ".env.production.local"]) {
  rmSync(path.join(standalone, f), { force: true });
}
console.log("Desktop server bundle ready:", standalone);
