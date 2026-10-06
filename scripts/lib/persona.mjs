// Assembles persona/*.yaml and rubric/*.yaml into the object shapes described
// by schemas/*.json, and reports what is still missing.

import path from 'node:path';
import { parseYaml } from './yamlmin.mjs';
import { readText, repoPath, fileExists, validateWithSchema } from './fsio.mjs';

function loadYaml(rel) {
  return parseYaml(readText(repoPath(...rel.split('/'))));
}

/**
 * Assemble the persona bundle.
 *
 * `root` may be either a repo root (persona/*.yaml inside it) or a directory
 * that directly contains identity.yaml and friends. The second form is what
 * tests and per-brand persona variants use, so a fixture does not have to
 * pretend to be a repo.
 *
 * Set LINA_PERSONA_ROOT to point at an alternate persona. That is how the test
 * suite exercises the engine against a filled fixture, and how you run two
 * brands from one install.
 */
export function loadPersona(root = process.env.LINA_PERSONA_ROOT || repoPath()) {
  const dir = fileExists(path.join(root, 'persona')) ? path.join(root, 'persona') : root;
  const p = (name) => {
    const file = path.join(dir, name);
    return fileExists(file) ? parseYaml(readText(file)) : null;
  };
  const persona = {
    identity: p('identity.yaml'),
    audience: p('audience.yaml'),
    voice: p('voice.yaml'),
    povMap: p('pov-map.yaml'),
    proof: p('proof.yaml'),
    offers: p('offers.yaml'),
    keywords: p('keywords.yaml'),
  };
  persona.voiceSamples = readVoiceSamples(dir);
  return persona;
}

export function loadRubric(root = repoPath()) {
  const r = (name) => {
    const file = path.join(root, 'rubric', name);
    return fileExists(file) ? parseYaml(readText(file)) : null;
  };
  return {
    profile: r('profile-rubric.yaml'),
    post: r('post-rubric.yaml'),
    consistency: r('brand-consistency.yaml'),
  };
}

/**
 * Parse persona/voice-samples.md into a list of sample texts.
 * Format is one or more "## Sample N" headings followed by body text, with
 * HTML comments used as placeholders. Samples whose body is only a comment or
 * empty are skipped, so the file can ship unfilled.
 */
