# tools/coupling-graph.py
# Usage: python tools/coupling-graph.py <repo-root> > docs/architecture-audit/outputs/coupling.json
import os, sys, json, re
ROOT = sys.argv[1] if len(sys.argv) > 1 else "."
ext_map = {
  ".ts": "ts", ".tsx":"ts", ".js":"ts",
  ".java":"java", ".kt":"java",
  ".rs":"rust",
  ".go":"go"
}
deps = {}
for base, _, files in os.walk(ROOT):
    for f in files:
        _, ext = os.path.splitext(f)
        if ext not in ext_map: continue
        lang = ext_map[ext]
        p = os.path.join(base, f)
        try:
            with open(p, "r", encoding="utf-8", errors="ignore") as fh:
                t = fh.read()
        except Exception:
            continue
        mod = base.split(os.sep)
        key = "/".join(mod[-3:])  # heuristic module key
        deps.setdefault(key, {"lang": lang, "imports": set()})
        for m in re.findall(r'(import\\s+[^\\n]+|use\\s+[^;]+;|package\\s+[^;]+;)', t):
            deps[key]["imports"].add(m[:100])
out = {k: {"lang": v["lang"], "imports": sorted(v["imports"])} for k,v in deps.items()}
print(json.dumps(out, indent=2))
