import fs from 'node:fs';
import path from 'node:path';

function readUtf8(p) {
  return fs.readFileSync(p, 'utf8');
}

function listFilesRecursive(dir, predicate) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(p, predicate));
    else if (predicate(p)) out.push(p);
  }
  return out;
}

function isJavaFile(p) {
  return p.endsWith('.java');
}

function loadBundledOpenApiJson(openapiYamlPath) {
  const jsonPath = process.env.OPENAPI_JSON;
  if (!jsonPath) {
    throw new Error('OPENAPI_JSON env var is required (path to bundled OpenAPI JSON).');
  }
  const spec = JSON.parse(readUtf8(jsonPath));
  if (!spec.paths) throw new Error('Invalid OpenAPI JSON: missing paths');
  return spec;
}

function getSpecOperations(spec) {
  const ops = new Set();
  for (const [p, item] of Object.entries(spec.paths ?? {})) {
    if (!item || typeof item !== 'object') continue;
    for (const [method, op] of Object.entries(item)) {
      const m = method.toLowerCase();
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(m)) continue;
      if (!op || typeof op !== 'object') continue;
      ops.add(`${m.toUpperCase()} ${p}`);
    }
  }
  return ops;
}

function normalizePath(p) {
  // Normalize to the OpenAPI shape (no /api/v1 prefix in paths; that lives in servers.url)
  // Accept both '/api/v1/foo' and '/foo'.
  if (p.startsWith('/api/v1/')) return p.slice('/api/v1'.length);
  if (p === '/api/v1') return '/';
  return p;
}

function extractJavaMappings(javaSource) {
  const classBase = [];
  const classRequestMapping = /@RequestMapping\s*\(([^)]*)\)/g;
  let m;
  while ((m = classRequestMapping.exec(javaSource)) !== null) {
    classBase.push(m[1]);
  }

  const mappingPatterns = [
    { method: 'GET', re: /@GetMapping\s*\(([^)]*)\)/g },
    { method: 'POST', re: /@PostMapping\s*\(([^)]*)\)/g },
    { method: 'PATCH', re: /@PatchMapping\s*\(([^)]*)\)/g },
    { method: 'DELETE', re: /@DeleteMapping\s*\(([^)]*)\)/g }
  ];

  const ops = [];
  for (const mp of mappingPatterns) {
    while ((m = mp.re.exec(javaSource)) !== null) {
      ops.push({ method: mp.method, rawArgs: m[1] });
    }
  }

  function extractPathFromArgs(args) {
    // Handles: "/foo" or value = "/foo" or path = "/foo"
    const direct = args.match(/\s*"([^"]+)"\s*/);
    if (direct) return direct[1];
    const named = args.match(/\b(?:value|path)\s*=\s*"([^"]+)"/);
    if (named) return named[1];
    return null;
  }

  const bases = classBase.map(extractPathFromArgs).filter(Boolean);
  const base = bases.length > 0 ? bases[bases.length - 1] : '';

  const results = new Set();
  for (const op of ops) {
    const p = extractPathFromArgs(op.rawArgs) ?? '';
    const full = `${base}${p}` || '/';
    results.add(`${op.method} ${normalizePath(full)}`);
  }
  return results;
}

function parseMvpSliceDone(todoText) {
  // A slice is considered DONE when every checkbox line in that slice section is [x].
  const lines = todoText.split(/\r?\n/);
  const slices = [];
  let current = null;

  for (const line of lines) {
    const header = line.match(/^###\s+Slice\s+(\d+)\./);
    if (header) {
      if (current) slices.push(current);
      current = { number: Number(header[1]), checkboxLines: [] };
      continue;
    }
    if (!current) continue;
    const cb = line.match(/^\s*-\s*\[( |x|X)\]\s+/);
    if (cb) current.checkboxLines.push(cb[1]);
  }
  if (current) slices.push(current);

  const done = new Map();
  for (const s of slices) {
    const hasBoxes = s.checkboxLines.length > 0;
    const allChecked = hasBoxes && s.checkboxLines.every((v) => v.toLowerCase() === 'x');
    done.set(s.number, allChecked);
  }
  return done;
}

function fail(msg) {
  console.error(msg);
  process.exitCode = 1;
}

const repoRoot = process.cwd();
const spec = loadBundledOpenApiJson('docs/openapi.yaml');
const specOps = getSpecOperations(spec);

const javaRoot = path.join(repoRoot, 'backend', 'src', 'main', 'java');
const javaFiles = fs.existsSync(javaRoot) ? listFilesRecursive(javaRoot, isJavaFile) : [];
const implOps = new Set();
for (const f of javaFiles) {
  const txt = readUtf8(f);
  if (!txt.includes('Mapping')) continue;
  for (const op of extractJavaMappings(txt)) implOps.add(op);
}

// Contract-first rule: any implemented operation must exist in spec.
for (const op of implOps) {
  if (!specOps.has(op)) {
    fail(`DRIFT: implementation has operation missing from spec: ${op}`);
  }
}

// Slice completion gate: if a slice is marked done in docs, required operations must exist in implementation.
const todoPath = path.join(repoRoot, 'docs', 'MVP_TODO_LIST.md');
if (fs.existsSync(todoPath)) {
  const todoText = readUtf8(todoPath);
  const doneMap = parseMvpSliceDone(todoText);

  const sliceRequired = new Map([
    [1, ['POST /auth/signup', 'POST /auth/login', 'GET /auth/me', 'POST /auth/logout']],
    [2, ['GET /accounts', 'POST /accounts', 'PATCH /accounts/{id}']],
    [3, ['GET /transactions', 'POST /transactions', 'GET /transactions/{id}', 'PATCH /transactions/{id}', 'DELETE /transactions/{id}', 'GET /categories', 'POST /categories', 'PATCH /categories/{id}']],
    [4, []],
    [5, ['GET /reports/summary', 'GET /reports/transfers']],
    [6, ['POST /imports/csv']],
    [7, ['GET /backups/export', 'POST /backups/import']]
  ]);

  for (const [sliceNo, isDone] of doneMap.entries()) {
    if (!isDone) continue;
    const requiredOps = sliceRequired.get(sliceNo) ?? [];
    for (const required of requiredOps) {
      if (!implOps.has(required)) {
        fail(`DRIFT: slice ${sliceNo} marked done but implementation missing: ${required}`);
      }
    }
  }
}

if (process.exitCode === 1) {
  console.error('Spec/implementation drift detected. Fix by updating docs/openapi.yaml first, then implementing in backend.');
} else {
  console.log(`OK: specOps=${specOps.size} implOps=${implOps.size} (no forbidden drift detected)`);
}
