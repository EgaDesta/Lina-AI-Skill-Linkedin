# BrowserOS neo — LinkedIn

Browser operations for this repo: reading a profile, applying profile edits,
publishing posts. Every step below is a recipe for the `browserclaw` MCP tools.

The scripts in `scripts/` never touch the network. The browser is the only thing
that does. Keep the separation: reproducible local scoring, unreliable browser
mutation.

---

## Scrape a profile for auditing

Playbook 02 prefers a JSON export. This is the fallback.

```
1. browser.tabs action=new -> https://www.linkedin.com/in/<slug>/
2. await page.snapshot({ mode: "interactive", depth: 3 }) for section refs
3. Extract with page.evaluate, field by field — never dump the page and parse:
   - headline    : the intro textbox's sibling text
   - about       : goto /in/<slug>/details/about/ then the intro section
   - experience  : goto /in/<slug>/details/experience/
   - featured    : /in/<slug>/details/featured/
   - skills      : /in/<slug>/details/skills/
   - licenses    : /in/<slug>/details/licenses/
   - education   : /in/<slug>/details/education/
   - contact     : main page, the contact card
4. Write to data/examples/<slug>.json in the shape from
   data/examples/sample-profile.json. Empty arrays are honest.
```

**Rules learned the hard way, from `neo-linkedin-profile-boost`:**

- Read by `page.evaluate` per section. A full-page read includes the nav, ads,
  and the "people you may know" carousel, and it will be truncated anyway.
- Don't trust `document.querySelectorAll` for anything interactive. LinkedIn's
  own markup is heavily shadowed; the accessibility tree is the reliable surface.
- An **"Ad Options" interstitial** appears after most edits. It overlays the
  page and every selector after it is wrong. Dismiss it with `act kind=click` on
  the Dismiss ref before continuing. The ref changes each time.
- `recent-activity` lags behind actual reposts. Verify a publish by searching
  for the post text, not by reading the activity feed.

---

## Apply a profile edit

### Headline — plain input

```
1. goto https://www.linkedin.com/in/<slug>/
2. snapshot -> click the "Edit intro" ref
3. snapshot -> fill the intro textbox ref with the new headline
4. act kind=click on Save
5. act kind=click to dismiss the Ad Options interstitial
6. Reload and read the headline back. Do not assume the save worked.
```

### About — the contenteditable trap

This is the one field where `fill()` and `type()` fail silently. About is a
Tiptap/ProseMirror instance; typed input either reverts or takes a minute per
paragraph.

The working method:

```
1. goto https://www.linkedin.com/in/<slug>/edit/forms/summary/new/
2. await page.waitForSelector('.ProseMirror')
3. page.evaluate on the .ProseMirror element:
     el.selectNodeContents(el);
     document.execCommand('delete');
     document.execCommand('insertText', false, aboutText);
4. snapshot -> act kind=click on Save
5. Dismiss the Ad Options interstitial
6. Reload /in/<slug>/details/about/ and read the text back
```

Newlines become separate `<p>` blocks. LinkedIn occasionally drops a trailing
paragraph — read it back rather than trusting the save.

### Experience bullets

Same contenteditable path, one item at a time:
`/in/<slug>/details/experience/` -> the edit pencil on the entry ->
`/in/<slug>/edit/forms/<id>/edit/`. Same selectNodeContents +
`execCommand('insertText')` per bullet field.

Save each entry separately. Two unsaved entries at once lose the first.

### Skills

```
1. goto https://www.linkedin.com/in/<slug>/details/skills/
2. click "Add a skill"
3. fill the "textbox Skill*" input with the skill name
4. await page.waitForSelector('[role="listbox"]')
5. snapshot -> click the matching option button
6. click "Save"
7. For more: "Add more skills" and repeat
```

### Pinning

Open the skill's overflow menu -> "Pin to top". The three pinned ones are what
LinkedIn displays; they are checked by `score-profile.mjs` `sc3`.

### Featured

`/in/<slug>/details/featured/` -> "+" -> paste URL or upload -> title and
description -> save. Order by strength, not by date.

---

## Publish an approved post

**Only from `status: "approved"`.** See `playbooks/05-post-compose.md` step 8.

```
1. Assert before touching the browser:
     post.status === "approved"  ||  post.approvals.some(a => a.decision === "approved" || a.decision === "edited")
     OR identity.publish.approval_required === false AND human confirmed this batch
   If neither, stop and say so.
2. browser.tabs action=new -> https://www.linkedin.com/feed/
3. snapshot -> the "Start a post" textbox ref
4. page.fill on that ref with post.text
5. If there is an image: snapshot -> the media button -> await the file chooser
   -> page.upload with the local path
6. snapshot -> the "Post" button ref
7. act kind=click on Post
8. wait for the composer to clear, then confirm by searching for a distinctive
   phrase from the post text. Do not trust the activity feed; it lags.
9. Update post.published = { at, url, via: "browseros-neo", external_id: null }
   and append to output/published.jsonl
```

Confirming by search rather than by the feed is not paranoia. The activity feed
has been observed showing a repost several days late, and a false negative here
means double-posting.

### Visibility

Set only from `identity.publish.allowed_visibility`. `feed_distribution` likewise
from `allowed_feed_distribution`. Anything outside those lists is a config error,
not a per-post decision.

---

## Automating any of this

Do not build a helper that publishes. The approval gate lives in this repo, and a
helper that bypasses it because it is faster is the failure mode everything here
is designed to prevent.

A helper that only *reads* is worth saving: profile extraction is reusable across
audits. If you save one, it must take a slug and return the JSON shape, and it
must not navigate to any edit URL.

---

## When it breaks

| Symptom | Cause |
|---|---|
| Every selector returns null after an edit | Ad Options interstitial. Dismiss it. |
| About reverts to the old text | Used `fill()` or `type()`. Use execCommand. |
| Save button does nothing | Refs went stale after the interstitial. Re-snapshot. |
| Post appears to publish, then vanishes | Soft-fail from a policy check. Search for the text to confirm. |
| Login prompt | The agent browser's session expired. `request_human_help`, kind `login`. |
| CAPTCHA | `request_human_help`, kind `captcha`. Never work around one. |