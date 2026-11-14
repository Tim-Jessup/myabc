# My ABC

Reading and writing games for little learners. A small installable web app: no accounts, no ads, no tracking, works offline.

**Play / install:** https://tim-jessup.github.io/myabc/

## One-time setup

1. On GitHub: **Settings → Pages → Build and deployment → Deploy from a branch**, pick `main` and `/ (root)`, then Save.
2. A minute later, open the link above in Chrome on the phone.
3. Chrome menu (⋮) → **Add to Home screen → Install**.

Updates pushed to `main` appear the next time the app is opened with a connection.

## The games

| Section | Game | Levels |
|---|---|---|
| Letters | Find the letter | capitals, small letters, look-alikes (b d p q) |
| Letters | Big and little | match capital to small, and back |
| Numbers | Find the number | 0–10, 0–20, up to 99 |
| Numbers | How many? | count 1–5, 1–10, 6–20 |
| Sounds | What does it start with? | 3 choices, 4 choices, last letter |
| Sounds | Find the picture | 3 or 4 pictures |
| Words | Read the word | short words, tricky choices, longer words |
| Words | Words to know | three sets of common words |
| Words | Build the word | exact letters, extra letters, longer words |
| Words | Make a sentence | three words, longer |
| Writing | Trace letters | small letters, capitals |
| Writing | Trace numbers | 0–9 |
| Writing | Write words | short words, longer words |

Wrong answers just fade out; there is no "fail".

## Pip the platypus

- Pip lives on the home screen, which is a little world: the letter tree, number pond, sound bell, word house and big pencil each open a set of games. Tap Pip to wake it up.
- The games are framed as helping Pip: feeding it letters, numbers and words, rebuilding words that fell apart, sorting out mixed-up sentences.
- Each finished round wins something for Pip's place: stickers she can drag around the yard, and now and then a new hat or colour for Pip.
- Pip's name can be changed on the grown-ups page.

## Your voice

Grown-ups page → **Record your voice**. You can record the 26 letter sounds, up to six praise clips, and a "round finished" cheer. Recordings are stored on the phone only (never in this repo, never uploaded). Recorded letter sounds are used when building words and matching sounds; praise clips replace the built-in "Yes!" lines.

## Grown-ups page

Hold the ⚙ on the home screen. It shows first-go scores and tricky items for every game, lets you set levels by hand, change the voice speed, and copy a progress summary.

Levels also adjust themselves: two strong rounds in a row moves up, a hard round moves back.

## Changing the content

Word lists, pictures, and sentences are all in `js/data.js`. Pip is drawn in `js/pal.js`. Game logic is in `js/app.js`. No build step.

Speech uses the phone's own text-to-speech voice. The Andika font is by SIL International (OFL, see `fonts/`).
