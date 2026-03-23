import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(scriptDir, "..");
const buildDir = path.join(webDir, "build", "client");

const args = process.argv.slice(2);
const skipBuild = args.includes("--skip-build");
const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? "3403");
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

// MIME types for static assets
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".mjs":  "application/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif":  "image/gif",
  ".ico":  "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf":  "font/ttf",
  ".map":  "application/json",
};

const indexPath = path.join(buildDir, "index.html");
if (!existsSync(indexPath)) {
  console.error(`Build output not found at ${buildDir}. Run build first.`);
  process.exit(1);
}

const server = createServer((req, res) => {
  // Only handle GET/HEAD
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${host}:${port}`);
  let filePath = path.join(buildDir, decodeURIComponent(url.pathname));

  // Prevent path traversal
  if (!filePath.startsWith(buildDir)) {
    res.writeHead(403);
    res.end();
    return;
  }

  // Try to serve the exact file; if it doesn't exist or is a directory, fall back to index.html (SPA)
  let stat;
  try {
    stat = statSync(filePath);
    if (stat.isDirectory()) {
      // Try index.html inside directory
      const dirIndex = path.join(filePath, "index.html");
      if (existsSync(dirIndex)) {
        filePath = dirIndex;
        stat = statSync(filePath);
      } else {
        filePath = indexPath;
        stat = statSync(filePath);
      }
    }
  } catch {
    // File not found — SPA fallback to index.html
    filePath = indexPath;
    stat = statSync(indexPath);
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || "application/octet-stream";

  res.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": stat.size,
    "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
  });

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  createReadStream(filePath).pipe(res);
});

server.listen(port, host, () => {
  console.log(`Static preview server running at http://${host}:${port}/`);
});