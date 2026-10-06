import test from 'node:test';
import assert from 'node:assert/strict';
import {
  words,
  wordCount,
  sentences,
  sentenceLengths,
  mean,
  median,
  lengthVariance,
  paragraphs,
  charCount,
  emojiCount,
  hashtagCount,
  hashtags,
  pronounCounts,
  secondToFirstRatio,
  numbers,
  imperativeSentences,
  ngrams,
  ngramOverlap,
  styleProfile,
  styleSimilarity,
  aggregateProfiles,
  contentWords,
} from '../scripts/lib/textstats.mjs';

test('word and char counting', () => {
  assert.equal(wordCount('one two three'), 3);
  assert.equal(wordCount("don't stop"), 2);
  assert.equal(charCount('abc'), 3);
  assert.equal(charCount('👍'), 1, 'astral chars count as one');
  assert.deepEqual(words('a b'), ['a', 'b']);
});

test('sentence splitting', () => {
  const s = sentences('One thing. Another thing! A third? Yes');
  assert.equal(s.length, 4);
  assert.equal(s[0], 'One thing.');
});

test('sentence splitting handles newlines as breaks', () => {
  const s = sentences('First line.\n\nSecond paragraph starts here. Done.');
  assert.ok(s.length >= 2);
});

test('a numbered list is one sentence per item', () => {
  // Without marker protection the splitter broke after each "N." and every
  // step became a one-word fragment, which skewed the mean sentence length and
  // hid the verb from imperative detection.
  assert.deepEqual(sentences('1. Write the trigger down. 2. Delete the old steps. 3. Test it twice.'), [
    '1. Write the trigger down.',
    '2. Delete the old steps.',
    '3. Test it twice.',
  ]);
});

test('sentence lengths of a numbered list count the words, not the markers', () => {
  assert.deepEqual(sentenceLengths('1. Write the trigger down. 2. Delete the old steps.'), [5, 5]);
});

test('descriptive statistics', () => {
  assert.equal(mean([2, 4, 6]), 4);
  assert.equal(median([1, 3, 5]), 3);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(mean([]), 0);
});

test('length variance is zero for uniform input and positive otherwise', () => {
  assert.equal(lengthVariance([5, 5, 5, 5]), 0);
  assert.ok(lengthVariance([2, 20, 4, 18]) > 0.5);
});

test('paragraph extraction', () => {
  assert.deepEqual(paragraphs('a\n\nb\n\n\nc'), ['a', 'b', 'c']);
  assert.equal(paragraphs('').length, 0);
});

test('emoji counting', () => {
  assert.equal(emojiCount('plain text'), 0);
  assert.ok(emojiCount('👍 great 🎉 work') >= 2);
  assert.equal(emojiCount('no emoji here'), 0);
});

test('hashtag extraction', () => {
  assert.equal(hashtagCount('#one #two'), 2);
  assert.deepEqual(hashtags('#one and #two'), ['one', 'two']);
  assert.equal(hashtagCount('email@example.com'), 0, 'a hash inside an email is not a hashtag');
});

test('pronoun counts and ratio', () => {
  const counts = pronounCounts('You should write it down. I have seen teams skip this.');
  assert.ok(counts.second >= 1);
  assert.ok(counts.first >= 1);
  assert.ok(secondToFirstRatio('You should do this.') > 0);
  assert.equal(secondToFirstRatio(''), 0);
});

test('number extraction', () => {
  const n = numbers('We cut 68% and saved 6 hours per week in 2025');
  assert.ok(n.length >= 3);
});

test('imperative detection', () => {
  const imp = imperativeSentences('Write it down. This is a claim. Use the checklist. Nothing here.');
  assert.equal(imp.length, 2);
});

