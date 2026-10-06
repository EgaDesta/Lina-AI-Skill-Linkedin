// Measurable properties of a piece of text.
//
// Everything here is deterministic and reproducible. That is the point: a
// personal-brand rubric that depends on a model's mood produces a score nobody
// can act on. If a property cannot be measured, it belongs in a playbook as a
// judgement call, not in a score.

const WORD_RE = /[A-Za-z0-9][A-Za-z0-9'’\-]*/g;

// Emoji ranges. Includes the common pictographic blocks plus regional
// indicators and ZWJ sequences, so a single flag is counted once.
const EMOJI_RE =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{1F1E6}-\u{1F1FF}\u{200D}\u{20E3}]/gu;

export function words(text) {
  return String(text).match(WORD_RE) ?? [];
}

export function wordCount(text) {
  return words(text).length;
}

/**
 * Split into sentences.
 *
 * Numbered lists are handled as a unit. A naive split on `[.!?] ` turns
 * "1. Write the trigger down." into two sentences — "1." and "Write the trigger
 * down." — which breaks sentence-length statistics (the "1." counts as a
 * one-word sentence and drags the mean down) and hides the instruction from
 * `imperativeSentences`, since the verb is no longer at the start.
 */
export function sentences(text) {
  const cleaned = String(text)
    .replace(/\r\n?/g, '\n')
    .replace(/\n+/g, ' \n ')
    .trim();
  if (cleaned === '') return [];

  // Protect list markers. The marker's own "." must also be neutralised, or
  // the sentence splitter breaks right after it ("2." then "Delete the old
  // steps."). A private-use character cannot appear in a post and cannot be a
  // split boundary.
  const SENT = String.fromCharCode(1); // marker separator
  const DOT = String.fromCharCode(2); // stand-in for the marker's period

  return cleaned
    .replace(/(^|[\n]|(?<=[.!?]\s))\s*(\d{1,2})([.)])\s+/g, (m, lead, num, punct) =>
      punct === '.'
        ? `${lead}${num}${DOT}${SENT}`
        : `${lead}${num}${SENT}`)
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(\[])/)
    .map((s) => s.split(SENT).join(' ').split(DOT).join('.').trim())
    .filter((s) => s.length > 0);
}

export function sentenceLengths(text) {
  return sentences(text).map((s) => wordCount(s));
}

export function mean(nums) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function stdev(nums) {
  if (nums.length < 2) return 0;
  const m = mean(nums);
  const variance = nums.reduce((acc, n) => acc + (n - m) ** 2, 0) / (nums.length - 1);
  return Math.sqrt(variance);
}

/**
 * Coefficient of variation. The measure of rhythm.
 * Very low means every sentence is the same length, which reads as machine
 * output even when the prose is good. This is the single cheapest
 * machine-authorship tell on LinkedIn.
 */
export function lengthVariance(nums) {
  const m = mean(nums);
  if (m === 0) return 0;
  return stdev(nums) / m;
}

