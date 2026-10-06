// The blacklist, and the matcher for everything a post is not allowed to say.
//
// Two separate lists, on purpose:
//   HARD_BANS  — phrases that are meaningless. No context makes them better.
//   SOFT_TELLS — phrases that are usually AI, but occasionally fine in a
//                specific context. These cost points instead of failing.
//
// A third, separate check lives in check-voice.mjs: claims that sound
// authoritative but have no entry in proof.yaml. That one matters more than
// anything on this list.

export const HARD_BANS = [
  // Self-reference. Fatal for a persona: nothing makes a professional
  // audience trust a feed faster than realising it is synthetic.
  'as an ai',
  'as a language model',
  'ai-generated',
  'ai generated',
  'in this response',
  'i cannot browse',
  'i dont have access to',
  'i do not have access to',
  'hope this helps',
  'here is the rewritten',

  // Empty abstraction.
  'delve into',
  'delve into the world',
  'dive deep into',
  'deep dive into',
  'navigate the landscape',
  'navigating the landscape',
  'ever-evolving landscape',
  'ever-changing landscape',
  'fast-paced world',
  'fast paced world',
  'rapidly evolving',
  'rapidly changing',
  'in todays world',
  'in today s world',
  'in todays digital age',
  'the digital age',
  'digital transformation journey',

  // Stacked intensity.
  'unlock the power',
  'unleash the power',
  'unlock your potential',
  'take it to the next level',
  'elevate your',
  'game-changer',
  'game changer',
  'game-changing',
  'revolutionary',
  'disruptive',
  'cutting-edge',
  'cutting edge',
  'best-in-class',
  'world-class',
  'next-level',
  'supercharge',
  '10x',
  'skyrocket',
  'explode your',
  'crush it',

  // Buzzword soup.
  'synergy',
  'synergies',
  'synergize',
  'synergise',
  'holistic approach',
  'holistic strategy',
  'robust solution',
  'comprehensive ecosystem',
  'leverage synergies',
  'actionable insights',
  'key learnings',
  'key takeaways',
  'value-add',
  'value proposition',
  'thought leader',
  'thought leadership',
  'paradigm shift',
  'mindset shift',
  'growth mindset',
  'north star',
  'bandwidth',
  'circle back',
  'touch base',
  'low-hanging fruit',
  'move the needle',
  'level up',
  'evergreen content',
  'content machine',
  'personal brand journey',

  // Formulaic openings. Each is individually fine; as a set they are a
  // fingerprint, which is why they are hard-banned as openings.
  'here is the thing',
  "here's the thing",
  'let that sink in',
  'buckle up',
  'without further ado',
  'picture this',
  'imagine this',
  'read that again',
  'sit with that',
  'let me be honest',
  'lets be honest',
  "let's be honest",
  'i will not sugarcoat',
  'no fluff',

  // Structural filler.
  'in conclusion',
  'to sum up',
  'furthermore',
  'moreover',
  'additionally',
  'it is important to note',
  "it's important to note",
  'needless to say',
  'at the end of the day',
  'when it comes to',
  'in terms of',
  'the fact of the matter',
  'one thing is clear',
  'only time will tell',
  'exciting times ahead',
  'the best is yet to come',

  // Requesting engagement in a way that reads as farming.
  'like and share',
  'smash that',
  'drop a comment if you agree',
  'comment below and ill',
  'tag someone who needs to see',
  'follow for more',
  'follow the page',
  'this will change your life',
  'this changed everything',
  'this changed my life',
  'this is the way',
];