test('imperative detection sees numbered steps', () => {
  // A numbered procedure is the archetypal how_to post, and vd1 asks whether
  // one exists. Matching only bare verbs would miss every numbered list.
  const imp = imperativeSentences(
    '1. Write the trigger down. 2. Delete the old steps. 3. Test it twice. Nothing here.',
  );
  assert.equal(imp.length, 3, `got ${JSON.stringify(imp)}`);
});

test('n-gram overlap: identical text is 1', () => {
  const a = 'The quick brown fox jumps over the lazy dog again and again today';
  const b = 'The quick brown fox jumps over the lazy dog again and again today';
  assert.equal(ngramOverlap(a, b), 1);
});

test('n-gram overlap: unrelated text is 0', () => {
  const a = 'Invoice handling took six hours every single week for them';
  const b = 'Sourdough starter needs feeding twice daily in warm weather';
  assert.equal(ngramOverlap(a, b), 0);
});

test('n-gram overlap: a rewritten post is caught as repetitive', () => {
  // This is the case the repetition check exists for: a post-length draft that
  // was lightly rewritten. It must score well above the 0.25 threshold.
  const original =
    'Your team is paying for the same work twice.\n\nOnce when someone does it. Once when the person who knew how is in a meeting and somebody has to ask.\n\nI have run this exercise on eleven engagements now. The document that survives is never the most complete one.\n\nOne team doing about 200 invoices a week by hand got to under two hours a week. Same headcount.\n\nWhat is the one process in your team that only one person understands?';
  const rewritten = original
    .replace('paying for', 'handling')
    .replace('eleven', 'nine')
    .replace('200', '150');
  assert.ok(ngramOverlap(original, rewritten) > 0.25, `expected >0.25, got ${ngramOverlap(original, rewritten)}`);
});

test('n-gram overlap: short strings score low even when similar', () => {
  // Documented behaviour, not a target. Jaccard is size-dependent: on a
  // 12-word sentence a heavy rewrite still scores under 0.25, because the
  // denominator is dominated by n-grams unique to each side. The repetition
  // check only ever runs on post-length text.
  const a = 'The tool is the cheap part and the document is what survives the team';
  const b = 'The tool is cheap and the document is what actually survives the team';
  assert.ok(ngramOverlap(a, b) > 0 && ngramOverlap(a, b) < 0.25);
});

test('ngram function builds sets of the requested size', () => {
  assert.equal(ngrams('a b c d e f', 4).size, 3);
});

test('style profile is stable and complete', () => {
  const p = styleProfile('You should write it down.\n\nI have seen it work twice.');
  assert.ok(p.meanSentenceWords > 0);
  assert.equal(p.words, 11);
  assert.equal(p.paragraphs, 2);
});

test('style profile of empty text does not throw', () => {
  const p = styleProfile('');
  assert.equal(p.words, 0);
  assert.equal(p.sentences, 0);
});

test('style similarity is symmetric and bounded', () => {
  const a = styleProfile('Short one. A much longer sentence follows this one for rhythm.');
  const b = styleProfile('Short one. A much longer sentence follows this one for rhythm.');
  assert.equal(styleSimilarity(a, b), 1);
  const c = styleProfile('A completely different shape with many more sentences in it here. And commas.');
  const s = styleSimilarity(a, c);
  assert.ok(s >= 0 && s <= 1);
  assert.equal(s, styleSimilarity(c, a), 'symmetric');
});

test('aggregate profiles averages numeric fields and counts samples', () => {
  const agg = aggregateProfiles([styleProfile('One. Two.'), styleProfile('A longer sentence here now.')]);
  assert.equal(agg.samples, 2);
  assert.ok(agg.meanSentenceWords > 0);
});

test('aggregate of nothing is null', () => {
  assert.equal(aggregateProfiles([]), null);
});

test('content words skip stopwords and short tokens', () => {
  const out = contentWords('automation automation automation with a document and the document', 5);
  assert.equal(out[0].word, 'automation');
  assert.equal(out[0].n, 3);
  assert.ok(!out.some((x) => x.word === 'with'));
});