# Audit Tools — GharBatai Monorepo

Scripts for collecting inventory metrics and architectural analysis. Run from the repo root.

---

## Available Scripts

### `../../tools/inventory.sh`

Generates `tools/outputs/inventory.json` with:
- Lines of code per package
- Test file counts per app
- Web route count
- Prisma stats (models, enums, schema LoC)
- API module count
- `forwardRef` usage count (circular dep markers)
- Prisma-in-controller violation count
- Dependency counts per package
- Version mismatches across workspace

```bash
bash tools/inventory.sh > tools/outputs/inventory.json
```

### `../../tools/dep-graph.sh`

Generates `tools/outputs/dep-graph.txt` with:
- API cross-module import map (module A → module B)
- `common/` → `modules/` upward violations
- Prisma direct access in controllers
- `forwardRef` circular dependency markers
- Web shared-types adoption metrics
- Duplicate library detection
- API module size distribution (LoC per module)

```bash
bash tools/dep-graph.sh > tools/outputs/dep-graph.txt
```

---

## Legacy / Template Scripts (Not Used)

The following scripts were part of the generic polyglot audit template and are not applicable to GharBatai (TypeScript/Node-only monorepo):

| Script | Language | Status |
|--------|----------|--------|
| `inventory-node.ts` | TypeScript | Superseded by `tools/inventory.sh` |
| `inventory-java.gradle.kts` | Java/Gradle | Not applicable |
| `inventory-rust.rs` | Rust | Not applicable |
| `inventory-go.sh` | Go | Not applicable |
| `coupling-graph.py` | Python | Superseded by `tools/dep-graph.sh` |

These can be safely removed.
