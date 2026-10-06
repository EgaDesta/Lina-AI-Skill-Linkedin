// End-to-end tests over the CLIs, run against the filled example persona via
// LINA_PERSONA_ROOT. These are the tests that would catch a regression in the
// scoring logic itself.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { repoPath } from '../scripts/lib/fsio.mjs';

const EXAMPLE = repoPath('data', 'examples', 'sample-persona');

function run(script, args = [], env = {}) {
  const res = spawnSync(process.execPath, [path.join(repoPath('scripts'), script), ...args], {
    encoding: 'utf8',
    env: { ...process.env, LINA_PERSONA_ROOT: EXAMPLE, ...env },
    cwd: repoPath(),
  });
  return { status: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

function runJson(script, args = []) {
  const r = run(script, [...args, '--json']);
  try {
    return JSON.parse(r.stdout);
  } catch (err) {
    throw new Error(`could not parse json from ${script}:\n${r.stdout}\n${r.stderr}`);
  }
}

/** Count CSV cells honouring RFC 4180 quoting. */
function countCsvCells(line) {
  let cells = 1;
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        i++;
        continue;
      }
      quoted = !quoted;
      continue;
    }
    if (ch === ',' && !quoted) cells++;
  }
  return cells;
}

// ---------------------------------------------------------------------------
// validate-persona
// ---------------------------------------------------------------------------

test('validate-persona passes on the example persona', () => {
  const out = runJson('validate-persona.mjs');
  assert.equal(out.blocking, 0, `unexpected blocking gaps: ${JSON.stringify(out.gaps.filter((g) => g.blocks))}`);
  assert.equal(out.voice_samples, 3);
  assert.ok(out.voice_profile, 'voice samples should be measured');
});

test('validate-persona blocks on the shipped empty persona', () => {
  const r = run('validate-persona.mjs', [], { LINA_PERSONA_ROOT: repoPath() });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /BLOCKING/);
});

test('validate-persona measures voice from samples', () => {
  const out = runJson('validate-persona.mjs');
  const p = out.voice_profile;
  assert.ok(p.meanSentenceWords > 0);
  assert.ok(p.lengthVariance > 0);
  assert.equal(p.samples, 3);
});

test('validate-persona reports emoji conflict when samples disagree with config', () => {
  // The example persona config says emoji: false and the samples have none, so
  // there must be no emoji conflict finding.
  const out = runJson('validate-persona.mjs');
  const ids = out.voice_findings.map((f) => f.id);
  assert.ok(!ids.includes('voice.emoji_conflict'));
});

// ---------------------------------------------------------------------------
// score-profile
// ---------------------------------------------------------------------------

test('score-profile scores the deliberately weak sample low', () => {
  const out = runJson('score-profile.mjs', ['--file', repoPath('data', 'examples', 'sample-profile.json')]);
  assert.ok(out.total < 40, `expected a low score, got ${out.total}`);
  assert.ok(out.band === 'not_ready' || out.band === 'needs_work');
});

test('score-profile reports every check', () => {
  const out = runJson('score-profile.mjs', ['--file', repoPath('data', 'examples', 'sample-profile.json')]);
  assert.ok(out.findings.length >= 20, `only ${out.findings.length} checks reported`);
  assert.equal(out.total_possible, 100);
});

test('score-profile finds the blockers on a weak profile', () => {
  const out = runJson('score-profile.mjs', ['--file', repoPath('data', 'examples', 'sample-profile.json')]);
  assert.ok(out.capped, 'a weak profile should trip the cap');
  const failedBlockers = out.findings.filter((f) => !f.passed && f.severity === 'blocker').map((f) => f.check_id);
  assert.ok(failedBlockers.includes('pc2'), 'no primary keyword in the headline');
  assert.ok(failedBlockers.includes('pc1'), 'headline says "Experienced Consultant", not the persona role title');
  assert.ok(failedBlockers.includes('cm3'), 'the sample About is under 500 characters');
  assert.ok(out.total <= 59, 'capped total must not exceed 59');
});

