'use strict';
(() => {
  const D = DATA;
  const $app = document.getElementById('app');

  /* ---------- storage ---------- */
  const KEY = 'myabc.v1';
  const store = { games: {}, items: {}, stickers: [], settings: { rate: 0.85, sfx: true } };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved) {
      Object.assign(store, saved);
      store.settings = Object.assign({ rate: 0.85, sfx: true }, saved.settings || {});
    }
  } catch (e) { /* start fresh */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* full or private mode */ } };

  /* ---------- helpers ---------- */
  const rnd = n => Math.floor(Math.random() * n);
  const one = a => a[rnd(a.length)];
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const others = (pool, n, bad) => shuffle(pool.filter(x => !bad.includes(x))).slice(0, n);

  /* ---------- speech + sound ---------- */
  let voice = null;
  const hasSpeech = 'speechSynthesis' in window;
  function pickVoice() {
    if (!hasSpeech) return;
    const vs = speechSynthesis.getVoices();
    for (const want of ['en-AU', 'en-NZ', 'en-GB', 'en']) {
      const v = vs.find(x => x.lang.replace('_', '-').startsWith(want));
      if (v) { voice = v; return; }
    }
  }
  if (hasSpeech) { pickVoice(); speechSynthesis.addEventListener('voiceschanged', pickVoice); }

  function say(text) {
    return new Promise(res => {
      if (!hasSpeech || !text) return res();
      let done = false;
      const fin = () => { if (!done) { done = true; res(); } };
      try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = 'en-AU';
        u.rate = store.settings.rate;
        u.onend = fin; u.onerror = fin;
        speechSynthesis.speak(u);
      } catch (e) { fin(); }
      setTimeout(fin, 1500 + text.length * 120); // never hang if the phone stays silent
    });
  }

  let actx = null;
  function tone(freqs, dur = 0.13, type = 'sine', vol = 0.18) {
    if (!store.settings.sfx) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      freqs.forEach((f, i) => {
        const o = actx.createOscillator(), g = actx.createGain();
        const t = actx.currentTime + i * dur * 0.9;
        o.type = type; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.6);
        o.connect(g).connect(actx.destination);
        o.start(t); o.stop(t + dur * 1.7);
      });
    } catch (e) { /* no audio */ }
  }
  const chime = () => tone([660, 880]);
  const boop = () => tone([220], 0.12, 'triangle', 0.12);
  const tap = () => tone([520], 0.05, 'sine', 0.08);
  const fanfare = () => tone([523, 659, 784, 1047], 0.16);

  /* ---------- item picking (things she finds tricky come back more often) ---------- */
  const itemStat = (id, key) => store.items[id + '|' + key] || [0, 0];
  function choose(id, pool, keyOf = x => String(x)) {
    const used = run.used;
    let cands = pool.filter(x => !used.has(keyOf(x)));
    if (!cands.length) { used.clear(); cands = pool; }
    const w = cands.map(x => { const [seen, missed] = itemStat(id, keyOf(x)); return 1 + 3 * missed / (seen + 1) + (seen ? 0 : 0.5); });
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    let pick = cands[cands.length - 1];
    for (let i = 0; i < cands.length; i++) { r -= w[i]; if (r <= 0) { pick = cands[i]; break; } }
    used.add(keyOf(pick));
    return pick;
  }

  /* ---------- the games ---------- */
  const ltr = c => `<span class="ltr">${esc(c)}</span>`;
  const pic = e => `<span class="pic">${e}</span>`;
  const SOUND_ALIKE = { c: ['k', 'q', 's'], k: ['c', 'q'], q: ['c', 'k'], s: ['c', 'z'], z: ['s'], j: ['g'], g: ['j'], i: ['e', 'y'], e: ['i'], u: ['a', 'o', 'y'], y: ['u', 'i', 'w'], w: ['y'], a: ['u'], o: ['u'], f: ['v'], v: ['f'] };
  const startLetters = Object.keys(D.START);
  const wordPic = Object.fromEntries(D.CVC.concat(D.LONGER));

  const SECTIONS = [
    { id: 'letters', name: 'Letters' },
    { id: 'numbers', name: 'Numbers' },
    { id: 'sounds', name: 'Sounds' },
    { id: 'words', name: 'Words' },
    { id: 'writing', name: 'Writing' }
  ];

  const GAMES = [
    {
      id: 'findLetter', sec: 'letters', icon: 'A', name: 'Find the letter',
      levels: ['Capitals', 'Small letters', 'Look-alikes'],
      make(lv) {
        const pool = lv === 0 ? D.UPPER : D.LOWER;
        const t = choose(this.id + lv, pool);
        let wrong;
        if (lv === 2) wrong = one(D.CONFUSABLE.filter(g => g.includes(t))).filter(x => x !== t);
        else wrong = others(pool, 3, [t]);
        return {
          type: 'pick', key: t, cols: 2,
          say: `Find the letter ${t.toUpperCase()}.`,
          choices: shuffle([{ html: ltr(t), ok: true }].concat(wrong.map(x => ({ html: ltr(x) }))))
        };
      }
    },
    {
      id: 'matchCase', sec: 'letters', icon: 'Aa', name: 'Big and little',
      levels: ['Find the little one', 'Find the big one'],
      make(lv) {
        const t = choose(this.id + lv, D.LOWER);
        const T = t.toUpperCase();
        const show = lv === 0 ? T : t;
        const conv = x => (lv === 0 ? x : x.toUpperCase());
        return {
          type: 'pick', key: t, cols: 2,
          say: lv === 0 ? `This is big ${T}. Find little ${T}.` : `This is little ${T}. Find big ${T}.`,
          stim: `<div class="stim-letter">${esc(show)}</div>`,
          choices: shuffle([{ html: ltr(conv(t)), ok: true }].concat(others(D.LOWER, 3, [t]).map(x => ({ html: ltr(conv(x)) }))))
        };
      }
    },
    {
      id: 'findNumber', sec: 'numbers', icon: '12', name: 'Find the number',
      levels: ['0 to 10', '0 to 20', 'Up to 99'],
      make(lv) {
        const pool = [];
        const [lo, hi] = [[0, 10], [0, 20], [10, 99]][lv];
        for (let i = lo; i <= hi; i++) pool.push(i);
        const t = choose(this.id + lv, pool);
        const near = new Set();
        if (t > 9) near.add(+String(t).split('').reverse().join(''));
        [t + 1, t - 1, t + 10, t - 10].forEach(x => near.add(x));
        let wrong = shuffle([...near].filter(x => x !== t && x >= lo && x <= hi)).slice(0, 2);
        wrong = wrong.concat(others(pool, 3 - wrong.length, [t, ...wrong]));
        return {
          type: 'pick', key: t, cols: 2,
          say: `Find the number ${t}.`,
          choices: shuffle([{ html: ltr(t), ok: true }].concat(wrong.map(x => ({ html: ltr(x) }))))
        };
      }
    },
    {
      id: 'count', sec: 'numbers', icon: '🐞', name: 'How many?',
      levels: ['1 to 5', '1 to 10', '6 to 20'],
      make(lv) {
        const [lo, hi] = [[1, 5], [1, 10], [6, 20]][lv];
        const pool = [];
        for (let i = lo; i <= hi; i++) pool.push(i);
        const t = choose(this.id + lv, pool);
        const nearby = [t - 2, t - 1, t + 1, t + 2].filter(x => x >= Math.max(1, lo - 1) && x <= hi + 1);
        const wrong = shuffle(nearby).slice(0, lv === 0 ? 2 : 3);
        const e = one(D.COUNTABLES);
        return {
          type: 'pick', key: t, cols: lv === 0 ? 3 : 2, small: true,
          say: 'How many? Count them.',
          stim: `<div class="count-box n${t > 10 ? 'big' : 'small'}">${Array(t).fill(`<span>${e}</span>`).join('')}</div>`,
          after: String(t),
          choices: [t, ...wrong].sort((a, b) => a - b).map(x => ({ html: ltr(x), ok: x === t }))
        };
      }
    },
    {
      id: 'firstSound', sec: 'sounds', icon: '🍎', name: 'What does it start with?',
      levels: ['3 choices', '4 choices', 'Last letter'],
      make(lv) {
        let word, emoji, t;
        if (lv < 2) {
          t = choose(this.id, startLetters);
          [word, emoji] = one(D.START[t]);
        } else {
          [word, emoji] = choose(this.id + lv, D.CVC, x => x[0]);
          t = word[word.length - 1];
        }
        const wrong = others(D.LOWER, lv === 0 ? 2 : 3, [t, 'x'].concat(SOUND_ALIKE[t] || []));
        return {
          type: 'pick', key: lv < 2 ? t : word, cols: lv === 0 ? 3 : 2, small: true,
          say: lv < 2 ? `${word}. What letter does ${word} start with?` : `${word}. What letter is at the end of ${word}?`,
          stim: `<div class="stim-pic">${emoji}</div>`, stimSay: word,
          after: lv < 2 ? `${t.toUpperCase()}, for ${word}.` : `${word} ends with ${t.toUpperCase()}.`,
          choices: shuffle([{ html: ltr(t), ok: true }].concat(wrong.map(x => ({ html: ltr(x) }))))
        };
      }
    },
    {
      id: 'soundPic', sec: 'sounds', icon: '🐝', name: 'Find the picture',
      levels: ['3 pictures', '4 pictures'],
      make(lv) {
        const t = choose(this.id, startLetters);
        const [word, emoji] = one(D.START[t]);
        const wrong = others(startLetters, lv === 0 ? 2 : 3, [t].concat(SOUND_ALIKE[t] || [])).map(l => one(D.START[l]));
        return {
          type: 'pick', key: t, cols: lv === 0 ? 3 : 2, small: lv === 0,
          say: `Which one starts with ${t.toUpperCase()}?`,
          stim: `<div class="stim-letter">${t.toUpperCase()}<span>${t}</span></div>`,
          after: `${word} starts with ${t.toUpperCase()}.`,
          choices: shuffle([{ html: pic(emoji), ok: true, say: word }].concat(wrong.map(([w, e]) => ({ html: pic(e), say: w }))))
        };
      }
    },
    {
      id: 'readWord', sec: 'words', icon: '📖', name: 'Read the word',
      levels: ['Short words', 'Tricky choices', 'Longer words'],
      make(lv) {
        const pool = lv === 2 ? D.LONGER : D.CVC;
        const [word, emoji] = choose(this.id + lv, pool, x => x[0]);
        let wrong = [];
        if (lv === 1) wrong = shuffle(pool.filter(x => x[0] !== word && (x[0][0] === word[0] || x[0].slice(1) === word.slice(1)))).slice(0, 3);
        const n = lv === 0 ? 2 : 3;
        wrong = wrong.concat(others(pool, n - wrong.length, [pool.find(x => x[0] === word), ...wrong])).filter(x => x[1] !== emoji);
        return {
          type: 'pick', key: word, cols: lv === 0 ? 3 : 2, small: lv === 0,
          say: 'Read the word. Which picture is it?',
          stim: `<div class="stim-word">${esc(word)}</div>`, stimSay: word, stimHelps: true,
          after: word,
          choices: shuffle([{ html: pic(emoji), ok: true }].concat(wrong.map(([w, e]) => ({ html: pic(e), say: w }))))
        };
      }
    },
    {
      id: 'sightWords', sec: 'words', icon: 'the', name: 'Words to know',
      levels: ['First words', 'More words', 'Harder words'],
      make(lv) {
        const t = choose(this.id + lv, D.SIGHT[lv]);
        const pool = D.SIGHT.slice(0, lv + 1).flat();
        return {
          type: 'pick', key: t, cols: 2,
          say: `Find the word: ${t}.`,
          choices: shuffle([{ html: `<span class="wrd">${esc(t)}</span>`, ok: true }].concat(others(pool, 3, [t]).map(x => ({ html: `<span class="wrd">${esc(x)}</span>` }))))
        };
      }
    },
    {
      id: 'buildWord', sec: 'words', icon: '🧩', name: 'Build the word',
      levels: ['Just the letters', 'Extra letters', 'Longer words'],
      make(lv) {
        const [word, emoji] = choose(this.id + lv, lv === 2 ? D.LONGER : D.CVC, x => x[0]);
        const letters = word.split('');
        const extra = lv === 0 ? [] : others(D.LOWER, 2, letters);
        return {
          type: 'build', key: word,
          say: `${word}. Spell ${word}.`,
          stim: `<div class="stim-pic">${emoji}</div>`, stimSay: word,
          answer: letters, tiles: shuffle(letters.concat(extra)), after: word, letters: true
        };
      }
    },
    {
      id: 'sentence', sec: 'words', icon: '💬', name: 'Make a sentence',
      levels: ['Three words', 'Longer'],
      make(lv) {
        const s = choose(this.id + lv, D.SENTENCES[lv]);
        const words = s.split(' ');
        let tiles = shuffle(words);
        if (tiles.join(' ') === s) tiles = tiles.reverse();
        return { type: 'build', key: s, say: s + '.', answer: words, tiles, after: s + '.', letters: false };
      }
    },
    {
      id: 'traceLetters', sec: 'writing', icon: '✏️', name: 'Trace letters', n: 6,
      levels: ['Small letters', 'Capitals'],
      make(lv) {
        const t = choose(this.id + lv, lv === 0 ? D.LOWER : D.UPPER);
        return { type: 'trace', key: t, glyphs: [t], say: `Trace the letter ${t.toUpperCase()}.` };
      }
    },
    {
      id: 'traceNumbers', sec: 'writing', icon: '5', name: 'Trace numbers', n: 6,
      levels: ['0 to 9'],
      make() {
        const t = choose(this.id, '0123456789'.split(''));
        return { type: 'trace', key: t, glyphs: [t], say: `Trace the number ${t}.` };
      }
    },
    {
      id: 'traceWords', sec: 'writing', icon: '📝', name: 'Write words', n: 3,
      levels: ['Short words', 'Longer words'],
      make(lv) {
        const [word, emoji] = choose(this.id + lv, lv === 0 ? D.CVC : D.LONGER, x => x[0]);
        return { type: 'trace', key: word, glyphs: word.split(''), word, emoji, say: `Write the word ${word}.`, after: word };
      }
    }
  ];
  const byId = Object.fromEntries(GAMES.map(g => [g.id, g]));
  const gstat = id => (store.games[id] = store.games[id] || { level: 0, rounds: [] });

  /* ---------- screens ---------- */
  let run = { used: new Set() };
  let runId = 0;
  const alive = id => id === runId;

  function home() {
    runId++;
    if (hasSpeech) speechSynthesis.cancel();
    const cards = sec => GAMES.filter(g => g.sec === sec.id).map(g => {
      const st = gstat(g.id);
      const pips = g.levels.map((_, i) => `<i class="${i <= st.level ? 'on' : ''}"></i>`).join('');
      return `<button class="card" data-game="${g.id}">
        <span class="card-icon ${/^[\w]+$/.test(g.icon) ? 'txt' : ''}">${g.icon}</span>
        <span class="card-name">${esc(g.name)}</span>
        <span class="pips">${pips}</span>
      </button>`;
    }).join('');
    $app.innerHTML = `
      <div class="screen home">
        <header class="home-top">
          <h1>My <b>A</b><b>B</b><b>C</b></h1>
          <div class="home-btns">
            <button class="chip" id="stickers">${store.stickers.length ? store.stickers[store.stickers.length - 1] : '⭐'} <span>${store.stickers.length}</span></button>
            <button class="chip quiet" id="grown" aria-label="Grown-ups (hold)">⚙</button>
          </div>
        </header>
        ${SECTIONS.map(s => `<section class="sec sec-${s.id}"><h2>${s.name}</h2><div class="cards">${cards(s)}</div></section>`).join('')}
        <p class="foot">Hold ⚙ for the grown-ups page</p>
      </div>`;
    $app.querySelectorAll('.card').forEach(b => b.onclick = () => { tap(); startGame(b.dataset.game); });
    $app.querySelector('#stickers').onclick = stickerBook;
    const g = $app.querySelector('#grown');
    let timer = null;
    g.onpointerdown = () => { timer = setTimeout(() => { timer = null; grownups(); }, 650); };
    g.onpointerup = g.onpointerleave = () => { if (timer) { clearTimeout(timer); timer = null; } };
    g.oncontextmenu = e => e.preventDefault();
  }

  function pushNav() { try { history.pushState({ in: 1 }, ''); } catch (e) { /* ignore */ } }
  window.addEventListener('popstate', home);
  const goHome = () => { if (history.state && history.state.in) history.back(); else home(); };

  function stickerBook() {
    pushNav();
    $app.innerHTML = `
      <div class="screen book">
        <div class="bar"><button class="round" id="x" aria-label="Back">←</button><h2>My stickers</h2><span></span></div>
        <div class="stickers">${store.stickers.length ? store.stickers.map(s => `<span>${s}</span>`).join('') : '<p class="empty">Finish a game to get your first sticker!</p>'}</div>
      </div>`;
    $app.querySelector('#x').onclick = goHome;
  }

  /* ---------- running a round ---------- */
  function startGame(id) {
    const g = byId[id];
    const st = gstat(id);
    st.level = Math.min(st.level, g.levels.length - 1);
    pushNav();
    run = { g, level: st.level, i: 0, n: g.n || 8, first: 0, used: new Set(), id: ++runId, marks: [] };
    nextQ();
  }

  function shell(body) {
    const { g, level, i, n, marks } = run;
    const dots = Array.from({ length: n }, (_, k) => `<i class="${k < i ? (marks[k] ? 'gold' : 'done') : k === i ? 'now' : ''}"></i>`).join('');
    $app.innerHTML = `
      <div class="screen game sec-${g.sec}">
        <div class="bar">
          <button class="round" id="x" aria-label="Home">✕</button>
          <div class="dots">${dots}</div>
          <button class="lvl" id="lvl" aria-label="Change level">Level ${level + 1}</button>
        </div>
        ${body}
      </div>`;
    $app.querySelector('#x').onclick = goHome;
    $app.querySelector('#lvl').onclick = levelSheet;
  }

  function levelSheet() {
    const { g } = run;
    const d = document.createElement('div');
    d.className = 'sheet';
    d.innerHTML = `<div class="sheet-box"><h3>${esc(g.name)}</h3>
      ${g.levels.map((l, i) => `<button data-l="${i}" class="${i === run.level ? 'on' : ''}"><b>${i + 1}</b> ${esc(l)}</button>`).join('')}
      <button class="cancel">Close</button></div>`;
    d.onclick = e => {
      const b = e.target.closest('button');
      if (b && b.dataset.l !== undefined) {
        gstat(g.id).level = +b.dataset.l; save();
        d.remove();
        run = { g, level: +b.dataset.l, i: 0, n: g.n || 8, first: 0, used: new Set(), id: ++runId, marks: [] };
        nextQ();
      } else if (!e.target.closest('.sheet-box') || b) d.remove();
    };
    document.body.appendChild(d);
  }

  function nextQ() {
    if (run.i >= run.n) return finish();
    const q = run.g.make(run.level);
    run.q = q;
    run.clean = true;
    ({ pick: renderPick, build: renderBuild, trace: renderTrace })[q.type](q);
    say(q.say);
  }

  async function answered(q, speakAfter = true) {
    const id = run.id;
    const st = (store.items[run.g.id + '|' + q.key] = itemStat(run.g.id, q.key));
    st[0]++; if (!run.clean) st[1]++;
    run.marks[run.i] = run.clean;
    if (run.clean) run.first++;
    save();
    chime();
    await Promise.all([speakAfter ? say(q.after || one(D.PRAISE)) : null, wait(850)]);
    if (!alive(id)) return;
    run.i++;
    nextQ();
  }

  const promptBtn = `<button class="speak" id="speak" aria-label="Hear it again">🔊</button>`;
  function wireCommon(q) {
    const sp = $app.querySelector('#speak');
    if (sp) sp.onclick = () => say(q.say);
    const stim = $app.querySelector('.stim');
    if (stim && q.stimSay) stim.onclick = () => { if (q.stimHelps) run.clean = false; say(q.stimSay); };
  }

  function renderPick(q) {
    shell(`
      <div class="prompt">${promptBtn}</div>
      ${q.stim ? `<div class="stim ${q.stimSay ? 'tappable' : ''}">${q.stim}</div>` : '<div class="stim-gap"></div>'}
      <div class="choices cols-${q.cols} ${q.small ? 'small' : ''}">
        ${q.choices.map((c, i) => `<button class="choice" data-i="${i}">${c.html}</button>`).join('')}
      </div>`);
    wireCommon(q);
    let locked = false;
    $app.querySelectorAll('.choice').forEach(b => b.onclick = () => {
      if (locked || b.disabled) return;
      const c = q.choices[+b.dataset.i];
      if (c.ok) {
        locked = true;
        b.classList.add('yes');
        answered(q);
      } else {
        run.clean = false;
        b.classList.add('nope'); b.disabled = true;
        boop();
        if (c.say) say(c.say);
      }
    });
  }

  function renderBuild(q) {
    shell(`
      <div class="prompt">${promptBtn}</div>
      ${q.stim ? `<div class="stim tappable">${q.stim}</div>` : '<div class="stim-gap"></div>'}
      <div class="slots ${q.letters ? 'letters' : 'wordsy'}">${q.answer.map(() => '<span class="slot"></span>').join('')}</div>
      <div class="tiles ${q.letters ? 'letters' : 'wordsy'}">${q.tiles.map((t, i) => `<button class="tile" data-i="${i}">${esc(t)}</button>`).join('')}</div>`);
    wireCommon(q);
    let pos = 0;
    const slots = $app.querySelectorAll('.slot');
    $app.querySelectorAll('.tile').forEach(b => b.onclick = () => {
      if (b.disabled || pos >= q.answer.length) return;
      const t = q.tiles[+b.dataset.i];
      if (t === q.answer[pos]) {
        slots[pos].textContent = t; slots[pos].classList.add('full');
        b.disabled = true; b.classList.add('used');
        pos++;
        if (pos === q.answer.length) answered(q);
        else { tap(); say(q.letters ? t.toUpperCase() : t); }
      } else {
        run.clean = false;
        boop();
        b.classList.remove('wob'); void b.offsetWidth; b.classList.add('wob');
      }
    });
  }

  /* ---------- tracing ---------- */
  const FONT = px => `700 ${px}px Andika, "Comic Sans MS", sans-serif`;
  function renderTrace(q) {
    const S = Math.round(Math.min(window.innerWidth - 32, window.innerHeight * 0.56, 460));
    shell(`
      <div class="prompt">${promptBtn}${q.word ? `<div class="trace-word"><span class="tw-pic">${q.emoji}</span>${q.glyphs.map(g => `<b>${esc(g)}</b>`).join('')}</div>` : ''}</div>
      <div class="pad" style="width:${S}px;height:${S}px">
        <canvas id="guide"></canvas><canvas id="ink"></canvas>
      </div>
      <div class="trace-btns">
        <button class="round big" id="clear" aria-label="Rub out">🧽</button>
        <button class="round big" id="skip" aria-label="Skip">➜</button>
      </div>`);
    wireCommon(q);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const guide = $app.querySelector('#guide'), ink = $app.querySelector('#ink');
    [guide, ink].forEach(c => { c.width = c.height = S * dpr; c.style.width = c.style.height = S + 'px'; });
    const gc = guide.getContext('2d'), ic = ink.getContext('2d');
    gc.scale(dpr, dpr); ic.scale(dpr, dpr);
    const M = 96; // small hidden canvases used to mark the tracing
    const mk = () => { const c = document.createElement('canvas'); c.width = c.height = M; return c.getContext('2d', { willReadFrequently: true }); };
    const maskC = mk(), tolC = mk(), inkC = mk();
    let gi = 0, glyphPx = null, tolPx = null, glyphCount = 0, busy = false, last = null;
    const id = run.id;

    function drawGlyph(ctx, size, ch, stroke) {
      const fs = size * 0.62;
      ctx.font = FONT(fs);
      ctx.textBaseline = 'alphabetic';
      const w = ctx.measureText(ch).width;
      const x = (size - w) / 2, y = size * 0.67;
      if (stroke) { ctx.lineWidth = stroke; ctx.lineJoin = 'round'; ctx.strokeText(ch, x, y); }
      ctx.fillText(ch, x, y);
      return fs;
    }

    function setGlyph() {
      const ch = q.glyphs[gi];
      gc.clearRect(0, 0, S, S);
      ic.clearRect(0, 0, S, S);
      inkC.clearRect(0, 0, M, M);
      // writing lines
      const fs = S * 0.62;
      gc.font = FONT(fs);
      const xh = gc.measureText('x').actualBoundingBoxAscent || fs * 0.5;
      const base = S * 0.67;
      gc.lineWidth = 2;
      gc.strokeStyle = '#B9C4DD'; gc.setLineDash([]);
      gc.beginPath(); gc.moveTo(12, base); gc.lineTo(S - 12, base); gc.stroke();
      gc.strokeStyle = '#D5DCEC'; gc.setLineDash([8, 8]);
      gc.beginPath(); gc.moveTo(12, base - xh); gc.lineTo(S - 12, base - xh); gc.stroke();
      gc.setLineDash([]);
      gc.fillStyle = '#D9E2F3';
      drawGlyph(gc, S, ch);
      // marking masks
      maskC.clearRect(0, 0, M, M); tolC.clearRect(0, 0, M, M);
      maskC.fillStyle = tolC.fillStyle = tolC.strokeStyle = '#000';
      drawGlyph(maskC, M, ch);
      drawGlyph(tolC, M, ch, M * 0.2);
      glyphPx = maskC.getImageData(0, 0, M, M).data;
      tolPx = tolC.getImageData(0, 0, M, M).data;
      glyphCount = 0;
      for (let i = 3; i < glyphPx.length; i += 4) if (glyphPx[i] > 100) glyphCount++;
      window.MYABC_TRACE = { M, S, glyphPx };
      $app.querySelectorAll('.trace-word b').forEach((b, k) => { b.className = k < gi ? 'done' : k === gi ? 'now' : ''; });
    }

    function seg(a, b) {
      ic.strokeStyle = '#3B3A6B'; ic.lineCap = ic.lineJoin = 'round'; ic.lineWidth = S * 0.085;
      ic.beginPath(); ic.moveTo(a.x, a.y); ic.lineTo(b.x, b.y); ic.stroke();
      const k = M / S;
      inkC.strokeStyle = '#000'; inkC.lineCap = inkC.lineJoin = 'round'; inkC.lineWidth = M * 0.1;
      inkC.beginPath(); inkC.moveTo(a.x * k, a.y * k); inkC.lineTo(b.x * k, b.y * k); inkC.stroke();
    }

    function dot(p) { // a tap leaves a dot, so i and j can be finished
      const k = M / S;
      ic.fillStyle = '#3B3A6B';
      ic.beginPath(); ic.arc(p.x, p.y, S * 0.0425, 0, 7); ic.fill();
      inkC.fillStyle = '#000';
      inkC.beginPath(); inkC.arc(p.x * k, p.y * k, M * 0.05, 0, 7); inkC.fill();
    }

    function check() {
      const px = inkC.getImageData(0, 0, M, M).data;
      let hit = 0, inkN = 0, stray = 0;
      for (let i = 3; i < px.length; i += 4) {
        const on = px[i] > 100;
        if (on) { inkN++; if (tolPx[i] < 100) stray++; }
        if (on && glyphPx[i] > 100) hit++;
      }
      return inkN > 0 && hit / glyphCount >= 0.7 && stray / inkN <= 0.35;
    }

    async function passed() {
      busy = true;
      $app.querySelector('.pad').classList.add('yes');
      if (gi < q.glyphs.length - 1) {
        chime();
        await wait(600);
        if (!alive(id)) return;
        gi++; busy = false;
        $app.querySelector('.pad').classList.remove('yes');
        setGlyph();
      } else {
        answered(q);
      }
    }

    const pt = e => { const r = ink.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    ink.onpointerdown = e => {
      if (busy) return;
      e.preventDefault();
      try { ink.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
      last = pt(e); dot(last);
    };
    ink.onpointermove = e => {
      if (!last || busy) return;
      const p = pt(e); seg(last, p); last = p;
    };
    ink.onpointerup = ink.onpointercancel = () => {
      if (!last) return;
      last = null;
      if (!busy && check()) passed();
    };
    $app.querySelector('#clear').onclick = () => { if (!busy) { ic.clearRect(0, 0, S, S); inkC.clearRect(0, 0, M, M); } };
    $app.querySelector('#skip').onclick = () => {
      if (busy) return;
      run.clean = false;
      if (gi < q.glyphs.length - 1) { gi++; setGlyph(); }
      else { busy = true; run.marks[run.i] = false; const s = (store.items[run.g.id + '|' + q.key] = itemStat(run.g.id, q.key)); s[0]++; s[1]++; save(); run.i++; nextQ(); }
    };

    const ready = document.fonts && document.fonts.load ? document.fonts.load(FONT(40), 'abc') : Promise.resolve();
    ready.catch(() => {}).then(() => { if (alive(id)) setGlyph(); });
  }

  /* ---------- end of round ---------- */
  function finish() {
    const { g, level, first, n } = run;
    const st = gstat(g.id);
    st.rounds.push({ l: level, s: first, n, d: new Date().toISOString().slice(0, 10) });
    if (st.rounds.length > 30) st.rounds.shift();
    const pct = first / n;
    let note = '';
    const prev = st.rounds[st.rounds.length - 2];
    if (pct >= 0.85 && prev && prev.l === level && prev.s / prev.n >= 0.85 && level < g.levels.length - 1) {
      st.level = level + 1; note = `Two great rounds: moving up to level ${st.level + 1}`;
    } else if (pct <= 0.35 && level > 0) {
      st.level = level - 1; note = `Dropping back to level ${st.level + 1} for a while`;
    }
    const sticker = one(D.STICKERS.filter(s => !store.stickers.includes(s)).concat(store.stickers.length >= D.STICKERS.length ? D.STICKERS : []));
    store.stickers.push(sticker);
    save();
    const stars = pct >= 0.85 ? 3 : pct >= 0.5 ? 2 : 1;
    runId++;
    $app.innerHTML = `
      <div class="screen end sec-${g.sec}">
        <div class="stars">${[0, 1, 2].map(i => `<span class="${i < stars ? 'on' : ''}" style="animation-delay:${i * 0.18}s">★</span>`).join('')}</div>
        <div class="prize">${sticker}</div>
        <p class="prize-label">New sticker!</p>
        <div class="end-btns">
          <button class="bigbtn" id="again">🔁 <span>Again</span></button>
          <button class="bigbtn alt" id="homeb">🏠 <span>Home</span></button>
        </div>
        <p class="note">${first} of ${n} first go${note ? ' · ' + esc(note) : ''}</p>
      </div>`;
    fanfare();
    say('You did it! Here is a new sticker.');
    $app.querySelector('#again').onclick = () => { history.replaceState(null, ''); startGame(g.id); };
    $app.querySelector('#homeb').onclick = goHome;
  }

  /* ---------- grown-ups ---------- */
  function summaryText() {
    const lines = [`My ABC progress, ${new Date().toISOString().slice(0, 10)}`];
    GAMES.forEach(g => {
      const st = gstat(g.id);
      if (!st.rounds.length) { lines.push(`${g.name}: not played yet`); return; }
      const recent = st.rounds.slice(-5).map(r => `L${r.l + 1} ${r.s}/${r.n}`).join(', ');
      const t = tricky(g.id);
      lines.push(`${g.name}: now level ${st.level + 1}/${g.levels.length}, ${st.rounds.length} rounds. Recent: ${recent}.${t.length ? ' Tricky: ' + t.join(', ') + '.' : ''}`);
    });
    return lines.join('\n');
  }
  function tricky(id) {
    return Object.entries(store.items)
      .filter(([k, v]) => k.startsWith(id + '|') && v[1] > 0)
      .sort((a, b) => b[1][1] / b[1][0] - a[1][1] / a[1][0] || b[1][1] - a[1][1])
      .slice(0, 6).map(([k]) => k.split('|')[1]);
  }

  function grownups() {
    pushNav();
    runId++;
    const rows = GAMES.map(g => {
      const st = gstat(g.id);
      const recent = st.rounds.slice(-5).map(r => `${r.s}/${r.n}`).join(' · ') || 'not played yet';
      const t = tricky(g.id);
      return `<div class="g-row">
        <div class="g-head"><b>${esc(g.name)}</b><span>${st.rounds.length} rounds</span></div>
        <div class="g-levels">${g.levels.map((l, i) => `<button data-g="${g.id}" data-l="${i}" class="${i === st.level ? 'on' : ''}">${i + 1}. ${esc(l)}</button>`).join('')}</div>
        <div class="g-meta">First-go scores: ${recent}${t.length ? `<br>Tricky: ${esc(t.join(', '))}` : ''}</div>
      </div>`;
    }).join('');
    $app.innerHTML = `
      <div class="screen grown">
        <div class="bar"><button class="round" id="x" aria-label="Back">←</button><h2>Grown-ups</h2><span></span></div>
        <p class="g-intro">Each game picks its own level: two strong rounds in a row moves up, a hard round moves back. Tap a level to set it yourself. Scores count answers that were right first go.</p>
        <div class="g-set">
          <button id="rate">Voice speed: <b>${store.settings.rate < 0.8 ? 'slow' : store.settings.rate < 0.95 ? 'gentle' : 'normal'}</b></button>
          <button id="sfx">Sounds: <b>${store.settings.sfx ? 'on' : 'off'}</b></button>
          <button id="copy">Copy progress summary</button>
        </div>
        ${rows}
        <button id="reset" class="danger">Reset all progress</button>
        ${hasSpeech ? '' : '<p class="g-intro">This browser has no speech voice, so the games will be silent.</p>'}
      </div>`;
    $app.querySelector('#x').onclick = goHome;
    $app.querySelectorAll('.g-levels button').forEach(b => b.onclick = () => {
      gstat(b.dataset.g).level = +b.dataset.l; save();
      b.parentNode.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    });
    const rerender = () => { history.replaceState(null, ''); grownups(); };
    $app.querySelector('#rate').onclick = () => { const r = store.settings.rate; store.settings.rate = r < 0.8 ? 0.85 : r < 0.95 ? 1 : 0.7; save(); rerender(); say('This is how fast I talk.'); };
    $app.querySelector('#sfx').onclick = () => { store.settings.sfx = !store.settings.sfx; save(); rerender(); };
    $app.querySelector('#copy').onclick = async e => {
      const text = summaryText();
      try { await navigator.clipboard.writeText(text); e.target.textContent = 'Copied!'; }
      catch (err) { window.prompt('Copy this:', text); }
    };
    $app.querySelector('#reset').onclick = () => {
      if (!window.confirm('Clear all scores, levels and stickers?')) return;
      store.games = {}; store.items = {}; store.stickers = []; save(); rerender();
    };
  }

  home();
})();