export const SOFT_TELLS = [
  { phrase: 'i have seen', note: 'fine once, repetitive at three. Usually a hedge standing in for a number.' },
  { phrase: 'in my experience', note: 'acceptable once per post, a tell at four.' },
  { phrase: 'the truth is', note: 'usually a signal there is no source behind the claim.' },
  { phrase: 'let that be said', note: 'engagement bait.' },
  { phrase: 'here is the kicker', note: 'chain-letter register.' },
  { phrase: 'you are not alone', note: 'affection-seeking; weak opening.' },
  { phrase: 'its not just', note: 'the "not X but Y" construction, heavily overused by generated copy.' },
  { phrase: 'not just a', note: 'same construction.' },
  { phrase: 'the real question is', note: 'acceptable, but check it is followed by an actual question.' },
  { phrase: 'obviously', note: 'dismissive of a reader who does not already agree.' },
  { phrase: 'simply', note: 'hides the work.' },
  { phrase: 'just', note: 'overuse reads as a tic.' },
  { phrase: 'literally', note: 'almost never literal.' },
  { phrase: 'actually', note: 'often substitutes for being specific.' },
  { phrase: 'really', note: 'emphasis without information.' },
  { phrase: 'very', note: 'emphasis without information.' },
  { phrase: 'truly', note: 'emphasis without information, like very and really.' },
  { phrase: 'seamlessly', note: 'hides the integration problem.' },
  { phrase: 'empower', note: 'agency-erasing.' },
  { phrase: 'leverage', note: 'corporate. Say "use".' },
  { phrase: 'utilize', note: 'same. Say "use".' },
  { phrase: 'robust', note: 'says nothing about reliability.' },
  { phrase: 'significant', note: 'needs the number attached.' },
  { phrase: 'substantial', note: 'needs the number attached, same as significant.' },
  { phrase: 'impressive', note: 'praise, not information.' },
  { phrase: 'innovative', note: 'praise, not information. Replace with what is different.' },
  { phrase: 'exciting', note: 'same. Say what changes for the reader.' },
  { phrase: 'transformative', note: 'same. Say what is different now.' },
  { phrase: 'seamless experience', note: 'unfalsifiable.' },
  { phrase: 'passion', note: 'self-reported, unverifiable.' },
  { phrase: 'passionate about', note: 'self-reported and unverifiable. Show the work instead.' },
  { phrase: 'results-driven', note: 'adjective with no result attached.' },
  { phrase: 'detail-oriented', note: 'self-reported. Name the thing that demonstrates it.' },
  { phrase: 'self-starter', note: 'self-reported. Say what you started without being asked.' },
  { phrase: 'proven track record', note: 'attach the proof or cut it.' },
  { phrase: 'i think', note: 'unnecessary hedge; if it is an opinion, say so once and commit.' },
  { phrase: 'i believe', note: 'unnecessary hedge. If it is an opinion, commit to it once.' },
  { phrase: 'i would say', note: 'same. Hedge once or not at all.' },
  { phrase: 'kind of', note: 'filler hedge.' },
  { phrase: 'sort of', note: 'filler hedge. Either the claim holds or it does not.' },
  { phrase: 'i guess', note: 'undermines an otherwise specific claim.' },
  { phrase: 'studies show', note: 'unless a real study is named, this is fabrication.' },
  { phrase: 'research shows', note: 'unsourced authority unless a real study is named.' },
  { phrase: 'experts say', note: 'unfalsifiable authority.' },
  { phrase: 'it is well known', note: 'unfalsifiable.' },
  { phrase: 'industry standard', note: 'usually means nobody chose it.' },
  { phrase: 'best practice', note: 'requires a named context or a source.' },
  { phrase: 'cutting', note: 'only with an object: cutting costs.' },
  { phrase: 'basically', note: 'filler. The sentence is longer than the idea.' },
  { phrase: 'essentially', note: 'filler. Cut it and see if anything is lost.' },
  { phrase: 'in order to', note: 'write "to".' },
  { phrase: 'due to the fact that', note: 'write "because".' },
  { phrase: 'at the end of the', note: 'filler clause.' },
  { phrase: 'a variety of', note: 'name the number.' },
  { phrase: 'a range of', note: 'name the number.' },
  { phrase: 'various', note: 'name them.' },
  { phrase: 'numerous', note: 'name the number.' },
  { phrase: 'several', note: 'fine, but "several" hides a small count. Use a number.' },
  { phrase: 'significantly', note: 'needs the number.' },
  { phrase: 'dramatically', note: 'needs the number.' },
  { phrase: 'extremely', note: 'needs the number.' },
  { phrase: 'crucial', note: 'so is everything.' },
  { phrase: 'vital', note: 'so is everything. Name the consequence instead.' },
  { phrase: 'essential', note: 'same. Every priority is somebody else\'s essential.' },
  { phrase: 'it is important', note: 'vague intensifier.' },
  { phrase: 'very important', note: 'vague intensifier with no consequence attached.' },
];

