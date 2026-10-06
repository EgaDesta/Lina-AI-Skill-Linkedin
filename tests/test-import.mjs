// Extraction verification. A misread profile produces confident, wrong persona
// proposals, and those get pasted into persona/ and trusted — so these tests
// use deliberately damaged fixtures and assert the verdict flips.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { repoPath, readJson } from '../scripts/lib/fsio.mjs';

const FIXTURE = repoPath('data', 'examples', 'sample-profile-rina.json');

function run(args = []) {
  const res = spawnSync(process.execPath, [path.join(repoPath('scripts'), 'import-profile.mjs'), ...args, '--json'], {
    encoding: 'utf8',
    cwd: repoPath(),
  });
  return { status: res.status, stdout: res.stdout ?? '', report: parse(res.stdout) };
}

/** Exit paths that print a plain error instead of a report have no JSON. */
function parse(stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

function withProfile(mutate, name) {
  const base = readJson(FIXTURE);
  const dir = fs.mkdtempSync(path.join(process.env.TEMP ?? '.', 'lina-import-'));
  const file = path.join(dir, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(mutate(base), null, 2));
  return { file, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

const byId = (report, id) => report.checks.find((c) => c.id === id);

test('a well-formed profile is sound', () => {
  const { status, report } = run(['--file', FIXTURE]);
  assert.equal(report.verdict, 'sound', JSON.stringify(report.checks.filter((c) => !c.passed), null, 2));
  assert.equal(status, 0);
  assert.ok(report.total >= 14, `only ${report.total} checks`);
});

test('a login wall is unsound', () => {
  const f = withProfile(
    (p) => ({ ...p, headline: 'Sign in to continue', about: '', experience: [], skills: [] }),
    'login-wall',
  );
  try {
    const { status, report } = run(['--file', f.file]);
    assert.equal(report.verdict, 'unsound');
    assert.equal(status, 1);
    assert.ok(byId(report, 'headline_not_placeholder').passed === false);
  } finally {
    f.cleanup();
  }
});

test('a LinkedIn placeholder headline is unsound', () => {
  const f = withProfile((p) => ({ ...p, headline: 'Add a headline' }), 'paywall');
  try {
    const { report } = run(['--file', f.file]);
    assert.equal(report.verdict, 'unsound');
    assert.ok(!byId(report, 'headline_not_placeholder').passed);
  } finally {
    f.cleanup();
  }
});

test('template leftovers are unsound', () => {
  const f = withProfile(
    (p) => ({ ...p, about: 'Lorem ipsum dolor sit amet. Your Name Here. Company Name.' }),
    'template',
  );
  try {
    const { report } = run(['--file', f.file]);
    assert.equal(report.verdict, 'unsound');
    const c = byId(report, 'no_template_leftovers');
    assert.ok(!c.passed);
    assert.equal(c.severity, 'blocker', 'template text means the scraper or the profile is a sample');
  } finally {
    f.cleanup();
  }
});

test('missing experience is unsound', () => {
  const f = withProfile((p) => ({ ...p, experience: [] }), 'no-exp');
  try {
    const { report } = run(['--file', f.file]);
    assert.equal(report.verdict, 'unsound');
    assert.ok(!byId(report, 'experience_present').passed);
  } finally {
    f.cleanup();
  }
});

test('a truncated About is a caveat, not unsound', () => {
  const f = withProfile((p) => ({ ...p, about: p.about.slice(0, 180) }), 'truncated');
  try {
    const { report } = run(['--file', f.file]);
    assert.equal(report.verdict, 'usable_with_caveats');
    const c = byId(report, 'about_length_plausible');
    assert.ok(!c.passed);
    // The point of the message is that only the owner can distinguish the two.
    assert.match(c.action, /only the owner knows/);
  } finally {
    f.cleanup();
  }
});

test('an About that duplicates the headline is caught', () => {
  const f = withProfile((p) => ({ ...p, about: p.headline }), 'dup');
  try {
    const { report } = run(['--file', f.file]);
    assert.ok(!byId(report, 'about_not_duplicate_headline').passed);
  } finally {
    f.cleanup();
  }
});

test('experience listed oldest-first is caught', () => {
  // The realistic selector failure: the right roles, paired with the wrong dates.
  const f = withProfile((p) => ({ ...p, experience: [...p.experience].reverse() }), 'reversed');
  try {
    const { report } = run(['--file', f.file]);
    assert.ok(!byId(report, 'experience_monotonic').passed);
    assert.match(byId(report, 'experience_monotonic').detail, /looks newer/);
  } finally {
    f.cleanup();
  }
});

test('roles without descriptions are caught as an extraction problem', () => {
  const f = withProfile(
    (p) => ({ ...p, experience: p.experience.map((e) => ({ title: e.title, company: e.company, period: e.period })) }),
    'no-detail',
  );
  try {
    const { report } = run(['--file', f.file]);
    assert.ok(!byId(report, 'experience_has_detail').passed);
  } finally {
    f.cleanup();
  }
});

test('partially-parsed Featured entries are caught', () => {
  const f = withProfile(
    (p) => ({ ...p, featured: [{ title: '' }, { title: 'Real one', url: 'https://e.com' }] }),
    'partial-featured',
  );
  try {
    const { report } = run(['--file', f.file]);
    assert.ok(!byId(report, 'featured_parsed').passed);
  } finally {
    f.cleanup();
  }
});

test('numbers on the profile are surfaced for the proof decision', () => {
  // The step where an importer is most dangerous and most useful. The report must
  // list candidates without deciding which are results.
  const { report } = run(['--file', FIXTURE]);
  assert.ok(report.numbers_on_profile.length > 0);
  assert.ok(report.possible_results.length > 0, 'this profile has quantitative results');
  for (const n of report.numbers_on_profile) {
    assert.ok(typeof n.value === 'string' && n.value.length > 0);
  }
  // Year-like and single-digit values are structural, not claims.
  assert.ok(!report.possible_results.includes('2019'), 'a bare year is not a result');
});

test('an agency-reading profile is flagged but never fails the run', () => {
  // It is a finding, not an error: a team profile is a valid profile that needs
  // different language. Severity `nice` is what keeps the verdict `sound`.
  const f = withProfile(
    (p) => ({ ...p, headline: 'Director at Hartono Consulting Ltd | operations process automation' }),
    'agency',
  );
  try {
    const { status, report } = run(['--file', f.file]);
    assert.equal(report.verdict, 'sound');
    assert.equal(status, 0);
    const c = byId(report, 'reads_as_individual');
    assert.ok(!c.passed, 'should be flagged');
    assert.equal(c.severity, 'nice');
  } finally {
    f.cleanup();
  }
});

test('every failed check states what to do', () => {
  // A passing check may say "ok"; a failing one must tell the reader what to do,
  // because that is the only part of the report anyone acts on.
  const { report } = run(['--file', FIXTURE]);
  for (const c of report.checks) {
    assert.ok(c.label, `${c.id} has no label`);
    if (c.passed) continue;
    assert.ok(c.action && c.action.length > 20, `${c.id} has no actionable message`);
  }
});

test('the About-length message asks the owner, not the script, to decide', () => {
  // A short About is ambiguous between "genuinely short" and "truncated in
  // extraction". Only the owner knows, so the message must say so rather than
  // reporting a finding the owner cannot act on.
  const f = withProfile((p) => ({ ...p, about: p.about.slice(0, 150) }), 'short-about');
  try {
    const { report } = run(['--file', f.file]);
    assert.ok(!byId(report, 'about_length_plausible').passed);
    assert.match(byId(report, 'about_length_plausible').action, /only the owner knows|ask before/);
  } finally {
    f.cleanup();
  }
});

test('a login wall in the headline is caught', () => {
  const f = withProfile((p) => ({ ...p, headline: 'Sign in to continue' }), 'signin');
  try {
    const { report } = run(['--file', f.file]);
    assert.ok(!byId(report, 'headline_not_placeholder').passed);
    assert.match(byId(report, 'headline_not_placeholder').detail, /login or default stub/);
  } finally {
    f.cleanup();
  }
});

test('the verdict drives the next step', () => {
  const sound = run(['--file', FIXTURE]).report;
  assert.match(sound.next_step, /score-profile/);

  const f = withProfile((p) => ({ ...p, about: p.about.slice(0, 100) }), 'caveat');
  try {
    const caveat = run(['--file', f.file]).report;
    assert.match(caveat.next_step, /caveats/);
  } finally {
    f.cleanup();
  }

  const g = withProfile((p) => ({ ...p, experience: [] }), 'unsound');
  try {
    const unsound = run(['--file', g.file]).report;
    assert.match(unsound.next_step, /Re-extract/);
    assert.match(unsound.next_step, /Do not propose/, 'must warn against proposing from a bad extraction');
  } finally {
    g.cleanup();
  }
});

test('missing file exits 3', () => {
  assert.equal(run(['--file', 'no/such/profile.json']).status, 3);
});

test('no argument exits 2', () => {
  const res = spawnSync(process.execPath, [path.join(repoPath('scripts'), 'import-profile.mjs')], {
    encoding: 'utf8',
    cwd: repoPath(),
  });
  assert.equal(res.status, 2);
});

test('the fixture used by the tests is itself sound', () => {
  // Guards the tests above: if the fixture regresses, they all pass vacuously.
  const { report } = run(['--file', FIXTURE]);
  assert.equal(report.verdict, 'sound', JSON.stringify(report.checks.filter((c) => !c.passed), null, 2));
});