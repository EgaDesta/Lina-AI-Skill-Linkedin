#!/usr/bin/env node
// Validate the persona bundle.
//
//   node scripts/validate-persona.mjs
//   node scripts/validate-persona.mjs --json
//   node scripts/validate-persona.mjs --root D:/other/lina
//
// Exit 0 = ready to generate. Exit 1 = gaps found. Exit 3 = cannot run.

import { parseArgs, renderGaps, usage } from './lib/cli.mjs';
import {
  loadPersona,
  collectGaps,
  blockingGaps,
  validatePersonaSchema,
  personaVersion,
  primarySegment,
  proofIndex,
} from './lib/persona.mjs';
import { styleProfile, aggregateProfiles, round } from './lib/textstats.mjs';
import { repoPath, nowISO } from './lib/fsio.mjs';

const args = parseArgs();
if (args.flags.help) {
  console.log(usage([
    'validate-persona — check persona/*.yaml for completeness and consistency',
    '',
    '  --json      machine-readable output',
    '  --root DIR  alternate repo root',
  ]));
  process.exit(0);
}

// Pass the flag straight through rather than defaulting it here. loadPersona
// resolves `undefined` to LINA_PERSONA_ROOT or the repo root; defaulting to
// repoPath() at the call site would silently override the env var that the test
// suite and multi-brand installs depend on.
let persona;
try {
  persona = loadPersona(args.flags.root);
} catch (err) {
  console.error(`cannot load persona: ${err.message}`);
  process.exit(3);
}

const gaps = collectGaps(persona);
const blockers = blockingGaps(persona);
const schemaErrors = validatePersonaSchema(persona);

// ---------------------------------------------------------------------------
// Voice sample measurement. Reported because it is the only objective signal
// available for whether voice.yaml matches reality.
// ---------------------------------------------------------------------------
const samples = persona.voiceSamples ?? [];
const profiles = samples.map((s) => styleProfile(s));
const aggregate = profiles.length ? aggregateProfiles(profiles) : null;
const voiceFindings = [];

if (aggregate) {
  const vs = persona.voice?.sentence ?? {};
  const target = vs.target_words ?? 14;
  const actual = aggregate.meanSentenceWords;
  const deviation = Math.abs(actual - target) / target;
  if (deviation > 0.4) {
    voiceFindings.push({
      id: 'voice.mean_sentence_words',
      severity: deviation > 0.7 ? 'blocker' : 'warn',
      message:
        `voice.yaml target is ${target} words, samples average ${round(actual, 1)} (${Math.round(deviation * 100)}% off). ` +
        'Where samples and config disagree, the samples win — update voice.yaml.',
    });
  }
  const minVar = vs.min_length_variance ?? 0.35;
  if (aggregate.lengthVariance < minVar) {
    voiceFindings.push({
      id: 'voice.length_variance',
      severity: 'warn',
      message:
        `samples have length variance ${round(aggregate.lengthVariance, 3)}, below the ${minVar} floor. ` +
        'Either the samples are too uniform to calibrate from, or the floor is wrong.',
    });
  }
  const fmtCfg = persona.voice?.formatting ?? {};
  const samplesWithEmoji = profiles.filter((p) => p.emoji > 0).length;
  if (!fmtCfg.emoji && samplesWithEmoji > 0) {
    voiceFindings.push({
      id: 'voice.emoji_conflict',
      severity: 'warn',
      message: `voice.formatting.emoji is false but ${samplesWithEmoji} of ${samples.length} samples contain emoji.`,
    });
  }
  const samplesWithHash = profiles.filter((p) => p.hashtags > 0).length;
  if (samples.length > 0 && samplesWithHash < samples.length / 2) {
    voiceFindings.push({
      id: 'voice.hashtag_usage',
      severity: 'nice',
      message: `${samplesWithHash} of ${samples.length} samples carry hashtags. Check the min_hashtags floor of ${fmtCfg.min_hashtags ?? '?'} is realistic.`,
    });
  }
}

