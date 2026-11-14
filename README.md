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

Each round ends with a sticker. Wrong answers just fade out; there is no "fail".

## Grown-ups page

Hold the ⚙ on the home screen. It shows first-go scores and tricky items for every game, lets you set levels by hand, change the voice speed, and copy a progress summary.

Levels also adjust themselves: two strong rounds in a row moves up, a hard round moves back.

## Changing the content

Word lists, pictures, and sentences are all in `js/data.js`. Game logic is in `js/app.js`. No build step.

Speech uses the phone's own text-to-speech voice. The Andika font is by SIL International (OFL, see `fonts/`).
