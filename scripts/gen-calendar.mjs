#!/usr/bin/env node
// Generate a content calendar from persona pillars, beliefs, and the archetype
// mix in rubric/brand-consistency.yaml.
//
//   node scripts/gen-calendar.mjs --start 2026-01-06 --days 30
//   node scripts/gen-calendar.mjs --start 2026-01-06 --days 14 --out output/calendar.json
//   node scripts/gen-calendar.mjs --start 2026-01-06 --days 30 --csv
//
// This produces a PLAN, not posts. It decides what should be published, in
// what order, drawing on what kind of proof exists. A slot with no proof entry
// available is deliberately planned at a lower claim level rather than given
// something to prove.
//
// Exit 0 = plan is valid, 1 = violations exist, 3 = cannot run.

import { parseArgs, usage } from './lib/cli.mjs';
import { writeJson, writeText, nowISO, parseDate, addDays, dayOfWeekISO } from './lib/fsio.mjs';
import { loadPersona, loadRubric, blockingGaps, proofIndex, pillarById, primarySegment } from './lib/persona.mjs';
import { round } from './lib/textstats.mjs';

const args = parseArgs();
if (args.flags.help) {
  console.log(usage([
    'gen-calendar — build a post plan from the persona',
    '',
    '  --start YYYY-MM-DD   first date (default: next Monday)',
    '  --days N             window length (default 30)',
    '  --csv                write CSV as well as json',
    '  --out PATH           output json path',
  ]));
  process.exit(0);
}

let persona;
try {
  persona = loadPersona();
} catch (err) {
  console.error(`cannot load persona: ${err.message}`);
  process.exit(3);
}
const rubric = loadRubric();
const drift = rubric.consistency?.drift ?? {};
const ladder = rubric.consistency?.claim_ladder ?? [];

const blockers = blockingGaps(persona);
const pillars = (persona.povMap?.pillars ?? []).filter((p) => p.label);
const beliefs = (persona.povMap?.beliefs ?? []).filter((b) => b.claim);
const hotTakes = (persona.povMap?.hot_takes ?? []).filter((h) => h.take);
const proof = proofIndex(persona);
const proofEntries = [...proof.values()].filter((e) => e.claim && e.source);
const rungs = (persona.offers?.ladder ?? []).filter((r) => r.cta_text);
const seg = primarySegment(persona);

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------
// Exit code is decided at the very end, after all output, so `--json` consumers
// get a complete document before the process ends.
const startISO = args.flags.start ?? nextMonday();
const days = Number(args.flags.days ?? 30);
const start = parseDate(startISO);
const end = addDays(start, days - 1);

const allowedDays = new Set(persona.identity?.publish?.allowed_posting_days ?? ['mon', 'tue', 'wed', 'thu', 'fri']);
const allowedTimes = persona.identity?.publish?.allowed_posting_times ?? ['08:30'];
const maxPerDay = persona.identity?.publish?.max_posts_per_day ?? 1;

// ---------------------------------------------------------------------------
// Archetype assignment
//
// The mix is fixed by rubric, not chosen per run. A planner that picks
// archetypes by "what feels interesting today" is how a feed turns into
// 40% opinion posts and stops working.
// ---------------------------------------------------------------------------
const MAX_ARCH = drift.archetype_distribution?.max_share_per_archetype ?? 0.25;
const MIN_ACTIONABLE = drift.archetype_distribution?.min_share_actionable_archetypes ?? 0.35;
const ACTIONABLE = new Set(['framework', 'how_to', 'case_study', 'checklist', 'myth_busting', 'observation']);

/**
 * Build the archetype plan.
 *
 * Apportionment against the ceiling, then an interleave pass. The previous
 * version round-robined a fixed ordered list, which for any plan smaller than
 * the list length emitted the first archetype for every slot — a 22-slot window
 * came out 100% how_to, then reported itself as violating its own ceiling.
 *
 * The ceiling is a cap, not a target. Nothing here aims at the maximum; the goal
 * is "as varied as the cap allows", which is what stops a feed looking like one
 * format repeated.
 */
