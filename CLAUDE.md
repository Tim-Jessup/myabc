# My ABC: guidelines for development

My ABC is a reading, writing and number app for a young child (about 4), played on an Android phone, with Pip the platypus as a friend. These guidelines decide what gets built and how. Follow them for every change.

## Guidelines

1. **Learning first, fun always.** Every activity teaches something. Rewards follow learning; they are never the point.
2. **Never punish.** No "wrong", no lost progress, no timers. A mistake is interesting, and just brings that card back sooner.
3. **Fair, forgiving checking.** Close enough counts (a letter drawn a little off the line passes). Leaving a part out (the dot on an i, the tail of a Q) does not. When in doubt, be fair to the child.
4. **No giveaway questions.** Every question has to make her think. If only one new letter is being taught, don't ask "what does this start with?" when the answer can only be that letter.
5. **One proven curriculum, in order.** Systematic synthetic phonics, as taught in Australian schools: letter sounds in teaching order (s a t p, i n m d, g o c k, ...), blending and spelling with only the letters already taught, then tricky (sight) words a few at a time. Numbers run alongside. A game type only appears once its prerequisites are learned.
6. **Pip is a curious, kind friend, not a teacher.** Pip speaks as "I" and never needs a pronoun (Pip's gender is deliberately left open). Instructions are short and always worded the same way; praise is varied. Wrong answers get kind, curious lines ("Ooh, tricky one! Try another.").
7. **Short sessions.** An event takes 3 to 5 minutes and always ends on a win.
8. **Grown-ups can see and steer.** The hold-to-open grown-ups page shows progress and dusty items, and can move her along.
9. **Private and offline.** No accounts, no tracking, no network calls beyond loading the app. Everything is stored on the phone (localStorage, IndexedDB). Voice recordings of the family never leave the phone.
10. **Test like a parent would.** Check every change for fairness and feel, not just "it runs": simulate sloppy tracing, wrong answers, scribbles and slow fingers.

## How the app is built

- **Plain HTML, CSS and JavaScript**, no build step, hosted on GitHub Pages as an installable PWA. `sw.js` caches everything for offline use and the app updates itself (see `checkUpdate` in `js/app.js`).
- `js/data.js`: word lists, pictures, sticker names, teaching order.
- `js/curriculum.js`: the sections of the journey, what each introduces, the prize for each item, and the generated list of events.
- `js/cards.js`: spaced repetition. Each skill is a card (`letter:s:see`, `letter:s:write`, `sight:the:see`, `word:cat:spell`, `number:3:count` ...). Cards sit in boxes 0 to 5 that come back after about 10 minutes, then 1, 3, 7, 14 and 30 days. Right first go moves a card up a box; right in the end (after a wrong try or a peek) drops it one box but still counts as done; a skip drops it two and leaves it dusty. "Dust" is how overdue a card is, or a miss not yet put right, and is what the prize room shows. Getting a prize's exercises right always polishes it: effort is rewarded, while the spacing quietly brings tricky things back sooner.
- `js/lines.js`: everything Pip says. Every line has a recording in `audio/` made by `tools/make_voice.py`; re-run it after adding or changing lines. The test checks that no spoken line lacks a recording.
- `js/trace.js`: marking for tracing and for writing from memory (see the notes at the top of that file).
- `js/pal.js`: Pip, drawn as SVG.
- `js/app.js`: screens and games.

## The journey

- **Introduction events** teach one new letter, number or tricky word in a fixed order: Pip shows it, shows it in a word, then she picks it from a set, traces it, says it (recorded and played back, not checked), finds the picture that starts with it (letters), and writes it from memory with hints. Finishing adds a matching prize to her collection and starts its cards.
- **Game events** focus on one kind of activity (letter hunt, sounds, writing, spelling, reading, counting, tricky words), built only from what she has learned, dustiest first.
- **Challenge gates** end each section: a mixed test of everything since the last gate, then a celebration and a big prize. Mistakes don't block her; they just make those prizes dusty.
- **The prize room** shows everything collected. "Polish" runs a short review of the dustiest cards, and each one cleaned sparkles.
- **Pip's home** holds stickers, hats, colours and backgrounds won along the way. After two minutes there, Pip suggests playing a game.

## Testing

Headless Chrome via Playwright drives the real app: play every event of the journey, every free-play game at every level, the prize room and polishing, and check for page errors, stuck screens and unrecorded lines. Tracing and writing changes also get a simulation over every letter and number (wobbly, off-line, wrong letter, scribble) before and after.
