# Connection Note

300 characters maximum. The Personalised note quota on LinkedIn is roughly two
per week before an upsell appears, so notes are rare and should be worth the
rarity.

## When a note is worth sending

Only when there is a specific reason that person and you should connect, and the
note states it in one sentence. "I liked your post" is not a reason. "You
published the version of this problem I have been trying to explain badly for a
year" is.

## Templates

### On their work

```
{Specific thing they did}. I have been trying to explain a version of this to
my team and getting the framing wrong. Would be good to compare notes.
```

### On shared context

```
You work on {thing} and I have been doing {thing} for {n} years — I think we
are solving the same problem from different ends. Worth comparing?
```

### Mutual connection or warm path

```
{Friend} mentioned you are the person to ask about {topic}. I am trying to get
up to speed on {specific problem}.
```

### On a job change

```
Saw you moved to {company}. I have been following {topic} closely since you were
at {previous}. Still the same focus?
```

## Rules

- One reason. Not two.
- No pitch. Not even a soft one.
- No link. LinkedIn notes do not make links clickable, and a link in a
  connection note reads as an opener for one.
- No "great profile". Generic praise makes the person wonder what you want.
- Under 300 characters. If it does not fit, the reason is not specific enough.
- Never use a template verbatim without replacing the braces. A template
  artefact is visible from across the room.

## Without a note

Send without a note most of the time. It is honest about what the request is.

Where the quota is spent, spend it on people in
`audience.segments[].role_titles`, not on whoever the People search returned.

## After they accept

Do not open with a DM. Wait until there is something specific, or until they
message first. `prompts/engagement-comment.md` covers what happens then.

The failure mode is accepting connections and then never interacting, which is
visible to both sides and slower than not connecting at all.

## Rate limits

`neo-linkedin-profile-boost` records the practical limits:

- Personalised notes: about 2 per week before the Premium upsell
- 3rd and 4th degree profiles have no Connect button — filter People search by
  the 2nd degree facet
- Search cards lazy-load; roughly 2 connects per automation run before page
  changes get rate-limited

## What this does not affect

None of it is scored. The rubric measures the profile a visitor lands on, not the
network behind it. Connection strategy is in `playbooks/06-engagement.md`.