export function readVoiceSamples(root = repoPath()) {
  const dir = fileExists(path.join(root, 'persona')) ? path.join(root, 'persona') : root;
  const file = path.join(dir, 'voice-samples.md');
  if (!fileExists(file)) return [];
  const text = readText(file);
  const chunks = text.split(/^##\s+Sample\s+\d+\s*$/gm);
  const samples = [];
  for (const chunk of chunks.slice(1)) {
    const body = chunk
      .split(/^##\s+/m)[0]
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/^---+\s*$/gm, '')
      .trim();
    if (body.length < 80) continue;
    samples.push(body);
  }
  return samples;
}

/** Flatten proof entries into a lookup: id -> entry. */
export function proofIndex(persona) {
  const map = new Map();
  for (const e of persona.proof?.entries ?? []) map.set(e.id, e);
  return map;
}

/** Flatten assets into a lookup. */
export function assetIndex(persona) {
  const map = new Map();
  for (const a of persona.proof?.assets ?? []) map.set(a.id, a);
  return map;
}

export function segmentById(persona, id) {
  return (persona.audience?.segments ?? []).find((s) => s.id === id) ?? null;
}

export function primarySegment(persona) {
  return segmentById(persona, persona.audience?.primary);
}

export function pillarById(persona, id) {
  return (persona.povMap?.pillars ?? []).find((p) => p.id === id) ?? null;
}

export function beliefById(persona, id) {
  return (persona.povMap?.beliefs ?? []).find((b) => b.id === id) ?? null;
}

export function hotTakeById(persona, id) {
  return (persona.povMap?.hot_takes ?? []).find((h) => h.id === id) ?? null;
}

/**
 * Everything that must be filled before Lina can produce anything publishable.
 * Returned as findings so validate-persona.mjs can print them as a checklist.
 */
export function collectGaps(persona) {
  const gaps = [];
  const push = (id, where, why, blocks = true) => gaps.push({ id, where, why, blocks });

  const id = persona.identity;
  if (!id) {
    push('identity', 'persona/identity.yaml', 'file missing or unreadable');
    return gaps;
  }

  for (const [key, label] of [
    ['display_name', 'the human name Lina writes as'],
    ['role_title', 'the role title that goes in the headline'],
    ['domain', 'the primary niche slug'],
    ['timezone', 'required before any post can be scheduled'],
  ]) {
    if (!id.profile?.[key]) {
      push(`profile.${key}`, 'persona/identity.yaml', label, key !== 'timezone');
    }
  }
  if (id.profile?.domain && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id.profile.domain)) {
    push('profile.domain_format', 'persona/identity.yaml', 'domain must be kebab-case');
  }

  for (const [key, label] of [
    ['statement', 'the positioning sentence. No headline can be written without it.'],
    ['problem', 'the problem the audience feels. About cannot open without it.'],
    ['method', 'the named method. Without it there is nothing to be known for.'],
    ['differentiator', 'why this person over the alternatives'],
  ]) {
    if (!id.positioning?.[key]) push(`positioning.${key}`, 'persona/identity.yaml', label);
  }

  if (!persona.keywords?.primary?.keyword) {
    push('keywords.primary.keyword', 'persona/keywords.yaml', 'without it the profile cannot rank for anything', true);
  }

  const entries = persona.proof?.entries ?? [];
  const filled = entries.filter((e) => e.claim && e.tier);
  if (filled.length < 3) {
    push(
      'proof.entries',
      'persona/proof.yaml',
      `at least 3 filled entries needed for the specificity dimension; found ${filled.length}`,
      false,
    );
  }
  for (const e of filled) {
    if (!e.source) push(`proof.${e.id}.source`, 'persona/proof.yaml', `"${e.claim || e.id}" has no source`);
    if (persona.proof?.policy?.require_client_permission && e.permission === 'requested') {
      push(`proof.${e.id}.permission`, 'persona/proof.yaml', 'permission still requested, cannot be used yet', false);
    }
  }

  const paid = persona.offers?.paid_offers ?? [];
  if (!paid.some((o) => o.name && o.outcome && o.price_model)) {
    push('offers.paid_offers', 'persona/offers.yaml', 'no complete offer. The profile has no conversion path.', true);
  }
  for (const rung of persona.offers?.ladder ?? []) {
    if (!rung.cta_text) push(`offers.${rung.id}.cta_text`, 'persona/offers.yaml', 'a rung with no CTA cannot be used in a post');
  }

  const samples = persona.voiceSamples ?? [];
  if (samples.length < 3) {
    push(
      'voice.samples',
      'persona/voice-samples.md',
      `at least 3 real posts needed as voice ground truth; found ${samples.length}`,
      false,
    );
  }

  const beliefs = (persona.povMap?.beliefs ?? []).filter((b) => b.claim);
  if (beliefs.length < 3) {
    push('pov-map.beliefs', 'persona/pov-map.yaml', `at least 3 claims needed; found ${beliefs.length}`, false);
  }

  const pillarWeights = (persona.povMap?.pillars ?? []).map((p) => p.weight ?? 0);
  const sum = pillarWeights.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > 0.02) {
    push('pov-map.pillars.weight_sum', 'persona/pov-map.yaml', `pillar weights sum to ${sum.toFixed(2)}, must be 1.00`);
  }

  const beliefIds = new Set((persona.povMap?.beliefs ?? []).map((b) => b.id));
  for (const p of persona.povMap?.pillars ?? []) {
    for (const ref of p.maps_to_beliefs ?? []) {
      if (!beliefIds.has(ref)) {
        push(`pov-map.${p.id}.maps_to_beliefs`, 'persona/pov-map.yaml', `references unknown belief "${ref}"`);
      }
    }
  }

  for (const b of persona.povMap?.beliefs ?? []) {
    if (b.confidence === 'high' && !(b.evidence_refs ?? []).length) {
      push(
        `pov-map.${b.id}.evidence_refs`,
        'persona/pov-map.yaml',
        'claimed with high confidence but no evidence. Lower the confidence or attach proof.',
        false,
      );
    }
  }

  return gaps;
}

/** Blocking gaps only. A non-empty result means Lina must not generate. */
export function blockingGaps(persona) {
  return collectGaps(persona).filter((g) => g.blocks);
}

/** Validate the assembled bundle against schemas/persona.schema.json. */
export function validatePersonaSchema(persona) {
  return validateWithSchema(persona, 'persona.schema.json');
}

export function personaVersion(persona) {
  return persona.identity?.persona?.version ?? '0.0.0';
}