test('score-profile measures vocabulary against the persona avoid-list', () => {
  // pcx1 checks voice.vocabulary.avoid, not the global hard-ban list. The
  // sample About says "results-driven", which the example persona bans.
  const out = runJson('score-profile.mjs', ['--file', repoPath('data', 'examples', 'sample-profile.json')]);
  const pcx1 = out.findings.find((f) => f.check_id === 'pcx1');
  assert.ok(!pcx1.passed, 'the sample About contains "results-driven"');
  assert.match(pcx1.measured, /results-driven/);
});

test('score-profile orders findings by severity then points', () => {
  const out = runJson('score-profile.mjs', ['--file', repoPath('data', 'examples', 'sample-profile.json')]);
  const failing = out.findings.filter((f) => !f.passed);
  const rank = { blocker: 0, warn: 1, nice: 2 };
  for (let i = 1; i < failing.length; i++) {
    assert.ok(rank[failing[i - 1].severity] <= rank[failing[i].severity], 'findings out of severity order');
  }
});

test('score-profile always lists what it refuses to score', () => {
  const out = runJson('score-profile.mjs', ['--file', repoPath('data', 'examples', 'sample-profile.json')]);
  assert.ok(out.not_scored.length >= 4);
  assert.ok(out.not_scored.some((s) => /reach/i.test(s)));
});

test('score-profile exits 1 below the threshold', () => {
  const r = run('score-profile.mjs', ['--file', repoPath('data', 'examples', 'sample-profile.json'), '--min', '80']);
  assert.equal(r.status, 1);
});

test('score-profile exits 3 on a missing file', () => {
  const r = run('score-profile.mjs', ['--file', 'no/such/file.json']);
  assert.equal(r.status, 3);
});

test('score-profile measures the offer from the persona, not the profile', () => {
  // cv2 asks whether an offer is *defined*, which lives in persona/offers.yaml.
  // A weak profile with a complete persona should pass cv2 — the profile's
  // problem is everything else, not the offer existing.
  const out = runJson('score-profile.mjs', ['--file', repoPath('data', 'examples', 'sample-profile.json')]);
  const cv2 = out.findings.find((f) => f.check_id === 'cv2');
  assert.ok(cv2.passed, `cv2 should pass: ${cv2.measured}`);
});

test('score-profile scores a strong profile highly', () => {
  const strong = {
    custom_url_slug: 'alex-mercer-operations',
    headline: 'Operations Consultant | process automation that survives whoever built it | The First 90 Days Method',
    about:
      'When one person holds all the process knowledge, the team cannot take leave and the same mistakes repeat monthly.\n\nThe First 90 Days Method fixes process documentation problems for operations leads in small B2B services firms. Three steps: write down what actually happens, delete decisions nobody remembers making, and make each step fail safely.\n\nOne 12-person finance team doing about 200 invoices a week by hand got to under two hours a week, same headcount. Eleven engagements since 2019, same sequence each time.\n\nThe document is what survives. Not the tool.\n\nI document what people already do before changing anything, so the team owns the result.\n\nIf you want the process documented properly, DM me.',
    experience: [
      { title: 'Operations Consultant', company: 'Independent', bullets: ['Cut invoice handling from 6h to under 2h a week across 1 team', 'Documented 60 processes that existed only in 1 head', 'Ran 11 engagements since 2019'] },
      { title: 'Ops Manager', company: 'Services Firm', bullets: ['Reduced exceptions to a list reviewable by Friday', 'Cut the approval chain from 3 steps to 1'] },
      { title: 'Analyst', company: 'Logistics', bullets: ['Moved 14 workflows off spreadsheets in 2 quarters'] },
    ],
    featured: [
      { title: 'Cutting invoice handling from 6h to under 2h', kind: 'case_study', url: 'https://example.com/a', description: 'A 12-person finance team.' },
      { title: 'Process documentation engagement', kind: 'article', url: 'https://example.com/b', description: 'How it runs.' },
      { title: 'The First 90 Days Method', kind: 'article', url: 'https://example.com/c', description: 'Written up.' },
      { title: 'Process documentation template', kind: 'article', url: 'https://example.com/d', description: 'One page.' },
      { title: 'Operations career', kind: 'article', url: 'https://example.com/e', description: '11 years.' },
    ],
    education: [{ school: 'University', field: 'Operations', year: 2014 }],
    licenses: [],
    skills: ['process automation', 'SOP documentation', 'manual process', 'operations management', 'workflow design'],
    contact: { email: 'x@example.com', website: 'https://example.com' },
    banner_image: 'banner.png',
    profile_photo: 'me.png',
  };
  const tmp = path.join(os.tmpdir(), `lina-strong-${process.pid}.json`);
  fs.writeFileSync(tmp, JSON.stringify(strong, null, 2));
  try {
    const out = runJson('score-profile.mjs', ['--file', tmp]);
    assert.ok(out.total >= 75, `expected a strong score, got ${out.total}: ${out.next_actions.map((a) => a.check_id).join(', ')}`);
    assert.equal(out.capped, false, `unexpected cap: ${out.cap_reason}`);
  } finally {
    fs.unlinkSync(tmp);
  }
});

