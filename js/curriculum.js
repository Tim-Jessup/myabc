// The journey. Sections follow systematic synthetic phonics as taught in Australian schools:
// letter sounds in teaching order, words built only from letters already taught, tricky
// (sight) words a few at a time once blending has started.
// Each section ends in a challenge gate. Edit SECTIONS to change what is taught and when.
const CURRICULUM = (() => {
  const D = DATA;

  const SECTIONS = [
    { name: 'Sandy Beach', icon: '🏖️', letters: ['s', 'a', 't', 'p'], sight: [] },
    { name: 'Fern Forest', icon: '🌿', letters: ['i', 'n', 'm', 'd'], sight: ['I'] },
    { name: 'Rocky Hills', icon: '⛰️', letters: ['g', 'o', 'c', 'k'], sight: ['the', 'to'] },
    { name: 'Rainbow River', icon: '🌈', letters: ['e', 'u', 'r', 'h'], sight: ['no', 'go'] },
    { name: 'Snowy Mountain', icon: '🏔️', letters: ['b', 'f', 'l', 'j'], sight: ['he', 'she', 'we', 'me'] },
    { name: 'Starry Sky', icon: '🌙', letters: ['v', 'w', 'x', 'y', 'z', 'q'], sight: ['was', 'you', 'my', 'are'] }
  ];
  // Numbers used to be taught alongside (until Nov 2026). Kept only so an older journey can be
  // carried over to the new one (see the migration at the end of js/app.js).
  const OLD_NUMBERS = [['1', '2', '3'], ['4', '5'], ['6', '7'], ['8', '9', '10'], ['0'], []];

  // a prize for every letter, of something that starts with it (x: something with x in it)
  const LETTER_PRIZE = {
    s: ['🐍', 'snake'], a: ['🍎', 'apple'], t: ['🐯', 'tiger'], p: ['🐷', 'pig'], i: ['🦎', 'iguana'], n: ['🪺', 'nest'],
    m: ['🐒', 'monkey'], d: ['🦕', 'dinosaur'], g: ['🦒', 'giraffe'], o: ['🐙', 'octopus'], c: ['🐱', 'cat'], k: ['🪁', 'kite'],
    e: ['🐘', 'elephant'], u: ['☂️', 'umbrella'], r: ['🌈', 'rainbow'], h: ['🐴', 'horse'], b: ['🐻', 'bear'], f: ['🐸', 'frog'],
    l: ['🦁', 'lion'], j: ['🧃', 'juice'], v: ['🎻', 'violin'], w: ['🐋', 'whale'], x: ['📦', 'box'], y: ['🪀', 'yo-yo'],
    z: ['🦓', 'zebra'], q: ['👑', 'queen']
  };
  // a word that shows each letter (it's highlighted in the word when the letter is introduced)
  const LETTER_WORD = Object.fromEntries(Object.entries(LETTER_PRIZE).map(([l, [e, w]]) => [l, [w, e]]));

  const GAME_TYPES = ['hunt', 'writing', 'sounds', 'spelling', 'reading', 'sight'];
  const GAME_INFO = {
    hunt: { icon: '🔎', name: 'Letter hunt' },
    writing: { icon: '✏️', name: 'Writing' },
    sounds: { icon: '👂', name: 'Sounds' },
    spelling: { icon: '🧩', name: 'Spelling' },
    reading: { icon: '📖', name: 'Reading' },
    sight: { icon: '💎', name: 'Tricky words' }
  };

  // words she can spell or read using only the letters she has
  const wordsFrom = letters => D.CVC.filter(([w]) => [...w].every(c => letters.includes(c))).map(x => x[0]);

  function available(known) {
    const L = known.letters, out = [];
    if (L.length >= 2) out.push('hunt');
    if (L.length >= 2) out.push('writing');
    if (L.filter(l => D.START[l]).length >= 2) out.push('sounds');
    if (wordsFrom(L).length >= 2) out.push('spelling');
    if (wordsFrom(L).length >= 3) out.push('reading');
    if (known.sight.length >= 2) out.push('sight');
    return out;
  }

  // the list of events, in order: introductions, a game after every two, a gate per section
  function buildEvents(numbers) {
    const ev = [], known = { letters: [], numbers: [], sight: [] }, used = {};
    const types = numbers ? ['hunt', 'writing', 'sounds', 'spelling', 'reading', 'counting', 'sight'] : GAME_TYPES;
    let sinceGame = 0;
    SECTIONS.forEach((sec, si) => {
      const intros = [];
      sec.letters.forEach((l, i) => {
        intros.push({ type: 'letter', v: l });
        if (i === 1 && numbers) numbers[si].forEach(n => intros.push({ type: 'number', v: n }));
        if (i === 2) sec.sight.forEach(w => intros.push({ type: 'sight', v: w }));
      });
      if (sec.letters.length < 3) sec.sight.forEach(w => intros.push({ type: 'sight', v: w }));
      intros.forEach(item => {
        ev.push({ kind: 'intro', item, section: si });
        known[{ letter: 'letters', number: 'numbers', sight: 'sight' }[item.type]].push(item.v);
        if (++sinceGame >= 2) {
          let can = available(known);
          if (numbers) { // the old rules: numbers counted towards writing, and had their own game
            if (!can.includes('writing') && known.letters.length + known.numbers.length >= 2) can.splice(1, 0, 'writing');
            if (known.numbers.length >= 2) can.push('counting');
          }
          if (can.length) {
            const game = can.slice().sort((a, b) => (used[a] || 0) - (used[b] || 0) || types.indexOf(a) - types.indexOf(b))[0];
            used[game] = (used[game] || 0) + 1;
            ev.push({ kind: 'game', game, section: si });
            sinceGame = 0;
          }
        }
      });
      ev.push({ kind: 'gate', section: si });
      sinceGame = 0;
    });
    return ev;
  }
  const EVENTS = buildEvents(null);
  const OLD_EVENTS = () => buildEvents(OLD_NUMBERS);

  const itemKey = it => `${it.type}:${it.v}`;
  function prizeOf(it) {
    if (it.type === 'letter') return { e: LETTER_PRIZE[it.v][0], label: it.v + ' ' + it.v.toUpperCase() };
    if (it.type === 'sight') return { e: '💎', label: it.v };
    const p = D.CVC.find(x => x[0] === it.v);
    return { e: p ? p[1] : '⭐', label: it.v };
  }

  return { SECTIONS, EVENTS, OLD_EVENTS, LETTER_PRIZE, LETTER_WORD, GAME_INFO, wordsFrom, itemKey, prizeOf };
})();
