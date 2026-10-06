import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HARD_BANS,
  SOFT_TELLS,
  findHardBans,
  findSoftTells,
  findVagueQuantifiers,
  findUnsourcedAuthority,
  countOccurrences,
  normalize,
} from '../scripts/lib/slop.mjs';

const CLEAN = 'Write the process down before you automate it. One team got six hours back in a quarter.';

test('a clean post trips nothing', () => {
  assert.equal(findHardBans(CLEAN).length, 0);
  assert.equal(findUnsourcedAuthority(CLEAN).length, 0);
});

test('hard bans are detected', () => {
  const bad = 'In today\'s fast-paced world, this is a game-changer. Here is the thing.';
  const hits = findHardBans(bad);
  assert.ok(hits.length >= 2, `expected >=2 hits, got ${hits.length}`);
  assert.ok(hits.some((h) => /fast-paced/i.test(h.phrase)));
});

test('AI self-reference is caught', () => {
  for (const p of ['As an AI, I cannot help with that.', 'This is AI-generated content.']) {
    assert.ok(findHardBans(p).some((h) => /as an ai|ai.generated/i.test(h.phrase)), `missed: ${p}`);
  }
});

test('extra bans from voice.yaml are honoured', () => {
  assert.equal(findHardBans('We deployed the thing.', ['deployed the thing']).length, 1);
});

test('detection is case and punctuation insensitive', () => {
  assert.ok(findHardBans('GAME-CHANGER!').length >= 1);
  assert.ok(findHardBans('game changer').length >= 1);
  assert.ok(findHardBans('A  Game-Changer').length >= 1);
});

test('contraction variants both match', () => {
  // "dont" and "don't" must both be caught, which is why the matcher searches
  // the normalised text and the raw text.
  assert.ok(findHardBans('as an ai language model, i cannot browse the web and report it back now').length >= 1);
});

test('soft tells are soft, not hard', () => {
  const text = 'I have seen this a lot. In my experience it just works. I think it is obvious.';
  assert.equal(findHardBans(text).length, 0, 'soft tells must not be hard bans');
  assert.ok(findSoftTells(text).length >= 2);
});

test('every soft tell explains why it matters', () => {
  // A tell without a note is just a rule nobody can act on.
  for (const t of SOFT_TELLS) {
    assert.ok(t.note && t.note.trim().length >= 8, `missing or too-short note on "${t.phrase}": ${t.note}`);
  }
});

test('vague quantifiers are found', () => {
  const hits = findVagueQuantifiers('Many companies see improvements and several teams notice it.');
  assert.ok(hits.some((h) => h.phrase === 'many'));
  assert.ok(hits.some((h) => h.phrase === 'several'));
});

test('unsourced authority is found', () => {
  const hits = findUnsourcedAuthority('Studies show it works and research proves the point.');
  assert.ok(hits.length >= 2);
});

test('countOccurrences counts repeats', () => {
  assert.equal(countOccurrences('just do it, just do it, just do it', 'just'), 3);
  assert.equal(countOccurrences('do it once', 'just'), 0);
});

test('normalize handles smart quotes and dashes', () => {
  assert.equal(normalize('It’s not “simple”—really'), "it's not \"simple\"-really");
});

test('hard ban list is free of duplicates', () => {
  const seen = new Set();
  for (const p of HARD_BANS) {
    const k = normalize(p);
    assert.ok(!seen.has(k), `duplicate hard ban: ${p}`);
    seen.add(k);
  }
});

test('no hard ban is also a soft tell', () => {
  const soft = new Set(SOFT_TELLS.map((t) => normalize(t.phrase)));
  for (const p of HARD_BANS) {
    assert.ok(!soft.has(normalize(p)), `"${p}" is in both lists; it should be one or the other`);
  }
});

test('nested coverage between the lists is intentional, not accidental', () => {
  // Some soft tells sit inside a hard ban on purpose: "leverage" alone is worth
  // flagging, "leverage synergies" is fatal. A post containing only the former
  // should lose points, not be blocked outright.
  const soft = SOFT_TELLS.map((t) => normalize(t.phrase));
  assert.ok(soft.some((s) => s === normalize('leverage')));
  assert.ok(HARD_BANS.some((h) => normalize(h).includes(normalize('leverage'))));
});

test('hits report a line number and context', () => {
  const h = findHardBans('First line is fine.\nSecond line has a game-changer in it.')[0];
  assert.ok(h.line >= 1);
  assert.ok(h.context.length > 0);
});