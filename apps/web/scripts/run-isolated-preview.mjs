import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(scriptDir, "..");
const viteEntrypoint = path.join(webDir, "node_modules", "vite", "bin", "vite.js");

const args = process.argv.slice(2);
const skipBuild = args.includes("--skip-build");
const host = process.env.HOST ?? "127.0.0.1";
const port = process.env.PORT ?? "3403";
const apiUrl = process.env.VITE_API_URL ?? process.env.API_URL ?? "http://127.0.0.1:3402/api";

const env = {
  ...process.env,
  API_URL: apiUrl,
  VITE_API_URL: apiUrl,
};

if (!skipBuild) {
  const build = spawnSync("pnpm", ["build"], {
    cwd: webDir,
    env,
    stdio: "inherit",
  });

  if (build.status !== 0) {
    process.exit(build.status ?? 1);
  }
}

const preview = spawnSync(
  "node",
  [viteEntrypoint, "preview", "--host", host, "--port", port, "--strictPort", "--outDir", "build/client"],
  {
    cwd: webDir,
    env,
    stdio: "inherit",
  }
);

process.exit(preview.status ?? 1);