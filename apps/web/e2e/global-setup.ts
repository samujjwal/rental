/**
 * Playwright Global Setup
 *
 * Runs ONCE before the entire test suite, after webServer instances are started.
 * Responsibilities:
 *  1. Verify the API is reachable and healthy.
 *  2. Verify the dev-login endpoint is enabled (fails fast in prod-like envs).
 *  3. Ensure test users exist — trigger DB seed if they are absent.
 *  4. Log environment metadata for CI traceability.
 *
 * @see playwright.config.ts — globalSetup points here.
 */

import { request } from "@playwright/test";

const API = process.env.E2E_API_URL ?? "http://localhost:3400/api";

const TEST_ROLES = [
  { role: "USER", email: "renter@test.com" },
  { role: "HOST", email: "owner@test.com" },
  { role: "ADMIN", email: "admin@test.com" },
] as const;

async function waitForHealth(maxAttempts = 30, intervalMs = 2_000): Promise<void> {
  const ctx = await request.newContext();
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await ctx.get(`${API}/listings`, { timeout: 5_000 });
      if (res.ok()) {
        console.log(`[global-setup] API healthy after ${attempt} attempt(s).`);
        await ctx.dispose();
        return;
      }
      lastError = `HTTP ${res.status()}`;
    } catch (err) {
      lastError = err;
    }

    if (attempt < maxAttempts) {
      console.log(
        `[global-setup] API not ready (attempt ${attempt}/${maxAttempts}). Retrying in ${intervalMs}ms…`,
      );
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  await ctx.dispose();
  throw new Error(
    `[global-setup] API at ${API}/listings did not become healthy after ${maxAttempts} attempts. Last error: ${lastError}`,
  );
}

async function ensureTestUsers(): Promise<void> {
  const ctx = await request.newContext();

  console.log("[global-setup] Verifying test user accounts via dev-login…");

  for (const { role, email } of TEST_ROLES) {
    try {
      const res = await ctx.post(`${API}/auth/dev-login`, {
        data: { email, role, secret: 'dev-secret-123' },
        timeout: 10_000,
      });

      if (res.ok()) {
        console.log(`[global-setup]   ✓ ${role} (${email}) — OK`);
        continue;
      }

      const body = await res.text();

      if (res.status() === 404 || body.includes("not found") ||
          (res.status() === 401 && (body.includes("noDevUser") || body.includes("No active user")))) {
        // User doesn't exist — attempt seed
        console.log(
          `[global-setup]   ⚠ ${role} (${email}) not found. Triggering seed…`,
        );
        await triggerSeed(ctx);
        // Re-test once after seed
        const retry = await ctx.post(`${API}/auth/dev-login`, {
          data: { email, role, secret: 'dev-secret-123' },
          timeout: 10_000,
        });
        if (retry.ok()) {
          console.log(`[global-setup]   ✓ ${role} (${email}) — seeded OK`);
        } else {
          console.warn(
            `[global-setup]   ✗ ${role} (${email}) still missing after seed (${retry.status()})`,
          );
        }
      } else if (res.status() === 403 || res.status() === 401) {
        throw new Error(
          `[global-setup] dev-login endpoint returned ${res.status()} — it appears to be disabled. ` +
            `Set NODE_ENV=development and ALLOW_DEV_LOGIN=true in the API .env to enable it for E2E tests.`,
        );
      } else {
        console.warn(
          `[global-setup]   ? ${role} (${email}) — unexpected response ${res.status()}: ${body.slice(0, 200)}`,
        );
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("dev-login endpoint")) throw err;
      console.warn(`[global-setup]   ? ${role} (${email}) — request failed: ${err}`);
    }
  }

  await ctx.dispose();
}

async function triggerSeed(ctx: Awaited<ReturnType<typeof request.newContext>>): Promise<void> {
  try {
    // Some APIs expose a dev-only seed endpoint; fall back to a no-op if absent.
    await ctx.post(`${API}/dev/seed`, { timeout: 30_000 });
  } catch {
    // Seed endpoint not available — that's fine; we'll log warnings per-user above.
  }
}

export default async function globalSetup(): Promise<void> {
  console.log("\n[global-setup] ═══════════════════════════════════════════════");
  console.log(`[global-setup] E2E suite starting — API: ${API}`);
  console.log(
    `[global-setup] STRIPE_TEST_BYPASS: ${process.env.STRIPE_TEST_BYPASS ?? "unset (real Stripe keys required)"}`,
  );
  console.log("[global-setup] ═══════════════════════════════════════════════\n");

  // Step 1 — verify API is up (webServer should have started it already)
  await waitForHealth();

  // Step 2 — verify / seed test users
  await ensureTestUsers();

  console.log("\n[global-setup] Setup complete. Running tests…\n");
}
