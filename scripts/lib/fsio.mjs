// Filesystem and JSON helpers. Sync on purpose: these scripts run as one-shot
// CLI commands from an agent, and async adds nothing but failure modes.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..', '..');

export function repoPath(...parts) {
  return path.join(REPO_ROOT, ...parts);
}

export function readText(file) {
  return fs.readFileSync(file, 'utf8');
}

export function readJson(file) {
  return JSON.parse(readText(file));
}

export function readJsonIfExists(file, fallback = null) {
  if (!fs.existsSync(file)) return fallback;
  return readJson(file);
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function writeJson(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return file;
}

export function writeText(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, value, 'utf8');
  return file;
}

export function fileExists(file) {
  return fs.existsSync(file);
}

/** Today as YYYY-MM-DD in local time. */
export function todayISO(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function nowISO(d = new Date()) {
  return d.toISOString();
}

/** Parse YYYY-MM-DD into a local Date at midnight. */
export function parseDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso).trim());
  if (!m) throw new Error(`not a YYYY-MM-DD date: ${iso}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function addDays(date, n) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + n);
  return d;
}

export function dayOfWeekISO(date) {
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][date.getDay()];
}

/** Minimal JSON Schema validator: enough for draft-07 constructs used here. */
export function validateAgainstSchema(value, schema, pointer = '$') {
  const errors = [];
  const t = schema.type;

  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const typeOk =
    t === undefined ||
    (Array.isArray(t) ? t.some((x) => matchesType(value, x)) : matchesType(value, t));

  if (!typeOk) {
    errors.push({ pointer, message: `expected type ${JSON.stringify(t)}, got ${describe(value)}` });
    return errors;
  }
  if (t === 'null' && value === null) return errors;

  if (typeof schema.const !== 'undefined' && value !== schema.const) {
    errors.push({ pointer, message: `expected const ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}` });
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((e) => e === value)) {
    errors.push({ pointer, message: `${JSON.stringify(value)} not in enum ${JSON.stringify(schema.enum)}` });
  }

  if (typeof value === 'string') {
    if (schema.minLength != null && value.length < schema.minLength) {
      errors.push({ pointer, message: `length ${value.length} < minLength ${schema.minLength}` });
    }
    if (schema.maxLength != null && value.length > schema.maxLength) {
      errors.push({ pointer, message: `length ${value.length} > maxLength ${schema.maxLength}` });
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errors.push({ pointer, message: `"${value}" does not match ${schema.pattern}` });
    }
  }

  if (typeof value === 'number') {
    if (schema.minimum != null && value < schema.minimum) {
      errors.push({ pointer, message: `${value} < minimum ${schema.minimum}` });
    }
    if (schema.maximum != null && value > schema.maximum) {
      errors.push({ pointer, message: `${value} > maximum ${schema.maximum}` });
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) {
      errors.push({ pointer, message: `${value.length} items < minItems ${schema.minItems}` });
    }
    if (schema.maxItems != null && value.length > schema.maxItems) {
      errors.push({ pointer, message: `${value.length} items > maxItems ${schema.maxItems}` });
    }
    if (schema.items) {
      value.forEach((item, i) => {
        errors.push(...validateAgainstSchema(item, schema.items, `${pointer}[${i}]`));
      });
    }
  }

  if (isObj(value)) {
    for (const key of schema.required ?? []) {
      if (!(key in value) || value[key] === undefined) {
        errors.push({ pointer, message: `missing required property "${key}"` });
      }
    }
    for (const [key, sub] of Object.entries(schema.properties ?? {})) {
      if (key in value && value[key] !== undefined) {
        errors.push(...validateAgainstSchema(value[key], sub, `${pointer}.${key}`));
      }
    }
    if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      const known = new Set(Object.keys(schema.properties ?? {}));
      for (const [key, sub] of Object.entries(value)) {
        if (!known.has(key)) {
          errors.push(...validateAgainstSchema(sub, schema.additionalProperties, `${pointer}.${key}`));
        }
      }
    }
  }

  for (const sub of schema.allOf ?? []) errors.push(...validateAgainstSchema(value, sub, pointer));
  if (schema.anyOf) {
    const branchErrors = schema.anyOf.map((sub) => validateAgainstSchema(value, sub, pointer));
    if (!branchErrors.some((e) => e.length === 0)) {
      // Report why each branch failed. "no branch matched" alone sends the
      // reader hunting through the schema to work out which constraint bit.
      const detail = schema.anyOf
        .map((_, i) => `branch ${i}: ${branchErrors[i].map((e) => e.message).join('; ') || 'ok'}`)
        .join(' | ');
      errors.push({ pointer, message: `no anyOf branch matched — ${detail}` });
    }
  }
  if (schema.if) {
    const matched = validateAgainstSchema(value, schema.if, pointer).length === 0;
    if (matched && schema.then) errors.push(...validateAgainstSchema(value, schema.then, pointer));
    if (!matched && schema.else) errors.push(...validateAgainstSchema(value, schema.else, pointer));
  }
  if (schema.$ref) {
    errors.push(...validateAgainstSchema(value, resolveRef(schema.$ref), pointer));
  }

  return errors;
}

function matchesType(value, t) {
  switch (t) {
    case 'object':
      return value !== null && typeof value === 'object' && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'integer':
      return Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'null':
      return value === null;
    default:
      return true;
  }
}

function describe(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/** Resolve a local `#/...` ref against the root schema. */
function resolveRef(ref, root) {
  const parts = ref.replace(/^#\//, '').split('/');
  let node = root ?? currentRoot;
  for (const p of parts) node = node?.[p];
  if (!node) throw new Error(`cannot resolve $ref ${ref}`);
  return node;
}

let currentRoot = null;

/** Load a schema file and remember it as the resolution root for $ref. */
export function loadSchema(name) {
  currentRoot = readJson(repoPath('schemas', name));
  return currentRoot;
}

export function validateWithSchema(value, schemaName, pointer = '$') {
  const schema = loadSchema(schemaName);
  return validateAgainstSchema(value, schema, pointer);
}