// ---------------------------------------------------------------------------
// Cross-file consistency
// ---------------------------------------------------------------------------
const cross = [];
const proof = proofIndex(persona);
const proofIds = new Set(proof.keys());
for (const b of persona.povMap?.beliefs ?? []) {
  for (const ref of b.evidence_refs ?? []) {
    if (!proofIds.has(ref)) {
      cross.push({ severity: 'blocker', message: `belief ${b.id} cites proof entry "${ref}" which does not exist` });
    }
  }
}
for (const h of persona.povMap?.hot_takes ?? []) {
  for (const ref of h.evidence_refs ?? []) {
    if (!proofIds.has(ref)) {
      cross.push({ severity: 'warn', message: `hot take ${h.id} cites unknown proof entry "${ref}"` });
    }
  }
}
const assetIds = new Set((persona.proof?.assets ?? []).map((a) => a.id));
for (const offer of persona.offers?.paid_offers ?? []) {
  for (const ref of offer.proof_refs ?? []) {
    if (!proofIds.has(ref)) {
      cross.push({ severity: 'warn', message: `offer "${offer.name}" cites unknown proof entry "${ref}"` });
    }
  }
}
for (const asset of persona.proof?.assets ?? []) {
  for (const ref of asset.proof_refs ?? []) {
    if (!proofIds.has(ref) && !assetIds.has(ref)) {
      cross.push({ severity: 'warn', message: `asset ${asset.id} cites unknown ref "${ref}"` });
    }
  }
}
const segIds = new Set((persona.audience?.segments ?? []).map((s) => s.id));
if (!segIds.has(persona.audience?.primary)) {
  cross.push({ severity: 'blocker', message: `audience.primary "${persona.audience?.primary}" is not a defined segment` });
}
const pillarIds = new Set((persona.povMap?.pillars ?? []).map((p) => p.id));
for (const rung of persona.offers?.ladder ?? []) {
  for (const ref of rung.serves ?? []) {
    if (!pillarIds.has(ref)) {
      cross.push({ severity: 'warn', message: `offer rung ${rung.rung} serves unknown pillar "${ref}"` });
    }
  }
}

// ---------------------------------------------------------------------------
// Publish gate sanity. Publishing is the one irreversible action here.
// ---------------------------------------------------------------------------
const gate = [];
const publish = persona.identity?.publish ?? {};
if (publish.mode === 'auto' && publish.approval_required === true) {
  gate.push({
    severity: 'warn',
    message: 'publish.mode is "auto" but approval_required is true: nothing will actually publish. Set one or the other deliberately.',
  });
}
if (publish.mode === 'auto' && !persona.identity?.profile?.timezone) {
  gate.push({ severity: 'blocker', message: 'publish.mode is "auto" without a timezone. Scheduling cannot be deterministic.' });
}
if (publish.mode === 'auto' && blockers.length > 0) {
  gate.push({ severity: 'blocker', message: 'publish.mode is "auto" while blocking persona gaps remain.' });
}

// ---------------------------------------------------------------------------
const allFindings = [...schemaErrors.map((e) => ({ severity: 'blocker', message: `schema: ${e.pointer} ${e.message}` })), ...cross, ...gate, ...voiceFindings];

if (args.flags.json) {
  console.log(JSON.stringify({
    ok: blockers.length === 0 && schemaErrors.length === 0,
    persona_version: personaVersion(persona),
    gaps,
    blocking: blockers.length,
    schema_errors: schemaErrors,
    voice_profile: aggregate,
    voice_samples: samples.length,
    voice_findings: voiceFindings,
    cross_findings: cross,
    gate_findings: gate,
    primary_segment: primarySegment(persona)?.label ?? null,
    proof_entries: proof.size,
    pillars: (persona.povMap?.pillars ?? []).length,
    generated_at: nowISO(),
  }, null, 2));
} else {
  console.log(renderGaps(gaps, blockers.length));
  if (aggregate) {
    console.log('VOICE MEASURED FROM SAMPLES');
    console.log(
      `  ${samples.length} samples  mean sentence ${round(aggregate.meanSentenceWords, 1)} words  ` +
        `variance ${round(aggregate.lengthVariance, 3)}  emoji/post ${round(aggregate.emoji, 2)}  ` +
        `hashtags/post ${round(aggregate.hashtags, 2)}`,
    );
    console.log('');
  }
  for (const f of voiceFindings) console.log(`  [${f.severity.toUpperCase()}] ${f.id}\n      ${f.message}`);
  for (const f of cross) console.log(`  [${f.severity.toUpperCase()}] ${f.message}`);
  for (const f of gate) console.log(`  [${f.severity.toUpperCase()}] gate: ${f.message}`);
  if (schemaErrors.length) {
    console.log('');
    for (const e of schemaErrors) console.log(`  [BLOCKER] schema: ${e.pointer} ${e.message}`);
  }
  if (!allFindings.length && !gaps.length) {
    console.log('Persona is complete and internally consistent.');
  }
}

const failed = blockers.length > 0 || schemaErrors.length > 0 || cross.some((c) => c.severity === 'blocker') || gate.some((g) => g.severity === 'blocker');
process.exit(failed ? 1 : 0);