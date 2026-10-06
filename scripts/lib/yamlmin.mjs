// Minimal YAML subset parser.
//
// WHY THIS EXISTS
// The repo ships zero runtime dependencies. The persona files are the most
// important thing in it and they need to be readable and editable by a human
// without a build step, which means YAML, not JSON. This parser covers exactly
// the subset used by persona/*.yaml and rubric/*.yaml, and it throws loudly on
// anything it does not understand instead of guessing.
//
// SUPPORTED
//   - comments (# to end of line, outside quotes)
//   - key: value, nested by 2-space indentation
//   - block sequences: "- scalar" and "- key: value" with continued keys
//   - flow sequences: [a, b, c]  (scalars and simple nested flow only)
//   - block scalars: | (literal, keeps newlines) and > (folded)
//   - scalars: double/single quoted, plain, integers, floats, true/false,
//     null / ~ / empty
//   - a key with no value and no deeper block -> null
//
// NOT SUPPORTED (throws)
//   anchors (&x), aliases (*x), tags (!!x), multiple documents (---),
//   flow mappings ({a: 1}), complex keys (? :), merge keys (<<)
//   tabs for indentation
//
// If you need one of those, convert the file. Do not extend this parser for a
// single feature; it is a data-format reader, not a YAML implementation.

const TRUE = new Set(['true', 'yes', 'on']);
const FALSE = new Set(['false', 'no', 'off']);
const NULLS = new Set(['', '~', 'null']);

class YamlError extends Error {
  constructor(message, line) {
    super(line != null ? `${message} (line ${line + 1})` : message);
    this.name = 'YamlError';
    this.line = line;
  }
}

/** Strip a trailing `# comment`, respecting quotes. */
function stripComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === '\\' && quote === '"') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '#' && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i);
    }
  }
  return line;
}

/** Remove surrounding quotes and resolve escapes. */
function unquote(raw, line) {
  if (raw.length >= 2 && raw[0] === '"' && raw[raw.length - 1] === '"') {
    return raw
      .slice(1, -1)
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\r/g, '\r')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
  if (raw.length >= 2 && raw[0] === "'" && raw[raw.length - 1] === "'") {
    return raw.slice(1, -1).replace(/''/g, "'");
  }
  return raw;
}

function coerce(raw) {
  const v = raw.trim();
  if (NULLS.has(v)) return null;
  if (v.length >= 2 && (v[0] === '"' || v[0] === "'")) {
    if (v[0] === v[v.length - 1]) return unquote(v);
    throw new YamlError(`unterminated string: ${v}`);
  }
  const lower = v.toLowerCase();
  if (TRUE.has(lower)) return true;
  if (FALSE.has(lower)) return false;
  if (/^-?\d+$/.test(v)) return Number.parseInt(v, 10);
  if (/^-?(\d+\.\d*|\.\d+|\d+)([eE][+-]?\d+)?$/.test(v)) return Number.parseFloat(v);
  return v;
}

/** Split a flow sequence body on top-level commas. */
function splitFlow(body, line) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let buf = '';
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quote) {
      buf += ch;
      if (ch === '\\' && quote === '"') {
        buf += body[++i] ?? '';
      } else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      buf += ch;
      continue;
    }
    if (ch === '[' || ch === '{') depth++;
    if (ch === ']' || ch === '}') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(buf);
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (quote) throw new YamlError('unterminated string in flow sequence', line);
  if (buf.trim() !== '' || parts.length > 0) parts.push(buf);
  return parts.filter((p) => p.trim() !== '');
}

function parseFlow(raw, line) {
  const v = raw.trim();
  if (v.startsWith('[')) {
    if (!v.endsWith(']')) throw new YamlError('unterminated flow sequence', line);
    return splitFlow(v.slice(1, -1), line).map((p) => parseFlow(p, line));
  }
  if (v.startsWith('{')) {
    // An empty flow mapping is a legitimate "no value here yet" placeholder and
    // is used in persona/audience.yaml. Anything with content stays rejected:
    // flow mappings are too easy to write ambiguously to be worth the parser.
    if (v === '{}') return {};
    throw new YamlError('non-empty flow mappings {a: 1} are not supported by yamlmin', line);
  }
  return coerce(v);
}

/**
 * Reject constructs this parser does not implement, loudly.
 *
 * Checked in two places: at the start of a line (a document-level construct) and
 * at the start of a value (which is where YAML actually permits anchors, aliases
 * and tags to appear). Checking only the line start would let `key: &anchor 1`
 * through and silently produce the string "&anchor 1".
 */
function rejectUnsupported(body, i) {
  const t = body[i].trimStart();
  const reject = (reason) => {
    throw new YamlError(reason, i);
  };
  if (/^&[\w-]/.test(t)) reject('anchors are not supported by yamlmin');
  if (/^\*[\w-]+/.test(t)) reject('aliases are not supported by yamlmin');
  if (/^!!/.test(t)) reject('tags are not supported by yamlmin');
  if (t === '---' || t === '...') reject('multi-document YAML is not supported by yamlmin');
  if (t.startsWith('? ')) reject('complex keys are not supported by yamlmin');

  // Value position. The key separator is the first ": " outside quotes.
  const colon = keySplit(t, i);
  if (colon !== -1) {
    const v = t.slice(colon + 1).trimStart();
    if (/^&[\w-]/.test(v)) reject('anchors are not supported by yamlmin');
    if (/^\*[\w-]+/.test(v)) reject('aliases are not supported by yamlmin');
    if (/^!!/.test(v)) reject('tags are not supported by yamlmin');
  }
}

