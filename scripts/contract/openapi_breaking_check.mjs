import fs from 'node:fs';

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function getOperations(spec) {
  const ops = new Map();
  const paths = spec.paths ?? {};
  for (const [p, item] of Object.entries(paths)) {
    if (!isObject(item)) continue;
    for (const [method, op] of Object.entries(item)) {
      const m = method.toLowerCase();
      if (!['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].includes(m)) continue;
      if (!isObject(op)) continue;
      ops.set(`${m.toUpperCase()} ${p}`, op);
    }
  }
  return ops;
}

function schemaFingerprint(schema) {
  if (!schema) return 'none';
  if (schema.$ref) return `ref:${schema.$ref}`;
  const type = schema.type ? String(schema.type) : 'unknown';
  const format = schema.format ? String(schema.format) : '';
  const nullable = schema.nullable === true ? 'nullable' : '';
  const enums = Array.isArray(schema.enum) ? `enum:${schema.enum.join('|')}` : '';
  return `type:${type}|format:${format}|${nullable}|${enums}`;
}

function getParameterKey(param) {
  return `${param.in ?? ''}:${param.name ?? ''}`;
}

function resolveLocalRef(spec, maybeSchema) {
  if (!maybeSchema || !maybeSchema.$ref) return maybeSchema;
  const ref = String(maybeSchema.$ref);
  if (!ref.startsWith('#/')) return maybeSchema;
  const parts = ref.slice(2).split('/');
  let cur = spec;
  for (const part of parts) {
    if (!isObject(cur) || !(part in cur)) return maybeSchema;
    cur = cur[part];
  }
  return cur;
}

function requiredSetForSchema(spec, schema) {
  const resolved = resolveLocalRef(spec, schema);
  if (!resolved || !Array.isArray(resolved.required)) return new Set();
  return new Set(resolved.required.map(String));
}

function getJsonContentSchema(op, statusCode) {
  const res = op.responses?.[statusCode];
  if (!res || !isObject(res)) return undefined;
  const content = res.content?.['application/json'];
  return content?.schema;
}

function getRequestJsonSchema(op) {
  const rb = op.requestBody;
  if (!rb || !isObject(rb)) return undefined;
  const content = rb.content?.['application/json'];
  return content?.schema;
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

const [basePath, headPath] = process.argv.slice(2);
if (!basePath || !headPath) {
  console.error('Usage: node openapi_breaking_check.mjs <base.json> <head.json>');
  process.exit(2);
}

const base = readJson(basePath);
const head = readJson(headPath);

const baseOps = getOperations(base);
const headOps = getOperations(head);

// 1) Removed operations are always breaking.
for (const key of baseOps.keys()) {
  if (!headOps.has(key)) {
    fail(`BREAKING: operation removed: ${key}`);
  }
}

// 2) Per-operation breaking checks.
for (const [key, baseOp] of baseOps.entries()) {
  const headOp = headOps.get(key);
  if (!headOp) continue;

  // Parameters: removal, required=false -> true, schema narrowing.
  const baseParams = Array.isArray(baseOp.parameters) ? baseOp.parameters : [];
  const headParams = Array.isArray(headOp.parameters) ? headOp.parameters : [];
  const baseMap = new Map(baseParams.filter(isObject).map((p) => [getParameterKey(p), p]));
  const headMap = new Map(headParams.filter(isObject).map((p) => [getParameterKey(p), p]));

  for (const [pkey, p] of headMap.entries()) {
    if (!baseMap.has(pkey) && p.required === true) {
      fail(`BREAKING: new required parameter added: ${key} ${pkey}`);
    }
  }

  for (const [pkey, p] of baseMap.entries()) {
    const next = headMap.get(pkey);
    if (!next) {
      fail(`BREAKING: parameter removed: ${key} ${pkey}`);
      continue;
    }
    const wasRequired = p.required === true;
    const nowRequired = next.required === true;
    if (!wasRequired && nowRequired) {
      fail(`BREAKING: parameter became required: ${key} ${pkey}`);
    }
    const baseSchema = resolveLocalRef(base, p.schema);
    const headSchema = resolveLocalRef(head, next.schema);
    if (schemaFingerprint(baseSchema) !== schemaFingerprint(headSchema)) {
      fail(`BREAKING: parameter schema changed: ${key} ${pkey} (${schemaFingerprint(baseSchema)} -> ${schemaFingerprint(headSchema)})`);
    }
  }

  // Request body: optional -> required is breaking; request schema required-set growth is breaking.
  const baseRb = baseOp.requestBody;
  const headRb = headOp.requestBody;
  const baseRbReq = isObject(baseRb) && baseRb.required === true;
  const headRbReq = isObject(headRb) && headRb.required === true;
  if (!baseRbReq && headRbReq) {
    fail(`BREAKING: requestBody became required: ${key}`);
  }

  const baseReqSchema = getRequestJsonSchema(baseOp);
  const headReqSchema = getRequestJsonSchema(headOp);
  if (baseReqSchema && headReqSchema) {
    const baseRequired = requiredSetForSchema(base, baseReqSchema);
    const headRequired = requiredSetForSchema(head, headReqSchema);
    for (const r of headRequired) {
      if (!baseRequired.has(r)) {
        fail(`BREAKING: request schema added required property '${r}': ${key}`);
      }
    }
  }

  // Responses: removing a documented status code is breaking.
  const baseResponses = isObject(baseOp.responses) ? baseOp.responses : {};
  const headResponses = isObject(headOp.responses) ? headOp.responses : {};
  for (const status of Object.keys(baseResponses)) {
    if (!(status in headResponses)) {
      fail(`BREAKING: response removed: ${key} ${status}`);
    }
  }

  // Success response schema drift: if 200/201 present in both and schema ref/type changes => breaking.
  for (const status of ['200', '201']) {
    if (!(status in baseResponses) || !(status in headResponses)) continue;
    const baseSchema = resolveLocalRef(base, getJsonContentSchema(baseOp, status));
    const headSchema = resolveLocalRef(head, getJsonContentSchema(headOp, status));
    if (schemaFingerprint(baseSchema) !== schemaFingerprint(headSchema)) {
      fail(`BREAKING: response schema changed: ${key} ${status} (${schemaFingerprint(baseSchema)} -> ${schemaFingerprint(headSchema)})`);
    }
  }
}

if (process.exitCode === 1) {
  console.error('OpenAPI breaking changes detected. If intentional, version the API or apply an additive-only change.');
}