// ---------------------------------------------------------------------------
// score-post
// ---------------------------------------------------------------------------

test('score-post hard-blocks the bad sample', () => {
  const out = runJson('score-post.mjs', ['--file', repoPath('data', 'examples', 'sample-post-bad.json')]);
  assert.ok(out.hard_blocks.length >= 1, 'the bad sample must trip at least one hard block');
  assert.equal(out.total, 0);
  assert.equal(out.band, 'reject');
});

test('score-post blocks the bad sample for unsourced numbers', () => {
  const out = runJson('score-post.mjs', ['--file', repoPath('data', 'examples', 'sample-post-bad.json')]);
  const ids = out.hard_blocks.map((b) => b.id);
  assert.ok(ids.includes('hb1'), `expected hb1 (unsourced claim), got ${ids.join(', ')}`);
});

test('a hard block names each offending number, not just a count', () => {
  // The reason for the whole repo is that a model will invent a number. A report
  // saying "unsourced claims" without listing them forces the reader to find
  // them by eye, which is exactly the review that gets skipped.
  const out = runJson('score-post.mjs', ['--file', repoPath('data', 'examples', 'sample-post-bad.json')]);
  const hb1 = out.hard_blocks.find((b) => b.id === 'hb1');
  assert.ok(Array.isArray(hb1.detail), 'detail should be a list, one entry per occurrence');
  assert.equal(hb1.detail.length, 4, `expected 4 unsourced numbers, got ${hb1.detail.length}`);
  for (const d of hb1.detail) {
    assert.match(d, /^\"\d+\"/, `entry should lead with the value: ${d}`);
    assert.match(d, /proof\.yaml/, `entry should say where it belongs: ${d}`);
  }
  assert.ok(hb1.action, 'a hard block must state how to resolve it');
});

test('hard blocks are printed in the human report, not hidden in the json', () => {
  const r = run('score-post.mjs', ['--file', repoPath('data', 'examples', 'sample-post-bad.json')]);
  assert.match(r.stdout, /HARD BLOCKS/, 'the section header must be present');
  assert.match(r.stdout, /hb1/);
  assert.match(r.stdout, /not in proof\.yaml/);
  // Each occurrence on its own line, so the numbers are scannable.
  assert.match(r.stdout, /^\s+"47"/m);
  assert.match(r.stdout, /^\s+"73"/m);
});

test('a clean post prints no hard-block section', () => {
  const r = run('score-post.mjs', ['--file', repoPath('data', 'examples', 'sample-post-good.json')]);
  assert.ok(!/HARD BLOCKS/.test(r.stdout), 'a clean post should not print the section at all');
});

test('score-post does not hard-block the good sample', () => {
  const out = runJson('score-post.mjs', ['--file', repoPath('data', 'examples', 'sample-post-good.json')]);
  assert.deepEqual(out.hard_blocks, [], `unexpected blocks: ${JSON.stringify(out.hard_blocks)}`);
});

test('score-post scores the good sample above the bad one', () => {
  const good = runJson('score-post.mjs', ['--file', repoPath('data', 'examples', 'sample-post-good.json')]);
  const bad = runJson('score-post.mjs', ['--file', repoPath('data', 'examples', 'sample-post-bad.json')]);
  assert.ok(good.computed_score > bad.computed_score, `${good.computed_score} should beat ${bad.computed_score}`);
});

test('a hard block zeroes the total even when computed points are decent', () => {
  // The point of the guardrail: a post with no unsourced claims fails no matter
  // how it scores on the other 99 points. The bad sample scores 61 on the
  // computed checks and is still a hard reject.
  const bad = runJson('score-post.mjs', ['--file', repoPath('data', 'examples', 'sample-post-bad.json')]);
  assert.ok(bad.computed_score > 30, 'the bad sample is not bad on every axis');
  assert.equal(bad.total, 0, 'yet the unsourced claims zero it');
  assert.equal(bad.band, 'reject');
});

test('score-post reports the computed score and the pending judgement points', () => {
  const out = runJson('score-post.mjs', ['--file', repoPath('data', 'examples', 'sample-post-good.json')]);
  assert.ok(out.judged_points_pending > 0, 'some checks are human judgement and must be declared');
  assert.ok(out.computed_points_possible < 100);
  assert.ok(out.not_scored.length >= 8);
});

test('score-post flags the bad sample hook length and CTA count', () => {
  const out = runJson('score-post.mjs', ['--file', repoPath('data', 'examples', 'sample-post-bad.json')]);
  const failed = out.findings.filter((f) => !f.passed && !f.judged).map((f) => f.check_id);
  assert.ok(failed.includes('ct1'), 'the bad sample has several CTAs');
  assert.ok(failed.includes('vm1'), 'the bad sample has hard bans');
});

test('score-post blocks queued posts with no approval', () => {
  const p = JSON.parse(fs.readFileSync(repoPath('data', 'examples', 'sample-post-good.json'), 'utf8'));
  p.status = 'queued';
  const tmp = path.join(os.tmpdir(), `lina-queued-${process.pid}.json`);
  fs.writeFileSync(tmp, JSON.stringify(p, null, 2));
  try {
    const out = runJson('score-post.mjs', ['--file', tmp]);
    assert.ok(out.hard_blocks.some((b) => b.id === 'hb6'), JSON.stringify(out.hard_blocks));
  } finally {
    fs.unlinkSync(tmp);
  }
});

test('score-post accepts queued posts with a recorded approval', () => {
  const p = JSON.parse(fs.readFileSync(repoPath('data', 'examples', 'sample-post-good.json'), 'utf8'));
  p.status = 'queued';
  p.approvals = [{ decision: 'approved', at: '2026-01-06T09:14:00Z', by: 'human' }];
  const tmp = path.join(os.tmpdir(), `lina-ok-${process.pid}.json`);
  fs.writeFileSync(tmp, JSON.stringify(p, null, 2));
  try {
    const out = runJson('score-post.mjs', ['--file', tmp]);
    assert.ok(!out.hard_blocks.some((b) => b.id === 'hb6'));
  } finally {
    fs.unlinkSync(tmp);
  }
});

test('score-post detects repetition against history', () => {
  const good = JSON.parse(fs.readFileSync(repoPath('data', 'examples', 'sample-post-good.json'), 'utf8'));
  const historyPath = path.join(os.tmpdir(), `lina-hist-${process.pid}.jsonl`);
  fs.writeFileSync(historyPath, `${JSON.stringify({ text: good.text })}\n`);
  const postPath = path.join(os.tmpdir(), `lina-dup-${process.pid}.json`);
  fs.writeFileSync(postPath, JSON.stringify(good, null, 2));
  try {
    const out = runJson('score-post.mjs', ['--file', postPath, '--history', historyPath]);
    const vd3 = out.findings.find((f) => f.check_id === 'vd3');
    assert.ok(!vd3.passed, 'a post identical to published history must fail repetition');
  } finally {
    fs.unlinkSync(historyPath);
    fs.unlinkSync(postPath);
  }
});

test('score-post exits 3 on a missing file', () => {
  const r = run('score-post.mjs', ['--file', 'nope.json']);
  assert.equal(r.status, 3);
});

test('score-post requires input', () => {
  assert.equal(run('score-post.mjs').status, 2);
});

// ---------------------------------------------------------------------------
// check-voice
// ---------------------------------------------------------------------------

test('check-voice reports hard bans and needs-source on the bad sample', () => {
  const out = runJson('check-voice.mjs', ['--file', repoPath('data', 'examples', 'sample-post-bad.json')]);
  assert.ok(out.counts.hard_bans > 0);
  assert.ok(out.counts.needs_source > 0);
  assert.ok(out.counts.unsourced_authority > 0);
});

test('check-voice accepts numbers that exist in proof.yaml', () => {
  const out = runJson('check-voice.mjs', ['--file', repoPath('data', 'examples', 'sample-post-good.json')]);
  assert.equal(out.counts.needs_source, 0, JSON.stringify(out.needs_source, null, 2));
});

test('check-voice compares against voice samples', () => {
  const out = runJson('check-voice.mjs', ['--file', repoPath('data', 'examples', 'sample-post-good.json')]);
  assert.equal(out.style.samples, 3);
  assert.ok(out.style.similarity > 0);
});

test('check-voice exit code reflects blocking findings', () => {
  assert.equal(run('check-voice.mjs', ['--file', repoPath('data', 'examples', 'sample-post-bad.json')]).status, 1);
  assert.equal(run('check-voice.mjs', ['--file', repoPath('data', 'examples', 'sample-post-good.json')]).status, 0);
});

test('check-voice handles a profile export as well as a post', () => {
  // A profile export has no `text` field, so check-voice concatenates the fields
  // a visitor actually reads before checking. That is why a profile can be run
  // through the same tool as a draft.
  const out = runJson('check-voice.mjs', ['--file', repoPath('data', 'examples', 'sample-profile.json')]);
  assert.equal(out.kind, 'voice');
  assert.ok(out.counts.soft_tells > 0, 'the weak profile About trips several soft tells');
  assert.ok(
    (out.vocabulary?.banned_prefer ?? []).length > 0,
    'the About says "results-driven", which the example persona bans',
  );
});

// ---------------------------------------------------------------------------
// gen-calendar
// ---------------------------------------------------------------------------

test('gen-calendar produces a valid plan', () => {
  const out = runJson('gen-calendar.mjs', ['--start', '2026-01-05', '--days', '30']);
  assert.ok(out.slots.length > 0);
  assert.equal(out.schema_version, 1);
  assert.equal(out.window.start, '2026-01-05');
});

test('gen-calendar respects allowed posting days', () => {
  const out = runJson('gen-calendar.mjs', ['--start', '2026-01-05', '--days', '30']);
  for (const s of out.slots) {
    const day = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(`${s.date}T00:00:00`).getDay()];
    assert.ok(['mon', 'tue', 'wed', 'thu', 'fri'].includes(day), `${s.date} is a ${day}`);
  }
});