/** Index of the key separator: the first ": " (or trailing ":"), outside quotes. */
function keySplit(line, i) {
  let quote = null;
  for (let j = 0; j < line.length; j++) {
    const ch = line[j];
    if (quote) {
      if (ch === '\\' && quote === '"') j++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === ':' && (j === line.length - 1 || line[j + 1] === ' ' || line[j + 1] === '\t')) {
      return j;
    }
  }
  return -1;
}

function indentOf(line) {
  let n = 0;
  while (n < line.length && line[n] === ' ') n++;
  return n;
}

/**
 * Parse a YAML subset string into plain JS values.
 * @param {string} source
 * @returns {any}
 */
export function parseYaml(source) {
  const rawLines = String(source).replace(/\r\n?/g, '\n').split('\n');
  const body = [];
  for (let i = 0; i < rawLines.length; i++) {
    rejectUnsupported(rawLines, i);
    // Tab indentation is checked before comment stripping, because a tab inside
    // a comment is harmless and a tab used as indentation is not.
    const m = rawLines[i].match(/^[ \t]*/);
    const lead = m ? m[0] : '';
    if (lead.includes('\t')) {
      throw new YamlError('tabs cannot be used for indentation', i);
    }
    const stripped = stripComment(rawLines[i]);
    if (stripped.trim() === '') continue;
    const ind = indentOf(stripped);
    body.push({ text: stripped.slice(ind), indent: ind, line: i });
  }
  if (body.length === 0) return null;
  const [value] = parseBlock(body, 0, body[0].indent);
  return value;
}

/** Parse a block at `indent`, starting at `idx`. Returns [value, nextIdx]. */
function parseBlock(lines, idx, indent) {
  // Sequence block?
  if (lines[idx].text.startsWith('- ') || lines[idx].text === '-') {
    const items = [];
    let i = idx;
    while (i < lines.length && lines[i].indent === indent && (lines[i].text.startsWith('- ') || lines[i].text === '-')) {
      const rest = lines[i].text === '-' ? '' : lines[i].text.slice(2).trim();
      if (rest === '') {
        // Value lives in the following, deeper block.
        if (i + 1 < lines.length && lines[i + 1].indent > indent) {
          const [v, next] = parseBlock(lines, i + 1, lines[i + 1].indent);
          items.push(v);
          i = next;
        } else {
          items.push(null);
          i++;
        }
        continue;
      }
      const colon = keySplit(rest, lines[i].line);
      if (colon === -1) {
        items.push(coerce(rest));
        i++;
        continue;
      }
      // A mapping that begins on the dash line. Its keys sit at indent + 2,
      // which is where the content after "- " already is.
      const synthetic = [{ text: rest, indent: indent + 2, line: lines[i].line }];
      let j = i + 1;
      while (j < lines.length && lines[j].indent > indent) {
        synthetic.push({ text: lines[j].text, indent: lines[j].indent, line: lines[j].line });
        j++;
      }
      const [obj] = parseBlock(synthetic, 0, indent + 2);
      items.push(obj);
      i = j;
    }
    return [items, i];
  }

  const map = {};
  let i = idx;
  while (i < lines.length && lines[i].indent === indent) {
    const { text, line } = lines[i];
    const colon = keySplit(text, line);
    if (colon === -1) throw new YamlError(`expected "key: value", got: ${text}`, line);
    const key = coerce(text.slice(0, colon).trim());
    if (typeof key !== 'string' && typeof key !== 'number') {
      throw new YamlError(`unsupported key type`, line);
    }
    const rawVal = text.slice(colon + 1).trim();

    // Block scalar: | or > (optionally with an indentation chomping indicator)
    if (rawVal === '|' || rawVal === '|-' || rawVal === '>' || rawVal === '>-') {
      const folded = rawVal.startsWith('>');
      const keepFinal = !rawVal.endsWith('-');
      const buf = [];
      let j = i + 1;
      let childIndent = null;
      while (j < lines.length && lines[j].indent > indent) {
        if (childIndent === null) childIndent = lines[j].indent;
        buf.push(' '.repeat(Math.max(0, lines[j].indent - childIndent)) + lines[j].text);
        j++;
      }
      let out = folded ? buf.join(' ') : buf.join('\n');
      if (keepFinal && out.length > 0) out += '\n';
      map[key] = out.replace(/\n$/, keepFinal ? '\n' : '');
      i = j;
      continue;
    }

    if (rawVal !== '') {
      map[key] = parseFlow(rawVal, line);
      i++;
      continue;
    }

    // Empty value: a deeper block is its value, otherwise null.
    if (i + 1 < lines.length && lines[i + 1].indent > indent) {
      const [v, next] = parseBlock(lines, i + 1, lines[i + 1].indent);
      map[key] = v;
      i = next;
    } else if (
      i + 1 < lines.length &&
      lines[i + 1].indent === indent &&
      (lines[i + 1].text.startsWith('- ') || lines[i + 1].text === '-')
    ) {
      // Sequences are commonly written at the same indent as their key.
      const [v, next] = parseBlock(lines, i + 1, indent);
      map[key] = v;
      i = next;
    } else {
      map[key] = null;
      i++;
    }
  }
  return [map, i];
}

export { YamlError };
export default { parseYaml };