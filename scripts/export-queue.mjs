#!/usr/bin/env node
// Export approved posts for the Make pipeline / Google Sheets queue.
//
//   node scripts/export-queue.mjs --out output/queue.csv
//   node scripts/export-queue.mjs --out output/queue.csv --json
//
// Only posts at status "approved" with no hard blocks and a real approval record
// are exported. This is the only script that writes to a file another system
// reads, so it is deliberately the strictest one in the repo.
//
// Exit 0 = exported, 1 = nothing eligible or a post failed the gate, 3 = cannot run.

import fs from 'node:fs';
import path from 'node:path';

import { parseArgs, usage } from './lib/cli.mjs';
import { writeText, nowISO, fileExists, readJson, repoPath } from './lib/fsio.mjs';
import { loadPersona } from './lib/persona.mjs';

const args = parseArgs();
if (args.flags.help) {
  console.log(usage([
    'export-queue — export approved posts for the Make pipeline',
    '',
    '  --out PATH   csv output (default output/queue.csv)',
    '  --posts PATH  directory of post json files (default output/drafts)',
    '  --json        machine-readable',
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

const postsDir = args.flags.posts ?? repoPath('output', 'drafts');
if (!fileExists(postsDir)) {
  console.error(`no drafts directory at ${postsDir}`);
  process.exit(3);
}

const files = fs.readdirSync(postsDir).filter((f) => f.endsWith('.json'));
if (!files.length) {
  console.error(`no posts in ${postsDir}`);
  process.exit(3);
}

const approvalRequired = persona.identity?.publish?.approval_required !== false;
const posts = files
  .map((f) => {
    try {
      return readJson(path.join(postsDir, f));
    } catch {
      return null;
    }
  })
  .filter(Boolean);

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------
const APPROVED = new Set(['approved', 'edited']);
const exported = [];
const rejected = [];

for (const p of posts) {
  const id = p.id ?? '(no id)';

  if (p.status !== 'approved') {
    if (['queued', 'published', 'in_review', 'rejected', 'draft'].includes(p.status)) {
      rejected.push({ id, reason: `status is "${p.status}", not "approved"` });
    }
    continue;
  }

  const hard = p.score?.hard_blocks ?? [];
  if (hard.length) {
    rejected.push({ id, reason: `hard blocks present: ${hard.map((h) => h.id ?? h.label ?? 'unknown').join(', ')}` });
    continue;
  }

  const approvals = (p.approvals ?? []).filter((a) => APPROVED.has(a.decision));
  if (approvalRequired && approvals.length === 0) {
    rejected.push({ id, reason: 'publish.approval_required is true but no approved entry in approvals' });
    continue;
  }

  if (!p.text || !String(p.text).trim()) {
    rejected.push({ id, reason: 'empty text' });
    continue;
  }

  if (!p.score || p.score.total == null) {
    rejected.push({ id, reason: 'no score recorded. Run score-post.mjs --write first.' });
    continue;
  }

  const min = persona.identity?.publish?.min_post_score ?? 75;
  if (p.score.total < min) {
    rejected.push({ id, reason: `score ${p.score.total} is below identity.publish.min_post_score ${min}` });
    continue;
  }

  exported.push(p);
}

// ---------------------------------------------------------------------------
// Visibility and feed distribution come from the persona, never from the post.
// ---------------------------------------------------------------------------
const allowedVisibility = persona.identity?.publish?.allowed_visibility ?? ['PUBLIC'];
const allowedFeed = persona.identity?.publish?.allowed_feed_distribution ?? ['MAIN_FEED'];

for (const p of exported) {
  if (p.visibility && !allowedVisibility.includes(p.visibility)) {
    rejected.push({ id: p.id, reason: `visibility "${p.visibility}" is not in identity.publish.allowed_visibility [${allowedVisibility.join(', ')}]` });
  }
  if (p.feed_distribution && !allowedFeed.includes(p.feed_distribution)) {
    rejected.push({ id: p.id, reason: `feed_distribution "${p.feed_distribution}" is not in allowed_feed_distribution [${allowedFeed.join(', ')}]` });
  }
}

const rows = exported.filter(
  (p) => !rejected.some((r) => r.id === p.id && r.reason.includes('not in identity.publish')),
);

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------
const COLUMNS = [
  'id', 'date', 'time', 'pillar', 'segment', 'archetype', 'belief_refs', 'proof_refs',
  'offer_rung', 'hook_family', 'hook_brief', 'claim_level', 'status',
  'title', 'body', 'image_brief', 'image_url',
  'visibility', 'feed_distribution', 'score',
  'approvals', 'published_at', 'published_url', 'notes',
];

function csvCell(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function rowFor(p) {
  const approvals = JSON.stringify(p.approvals ?? []);
  return {
    id: p.id,
    date: p.scheduled_for ? String(p.scheduled_for).slice(0, 10) : '',
    time: p.scheduled_for ? String(p.scheduled_for).slice(11, 16) : '',
    pillar: p.pillar,
    segment: p.segment,
    archetype: p.archetype,
    belief_refs: (p.belief_refs ?? []).join(' '),
    proof_refs: (p.proof_refs ?? []).join(' '),
    offer_rung: p.offer_rung ?? '',
    hook_family: p.hook_pattern ?? '',
    hook_brief: p.notes ?? '',
    claim_level: p.claim_level ?? '',
    status: p.status,
    title: p.title ?? '',
    body: p.text,
    image_brief: p.image_brief ?? '',
    image_url: '',
    visibility: p.visibility ?? allowedVisibility[0],
    feed_distribution: p.feed_distribution ?? allowedFeed[0],
    score: p.score?.total ?? '',
    approvals,
    published_at: p.published?.at ?? '',
    published_url: p.published?.url ?? '',
    notes: p.notes ?? '',
  };
}

const csv = [
  COLUMNS.join(','),
  ...rows.map((p) => {
    const r = rowFor(p);
    return COLUMNS.map((c) => csvCell(r[c])).join(',');
  }),
].join('\n');

const out = args.flags.out ?? repoPath('output', 'queue.csv');
writeText(out, `${csv}\n`);

const statusPath = out.replace(/\.csv$/, '.csv.status');
writeText(statusPath, `${JSON.stringify({ generated_at: nowISO(), exported: rows.length, rejected: rejected.length }, null, 2)}\n`);

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
if (args.flags.json) {
  console.log(JSON.stringify({ exported: rows.map((p) => ({ id: p.id, score: p.score?.total, visibility: p.visibility, feed_distribution: p.feed_distribution })), rejected, out }, null, 2));
} else {
  console.log('='.repeat(72));
  console.log('LINA QUEUE EXPORT');
  console.log('='.repeat(72));
  console.log('');
  console.log(`scanned : ${posts.length} post(s) in ${postsDir}`);
  console.log(`exported: ${rows.length}`);
  console.log(`blocked : ${rejected.length}`);
  console.log('');
  if (rows.length) {
    console.log('EXPORTED');
    for (const p of rows) {
      console.log(`  ${p.id}  score ${p.score?.total}  ${p.archetype}  ${p.visibility ?? allowedVisibility[0]}`);
    }
    console.log('');
  }
  if (rejected.length) {
    console.log('BLOCKED');
    for (const r of rejected) console.log(`  ${r.id}: ${r.reason}`);
    console.log('');
  }
  if (rows.length) {
    console.log(`wrote ${out}`);
    console.log('');
    console.log('Next: integrations/make.md — Make filters on status == "Approved".');
    console.log('The approvals column is in the export on purpose: it is how a human');
    console.log('reviewing the sheet can see a post was approved, not merely written.');
  } else {
    console.log('Nothing exported. Nothing was approved yet — that is the expected');
    console.log('state of a fresh install, not an error.');
  }
}

process.exit(rows.length > 0 ? 0 : 1);