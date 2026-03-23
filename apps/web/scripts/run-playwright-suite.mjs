import { spawnSync } from "node:child_process";

const resolvedBaseUrl =
  process.env.BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3401";

const suites = {
  manual: [
    "e2e/manual-critical-ui-journeys.spec.ts",
  ],
  core: [
    "e2e/admin-flows.spec.ts",
    "e2e/auth.spec.ts",
    "e2e/disputes.spec.ts",
    "e2e/favorites.spec.ts",
    "e2e/home.spec.ts",
    "e2e/messages.spec.ts",
    "e2e/organizations.spec.ts",
    "e2e/owner-dashboard.spec.ts",
    "e2e/owner-listings.spec.ts",
    "e2e/password-recovery.spec.ts",
    "e2e/payments-reviews-notifications.spec.ts",
    "e2e/portal-layout-consistency.spec.ts",
    "e2e/renter-booking-journey.spec.ts",
    "e2e/renter-dashboard.spec.ts",
    "e2e/responsive-accessibility.spec.ts",
    "e2e/route-health.spec.ts",
    "e2e/search-browse.spec.ts",
    "e2e/settings.spec.ts",
    "e2e/smoke.spec.ts",
    "e2e/test-admin-basic.spec.ts",
    "e2e/test-owner-login.spec.ts",
  ],
  comprehensive: [
    "e2e/comprehensive-edge-cases.spec.ts",
    "e2e/comprehensive-form-validation.spec.ts",
    "e2e/comprehensive-user-journeys.spec.ts",
  ],
  ujlt: [
    "e2e/ujlt-v2-comprehensive-journeys.spec.ts",
  ],
  debug: ["e2e/debug-disputes.spec.ts", "e2e/diagnostic.spec.ts"],
  full: [],
};

const rawArgs = process.argv.slice(2).filter((arg) => arg !== "--");
const hasNamedSuite = rawArgs[0] && rawArgs[0] in suites;
const shouldUseCoreSuite =
  rawArgs.length === 0 ||
  rawArgs[0].startsWith("--") ||
  rawArgs[0].startsWith("-");

const suiteFiles = hasNamedSuite
  ? suites[rawArgs[0]]
  : shouldUseCoreSuite
    ? suites.core
    : [];
const passthroughArgs = hasNamedSuite ? rawArgs.slice(1) : rawArgs;

const defaultProject = process.env.PLAYWRIGHT_DEFAULT_PROJECT;
const hasProjectArg = passthroughArgs.some(
  (arg) => arg === "--project" || arg.startsWith("--project=")
);
const finalArgs =
  defaultProject && !hasProjectArg
    ? [...passthroughArgs, `--project=${defaultProject}`]
    : passthroughArgs;

const result = spawnSync(
  "pnpm",
  ["exec", "playwright", "test", ...suiteFiles, ...finalArgs],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      BASE_URL: resolvedBaseUrl,
      E2E_FORCE_UI_LOGIN:
        process.env.E2E_FORCE_UI_LOGIN ?? "false",
      PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL ?? resolvedBaseUrl,
    },
  }
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
