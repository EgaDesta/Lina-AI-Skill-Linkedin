#!/usr/bin/env node
// Voice, vocabulary and proof enforcement.
//
//   node scripts/check-voice.mjs --file output/drafts/post.json
//   node scripts/check-voice.mjs --text "raw post text"
//   node scripts/check-voice.mjs --profile            headline/about/experience
//   node scripts/check-voice.mjs --drift --history output/published.jsonl
//
// This module is imported by score-post.mjs, so the two can never disagree
// about what a post contains.

import { parseArgs, renderReport, usage } from './lib/cli.mjs';
import { loadPersona, loadRubric, proofIndex } from './lib/persona.mjs';
import { readJson, repoPath, writeJson, nowISO, fileExists, readText, validateWithSchema } from './lib/fsio.mjs';
import {
  findHardBans,
  findSoftTells,
  findVagueQuantifiers,
  findUnsourcedAuthority,
  countOccurrences,
} from './lib/slop.mjs';
import {
  styleProfile,
  styleSimilarity,
  aggregateProfiles,
  contentWords,
  ngrams,
  ngramOverlap,
  round,
  mean,
} from './lib/textstats.mjs';

const args = parseArgs();
if (args.flags.help) {
  console.log(usage([
    'check-voice — enforce persona voice, vocabulary bans, and proof sourcing',
    '',
    '  --file PATH       post.schema.json or a profile export json',
    '  --text STR        raw text',
    '  --profile PATH    profile export json (headline, about, experience...)',
    '  --drift           run rolling-window drift checks',
    '  --history PATH    jsonl of published posts',
    '  --json            machine-readable',
    '  --write           write the voice report into the post file',
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

export function checkVoice({ text, persona: p, includeFindings = false }) {
  const voice = p.voice ?? {};
  const extraBans = voice.banned_patterns ?? [];
  const hardBans = findHardBans(text, extraBans);
  const softTells = findSoftTells(text);
  const vague = findVagueQuantifiers(text);
  const authority = findUnsourcedAuthority(text);

  // Repeated tells matter more than single ones.
  const repeatedTells = softTells
    .map((t) => ({ ...t, count: countOccurrences(text, t.phrase) }))
    .filter((t) => t.count >= 3);

  const proof = proofIndex(p);
  const { known, structural } = knownNumberIndex(p, proof);

  const numericTokens = (String(text).match(/\b\d+(?:[.,]\d+)?\s?(?:%|percent|x|hours?|hrs?|days?|weeks?|months?|years?)?\b/gi) ?? []).map(
    (n) => n.trim(),
  );

  // Small integers are structural, not claims: list numbering, step counts, years.
  const STRUCTURAL = /^(?:[0-9]{4}|[1-9]|10)$/;
  const needsSource = [];
  for (const tok of numericTokens) {
    const bare = tok.replace(/[^0-9.,]/g, '');
    if (!bare || STRUCTURAL.test(bare)) continue;
    if (known.has(bare) || known.has(tok)) continue;
    // Numbers belonging to a named entity rather than to a factual claim: the
    // method name, the file name, a slot id. These are labels, not evidence, and
    // blocking them would make it impossible to name anything with a number in it.
    if (structural.has(bare) || structural.has(tok)) continue;
    const idx = text.search(new RegExp(tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    const claim = idx >= 0 ? excerptClaim(text, idx, tok.length) : tok;
    const entry = guessProofEntry(claim, proof);
    needsSource.push({
      value: tok,
      matched_claim: claim,
      tier: entry?.tier ?? 'missing',
      source: entry?.source ?? null,
      permission: entry?.permission ?? null,
      detail: entry
        ? `matched proof entry ${entry.id}`
        : 'no proof.yaml entry has this value. Add one with a tier and source, or remove the number.',
    });
  }

  const out = {
    hard_bans: hardBans,
    soft_tells: softTells,
    repeated_tells: repeatedTells,
    vague_quantifiers: vague,
    unsourced_authority: authority,
    needs_source: needsSource,
    counts: {
      hard_bans: hardBans.length,
      soft_tells: softTells.length,
      repeated_tells: repeatedTells.length,
      vague_quantifiers: vague.length,
      unsourced_authority: authority.length,
      needs_source: needsSource.length,
    },
  };
  if (includeFindings) {
    out.profile = styleProfile(text);
    out.style = compareToSamples(text, p);
    out.vocabulary = {
      banned_prefer: (voice.vocabulary?.avoid ?? []).filter((w) => containsWord(text, w)),
      missing_prefer: (voice.vocabulary?.prefer ?? []).filter((w) => !containsWord(text, w)),
      overuse: (voice.vocabulary?.prefer ?? [])
        .map((w) => ({ word: w, count: countOccurrences(text, w) }))
        .filter((x) => x.count > 3),
      dominant: contentWords(text, 12),
    };
  }
  return out;
}

/**
 * Build the two sets the sourcing check needs.
 *
 * `known` — every number that appears anywhere in a proof entry. Proof text is
 * the claim registry, so a number found there is sourced by definition. This
 * includes numbers written in the claim prose ("about six hours"), not just
 * `metric.value`, because that is how people actually write them.
 *
 * `structural` — numbers that belong to a named entity rather than to a factual
 * claim. The method name ("The First 90 Days Method"), the domain, the profile
 * slug, keywords. These are labels. Blocking them would make it impossible to
 * name anything containing a digit, which would push people to remove the name
 * of their own method rather than source their results — exactly the wrong
 * incentive.
 */
function knownNumberIndex(p, proof) {
  const known = new Set();
  const structural = new Set();
  const NUMBER = /\b\d+(?:[.,]\d+)?\b/g;

  const harvest = (obj) => {
    if (obj == null) return;
    if (typeof obj === 'number') {
      known.add(String(obj));
      known.add(String(obj).replace(/\.0+$/, ''));
      return;
    }
    if (typeof obj !== 'string') {
      if (Array.isArray(obj)) {
        obj.forEach(harvest);
        return;
      }
      if (typeof obj === 'object') {
        Object.values(obj).forEach(harvest);
        return;
      }
      return;
    }
    for (const m of obj.match(NUMBER) ?? []) known.add(m.trim());
  };

  // Proof: metric values, and numbers anywhere in the descriptive fields.
  for (const e of proof.values()) {
    harvest(e?.metric);
    for (const field of ['claim', 'context', 'subject', 'source', 'period']) {
      for (const m of String(e?.[field] ?? '').match(NUMBER) ?? []) known.add(m.trim());
    }
  }

  // Persona: names and identifiers.
  const names = [
    p.identity?.positioning?.method,
    p.identity?.positioning?.statement,
    p.identity?.profile?.domain,
    p.identity?.profile?.custom_url_slug,
    p.identity?.profile?.role_title,
    p.keywords?.primary?.keyword,
    p.keywords?.primary?.headline_phrase,
    ...(p.keywords?.secondary ?? []).map((k) => k.keyword),
    ...Object.values(p.keywords?.phrase_bank ?? {}).flat(),
    ...(p.keywords?.hashtags?.branded ?? []),
  ];
  for (const n of names) {
    if (!n) continue;
    for (const m of String(n).match(NUMBER) ?? []) structural.add(m.trim());
  }

  return { known, structural };
}

function containsWord(text, phrase) {
  const re = new RegExp(`(?:^|\\W)${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|\\W)`, 'i');
  return re.test(String(text));
}

function excerptClaim(text, index, len) {
  const start = text.lastIndexOf('.', index) + 1;
  const end = text.indexOf('.', index + len);
  const sentence = text.slice(start >= 0 ? start : 0, end === -1 ? text.length : end).trim();
  return sentence.length > 200 ? `${sentence.slice(0, 200)}…` : sentence;
}

/** Find the proof entry whose claim most resembles this sentence. */
function guessProofEntry(claim, proof) {
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const target = norm(claim);
  if (!target) return null;
  let best = null;
  let bestScore = 0;
  for (const e of proof.values()) {
    const words = new Set(norm(e?.claim ?? '').split(' ').filter((w) => w.length > 3));
    if (words.size === 0) continue;
    let hit = 0;
    for (const w of words) if (target.includes(w)) hit++;
    const score = hit / words.size;
    if (score > bestScore) {
      bestScore = score;
      best = e;
    }
  }
  return bestScore >= 0.4 ? best : null;
}

function compareToSamples(text, p) {
  const samples = p.voiceSamples ?? [];
  if (!samples.length) return { samples: 0, similarity: null, note: 'no voice-samples.md entries to compare against' };
  const agg = aggregateProfiles(samples.map((s) => styleProfile(s)));
  const here = styleProfile(text);
  return {
    samples: samples.length,
    similarity: styleSimilarity(here, agg),
    note: 'Compare against persona/voice-samples.md. Below 0.7 reads as generic rather than as this person.',
  };
}

// ---------------------------------------------------------------------------
// Drift: rolling-window aggregate checks over published history.
// ---------------------------------------------------------------------------
function driftReport(persona, rubric, history) {
  const rules = rubric.consistency?.drift ?? {};
  const findings = [];
  if (history.length < 3) {
    return {
      findings,
      skipped: `only ${history.length} published posts; rolling-window checks need at least 3`,
    };
  }
  const profiles = history.map((p) => (typeof p === 'string' ? p : p.text)).map((t) => styleProfile(t));
  const agg = aggregateProfiles(profiles);

  // Pillar distribution
  const win = rules.pillar_distribution?.window ?? 30;
  const recent = history.slice(-win);
  const actual = {};
  for (const p of recent) {
    const pillar = (typeof p === 'string' ? null : p.pillar) ?? 'unknown';
    actual[pillar] = (actual[pillar] ?? 0) + 1;
  }
  const planned = Object.fromEntries((persona.povMap?.pillars ?? []).map((p) => [p.id, p.weight ?? 0]));
  const tvd = totalVariationDistance(
    Object.fromEntries(Object.keys(planned).map((k) => [k, (actual[k] ?? 0) / recent.length])),
    planned,
  );
  if (tvd > (rules.pillar_distribution?.max_total_variation_distance ?? 0.2)) {
    findings.push({
      id: 'drift.pillar_distribution',
      severity: 'warn',
      message: `pillar mix has drifted ${round(tvd, 3)} from plan (limit ${rules.pillar_distribution?.max_total_variation_distance ?? 0.2}). Actual: ${JSON.stringify(actual)}`,
    });
  }

  // Archetype distribution
  const arch = {};
  for (const p of recent) {
    const a = (typeof p === 'string' ? null : p.archetype) ?? 'unknown';
    arch[a] = (arch[a] ?? 0) + 1;
  }
  for (const [k, n] of Object.entries(arch)) {
    const share = n / recent.length;
    const limit = rules.archetype_distribution?.max_share_per_archetype ?? 0.25;
    if (share > limit && k !== 'unknown') {
      findings.push({
        id: 'drift.archetype_' + k,
        severity: 'warn',
        message: `${k} is ${Math.round(share * 100)}% of the last ${recent.length} posts, above the ${Math.round(limit * 100)}% ceiling`,
      });
    }
  }

  // Voice drift against the samples
  const samples = persona.voiceSamples ?? [];
  if (samples.length) {
    const sampleAgg = aggregateProfiles(samples.map((s) => styleProfile(s)));
    const tol = rules.voice_drift?.mean_sentence_words?.tolerance ?? 0.25;
    const dev = Math.abs(agg.meanSentenceWords - sampleAgg.meanSentenceWords) / Math.max(sampleAgg.meanSentenceWords, 1);
    if (dev > tol) {
      findings.push({
        id: 'drift.mean_sentence_words',
        severity: 'warn',
        message: `recent posts average ${round(agg.meanSentenceWords, 1)} words per sentence vs ${round(sampleAgg.meanSentenceWords, 1)} in voice-samples.md (${Math.round(dev * 100)}% drift, limit ${Math.round(tol * 100)}%)`,
      });
    }
    const vd = rules.voice_drift?.second_to_first_person_ratio ?? {};
    const r = ratioOf(profiles);
    if (vd.min != null && r < vd.min) {
      findings.push({ id: 'drift.person_ratio_low', severity: 'warn', message: `second-to-first person ratio is ${round(r, 2)}, below floor ${vd.min}. The feed has stopped addressing the reader.` });
    }
    if (vd.max != null && r > vd.max) {
      findings.push({ id: 'drift.person_ratio_high', severity: 'warn', message: `second-to-first person ratio is ${round(r, 2)}, above ceiling ${vd.max}. Reads as coaching copy.` });
    }
    if ((vd.emoji_per_post?.max ?? 0) === 0 && agg.emoji > 0.5) {
      findings.push({ id: 'drift.emoji', severity: 'warn', message: `recent posts average ${round(agg.emoji, 2)} emoji per post but voice.yaml sets max 0.` });
    }
  }

  // Repetition: hook reuse and pairwise overlap
  const hookCounts = new Map();
  for (const p of recent) {
    const t = typeof p === 'string' ? p : p.text;
    const h = t.split('\n').find((l) => l.trim()) ?? '';
    const norm = h.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    hookCounts.set(norm, (hookCounts.get(norm) ?? 0) + 1);
  }
  const reused = [...hookCounts.entries()].filter(([, n]) => n >= 3);
  const hookReuseRate = reused.reduce((a, [, n]) => a + n, 0) / Math.max(recent.length, 1);
  if (hookReuseRate > (rules.repetition?.max_hook_line_reuse_rate ?? 0.15)) {
    findings.push({
      id: 'drift.hook_reuse',
      severity: 'warn',
      message: `${Math.round(hookReuseRate * 100)}% of the last ${recent.length} posts reuse an opening line verbatim`,
    });
  }

  let worstPair = 0;
  let worstIdx = [null, null];
  const grams = recent.map((p) => ngrams(typeof p === 'string' ? p : p.text, 4));
  for (let i = 0; i < grams.length; i++) {
    for (let j = i + 1; j < grams.length; j++) {
      const o = ngramOverlap(grams[i], grams[j], 4);
      if (o > worstPair) {
        worstPair = o;
        worstIdx = [i, j];
      }
    }
  }
  if (worstPair > (rules.repetition?.max_ngram_overlap_any_pair ?? 0.25)) {
    findings.push({
      id: 'drift.repetition',
      severity: 'warn',
      message: `posts ${worstIdx[0]} and ${worstIdx[1]} of the window share ${Math.round(worstPair * 100)}% of their 4-grams`,
    });
  }

  // Proof rotation
  const pr = rubric.consistency?.proof_rotation ?? {};
  const proofUse = new Map();
  for (const p of recent) {
    if (typeof p === 'string') continue;
    for (const ref of p.proof_refs ?? []) proofUse.set(ref, (proofUse.get(ref) ?? 0) + 1);
  }
  for (const [ref, n] of proofUse) {
    const share = n / recent.length;
    if (share > (pr.max_reuse_rate_of_single_proof_entry ?? 0.2)) {
      findings.push({
        id: 'drift.proof_reuse',
        severity: 'warn',
        message: `proof entry ${ref} appears in ${Math.round(share * 100)}% of the window (limit ${Math.round((pr.max_reuse_rate_of_single_proof_entry ?? 0.2) * 100)}%)`,
      });
    }
  }

  return { findings, aggregated: agg };
}

function totalVariationDistance(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let d = 0;
  for (const k of keys) d += Math.abs((a[k] ?? 0) - (b[k] ?? 0));
  return d / 2;
}

function ratioOf(profiles) {
  const s = mean(profiles.map((p) => (p.firstPerson ? p.secondPerson / p.firstPerson : p.secondPerson)));
  return round(s, 2);
}

// ---------------------------------------------------------------------------
// CLI path
// ---------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('check-voice.mjs')) {
  let text = null;
  let post = null;
  let subject = 'inline';
  const file = args.flags.file ?? args._[0];
  if (args.flags.text) {
    text = args.flags.text;
  } else if (file) {
    if (!fileExists(file)) {
      console.error(`file not found: ${file}`);
      process.exit(3);
    }
    const data = readJson(file);
    post = data;
    if (typeof data.text === 'string') {
      text = data.text;
      subject = data.id ?? 'unknown';
    } else {
      // Profile export: concatenate the fields a reader actually sees.
      text = [
        data.headline,
        data.about,
        ...(data.experience ?? []).flatMap((e) => [e.title, e.company, ...(e.bullets ?? [])]),
        ...(data.featured ?? []).map((f) => `${f.title ?? ''} ${f.description ?? ''}`),
      ]
        .filter(Boolean)
        .join('\n');
      subject = data.custom_url_slug ?? data.name ?? 'profile';
    }
  } else {
    console.error('need --file PATH or --text STR');
    process.exit(2);
  }

  const result = checkVoice({ text, persona, includeFindings: true });

  let drift = null;
  if (args.flags.history && fileExists(args.flags.history)) {
    const history = readText(args.flags.history)
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    drift = driftReport(persona, rubric, history);
  }

  const outFile = args.flags.out;
  const payload = {
    schema_version: 1,
    kind: 'voice',
    subject,
    generated_at: nowISO(),
    persona_version: persona.identity?.persona?.version ?? '0.0.0',
    counts: result.counts,
    hard_bans: result.hard_bans,
    soft_tells: result.soft_tells,
    repeated_tells: result.repeated_tells,
    vague_quantifiers: result.vague_quantifiers,
    unsourced_authority: result.unsourced_authority,
    needs_source: result.needs_source,
    style: result.style,
    vocabulary: result.vocabulary,
    drift,
  };

  if (args.flags.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    const L = [];
    L.push('='.repeat(72));
    L.push(`LINA VOICE CHECK — ${subject}`);
    L.push('='.repeat(72));
    L.push('');
    const rows = [
      ['hard bans', result.counts.hard_bans, 'must be 0'],
      ['soft tells', result.counts.soft_tells, '1 or fewer'],
      ['repeated tells (3x+)', result.counts.repeated_tells, 'must be 0'],
      ['vague quantifiers', result.counts.vague_quantifiers, 'should be 0'],
      ['unsourced authority', result.counts.unsourced_authority, 'must be 0'],
      ['needs proof source', result.counts.needs_source, 'must be 0'],
    ];
    for (const [label, n, target] of rows) {
      L.push(`  ${String(n).padStart(3)}  ${label.padEnd(26)} ${target}`);
    }
    L.push('');
    if (result.hard_bans.length) {
      L.push('HARD BANS');
      for (const b of result.hard_bans) L.push(`  "${b.phrase}"  line ~${b.line}\n     ${b.context}`);
      L.push('');
    }
    if (result.needs_source.length) {
      L.push('NEEDS PROOF SOURCE');
      for (const n of result.needs_source) {
        L.push(`  value: ${n.value}\n     claim: ${n.matched_claim}\n     ${n.detail}`);
      }
      L.push('');
    }
    if (result.repeated_tells.length) {
      L.push('REPEATED TELLS');
      for (const t of result.repeated_tells) L.push(`  "${t.phrase}" x${t.count} — ${t.note}`);
      L.push('');
    }
    if (result.unsourced_authority.length) {
      L.push('UNSOURCED AUTHORITY');
      for (const a of result.unsourced_authority) L.push(`  "${a.phrase}" line ~${a.line}`);
      L.push('');
    }
    if (result.vocabulary) {
      L.push('STYLE');
      L.push(`  samples compared: ${result.style.samples}`);
      L.push(`  similarity to samples: ${result.style.similarity ?? 'n/a'}`);
      L.push(`  dominant words: ${result.vocabulary.dominant.map((d) => d.word).join(', ') || 'none'}`);
      if (result.vocabulary.banned_prefer.length) L.push(`  words on the avoid list: ${result.vocabulary.banned_prefer.join(', ')}`);
      if (result.vocabulary.overuse.length) L.push(`  overused persona words: ${result.vocabulary.overuse.map((o) => `${o.word} x${o.count}`).join(', ')}`);
      L.push('');
    }
    if (drift) {
      L.push('DRIFT');
      if (drift.skipped) L.push(`  skipped: ${drift.skipped}`);
      for (const f of drift.findings ?? []) L.push(`  [${f.severity.toUpperCase()}] ${f.id}\n      ${f.message}`);
      L.push('');
    }
    console.log(L.join('\n'));
  }

  if (outFile) writeJson(outFile, payload);
  if (args.flags.write && post && file && typeof post === 'object' && typeof post.text === 'string') {
    post.voice_report = payload;
    writeJson(file, post);
    console.error(`\nwrote voice_report into ${file}`);
  }

  const blocking = result.counts.hard_bans + result.counts.needs_source + result.counts.unsourced_authority + result.counts.repeated_tells;
  process.exit(blocking > 0 ? 1 : 0);
}