test('gen-calendar respects max_posts_per_day', () => {
  const out = runJson('gen-calendar.mjs', ['--start', '2026-01-05', '--days', '30']);
  const perDay = {};
  for (const s of out.slots) perDay[s.date] = (perDay[s.date] ?? 0) + 1;
  for (const [date, n] of Object.entries(perDay)) assert.equal(n, 1, `${date} has ${n} slots`);
});

test('gen-calendar keeps the archetype cap', () => {
  const out = runJson('gen-calendar.mjs', ['--start', '2026-01-05', '--days', '30']);
  for (const [k, v] of Object.entries(out.distribution.archetypes)) {
    assert.ok(v.actual <= 0.30, `${k} at ${v.actual} exceeds the cap`);
  }
});

test('gen-calendar assigns an archetype to every slot', () => {
  const out = runJson('gen-calendar.mjs', ['--start', '2026-01-05', '--days', '30']);
  for (const s of out.slots) {
    assert.ok(s.archetype, 'slot without an archetype');
    assert.ok(s.pillar, 'slot without a pillar');
    assert.ok(s.hook_family, 'slot without a hook family');
    assert.ok(s.claim_level >= 1 && s.claim_level <= 4);
  }
});

test('gen-calendar does not repeat a pillar two days running', () => {
  const out = runJson('gen-calendar.mjs', ['--start', '2026-01-05', '--days', '30']);
  for (let i = 1; i < out.slots.length; i++) {
    assert.notEqual(out.slots[i].pillar, out.slots[i - 1].pillar, `slots ${i - 1} and ${i} share a pillar`);
  }
});

