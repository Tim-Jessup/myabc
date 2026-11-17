# My ABC

Reading and writing games for little learners. A small installable web app: no accounts, no ads, no tracking, works offline.

**Play / install:** https://tim-jessup.github.io/myabc/

## One-time setup

1. On GitHub: **Settings → Pages → Build and deployment → Deploy from a branch**, pick `main` and `/ (root)`, then Save.
2. A minute later, open the link above in Chrome on the phone.
3. Chrome menu (⋮) → **Add to Home screen → Install**.

The app checks for a new version when it opens and whenever it comes back to the front, and reloads itself on the home screen. There is also a **Check for updates** button on the grown-ups page.

## How it works

Guidelines for development are in [CLAUDE.md](CLAUDE.md).

**The journey** opens the app: six areas (Sandy Beach, Fern Forest, Rocky Hills, Rainbow River, Snowy Mountain, Starry Sky) that teach letters in the order Australian schools use (s a t p, i n m d, g o c k, e u r h, b f l j, v w x y z q) with tricky words (I, the, to, no, go, he, she, we, me, was, you, my, are) along the way.

- **Introductions** teach one new thing: Pip shows it and shows it in a word, then she picks it from a set, traces it, says it out loud (it's recorded and played back to her, not checked), finds a picture that starts with it, and writes it from memory (👀 peeks and a faint guide help if she's stuck). Each one adds a prize to her collection.
- **Game events** in between practise one kind of thing (letter hunt, writing, sounds, spelling, reading, tricky words), using only what she has learned, dustiest first. Spelling and reading only use words made from her letters, and add those words to her collection.
- **Challenge gates** end each area with a mixed test and a big celebration (a new hat, colour or background).

**Flashcard learning.** Every skill is a card (seeing s, hearing s, writing s, reading "cat", spelling "cat"...). Cards come back after about 10 minutes, then 1, 3, 7, 14 and 30 days; a clean answer moves a card on, a mistake brings it back sooner.

**The prize room (🏆)** shows her whole collection. Prizes that are due for practice, or recently tripped her up, get dusty and cobwebby. "Polish my prizes" runs a short review of the dustiest ones, and each prize she cleans sparkles.

Free play (🌳) still has every game at any level.

## Pip's home

Stickers live in a sticker book along the bottom, with their names written underneath. Drag one up into the yard, drag it back down to put it away, or tidy everything up with the basket. Tap a sticker and it wiggles while Pip says its name. Food stickers can be fed to Pip. Pip can be moved around, and wears the hats, colours and backgrounds won on the journey. After two minutes here, Pip suggests playing a game for a new prize.

## The games

| Section | Game | Levels |
|---|---|---|
| Letters | Find the letter | capitals, small letters, look-alikes (b d p q) |
| Letters | Big and little | match capital to small, and back |
| Sounds | What does it start with? | 3 choices, 4 choices, last letter |
| Sounds | Find the picture | 3 or 4 pictures |
| Words | Read the word | short words, tricky choices, longer words |
| Words | Words to know | three sets of common words |
| Words | Build the word | exact letters, extra letters, longer words |
| Words | Make a sentence | three words, longer |
| Writing | Trace letters | small letters, capitals |
| Writing | Write letters | copy small letters, small letters from memory, copy capitals, capitals from memory |
| Writing | Write words | short words, longer words |

Wrong answers just fade out; there is no "fail".

## Pip the platypus

- Pip is a curious, kind friend who walks the journey with her and speaks as "I" (Pip's gender is left open).
- The games are framed as helping Pip: feeding Pip letters and words, rebuilding words that fell apart, sorting out mixed-up sentences.
- Free play (🌳) is a little world: the letter tree, sound bell, word house and big pencil each open a set of games.
- Pip's name can be changed on the grown-ups page.

## Your voice

Grown-ups page → **Record your voice**. You can record the 26 letter sounds, up to six praise clips, and a "round finished" cheer. Recordings are stored on the phone only (never in this repo, never uploaded). Recorded letter sounds are used when building words and matching sounds; praise clips replace the built-in "Yes!" lines.

## Grown-ups page

Hold the ⚙ on the home screen. It shows where she is on the journey (and can move her along), how many prizes she has and which are dusty, first-go scores for every game, and lets you set free-play levels, change the voice speed, and copy a progress summary.

Levels also adjust themselves: two strong rounds in a row moves up, a hard round moves back.

## Pip's voice

Everything Pip says is a real recording in `audio/` (one MP3 per line, about 900 of them), made with the open-source [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M) voice model (Apache-2.0). So the app sounds the same on every phone and browser and works offline, with no dependence on the phone's own text-to-speech. The phone's voice is only used as a fallback for a line that has no recording (for example if you rename Pip).

If you add or change lines in `js/lines.js` or words in `js/data.js`, run `tools/make_voice.py` to record the new lines (see the notes at the top of that file).

## Changing the content

Word lists, pictures, and sentences are all in `js/data.js`. Everything Pip says is in `js/lines.js`. Pip is drawn in `js/pal.js`, tracing is marked in `js/trace.js`, and the rest of the game logic is in `js/app.js`. No build step.

The Andika font is by SIL International (OFL, see `fonts/`).