function buildArchetypePlan(total, cap = MAX_ARCH) {
  if (total <= 0) return [];
  const order = [
    'how_to', 'framework', 'observation', 'checklist',
    'case_study', 'myth_busting', 'opinion', 'story', 'question', 'announcement',
  ];
  const capCount = Math.max(1, Math.floor(total * cap));

  // Pass 1: deal slots out evenly, then interleave in pass 2 so consecutive
  // slots are rarely the same archetype.
  const base = Math.floor(total / order.length);
  const extra = total % order.length;
  const pools = new Map();
  for (let i = 0; i < order.length; i++) {
    const n = base + (i < extra ? 1 : 0);
    if (n > 0) pools.set(order[i], Array.from({ length: n }, () => order[i]));
  }

  const out = [];
  let progress = true;
  while (out.length < total && progress) {
    progress = false;
    for (const a of order) {
      if (out.length >= total) break;
      const pool = pools.get(a);
      if (!pool || pool.length === 0) continue;
      out.push(pool.pop());
      progress = true;
    }
  }

  // Enforce the ceiling: if even distribution exceeds it, spill the surplus
  // into the archetypes currently holding the fewest slots.
  const count = (a) => out.filter((x) => x === a).length;
  for (let i = out.length - 1; i >= 0; i--) {
    const a = out[i];
    if (count(a) <= capCount) continue;
    const [leanest] = order
      .filter((x) => count(x) < capCount)
      .sort((x, y) => count(x) - count(y));
    if (leanest) out[i] = leanest;
  }

  return out;
}

// ---------------------------------------------------------------------------
// Claim level: what a slot may honestly assert given available evidence.
// ---------------------------------------------------------------------------
function levelFor(archetype, pillar, proofRefs) {
  const has = proofRefs.length > 0;
  if (archetype === 'case_study') return has ? 3 : 2;
  if (archetype === 'how_to' || archetype === 'framework' || archetype === 'checklist') return has ? 3 : 2;
  if (archetype === 'opinion' || archetype === 'question') return 1;
  if (archetype === 'myth_busting') return has ? 3 : 1;
  if (archetype === 'observation') return has ? 3 : 2;
  if (archetype === 'story') return has ? 3 : 2;
  if (archetype === 'announcement') return 4;
  return 2;
}

// ---------------------------------------------------------------------------
// Build slots
// ---------------------------------------------------------------------------
const slots = [];
const violations = [];

// Dates eligible for posting.
const dates = [];
for (let d = new Date(start.getTime()); d <= end; d = addDays(d, 1)) {
  if (allowedDays.has(dayOfWeekISO(d))) dates.push(d);
}

if (dates.length === 0) {
  violations.push({
    rule: 'no_eligible_dates',
    detail: `identity.publish.allowed_posting_days is [${[...allowedDays].join(', ')}] and none fall inside ${startISO}..${endISO(end)}.`,
    severity: 'blocker',
  });
}

const archetypes = buildArchetypePlan(dates.length * maxPerDay);

// Pillar rotation weighted by persona weights, never repeating a pillar twice
// in a row, because consecutive same-pillar posts read as a campaign.
const pillarPool = [];
for (const p of pillars) {
  const n = Math.round((p.weight ?? 0) * dates.length * maxPerDay);
  for (let i = 0; i < n; i++) pillarPool.push(p.id);
}
while (pillarPool.length < dates.length * maxPerDay) {
  pillarPool.push(pillars[Math.floor(pillarPool.length % Math.max(pillars.length, 1))]?.id ?? pillars[0]?.id);
}

let lastPillar = null;
let idx = 0;
for (const date of dates) {
  for (let k = 0; k < maxPerDay; k++) {
    let pillarId = pillarPool[idx % pillarPool.length] ?? pillars[0]?.id;
    if (pillarId === lastPillar) {
      const swap = pillarPool.find((p, i) => p !== lastPillar && pillarPool[(idx + i) % pillarPool.length] !== lastPillar);
      pillarId = swap ?? pillarId;
    }
    lastPillar = pillarId;
    const pillar = pillarById(persona, pillarId);
    const archetype = archetypes[idx % archetypes.length] ?? 'observation';

    // Belief selection: heaviest first, round-robin, never the same belief twice
    // in a row.
    const pillarBeliefs = [...(pillar?.maps_to_beliefs ?? [])];
    const pool = pillarBeliefs.length
      ? pillarBeliefs
      : beliefs.map((b) => b.id);
    const beliefRef = pool.length ? pool[idx % pool.length] : null;

    // Proof selection: rotate, and only attach entries valid for this channel.
    const usable = proofEntries.filter((e) => (e.usable_in ?? ['post']).includes('post'));
    const proofRefs =
      archetype === 'opinion' || archetype === 'question'
        ? []
        : usable.length
          ? [usable[idx % usable.length].id]
          : [];

    // Hook family: rotate deterministically so consecutive posts do not share one.
    const HOOKS = ['cost-first', 'wrong-belief', 'observation', 'number-list', 'direct-question', 'contrast', 'story-open', 'consequence', 'proof-first', 'demonstrable'];
    const hookByArchetype = {
      case_study: 'proof-first',
      how_to: 'number-list',
      framework: 'demonstrable',
      checklist: 'number-list',
      opinion: 'wrong-belief',
      myth_busting: 'wrong-belief',
      observation: 'observation',
      story: 'story-open',
      question: 'direct-question',
      announcement: 'consequence',
    };
    const hook = hookByArchetype[archetype] ?? HOOKS[idx % HOOKS.length];

    // Offer rung: highest rung whose proof requirement is satisfiable here.
    let ctaRung = null;
    for (const rung of rungs) {
      const serves = rung.serves ?? [];
      if (!serves.includes(pillarId)) continue;
      if (rung.requires_proof_refs && proofRefs.length === 0) continue;
      if ((rung.primary_archetypes ?? []).includes(archetype)) {
        ctaRung = rung.rung;
        break;
      }
    }
    if (ctaRung == null) ctaRung = rungs.find((r) => r.rung === 1)?.rung ?? null;

    slots.push({
      id: `slot-${startISO}-${String(idx + 1).padStart(3, '0')}`,
      date: isoDate(date),
      time: allowedTimes[idx % Math.max(allowedTimes.length, 1)],
      pillar: pillarId,
      segment: seg?.id ?? null,
      archetype,
      belief_refs: beliefRef ? [beliefRef] : [],
      proof_refs: proofRefs,
      offer_rung: ctaRung,
      hook_family: hook,
      hook_brief: briefFor(archetype, pillar, beliefRef, persona),
      cta_rung: ctaRung,
      claim_level: levelFor(archetype, pillar, proofRefs),
      status: 'planned',
      title: null,
      score: null,
      published_url: null,
      notes: null,
    });
    idx++;
  }
}

