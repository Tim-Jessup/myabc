# My ABC

Reading and writing games for little learners. A small installable web app: no accounts, no ads, no tracking, works offline.

**Play / install:** https://tim-jessup.github.io/myabc/

## One-time setup

1. On GitHub: **Settings → Pages → Build and deployment → Deploy from a branch**, pick `main` and `/ (root)`, then Save.
2. A minute later, open the link above in Chrome on the phone.
3. Chrome menu (⋮) → **Add to Home screen → Install**.

The app checks for a new version when it opens and whenever it comes back to the front, and reloads itself on the home screen. There is also a **Check for updates** button on the grown-ups page.

## Pip's path

The app opens on Pip's path: a trail of stops in the order letters are usually taught in Australian schools (s a t p i n m d g o c k e u r h b f l j v w x y z q).

- **Letter stops** mix a few activities around one letter: find it, match big and little, hear what starts with it, and write it.
- **Word stops** come every few letters and only use letters met so far (pin, tap, ant after the first six).
- **Number stops** and **words-to-know stops** come in between, and the path ends with sentences.
- **Writing** each letter moves from tracing, to copying it from a model, to writing it from memory, as she manages each one without help. Each stop also reviews a letter she has found tricky.
- Every stop wins a sticker. Every fifth stop wins something bigger: a new hat, a new colour for Pip, or a new background for Pip's place.

Free play (🌳) still has every game at any level. The grown-ups page shows where she is on the path, can move her forward or back, and lists which letters she copies or writes from memory.

## Pip's place

Stickers live in a sticker book along the bottom, with their names written underneath. Drag one up into the yard, drag it back down to put it away, or tidy everything up with the basket. Tap a sticker and it wiggles while Pip says its name. Food stickers can be fed to Pip. Pip can be moved around, and wears the hats, colours and backgrounds won on the path.

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
| Writing | Write letters | copy small letters, small letters from memory, copy capitals, capitals from memory |
| Writing | Write numbers | trace, copy, from memory |
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

## Pip's voice

Everything Pip says is a real recording in `audio/` (one MP3 per line, about 900 of them), made with the open-source [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M) voice model (Apache-2.0). So the app sounds the same on every phone and browser and works offline, with no dependence on the phone's own text-to-speech. The phone's voice is only used as a fallback for a line that has no recording (for example if you rename Pip).

If you add or change lines in `js/lines.js` or words in `js/data.js`, run `tools/make_voice.py` to record the new lines (see the notes at the top of that file).

## Changing the content

Word lists, pictures, and sentences are all in `js/data.js`. Everything Pip says is in `js/lines.js`. Pip is drawn in `js/pal.js`, tracing is marked in `js/trace.js`, and the rest of the game logic is in `js/app.js`. No build step.

The Andika font is by SIL International (OFL, see `fonts/`).
