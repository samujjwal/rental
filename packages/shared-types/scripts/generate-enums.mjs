#!/usr/bin/env node
/**
 * Generate TypeScript enums from Prisma schema.
 * Single source of truth: packages/database/prisma/schema.prisma
 * Output: packages/shared-types/src/enums.generated.ts
 *
 * Usage: node scripts/generate-enums.mjs
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = resolve(__dirname, "../../database/prisma/schema.prisma");
const OUTPUT_PATH = resolve(__dirname, "../src/enums.generated.ts");

const schema = readFileSync(SCHEMA_PATH, "utf-8");

// Parse all enum blocks from Prisma schema
const enumRegex = /enum\s+(\w+)\s*\{([^}]+)\}/g;
const enums = [];
let match;

while ((match = enumRegex.exec(schema)) !== null) {
  const name = match[1];
  const body = match[2];
  const values = body
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, "").trim()) // strip inline comments
    .filter((line) => line && !line.startsWith("//") && !line.startsWith("@@"));

  enums.push({ name, values });
}

// Generate output
const lines = [
  "// ==========================================================================",
  "// AUTO-GENERATED — DO NOT EDIT",
  "// Source: packages/database/prisma/schema.prisma",
  `// Generated: ${new Date().toISOString()}`,
  "// Run: pnpm --filter shared-types generate",
  "// ==========================================================================",
  "",
];

for (const { name, values } of enums) {
  lines.push(`export enum ${name} {`);
  for (const value of values) {
    lines.push(`  ${value} = '${value}',`);
  }
  lines.push("}");
  lines.push("");

  // Also export as const object for runtime use
  lines.push(`export const ${name}Values = [${values.map((v) => `'${v}'`).join(", ")}] as const;`);
  lines.push("");
}

// Export a type helper
lines.push("// Utility type: extract union from enum");
lines.push(
  "export type EnumValues<T extends Record<string, string>> = T[keyof T];"
);
lines.push("");

writeFileSync(OUTPUT_PATH, lines.join("\n"), "utf-8");
console.log(`Generated ${enums.length} enums → ${OUTPUT_PATH}`);