// ---------------------------------------------------------------------------
// Validate the plan against the rubric, before any writing happens.
// ---------------------------------------------------------------------------
const n = slots.length || 1;
const pillarActual = {};
const archActual = {};
for (const s of slots) {
  pillarActual[s.pillar] = (pillarActual[s.pillar] ?? 0) + 1;
  archActual[s.archetype] = (archActual[s.archetype] ?? 0) + 1;
}
for (const [k, v] of Object.entries(archActual)) {
  if (v / n > MAX_ARCH + 0.02) {
    violations.push({ rule: 'archetype_share', detail: `${k} is ${Math.round((v / n) * 100)}% of the plan, above the ${Math.round(MAX_ARCH * 100)}% ceiling`, severity: 'warn' });
  }
}
const actionableShare = slots.filter((s) => ACTIONABLE.has(s.archetype)).length / n;
if (actionableShare < MIN_ACTIONABLE) {
  violations.push({ rule: 'actionable_share', detail: `only ${Math.round(actionableShare * 100)}% of the plan is actionable, below the ${Math.round(MIN_ACTIONABLE * 100)}% floor`, severity: 'warn' });
}

if (proofEntries.length < 3) {
  violations.push({
    rule: 'thin_proof',
    detail: `only ${proofEntries.length} sourced proof entries available. Most slots will plan at claim level 1-2 and score lower on specificity. This is the correct behaviour, not a bug to route around.`,
    severity: 'warn',
  });
}
if (!beliefs.length) {
  violations.push({ rule: 'no_beliefs', detail: 'no beliefs defined; every opinion slot will be unfalsifiable', severity: 'warn' });
}
if (!hotTakes.length) {
  violations.push({ rule: 'no_hot_takes', detail: 'no hot takes defined; opinion and myth_busting slots will have nothing to argue', severity: 'nice' });
}
if (blockers.length) {
  violations.push({
    rule: 'persona_incomplete',
    detail: `${blockers.length} blocking persona gaps: ${blockers.map((b) => b.id).join(', ')}. Fix persona/ before writing anything.`,
    severity: 'blocker',
  });
}

const calendar = {
  schema_version: 1,
  persona_version: persona.identity?.persona?.version ?? '0.0.0',
  generated_at: nowISO(),
  window: { start: startISO, end: endISO(end) },
  distribution: {
    pillars: mergeCounts(pillarActual, pillars.map((p) => [p.id, p.weight ?? 0]), slots.length),
    archetypes: Object.fromEntries(Object.entries(archActual).map(([k, v]) => [k, { actual: round(v / slots.length, 3), count: v }])),
    claim_levels: slots.reduce((acc, s) => ({ ...acc, [s.claim_level]: (acc[s.claim_level] ?? 0) + 1 }), {}),
  },
  violations,
  slots,
};

function mergeCounts(actual, plannedPairs, total) {
  const out = {};
  for (const [id, weight] of plannedPairs) {
    out[id] = { planned: round(weight, 3), actual: round((actual[id] ?? 0) / Math.max(total, 1), 3), count: actual[id] ?? 0 };
  }
  return out;
}

