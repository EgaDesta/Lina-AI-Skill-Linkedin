// Persona-level tests: the shipped empty persona must block, the example
// persona must pass, and the schema must accept both the right values and the
// wrong ones.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadPersona,
  collectGaps,
  blockingGaps,
  validatePersonaSchema,
  proofIndex,
  pillarById,
  beliefById,
  primarySegment,
  readVoiceSamples,
} from '../scripts/lib/persona.mjs';
import { repoPath, validateWithSchema, validateAgainstSchema, loadSchema } from '../scripts/lib/fsio.mjs';

const SHIPPED = repoPath();
const EXAMPLE = repoPath('data', 'examples', 'sample-persona');

test('the shipped persona is empty and blocks', () => {
  const p = loadPersona(SHIPPED);
  const blockers = blockingGaps(p);
  assert.ok(blockers.length > 0, 'an empty persona must block, or Lina would guess the niche');
  assert.ok(
    blockers.some((b) => b.id === 'positioning.statement'),
    'a missing positioning statement must be a blocking gap',
  );
});

test('the shipped persona still parses and passes schema', () => {
  const p = loadPersona(SHIPPED);
  const errors = validatePersonaSchema(p);
  assert.deepEqual(errors, [], 'empty strings are valid strings; only presence matters');
});

test('the example persona is complete', () => {
  const p = loadPersona(EXAMPLE);
  const gaps = collectGaps(p);
  const blockers = gaps.filter((g) => g.blocks);
  assert.deepEqual(blockers, [], `example persona should have no blocking gaps, got ${JSON.stringify(blockers, null, 2)}`);
});

test('the example persona passes schema validation', () => {
  const p = loadPersona(EXAMPLE);
  assert.deepEqual(validatePersonaSchema(p), []);
});

test('pillar weights in the example sum to one', () => {
  const p = loadPersona(EXAMPLE);
  const sum = (p.povMap.pillars ?? []).reduce((a, x) => a + (x.weight ?? 0), 0);
  assert.ok(Math.abs(sum - 1) < 0.001, `weights sum to ${sum}`);
});

test('every pillar belief reference resolves', () => {
  const p = loadPersona(EXAMPLE);
  const ids = new Set((p.povMap.beliefs ?? []).map((b) => b.id));
  for (const pillar of p.povMap.pillars ?? []) {
    for (const ref of pillar.maps_to_beliefs ?? []) {
      assert.ok(ids.has(ref), `pillar ${pillar.id} references unknown belief ${ref}`);
    }
  }
});

test('every belief evidence reference resolves to a proof entry', () => {
  const p = loadPersona(EXAMPLE);
  const proof = proofIndex(p);
  for (const b of p.povMap.beliefs ?? []) {
    for (const ref of b.evidence_refs ?? []) {
      assert.ok(proof.has(ref), `belief ${b.id} references unknown proof entry ${ref}`);
    }
  }
});

test('every used proof entry has a source', () => {
  const p = loadPersona(EXAMPLE);
  for (const e of p.proof.entries ?? []) {
    if (e.claim && e.tier) {
      assert.ok(e.source, `proof entry ${e.id} has a claim but no source`);
    }
  }
});

test('high confidence beliefs carry evidence', () => {
  const p = loadPersona(EXAMPLE);
  for (const b of p.povMap.beliefs ?? []) {
    if (b.confidence === 'high') {
      assert.ok((b.evidence_refs ?? []).length > 0, `belief ${b.id} is high confidence with no evidence`);
    }
  }
});

test('publish gate defaults are safe', () => {
  const p = loadPersona(SHIPPED);
  assert.equal(p.identity.publish.approval_required, true);
  assert.equal(p.identity.publish.mode, 'draft');
});

test('example persona does not enable auto publishing', () => {
  const p = loadPersona(EXAMPLE);
  assert.equal(p.identity.publish.mode, 'draft');
  assert.equal(p.identity.publish.approval_required, true);
});

test('paid offers in the example are complete enough for conversion_path', () => {
  const p = loadPersona(EXAMPLE);
  const ok = (p.offers.paid_offers ?? []).some((o) => o.name && o.outcome && o.price_model);
  assert.ok(ok);
});

test('every offer rung has cta_text', () => {
  const p = loadPersona(EXAMPLE);
  for (const rung of p.offers.ladder ?? []) {
    assert.ok(rung.cta_text, `rung ${rung.rung} has no cta_text`);
  }
});

