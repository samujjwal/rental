// tools/inventory-node.ts
// Usage: ts-node tools/inventory-node.ts > docs/architecture-audit/outputs/node-inventory.json
import { readFileSync, readdirSync, statSync } from "fs";
import * as path from "path";

function findPackageJsons(dir: string, acc: string[] = []) {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory() && !entry.startsWith(".") && entry !== "node_modules") {
      findPackageJsons(p, acc);
    } else if (entry === "package.json") {
      acc.push(p);
    }
  }
  return acc;
}

function main() {
  const root = process.cwd();
  const files = findPackageJsons(root);
  const out: any[] = [];
  for (const f of files) {
    try {
      const json = JSON.parse(readFileSync(f, "utf-8"));
      out.push({
        file: path.relative(root, f),
        name: json.name,
        version: json.version,
        deps: json.dependencies || {},
        devDeps: json.devDependencies || {},
        scripts: json.scripts || {},
      });
    } catch (e) {
      // ignore malformed
    }
  }
  console.log(JSON.stringify(out, null, 2));
}

main();
