// yamlmin is the riskiest file in the repo: a hand-written parser guarding the
// persona data. It throws rather than guesses, which is correct, but only if it
// throws on the right things.

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseYaml, YamlError } from '../scripts/lib/yamlmin.mjs';

test('scalars', () => {
  assert.deepEqual(parseYaml('a: 1'), { a: 1 });
  assert.deepEqual(parseYaml('a: 1.5'), { a: 1.5 });
  assert.deepEqual(parseYaml('a: -2'), { a: -2 });
  assert.deepEqual(parseYaml('a: true'), { a: true });
  assert.deepEqual(parseYaml('a: false'), { a: false });
  assert.deepEqual(parseYaml('a: yes'), { a: true });
  assert.deepEqual(parseYaml('a: null'), { a: null });
  assert.deepEqual(parseYaml('a: ~'), { a: null });
  assert.deepEqual(parseYaml('a:'), { a: null });
  assert.deepEqual(parseYaml('a: hello world'), { a: 'hello world' });
  assert.deepEqual(parseYaml('a: "quoted: colon"'), { a: 'quoted: colon' });
  assert.deepEqual(parseYaml("a: 'single'"), { a: 'single' });
});

test('empty document', () => {
  assert.equal(parseYaml(''), null);
  assert.equal(parseYaml('\n\n  \n'), null);
  assert.equal(parseYaml('# only a comment'), null);
});

test('nesting by indentation', () => {
  const out = parseYaml(['a:', '  b: 1', '  c:', '    d: 2', 'e: 3'].join('\n'));
  assert.deepEqual(out, { a: { b: 1, c: { d: 2 } }, e: 3 });
});

test('block sequence of scalars', () => {
  assert.deepEqual(parseYaml(['a:', '  - one', '  - two'].join('\n')), { a: ['one', 'two'] });
});

test('sequence at the same indent as its key', () => {
  assert.deepEqual(parseYaml(['a:', '- one', '- two'].join('\n')), { a: ['one', 'two'] });
});

test('block sequence of mappings', () => {
  const out = parseYaml(
    ['items:', '  - id: a', '    n: 1', '  - id: b', '    n: 2'].join('\n'),
  );
  assert.deepEqual(out, { items: [{ id: 'a', n: 1 }, { id: 'b', n: 2 }] });
});

test('sequence nested under a sequence item', () => {
  const out = parseYaml(['a:', '  - x:', '      - 1', '      - 2', '  - y: 3'].join('\n'));
  assert.deepEqual(out, { a: [{ x: [1, 2] }, { y: 3 }] });
});

test('flow sequences', () => {
  assert.deepEqual(parseYaml('a: [1, 2, 3]'), { a: [1, 2, 3] });
  assert.deepEqual(parseYaml('a: [mon, tue, wed]'), { a: ['mon', 'tue', 'wed'] });
  assert.deepEqual(parseYaml('a: ["08:30", "12:00"]'), { a: ['08:30', '12:00'] });
  assert.deepEqual(parseYaml('a: [true, false, null]'), { a: [true, false, null] });
});

test('empty flow mapping is allowed, non-empty is rejected', () => {
  assert.deepEqual(parseYaml('a: {}'), { a: {} });
  assert.throws(() => parseYaml('a: {b: 1}'), YamlError);
});

test('comments', () => {
  const out = parseYaml(['# header', 'a: 1 # trailing', 'b: "has # inside"'].join('\n'));
  assert.deepEqual(out, { a: 1, b: 'has # inside' });
});

test('hash inside a url value is not a comment', () => {
  assert.deepEqual(parseYaml('url: https://example.com/page#frag'), {
    url: 'https://example.com/page#frag',
  });
});

test('block scalars', () => {
  const lit = parseYaml(['a: |', '  line one', '  line two'].join('\n'));
  assert.equal(lit.a, 'line one\nline two\n');

  const folded = parseYaml(['a: >', '  line one', '  line two'].join('\n'));
  assert.equal(folded.a, 'line one line two\n');

  const stripped = parseYaml(['a: |-', '  only'].join('\n'));
  assert.equal(stripped.a, 'only');
});

test('colon in a value', () => {
  assert.deepEqual(parseYaml('a: https://x.test'), { a: 'https://x.test' });
  assert.deepEqual(parseYaml('a: 12:30 tomorrow'), { a: '12:30 tomorrow' });
});

test('rejects unsupported constructs loudly', () => {
  assert.throws(() => parseYaml('a: &anchor 1'), /anchors/);
  assert.throws(() => parseYaml('a: *alias'), /aliases/);
  assert.throws(() => parseYaml('a: !!str 1'), /tags/);
  assert.throws(() => parseYaml('---'), /multi-document/);
  assert.throws(() => parseYaml('? complex'), /complex keys/);
});

test('rejects tabs for indentation', () => {
  assert.throws(() => parseYaml('a:\n\tb: 1'), /tabs/);
});

test('unterminated string is an error, not a silent pass', () => {
  assert.throws(() => parseYaml('a: "unclosed'), /unterminated|expect/);
});

test('CRLF input', () => {
  assert.deepEqual(parseYaml('a: 1\r\nb: 2\r\n'), { a: 1, b: 2 });
});

test('real files in the repo parse', async () => {
  const { repoPath, readText, fileExists } = await import('../scripts/lib/fsio.mjs');
  const files = [
    'persona/identity.yaml',
    'persona/audience.yaml',
    'persona/voice.yaml',
    'persona/pov-map.yaml',
    'persona/proof.yaml',
    'persona/offers.yaml',
    'persona/keywords.yaml',
    'rubric/profile-rubric.yaml',
    'rubric/post-rubric.yaml',
    'rubric/brand-consistency.yaml',
    'data/examples/sample-persona/identity.yaml',
    'data/examples/sample-persona/voice.yaml',
    'data/examples/sample-persona/pov-map.yaml',
    'data/examples/sample-persona/proof.yaml',
    'data/examples/sample-persona/offers.yaml',
    'data/examples/sample-persona/keywords.yaml',
    'data/examples/sample-persona/audience.yaml',
  ];
  for (const rel of files) {
    const abs = repoPath(...rel.split('/'));
    assert.ok(fileExists(abs), `${rel} should exist`);
    const out = parseYaml(readText(abs));
    assert.ok(out && typeof out === 'object', `${rel} should parse to an object`);
  }
});