test('voice samples parse out of the example', () => {
  const samples = readVoiceSamples(EXAMPLE);
  assert.equal(samples.length, 3);
  assert.ok(samples[0].length > 80);
});

test('voice samples parse out of the shipped file as empty', () => {
  assert.equal(readVoiceSamples(SHIPPED).length, 0);
});

test('lookups return null rather than throwing', () => {
  const p = loadPersona(EXAMPLE);
  assert.equal(pillarById(p, 'p9'), null);
  assert.equal(beliefById(p, 'b9'), null);
  assert.equal(primarySegment(p).id, p.audience.primary);
});

test('schema rejects a wrong enum value', () => {
  // The enum lives on the `mode` subschema, so validate a scalar against that
  // subschema directly. Handing it an object would compare the object against
  // the enum, which fails for the wrong reason and would pass for the right one.
  const schema = loadSchema('persona.schema.json');
  const modeSchema = schema.properties.identity.properties.publish.properties.mode;
  const errors = validateAgainstSchema('yolo', modeSchema);
  assert.ok(errors.some((e) => /enum/.test(e.message)), JSON.stringify(errors));
  assert.deepEqual(validateAgainstSchema('draft', modeSchema), []);
  assert.deepEqual(validateAgainstSchema('auto', modeSchema), []);
});

test('schema rejects a wrong publish mode on a whole persona', () => {
  const p = loadPersona(EXAMPLE);
  const broken = JSON.parse(JSON.stringify(p));
  broken.identity.publish.mode = 'auto-everything';
  const errors = validateWithSchema(broken, 'persona.schema.json');
  assert.ok(errors.some((e) => /mode/.test(e.pointer) && /enum/.test(e.message)), JSON.stringify(errors));
});

test('schema rejects a missing required property', () => {
  const schema = loadSchema('post.schema.json');
  const errors = validateAgainstSchema({ id: 'x', text: 'y' }, schema);
  assert.ok(errors.some((e) => /missing required property/.test(e.message)));
});

test('post schema requires approval before queued', () => {
  const schema = loadSchema('post.schema.json');
  const base = {
    id: 'post-1',
    text: 'x'.repeat(200),
    pillar: 'p1',
    archetype: 'how_to',
    language: 'en',
  };
  const queuedNoApproval = validateWithSchema({ ...base, status: 'queued' }, 'post.schema.json');
  assert.ok(queuedNoApproval.length > 0, 'queued without approvals must fail');

  const queuedApproved = validateWithSchema(
    { ...base, status: 'queued', approvals: [{ decision: 'approved', at: '2026-01-01T00:00:00Z' }] },
    'post.schema.json',
  );
  assert.deepEqual(queuedApproved, []);

  const publishedNoRecord = validateWithSchema({ ...base, status: 'published' }, 'post.schema.json');
  assert.ok(publishedNoRecord.some((e) => /published/.test(e.message)), 'published requires a published record');
});

test('post schema rejects a bad pillar or archetype id', () => {
  const errors = validateWithSchema(
    { id: 'p1', text: 'x', pillar: 'nope', archetype: 'how_to', language: 'en', status: 'draft' },
    'post.schema.json',
  );
  assert.ok(errors.some((e) => /pillar/.test(e.pointer)));
});

test('calendar schema validates a generated slot', () => {
  const cal = validateWithSchema(
    {
      schema_version: 1,
      persona_version: '0.1.0',
      generated_at: '2026-01-01T00:00:00.000Z',
      window: { start: '2026-01-05', end: '2026-02-03' },
      slots: [
        {
          id: 'slot-2026-01-05-001',
          date: '2026-01-05',
          time: '08:30',
          pillar: 'p1',
          archetype: 'how_to',
          status: 'planned',
        },
      ],
    },
    'calendar.schema.json',
  );
  assert.deepEqual(cal, []);
});

test('audit report schema validates a minimal report', () => {
  const errors = validateWithSchema(
    {
      schema_version: 1,
      kind: 'profile',
      subject: 'x',
      total: 42,
      total_possible: 100,
      band: 'needs_work',
      findings: [{ check_id: 'pc1', severity: 'warn', passed: false, label: 'x' }],
    },
    'audit-report.schema.json',
  );
  assert.deepEqual(errors, []);
});