/** Vague quantifiers. Every one of these should be a number in a proof-led persona. */
export const VAGUE_QUANTIFIERS = [
  'many',
  'most',
  'almost all',
  'nearly all',
  'a lot of',
  'lots of',
  'tons of',
  'plenty of',
  'majority of',
  'some',
  'few',
  'several',
  'countless',
  'dozens',
  'hundreds of',
  'thousands of',
];

/**
 * Authority claims with no named source. Distinct from SOFT_TELLS because
 * this is how fabricated credibility is phrased.
 */
export const UNSOURCED_AUTHORITY = [
  'studies show',
  'study shows',
  'research shows',
  'research proves',
  'experts say',
  'experts agree',
  'data shows',
  'data proves',
  'statistics show',
  'it is well known',
  'widely known',
  'widely accepted',
  'studies have shown',
  'research has found',
  'according to research',
  'sources show',
  'it is proven',
  'proven fact',
  'well documented',
];

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalise for matching: lowercase, collapse whitespace, unify the
 * punctuation generated copy scatters around contractions and dashes.
 */
export function normalize(text) {
  return String(text)
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ');
}

/**
 * Locate a phrase in `text`, preferring the normalised form and falling back to
 * the raw text.
 *
 * The fallback is what catches a phrase written without an apostrophe
 * ("dont") when the list has one ("don't"). Searching both strings at once, as
 * an earlier version did, put the index for the raw match into a
 * normalised-and-raw concatenation — so the reported position and line number
 * were only meaningful for phrases occurring in the first half of the text.
 *
 * Returns the offset in `text`, or -1.
 */
function locate(text, phrase) {
  const raw = String(text);
  const p = normalize(phrase);
  const direct = raw.toLowerCase().indexOf(p);
  if (direct !== -1) return direct;

  // Contraction-tolerant match on the raw text.
  const needle = escapeRe(p).replace(/'\\?/, "[']?");
  const m = new RegExp(needle, 'i').exec(raw);
  return m ? m.index : -1;
}

function lineAt(text, index) {
  return String(text).slice(0, Math.max(0, index)).split('\n').length;
}

/** Find every hard-ban hit, with position, so a fix can point at a line. */
export function findHardBans(text, extraBans = []) {
  const hits = [];
  for (const phrase of [...HARD_BANS, ...extraBans]) {
    const idx = locate(text, phrase);
    if (idx === -1) continue;
    hits.push({
      phrase,
      position: idx,
      line: lineAt(text, idx),
      context: excerpt(text, idx, phrase.length),
    });
  }
  return hits;
}

export function findSoftTells(text) {
  const hits = [];
  for (const { phrase, note } of SOFT_TELLS) {
    const idx = locate(text, phrase);
    if (idx === -1) continue;
    hits.push({ phrase, note, line: lineAt(text, idx) });
  }
  return hits;
}

export function findVagueQuantifiers(text) {
  const hits = [];
  for (const q of VAGUE_QUANTIFIERS) {
    const idx = locate(text, q);
    if (idx === -1) continue;
    hits.push({ phrase: q, line: lineAt(text, idx) });
  }
  return hits;
}

export function findUnsourcedAuthority(text) {
  const hits = [];
  for (const a of UNSOURCED_AUTHORITY) {
    const idx = locate(text, a);
    if (idx === -1) continue;
    hits.push({ phrase: a, line: lineAt(text, idx) });
  }
  return hits;
}

/**
 * Count occurrences of a phrase.
 *
 * Counting happens on the normalised text only. Searching the normalised text and
 * the raw text together was an earlier attempt to catch both "dont" and "don't",
 * but it double-counts every hit that is already identical in both forms — a
 * phrase repeated three times reported six. Contraction variants are handled by
 * making the apostrophe optional in the needle instead.
 */
export function countOccurrences(text, phrase) {
  const hay = normalize(text);
  const needle = escapeRe(normalize(phrase)).replace(/'\\?/, "[']?");
  const re = new RegExp(needle, 'g');
  const m = hay.match(re);
  return m ? m.length : 0;
}

export function excerpt(text, index, length, pad = 48) {
  const start = Math.max(0, index - pad);
  const end = Math.min(text.length, index + length + pad);
  const slice = text.slice(start, end);
  return (start > 0 ? '...' : '') + slice + (end < text.length ? '...' : '');
}

export { escapeRe };