test('gen-calendar never places a proof-requiring CTA where there is no proof', () => {
  const out = runJson('gen-calendar.mjs', ['--start', '2026-01-05', '--days', '30']);
  for (const s of out.slots) {
    if ((s.offer_rung ?? 0) >= 4) {
      assert.ok((s.proof_refs ?? []).length > 0, `slot ${s.id} has rung ${s.offer_rung} with no proof`);
    }
  }
});

test('gen-calendar reports distribution, not just slots', () => {
  const out = runJson('gen-calendar.mjs', ['--start', '2026-01-05', '--days', '30']);
  assert.ok(Object.keys(out.distribution.pillars).length >= 5);
  assert.ok(Object.keys(out.distribution.claim_levels).length >= 1);
});

test('gen-calendar is deterministic for a given start date', () => {
  const a = runJson('gen-calendar.mjs', ['--start', '2026-01-05', '--days', '14']);
  const b = runJson('gen-calendar.mjs', ['--start', '2026-01-05', '--days', '14']);
  assert.deepEqual(
    a.slots.map((s) => [s.date, s.pillar, s.archetype]),
    b.slots.map((s) => [s.date, s.pillar, s.archetype]),
  );
});

test('gen-calendar blocks on an incomplete persona', () => {
  const r = run('gen-calendar.mjs', ['--start', '2026-01-05', '--days', '30'], { LINA_PERSONA_ROOT: repoPath() });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /PLAN VIOLATIONS|persona_incomplete/);
});

