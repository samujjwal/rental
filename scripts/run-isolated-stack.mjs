import { spawn } from "node:child_process";
import process from "node:process";

const rootDir = "/Users/samujjwal/Development/rental";

const rawArgs = new Set(process.argv.slice(2));
const skipBuild = rawArgs.has("--skip-build");

const apiHost = process.env.API_HOST ?? process.env.HOST ?? "127.0.0.1";
const apiPort = process.env.API_PORT ?? process.env.PORT ?? "3402";
const webHost = process.env.WEB_HOST ?? "127.0.0.1";
const webPort = process.env.WEB_PORT ?? "3403";
const apiUrl = process.env.API_URL ?? `http://${apiHost}:${apiPort}/api`;
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://rental_user:rental_password@localhost:3432/rental_portal?schema=public";
const redisHost = process.env.REDIS_HOST ?? "127.0.0.1";
const redisPort = process.env.REDIS_PORT ?? "3479";
const corsOrigins =
  process.env.CORS_ORIGINS ??
  [
    "http://localhost:3400",
    "http://127.0.0.1:3400",
    "http://localhost:3401",
    "http://127.0.0.1:3401",
    `http://localhost:${webPort}`,
    `http://${webHost}:${webPort}`,
  ].join(",");

const children = [];
let shuttingDown = false;

function log(message) {
  console.log(`[isolated-stack] ${message}`);
}

function spawnCommand(command, args, env, label) {
  const child = spawn(command, args, {
    cwd: rootDir,
    env: {
      ...process.env,
      ...env,
    },
    stdio: "inherit",
  });

  children.push(child);

  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }
    if (code === 0 || signal === "SIGTERM") {
      return;
    }
    console.error(`[isolated-stack] ${label} exited unexpectedly (${signal ?? code}).`);
    shutdown(1);
  });

  return child;
}

async function waitForHttp(url, label, timeoutMs = 90_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        log(`${label} is ready at ${url}`);
        return;
      }
    } catch {
      // Keep polling until timeout.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`${label} did not become ready in time: ${url}`);
}

function shutdown(code = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  setTimeout(() => {
    for (const child of children) {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    }
    process.exit(code);
  }, 1000).unref();
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => shutdown(0));
}

async function runBuilds() {
  if (skipBuild) {
    log("Skipping API and web builds.");
    return;
  }

  await new Promise((resolve, reject) => {
    const build = spawn("pnpm", ["--filter", "@rental-portal/api", "run", "build"], {
      cwd: rootDir,
      env: process.env,
      stdio: "inherit",
    });
    build.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`API build failed with code ${code}`));
    });
  });

  await new Promise((resolve, reject) => {
    const build = spawn("pnpm", ["--dir", `${rootDir}/apps/web`, "run", "build"], {
      cwd: rootDir,
      env: {
        ...process.env,
        API_URL: apiUrl,
        VITE_API_URL: apiUrl,
      },
      stdio: "inherit",
    });
    build.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Web build failed with code ${code}`));
    });
  });
}

async function main() {
  await runBuilds();

  log(`Starting isolated API on ${apiHost}:${apiPort}`);
  spawnCommand(
    "pnpm",
    ["--filter", "@rental-portal/api", "run", "start"],
    {
      HOST: apiHost,
      PORT: apiPort,
      API_HOST: apiHost,
      API_PORT: apiPort,
      DATABASE_URL: databaseUrl,
      REDIS_HOST: redisHost,
      REDIS_PORT: redisPort,
      ALLOW_DEV_LOGIN: process.env.ALLOW_DEV_LOGIN ?? "true",
      STRIPE_TEST_BYPASS: process.env.STRIPE_TEST_BYPASS ?? "true",
      DISABLE_THROTTLE: process.env.DISABLE_THROTTLE ?? "true",
      TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ?? "",
      TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN ?? "",
      TWILIO_VERIFY_SERVICE_SID: process.env.TWILIO_VERIFY_SERVICE_SID ?? "",
      CORS_ORIGINS: corsOrigins,
    },
    "API"
  );

  await waitForHttp(`${apiUrl}/health`, "API health");

  log(`Starting isolated web preview on ${webHost}:${webPort}`);
  spawnCommand(
    "pnpm",
    ["--dir", `${rootDir}/apps/web`, "run", "start:isolated:skip-build"],
    {
      HOST: webHost,
      PORT: webPort,
      WEB_HOST: webHost,
      WEB_PORT: webPort,
      API_URL: apiUrl,
      VITE_API_URL: apiUrl,
    },
    "web preview"
  );

  await waitForHttp(`http://${webHost}:${webPort}`, "web preview");
  log(`Isolated stack ready: web=http://${webHost}:${webPort} api=${apiUrl}`);
}

main().catch((error) => {
  console.error(`[isolated-stack] ${error instanceof Error ? error.message : String(error)}`);
  shutdown(1);
});