function briefFor(archetype, pillar, beliefRef, p) {
  const b = beliefRef ? (p.povMap?.beliefs ?? []).find((x) => x.id === beliefRef) : null;
  const hot = p.povMap?.hot_takes?.[0];
  const map = {
    opinion: hot ? `Argue: ${hot.line || hot.take}` : 'Argue one belief from pov-map, hedged as opinion.',
    framework: b ? `Teach the named method, with the belief "${truncate(b.claim, 80)}" as the spine.` : 'Teach the named method as a sequence the reader can reuse.',
    how_to: 'A numbered procedure the reader can follow today. No step may be aspirational.',
    case_study: 'Situation, intervention, measured result. Every number from proof.yaml.',
    observation: 'A pattern noticed across real work, framed as observation not law.',
    myth_busting: `Take the belief that "${truncate(b?.claim ?? hot?.take ?? 'a common assumption', 90)}" is wrong, and say why.`,
    story: 'One event, one decision, one consequence. No moral stated explicitly.',
    question: 'A specific question whose answer would change something for the reader.',
    announcement: 'Only if it concerns the person, not a product release.',
    checklist: 'A list where each item is verifiable as done or not done.',
  };
  return map[archetype] ?? '';
}

function truncate(s, n) {
  const str = String(s ?? '').trim();
  return str.length <= n ? str : `${str.slice(0, n - 1)}…`;
}
function csvEscape(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function endISO(d) {
  return isoDate(d);
}
function nextMonday() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  return isoDate(d);
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
const out = args.flags.out ?? null;
const header = 'id,date,time,pillar,segment,archetype,belief_refs,proof_refs,offer_rung,hook_family,hook_brief,claim_level,status,title,score,published_url,notes';
const csv = [
  header,
  ...slots.map((s) =>
    [
      s.id,
      s.date,
      s.time ?? '',
      s.pillar,
      s.segment ?? '',
      s.archetype,
      (s.belief_refs ?? []).join(' '),
      (s.proof_refs ?? []).join(' '),
      s.offer_rung ?? '',
      s.hook_family ?? '',
      csvEscape(s.hook_brief ?? ''),
      s.claim_level,
      s.status,
      s.title ?? '',
      s.score ?? '',
      s.published_url ?? '',
      csvEscape(s.notes ?? ''),
    ].join(','),
  ),
].join('\n');

if (out) writeJson(out, calendar);
if (args.flags.csv) {
  const csvPath = (out ?? 'output/calendar.json').replace(/\.json$/, '.csv');
  writeText(csvPath, `${csv}\n`);
  console.error(`wrote ${csvPath}`);
}

// `--json` prints the document and nothing else. The human summary is a separate
// mode; a machine consumer that asked for JSON must not have to strip a report
// off the front of it, and must not have to care whether the plan had warnings.
if (args.flags.json) {
  console.log(JSON.stringify(calendar, null, 2));
  process.exit(violations.length > 0 ? 1 : 0);
}

console.log(`LINA CONTENT PLAN  ${startISO} -> ${endISO(end)}`);
console.log(`persona v${calendar.persona_version}   slots: ${slots.length}`);
console.log('');
console.log('PILLAR MIX');
for (const [id, d] of Object.entries(calendar.distribution.pillars)) {
  const label = pillarById(persona, id)?.label || '(unnamed)';
  const delta = (d.actual - d.planned).toFixed(3);
  console.log(`  ${id}  ${String(Math.round(d.actual * 100)).padStart(3)}%  (plan ${Math.round(d.planned * 100)}%, ${delta >= 0 ? '+' : ''}${Math.round(delta * 100)}pp)  ${label}`);
}
console.log('');
console.log('ARCHETYPE MIX');
for (const [k, d] of Object.entries(calendar.distribution.archetypes)) {
  console.log(`  ${String(Math.round(d.actual * 100)).padStart(3)}%  ${k} (${d.count})`);
}
console.log('');
console.log('CLAIM LEVELS');
for (const [k, v] of Object.entries(calendar.distribution.claim_levels).sort()) {
  const lvl = ladder.find((l) => String(l.level) === k);
  console.log(`  level ${k} ${(lvl?.label ?? '').padEnd(11)} ${v}`);
}
console.log('');
if (violations.length) {
  console.log('PLAN VIOLATIONS — fix the plan, not the writing');
  for (const v of violations) console.log(`  [${v.severity.toUpperCase()}] ${v.rule}: ${v.detail}`);
  console.log('');
} else {
  console.log('Plan satisfies rubric/brand-consistency.yaml.');
  console.log('');
}

const fatal = violations.some((v) => v.severity === 'blocker');
if (fatal) process.exit(1);
if (violations.some((v) => v.severity === 'warn')) process.exit(1);
process.exit(0);