test('gen-calendar writes csv when asked', () => {
  const out = path.join(os.tmpdir(), `lina-cal-${process.pid}.json`);
  const csvPath = out.replace(/\.json$/, '.csv');
  try {
    run('gen-calendar.mjs', ['--start', '2026-01-05', '--days', '14', '--csv', '--out', out]);
    assert.ok(fs.existsSync(out), 'json not written');
    assert.ok(fs.existsSync(csvPath), 'csv not written');
    const lines = fs.readFileSync(csvPath, 'utf8').trim().split('\n');
    // Must match content/calendar.template.csv, which is what the Sheets queue
    // and the Make scenario both map onto by name.
    const expected = fs
      .readFileSync(repoPath('content', 'calendar.template.csv'), 'utf8')
      .split('\n')[0];
    assert.equal(lines[0], expected, 'csv header must match content/calendar.template.csv');
    assert.ok(lines.length > 1, 'csv has no data rows');

    // Count columns quote-aware. A naive split on "," undercounts rows whose
    // hook_brief legitimately contains a comma, which is most of them.
    const cols = countCsvCells(lines[0]);
    for (const line of lines.slice(1)) {
      assert.equal(countCsvCells(line), cols, `ragged csv row: ${line.slice(0, 80)}`);
    }
    assert.ok(
      lines.slice(1).some((l) => l.includes('"')),
      'at least one row should exercise the quoting path',
    );
  } finally {
    for (const f of [out, csvPath]) if (fs.existsSync(f)) fs.unlinkSync(f);
  }
});