export function paragraphs(text) {
  return String(text)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

export function lines(text) {
  return String(text).split('\n');
}

export function firstLine(text) {
  return lines(text).find((l) => l.trim() !== '') ?? '';
}

export function lastTwoLines(text) {
  const ls = lines(text).filter((l) => l.trim() !== '');
  return ls.slice(-2).join(' ');
}

/** LinkedIn mobile is roughly 42-46 characters per line. 180 is a safe 4-line cap. */
export function longestParagraphChars(text) {
  return paragraphs(text).reduce((max, p) => Math.max(max, p.length), 0);
}

export function charCount(text) {
  return [...String(text)].length;
}

export function readingSeconds(text, wpm = 238) {
  return Math.round((wordCount(text) / wpm) * 60);
}

export function countMatches(text, re) {
  const m = String(text).match(re);
  return m ? m.length : 0;
}

export function emojiCount(text) {
  const m = String(text).match(EMOJI_RE);
  return m ? m.length : 0;
}

export function emojis(text) {
  return String(text).match(EMOJI_RE) ?? [];
}

export function hashtagCount(text) {
  return countMatches(text, /(^|\s)#[\p{L}\p{N}_]+/gu);
}

export function hashtags(text) {
  return (String(text).match(/(^|\s)#[\p{L}\p{N}_]+/gu) ?? []).map((h) => h.trim().slice(1));
}

export function questionCount(text) {
  return countMatches(text, /\?/g);
}

const PRONOUN = {
  first: /\b(?:i|i'm|i've|ive|i'll|i'd|my|mine|me|we|we're|we've|our|us)\b/gi,
  second: /\b(?:you|you're|you've|you'll|you'd|your|yours)\b/gi,
  third: /\b(?:they|them|their|theirs|he|him|his|she|her|hers|it|its)\b/gi,
};

export function pronounCounts(text) {
  return {
    first: countMatches(text, PRONOUN.first),
    second: countMatches(text, PRONOUN.second),
    third: countMatches(text, PRONOUN.third),
  };
}

/** How addressed the reader is, per 100 words. Normalised so length does not skew it. */
export function secondToFirstRatio(text) {
  const p = pronounCounts(text);
  const words = Math.max(wordCount(text), 1);
  const per100 = (n) => (n / words) * 100;
  const s = per100(p.second);
  const f = per100(p.first);
  return f === 0 ? s : s / f;
}

/** Numeric tokens. Used both for proof checking and for "is this concrete" scoring. */
export function numbers(text) {
  return String(text).match(/\b\d[\d,.]*\s?(?:%|percent|x|hours?|hrs?|days?|weeks?|months?|years?|k|m|bn)?\b/gi) ?? [];
}

/**
 * Sentences that instruct rather than describe.
 *
 * Two shapes are recognised, because both are common in real how-to posts:
 *   - the bare verb: "Write it down." / "Use the checklist."
 *   - a list marker with the verb after it: "1. Write it down." /
 *     "- Use the checklist."
 * A caller that only matched the bare verb would score a perfectly good numbered
 * procedure as having no actionable content, which is the one thing
 * `post-rubric.yaml` check `vd1` is asking about.
 */
const IMPERATIVE_VERBS = [
  'use', 'start', 'stop', 'write', 'build', 'measure', 'track', 'ask', 'try',
  'check', 'pick', 'choose', 'drop', 'add', 'remove', 'test', 'ship',
  'document', 'define', 'list', 'block', 'automate', 'reorder', 'review',
  'audit', 'log', 'tag', 'standardise', 'standardize', 'schedule', 'run',
  'read', 'look', 'find', 'count', 'compare', 'cut', 'replace', 'move',
  'write down', 'write it down', 'put', 'keep', 'make', 'give', 'take',
  'send', 'call', 'book', 'share', 'note', 'set', 'decide', 'name',
];
const IMPERATIVE_RE = new RegExp(
  `^(?:\\d+[.)]\\s*|[-*•]\\s*)?(?:${IMPERATIVE_VERBS.join('|')})\\b`,
  'i',
);

export function imperativeSentences(text) {
  return sentences(text).filter((s) => IMPERATIVE_RE.test(s.trim()));
}

/**
 * Distinct n-grams, used for repetition detection.
 * Words lowercased and stripped of punctuation so "don't" and "dont" match.
 */
export function ngrams(text, n = 4) {
  const ws = words(text).map((w) => w.toLowerCase());
  const out = new Set();
  for (let i = 0; i + n <= ws.length; i++) out.add(ws.slice(i, i + n).join(' '));
  return out;
}

/**
 * Jaccard overlap of n-gram sets. Between 0 and 1.
 *
 * Note the size dependence. Jaccard on a 60-word post, where a heavy rewrite
 * still shares most of its 4-grams, scores far above the 0.25 threshold. The
 * same edit on a 12-word sentence scores around 0.10, because the denominator is
 * dominated by n-grams unique to each side. The 0.25 threshold in
 * `rubric/post-rubric.yaml` therefore only means something for post-length text,
 * which is the only text it is applied to. Comparing short strings needs a
 * different measure; do not lower the threshold to make a short test pass.
 */
export function ngramOverlap(a, b, n = 4) {
  const A = a instanceof Set ? a : ngrams(a, n);
  const B = b instanceof Set ? b : ngrams(b, n);
  if (A.size === 0 || B.size === 0) return 0;
  let shared = 0;
  for (const g of A) if (B.has(g)) shared++;
  return shared / (A.size + B.size - shared);
}

/** Profile of text style, for comparing against voice-samples.md. */
export function styleProfile(text) {
  const lens = sentenceLengths(text);
  const p = pronounCounts(text);
  return {
    chars: charCount(text),
    words: wordCount(text),
    sentences: lens.length,
    meanSentenceWords: round(mean(lens), 2),
    medianSentenceWords: round(median(lens), 2),
    lengthVariance: round(lengthVariance(lens), 3),
    paragraphs: paragraphs(text).length,
    emoji: emojiCount(text),
    hashtags: hashtagCount(text),
    questions: questionCount(text),
    numbers: numbers(text).length,
    firstPerson: p.first,
    secondPerson: p.second,
    thirdPerson: p.third,
    exclamations: countMatches(text, /!/g),
    ellipses: countMatches(text, /\.\.\./g),
    semicolons: countMatches(text, /;/g),
    colons: countMatches(text, /:/g),
    dashes: countMatches(text, /—|–/g),
    commas: countMatches(text, /,/g),
    contractions: countMatches(text, /\b\w+'(?:s|t|re|ve|ll|d|m)\b/gi),
  };
}

/**
 * Similarity of two style profiles, 0 to 1.
 * Weighted so that the signals a reader notices first (rhythm, pronouns,
 * density of punctuation) dominate over raw length.
 */
export function styleSimilarity(a, b) {
  const metrics = [
    ['meanSentenceWords', 0.22],
    ['lengthVariance', 0.16],
    ['paragraphs', 0.08],
    ['exclamations', 0.04],
    ['questions', 0.08],
    ['commas', 0.08],
    ['dashes', 0.04],
    ['contractions', 0.08],
    ['hashtags', 0.08],
    ['numbers', 0.08],
    ['emoji', 0.06],
  ];
  let total = 0;
  for (const [key, weight] of metrics) {
    const x = a[key] ?? 0;
    const y = b[key] ?? 0;
    const scale = Math.max(Math.abs(x), Math.abs(y), 1);
    total += weight * (1 - Math.min(1, Math.abs(x - y) / scale));
  }
  return round(total, 3);
}

/** Aggregate several samples into one profile, averaging numeric fields. */
export function aggregateProfiles(profiles) {
  if (!profiles.length) return null;
  const keys = Object.keys(profiles[0]).filter((k) => typeof profiles[0][k] === 'number');
  const out = {};
  for (const k of keys) {
    out[k] = round(mean(profiles.map((p) => p[k] ?? 0)), 3);
  }
  out.samples = profiles.length;
  return out;
}

export function round(n, digits = 2) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/** Words used most, after stopwords. Reveals a writer's vocabulary fingerprint. */
export function contentWords(text, limit = 25) {
  const STOP = new Set(
    `a about after all also am an and any are as at be because been before being but by can cannot could did do does doing done down each even every for from get got had has have he her here hers him his how i if in into is it its just like me more most my no nor not of off on once only or other our out over own said same she should so some such than that the their them then there these they this those through to too under until up us use used very was we were what when where which while who why will with would you your yours`
      .split(/\s+/),
  );
  const freq = new Map();
  for (const w of words(text).map((x) => x.toLowerCase())) {
    if (w.length < 4 || STOP.has(w)) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word, n]) => ({ word, n }));
}