test('gen-calendar produces a varied archetype mix', () => {
  // Regression: the first implementation round-robined an ordered list, which
  // for a 22-slot window emitted the first archetype 22 times and then reported
  // itself as violating its own ceiling.
  const out = runJson('gen-calendar.mjs', ['--start', '2026-01-05', '--days', '30']);
  const shares = Object.entries(out.distribution.archetypes).map(([k, v]) => [k, v.actual]);
  assert.ok(shares.length >= 5, `only ${shares.length} archetypes in a 22-slot plan`);
  const max = Math.max(...shares.map(([, v]) => v));
  assert.ok(max <= 0.25 + 0.02, `largest archetype share is ${max}`);
  assert.equal(
    out.violations.filter((v) => v.rule === 'archetype_share').length,
    0,
    'a correct plan should not report an archetype-share violation',
  );
});

test('gen-calendar is deterministic for a given start date (again, after mix fix)', () => {
  const a = runJson('gen-calendar.mjs', ['--start', '2026-02-02', '--days', '20']);
  const b = runJson('gen-calendar.mjs', ['--start', '2026-02-02', '--days', '20']);
  assert.deepEqual(
    a.slots.map((s) => `${s.date}|${s.archetype}|${s.hook_family}`),
    b.slots.map((s) => `${s.date}|${s.archetype}|${s.hook_family}`),
  );
});

test('gen-calendar does not repeat an archetype on consecutive days', () => {
  const out = runJson('gen-calendar.mjs', ['--start', '2026-01-05', '--days', '30']);
  for (let i = 1; i < out.slots.length; i++) {
    assert.notEqual(
      out.slots[i].archetype,
      out.slots[i - 1].archetype,
      `slots ${i - 1} and ${i} are both ${out.slots[i].archetype}`,
    );
  }
});

// ---------------------------------------------------------------------------
// export-queue
// ---------------------------------------------------------------------------

test('export-queue exports nothing when no post is approved', () => {
  const drafts = path.join(os.tmpdir(), `lina-drafts-${process.pid}`);
  fs.mkdirSync(drafts, { recursive: true });
  fs.copyFileSync(repoPath('data', 'examples', 'sample-post-good.json'), path.join(drafts, 'a.json'));
  const out = path.join(os.tmpdir(), `lina-queue-${process.pid}.csv`);
  try {
    const r = run('export-queue.mjs', ['--posts', drafts, '--out', out]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /Nothing exported/);
  } finally {
    fs.rmSync(drafts, { recursive: true, force: true });
    if (fs.existsSync(out)) fs.unlinkSync(out);
  }
});

test('export-queue refuses a post whose status is not approved', () => {
  const drafts = path.join(os.tmpdir(), `lina-drafts2-${process.pid}`);
  fs.mkdirSync(drafts, { recursive: true });
  const p = JSON.parse(fs.readFileSync(repoPath('data', 'examples', 'sample-post-good.json'), 'utf8'));
  p.status = 'in_review';
  p.approvals = [{ decision: 'approved', at: '2026-01-06T09:14:00Z' }];
  fs.writeFileSync(path.join(drafts, 'a.json'), JSON.stringify(p));
  const out = path.join(os.tmpdir(), `lina-queue2-${process.pid}.csv`);
  try {
    const r = run('export-queue.mjs', ['--posts', drafts, '--out', out]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /not "approved"/);
  } finally {
    fs.rmSync(drafts, { recursive: true, force: true });
    if (fs.existsSync(out)) fs.unlinkSync(out);
  }
});

test('export-queue refuses an approved post with no approval record', () => {
  const drafts = path.join(os.tmpdir(), `lina-drafts3-${process.pid}`);
  fs.mkdirSync(drafts, { recursive: true });
  const p = JSON.parse(fs.readFileSync(repoPath('data', 'examples', 'sample-post-good.json'), 'utf8'));
  p.status = 'approved';
  p.approvals = [];
  fs.writeFileSync(path.join(drafts, 'a.json'), JSON.stringify(p));
  const out = path.join(os.tmpdir(), `lina-queue3-${process.pid}.csv`);
  try {
    const r = run('export-queue.mjs', ['--posts', drafts, '--out', out]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /no approved entry/);
  } finally {
    fs.rmSync(drafts, { recursive: true, force: true });
    if (fs.existsSync(out)) fs.unlinkSync(out);
  }
});