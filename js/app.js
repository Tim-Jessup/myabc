'use strict';
(() => {
  const D = DATA;
  const $app = document.getElementById('app');

  /* ---------- storage ---------- */
  const KEY = 'myabc.v1';
  const store = { games: {}, items: {}, stickers: [], settings: { rate: 0.85, sfx: true }, pal: {} };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved) Object.assign(store, saved);
  } catch (e) { /* start fresh */ }
  store.settings = Object.assign({ rate: 0.85, sfx: true }, store.settings || {});
  store.pal = Object.assign({ name: 'Pip', color: 'brown', hat: null, hats: [], colors: ['brown'] }, store.pal || {});
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* full or private mode */ } };

  /* ---------- helpers ---------- */
  const rnd = n => Math.floor(Math.random() * n);
  const one = a => a[rnd(a.length)];
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const others = (pool, n, bad) => shuffle(pool.filter(x => !bad.includes(x))).slice(0, n);
  const N = () => store.pal.name || 'Pip';

  // Stickers used to be plain emoji; now each one has a spot in the yard.
  const freeSpot = () => {
    for (let k = 0; k < 30; k++) {
      const x = 0.08 + Math.random() * 0.84, y = 0.1 + Math.random() * 0.8;
      if (Math.abs(x - 0.5) > 0.24 || Math.abs(y - 0.56) > 0.27) return { x, y };
    }
    return { x: 0.1, y: 0.15 };
  };
  store.stickers = (store.stickers || []).map(s => (typeof s === 'string' ? Object.assign({ e: s }, freeSpot()) : s));

  /* ---------- recorded voice clips (kept on this phone only) ---------- */
  const Clips = (() => {
    let db = null;
    const urls = {};
    const open = () => new Promise((res, rej) => {
      const r = indexedDB.open('myabc', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('clips');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const ready = (async () => {
      try {
        db = await open();
        await new Promise(res => {
          const rq = db.transaction('clips').objectStore('clips').openCursor();
          rq.onsuccess = () => { const c = rq.result; if (c) { urls[c.key] = URL.createObjectURL(c.value); c.continue(); } else res(); };
          rq.onerror = () => res();
        });
      } catch (e) { /* no storage: recordings unavailable */ }
    })();
    const write = fn => new Promise(res => {
      if (!db) return res();
      try { const tx = db.transaction('clips', 'readwrite'); fn(tx.objectStore('clips')); tx.oncomplete = tx.onerror = () => res(); } catch (e) { res(); }
    });
    return {
      ready,
      has: id => !!urls[id],
      ids: () => Object.keys(urls),
      put(id, blob) { if (urls[id]) URL.revokeObjectURL(urls[id]); urls[id] = URL.createObjectURL(blob); return write(s => s.put(blob, id)); },
      del(id) { if (urls[id]) URL.revokeObjectURL(urls[id]); delete urls[id]; return write(s => s.delete(id)); },
      url: id => urls[id]
    };
  })();

  /* ---------- speech + sound ---------- */
  /* Pip's voice: every line has a recording in audio/ (made by tools/make_voice.py),
     so it sounds the same on every phone and works offline. The phone's own
     text-to-speech is only a fallback for anything without a recording. */
  const Voice = { clips: {}, ready: false };
  Voice.load = fetch('audio/index.json').then(r => (r.ok ? r.json() : null)).then(j => {
    if (j && j.clips) { Voice.clips = j.clips; Voice.ready = true; }
  }).catch(() => {});
  const voiceUrl = text => { const f = Voice.clips[LINES.key(text)]; return f ? 'audio/' + f + '.mp3' : null; };
  const RATE = () => (store.settings.rate < 0.8 ? 0.85 : store.settings.rate < 0.95 ? 1 : 1.15);

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

  function tts(text) {
    return new Promise(res => {
      if (!hasSpeech || !text) return res();
      let done = false;
      const fin = () => { if (!done) { done = true; res(); } };
      try {
        const u = new SpeechSynthesisUtterance(text);
        if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = 'en-AU';
        u.rate = store.settings.rate;
        u.onend = fin; u.onerror = fin;
        speechSynthesis.resume(); // Chrome can get stuck paused
        speechSynthesis.speak(u);
      } catch (e) { fin(); }
      setTimeout(fin, 1500 + text.length * 120); // never hang if the phone stays silent
    });
  }

  // One audio element, reused: phones only let a page play sound after a tap,
  // and reusing the element that was first played from a tap keeps that permission.
  const player = new Audio();
  player.preload = 'auto';
  function playUrl(url, rate = 1) {
    return new Promise(res => {
      if (!url) return res();
      let done = false;
      const fin = () => { if (!done) { done = true; player.onended = player.onerror = null; res(); } };
      try {
        player.onended = fin; player.onerror = fin;
        player.src = url;
        player.playbackRate = rate;
        player.defaultPlaybackRate = rate;
        player.play().catch(fin);
      } catch (e) { fin(); }
      setTimeout(fin, 8000);
    });
  }
  const playClip = id => playUrl(Clips.url(id));
  const talk = on => document.querySelectorAll('.pal').forEach(p => p.classList.toggle('talk', on));
  const stopAll = () => { try { player.pause(); if (hasSpeech) speechSynthesis.cancel(); } catch (e) { /* ok */ } };

  // say('text'), say({clip:'snd-b'}) or a list of both, played in order.
  let sayTok = 0;
  async function say(parts) {
    const tok = ++sayTok;
    stopAll();
    parts = [].concat(parts).filter(Boolean);
    if (!parts.length) return;
    talk(true);
    let spoke = false;
    for (const p of parts) {
      if (tok !== sayTok) return;
      if (typeof p !== 'string') { await playClip(p.clip); continue; }
      const url = voiceUrl(p);
      if (url) { await playUrl(url, RATE()); continue; }
      (window.MYABC_UNRECORDED = window.MYABC_UNRECORDED || []).push(p); // lines with no recording, for testing
      // Chrome drops speech queued straight after cancel(), so give it a moment first
      if (!spoke) { spoke = true; await wait(60); if (tok !== sayTok) return; }
      await tts(p);
    }
    if (tok === sayTok) talk(false);
  }
  const hush = () => { sayTok++; stopAll(); talk(false); };

  // Keep every recording on the phone so the app speaks offline too.
  async function cacheVoice() {
    if (!Voice.ready || !('caches' in window) || !navigator.onLine) return;
    try {
      const cache = await caches.open('myabc-audio');
      const want = new Set(Object.values(Voice.clips).map(f => new URL('audio/' + f + '.mp3', location.href).href));
      for (const req of await cache.keys()) if (!want.has(req.url)) cache.delete(req);
      const have = new Set((await cache.keys()).map(r => r.url));
      const todo = [...want].filter(u => !have.has(u));
      let i = 0;
      const worker = async () => {
        while (i < todo.length) {
          const u = todo[i++];
          try { const r = await fetch(u); if (r.ok) await cache.put(u, r); } catch (e) { return; }
        }
      };
      await Promise.all([worker(), worker(), worker()]);
    } catch (e) { /* try again next launch */ }
  }
  const sound = l => (Clips.has('snd-' + l) ? { clip: 'snd-' + l } : null);

  let actx = null;
  function tone(freqs, dur = 0.13, type = 'sine', vol = 0.18) {
    if (!store.settings.sfx) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      freqs.forEach((f, i) => {
        if (!f) return;
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
  const chomp = () => tone([180, 0, 150], 0.07, 'square', 0.06);
  const fanfare = () => tone([523, 659, 784, 1047], 0.16);
  const pipTune = () => tone([392, 523, 494, 587, 784], 0.14, 'triangle', 0.16); // Pip's little hello

  /* ---------- the friend ---------- */
  let palTimer = null;
  function palState(s, ms) {
    clearTimeout(palTimer);
    document.querySelectorAll('.pal').forEach(p => { p.dataset.s = s; });
    if (ms) palTimer = setTimeout(() => document.querySelectorAll('.pal').forEach(p => { p.dataset.s = 'idle'; }), ms);
  }
  const palBtn = (state = 'idle') => `<button class="palbtn" id="speak" aria-label="Hear it again">${PAL.svg(store.pal, state)}<i>🔊</i></button>`;

  function flyTo(el, target) {
    if (!el || !target || !el.animate) return Promise.resolve();
    const a = el.getBoundingClientRect(), b = target.getBoundingClientRect();
    const c = el.cloneNode(true);
    Object.assign(c.style, { position: 'fixed', left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px', margin: 0, zIndex: 20, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' });
    c.classList.add('flying');
    document.body.appendChild(c);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height * 0.55 - (a.top + a.height / 2);
    const an = c.animate([{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${dx}px,${dy}px) scale(.12)` }], { duration: 420, easing: 'cubic-bezier(.5,0,.9,.5)' });
    return new Promise(res => { const end = () => { c.remove(); res(); }; an.onfinish = end; an.oncancel = end; setTimeout(end, 600); });
  }

  function confetti() {
    const box = document.createElement('div');
    box.className = 'confetti';
    const cols = ['#FF6B4A', '#F5A300', '#14B8A6', '#4F6FF5', '#A855F7', '#FFC531'];
    for (let i = 0; i < 46; i++) {
      const s = document.createElement('i');
      s.style.cssText = `left:${Math.random() * 100}%;background:${one(cols)};animation-delay:${Math.random() * 0.5}s;animation-duration:${1.6 + Math.random() * 1.2}s;width:${8 + rnd(8)}px;height:${10 + rnd(10)}px`;
      box.appendChild(s);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 3400);
  }

  /* ---------- item picking (things she finds tricky come back more often) ---------- */
  const itemStat = (id, key) => store.items[id + '|' + key] || [0, 0];
  function choose(id, pool, keyOf = x => String(x)) {
    const used = run.used;
    if (run.force != null) { // the path asks for a particular letter or word
      const f = pool.find(x => keyOf(x) === String(run.force));
      run.force = null;
      if (f !== undefined) { used.add(keyOf(f)); return f; }
    }
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
  // The first question of a round sets the scene; after that the prompt is short.
  const intro = (id, again) => (run.i !== 0 ? again : run.items ? [LINES.path.go].concat(again) : [LINES.intro[id]].concat(again));

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
        const again = LINES.findLetter(t.toUpperCase());
        return {
          type: 'pick', key: t, cols: 2, feed: true, again,
          say: intro(this.id, again),
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
        const conv = x => (lv === 0 ? x : x.toUpperCase());
        const again = lv === 0 ? LINES.bigToLittle(T) : LINES.littleToBig(T);
        return {
          type: 'pick', key: t, cols: 2, again,
          say: intro(this.id, again),
          stim: `<div class="stim-letter">${esc(lv === 0 ? T : t)}</div>`,
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
        const again = LINES.findNumber(t);
        return {
          type: 'pick', key: t, cols: 2, feed: true, again,
          say: intro(this.id, again),
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
        const again = LINES.howMany;
        return {
          type: 'pick', key: t, cols: lv === 0 ? 3 : 2, small: true, again,
          say: intro(this.id, again),
          stim: `<div class="count-box n${t > 10 ? 'big' : 'small'}">${Array(t).fill(`<span>${e}</span>`).join('')}</div>`,
          after: LINES.number(t),
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
          t = choose(this.id + lv, startLetters);
          [word, emoji] = one(D.START[t]);
        } else {
          [word, emoji] = choose(this.id + lv, D.CVC, x => x[0]);
          t = word[word.length - 1];
        }
        const wrong = others(D.LOWER, lv === 0 ? 2 : 3, [t, 'x'].concat(SOUND_ALIKE[t] || []));
        const again = lv < 2 ? LINES.startsWithQ(word) : LINES.endsWithQ(word);
        return {
          type: 'pick', key: lv < 2 ? t : word, cols: lv === 0 ? 3 : 2, small: true, again,
          say: intro(this.id, again),
          stim: `<div class="stim-pic">${emoji}</div>`, stimSay: LINES.word(word),
          after: [sound(t), lv < 2 ? LINES.forWord(t.toUpperCase(), word) : LINES.endsWith(word, t.toUpperCase())],
          choices: shuffle([{ html: ltr(t), ok: true }].concat(wrong.map(x => ({ html: ltr(x) }))))
        };
      }
    },
    {
      id: 'soundPic', sec: 'sounds', icon: '🐝', name: 'Find the picture',
      levels: ['3 pictures', '4 pictures'],
      make(lv) {
        const t = choose(this.id + lv, startLetters);
        const T = t.toUpperCase();
        const [word, emoji] = one(D.START[t]);
        const wrong = others(startLetters, lv === 0 ? 2 : 3, [t].concat(SOUND_ALIKE[t] || [])).map(l => one(D.START[l]));
        const again = [LINES.whichStarts(T), sound(t)];
        return {
          type: 'pick', key: t, cols: lv === 0 ? 3 : 2, small: lv === 0, again,
          say: run.i === 0 ? [LINES.wantStarts(T), sound(t), LINES.whichOne] : again,
          stim: `<div class="stim-letter">${T}<span>${t}</span></div>`,
          after: LINES.startsWith(word, T),
          choices: shuffle([{ html: pic(emoji), ok: true, say: LINES.word(word) }].concat(wrong.map(([w, e]) => ({ html: pic(e), say: LINES.word(w) }))))
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
        const again = LINES.readWord;
        return {
          type: 'pick', key: word, cols: lv === 0 ? 3 : 2, small: lv === 0, again,
          say: run.i === 0 ? LINES.intro.readWord : again,
          stim: `<div class="stim-word">${esc(word)}</div>`, stimSay: LINES.word(word), stimHelps: true,
          after: LINES.word(word),
          choices: shuffle([{ html: pic(emoji), ok: true }].concat(wrong.map(([w, e]) => ({ html: pic(e), say: LINES.word(w) }))))
        };
      }
    },
    {
      id: 'sightWords', sec: 'words', icon: 'the', name: 'Words to know',
      levels: ['First words', 'More words', 'Harder words'],
      make(lv) {
        const t = choose(this.id + lv, D.SIGHT[lv]);
        const pool = D.SIGHT.slice(0, lv + 1).flat();
        const again = LINES.findWord(t);
        return {
          type: 'pick', key: t, cols: 2, feed: true, again,
          say: intro(this.id, again),
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
        const again = LINES.build(word);
        return {
          type: 'build', key: word, again,
          say: intro(this.id, again),
          stim: `<div class="stim-pic">${emoji}</div>`, stimSay: LINES.word(word),
          answer: letters, tiles: shuffle(letters.concat(extra)), after: LINES.word(word), letters: true
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
        return {
          type: 'build', key: s, again: LINES.sentence(s),
          say: intro(this.id, LINES.sentence(s)),
          answer: words, tiles, after: LINES.sentence(s), letters: false
        };
      }
    },
    {
      id: 'traceLetters', sec: 'writing', icon: '✏️', name: 'Trace letters', n: 6,
      levels: ['Small letters', 'Capitals'],
      make(lv) {
        const t = choose(this.id + lv, lv === 0 ? D.LOWER : D.UPPER);
        return writeQ(t, 'trace', this.id);
      }
    },
    {
      id: 'traceNumbers', sec: 'writing', icon: '5', name: 'Write numbers', n: 6,
      levels: ['Trace 0 to 9', 'Copy 0 to 9', '0 to 9 from memory'],
      make(lv) {
        const t = choose(this.id + lv, '0123456789'.split(''));
        return writeQ(t, ['trace', 'copy', 'recall'][lv], this.id);
      }
    },
    {
      id: 'traceWords', sec: 'writing', icon: '📝', name: 'Write words', n: 3,
      levels: ['Short words', 'Longer words'],
      make(lv) {
        const [word, emoji] = choose(this.id + lv, lv === 0 ? D.CVC : D.LONGER, x => x[0]);
        const again = LINES.writeWord(word);
        return { type: 'trace', key: word, glyphs: word.split(''), word, emoji, again, say: intro(this.id, again), after: LINES.word(word) };
      }
    }
  ];
  // writing a letter or number: trace it, copy it from a model, or write it from memory
  function writeQ(t, mode, gameId) {
    const T = String(t).toUpperCase(), digit = /\d/.test(t);
    let again;
    if (mode === 'trace') again = digit ? LINES.traceNumber(t) : LINES.traceLetter(T);
    else if (mode === 'copy') again = digit ? LINES.copyNumber(t) : LINES.copyLetter(T);
    else again = digit ? LINES.writeNumber(t) : t === T ? LINES.writeBig(T) : LINES.writeLittle(T);
    return { type: 'trace', mode, key: String(t), glyphs: [String(t)], again, say: intro(gameId, again) };
  }
  GAMES.splice(GAMES.findIndex(g => g.id === 'traceNumbers'), 0, {
    id: 'writeLetters', sec: 'writing', icon: '✍️', name: 'Write letters', n: 6,
    levels: ['Copy small letters', 'Small letters from memory', 'Copy capitals', 'Capitals from memory'],
    make(lv) {
      const t = choose(this.id + lv, lv >= 2 ? D.UPPER : D.LOWER);
      return writeQ(t, lv % 2 === 0 ? 'copy' : 'recall', this.id);
    }
  });
  const byId = Object.fromEntries(GAMES.map(g => [g.id, g]));
  const gstat = id => (store.games[id] = store.games[id] || { level: 0, rounds: [] });

  /* ---------- home: Pip's world ---------- */
  let run = { used: new Set(), i: 0 };
  let runId = 0;
  const alive = id => id === runId;
  let awake = false;
  let sleepTimer = null;

  function worldSVG() {
    const lbl = (x, y, t) => `<text x="${x}" y="${y}" class="lbl">${t}</text>`;
    const fruit = (x, y, t) => `<g class="fruit"><circle cx="${x}" cy="${y}" r="17" fill="#FF6B4A"/><text x="${x}" y="${y + 7}" class="ft">${t}</text></g>`;
    const pad = (x, y, t) => `<g class="fruit"><circle cx="${x}" cy="${y}" r="17" fill="#3FA06A"/><text x="${x}" y="${y + 7}" class="ft">${t}</text></g>`;
    return `<svg class="world" viewBox="0 0 400 770" preserveAspectRatio="xMidYMax meet">
      <rect x="-800" y="-800" width="2000" height="1600" fill="#CDEBFA"/>
      <circle cx="338" cy="150" r="30" fill="#FFD35A"/>
      <g fill="#fff" class="cloud"><ellipse cx="90" cy="150" rx="40" ry="14"/><ellipse cx="112" cy="138" rx="24" ry="14"/></g>
      <g fill="#fff" class="cloud c2"><ellipse cx="240" cy="118" rx="30" ry="11"/></g>
      <path d="M-800 250 Q 60 170 200 235 T 1200 215 V 900 H -800 Z" fill="#B7E0A0"/>
      <path d="M-800 330 Q 120 280 260 320 T 1200 310 V 1600 H -800 Z" fill="#9AD27A"/>
      <path d="M440 372 C 340 372 330 415 300 428 C 240 455 250 560 160 590 C 100 610 60 660 -40 695" fill="none" stroke="#7CC8EE" stroke-width="44" stroke-linecap="round"/>

      <g class="spot" data-sec="letters">
        <rect x="8" y="196" width="160" height="212" fill="transparent"/>
        <rect x="82" y="300" width="24" height="72" rx="8" fill="#9A6B4B"/>
        <circle cx="94" cy="262" r="56" fill="#4FAE5A"/><circle cx="52" cy="292" r="34" fill="#4FAE5A"/><circle cx="138" cy="290" r="36" fill="#4FAE5A"/>
        ${fruit(76, 246, 'A')}${fruit(118, 266, 'b')}${fruit(60, 294, 'c')}
        ${lbl(94, 398, 'Letters')}
      </g>
      <g class="spot" data-sec="numbers">
        <rect x="216" y="376" width="172" height="130" fill="transparent"/>
        <ellipse cx="300" cy="430" rx="80" ry="46" fill="#7CC8EE" stroke="#5FB3DD" stroke-width="5"/>
        ${pad(266, 422, '1')}${pad(308, 444, '2')}${pad(338, 414, '3')}
        ${lbl(300, 500, 'Numbers')}
      </g>
      <g class="spot" data-sec="sounds">
        <rect x="22" y="418" width="140" height="138" fill="transparent"/>
        <circle cx="92" cy="431" r="8" fill="#0E9384"/>
        <path d="M52 502 Q52 440 92 434 Q132 440 132 502 Z" fill="#14B8A6"/>
        <circle cx="92" cy="515" r="9" fill="#0E9384"/>
        <rect x="44" y="496" width="96" height="13" rx="6.5" fill="#0E9384"/>
        <g class="ring" fill="none" stroke="#14B8A6" stroke-width="5" stroke-linecap="round">
          <path d="M146 456 q10 14 0 28"/><path d="M158 446 q16 24 0 48"/><path d="M38 456 q-10 14 0 28"/><path d="M26 446 q-16 24 0 48"/>
        </g>
        ${lbl(92, 550, 'Sounds')}
      </g>
      <g class="spot" data-sec="words">
        <rect x="254" y="544" width="118" height="140" fill="transparent"/>
        <rect x="270" y="590" width="84" height="62" rx="6" fill="#4F6FF5"/>
        <polygon points="260,596 312,548 364,596" fill="#3550C8"/>
        <rect x="300" y="620" width="24" height="32" rx="5" fill="#FFF6E5"/>
        <text x="312" y="613" class="ft" style="font-size:17px">abc</text>
        ${lbl(312, 678, 'Words')}
      </g>
      <g class="spot" data-sec="writing">
        <rect x="140" y="626" width="130" height="144" fill="transparent"/>
        <g transform="rotate(-28 205 690)">
          <rect x="193" y="644" width="24" height="72" fill="#A855F7"/>
          <rect x="193" y="632" width="24" height="14" rx="5" fill="#F9A8D4"/>
          <polygon points="193,716 217,716 205,740" fill="#F5D6A8"/><polygon points="200,730 210,730 205,740" fill="#2B2A4C"/>
        </g>
        <path d="M150 738 q 9 -12 18 0 t 18 0 t 18 0" fill="none" stroke="#2B2A4C" stroke-width="4" stroke-linecap="round"/>
        ${lbl(205, 764, 'Writing')}
      </g>
      <g class="palspot" id="palspot">
        <rect x="170" y="250" width="124" height="134" fill="transparent"/>
        <ellipse cx="231" cy="376" rx="46" ry="8" fill="#7FBF5E"/>
        <svg x="166" y="246" width="130" height="132" viewBox="${PAL.BOX}" overflow="visible">${PAL.g(store.pal, awake ? 'idle' : 'sleep')}</svg>
      </g>
    </svg>`;
  }

  let hub = 'path';
  function home() { if (hub === 'world') world(); else pathScreen(); }

  function world() {
    runId++;
    hush();
    const id = runId;
    $app.innerHTML = `
      <div class="screen world-screen">
        <header class="hud">
          <h1>My <b>A</b><b>B</b><b>C</b></h1>
          <div class="home-btns">
            <button class="chip" id="topath" aria-label="Pip's path">🗺</button>
            <button class="chip" id="place" aria-label="${esc(N())}'s place">🏡 <span>${store.stickers.length}</span></button>
            <button class="chip quiet" id="grown" aria-label="Grown-ups (hold)">⚙</button>
          </div>
        </header>
        ${worldSVG()}
      </div>`;
    const restSoon = () => {
      clearTimeout(sleepTimer);
      sleepTimer = setTimeout(() => { if (alive(id) && !document.querySelector('.sheet')) { awake = false; palState('sleep'); } }, 45000);
    };
    const wake = () => { awake = true; palState('idle'); restSoon(); };
    $app.querySelectorAll('.spot').forEach(s => s.onclick = () => { tap(); wake(); sectionSheet(SECTIONS.find(x => x.id === s.dataset.sec)); });
    $app.querySelector('#palspot').onclick = () => {
      if (!awake) { wake(); pipTune(); palState('happy', 1400); say(N() === 'Pip' ? LINES.hello : [LINES.hello[0], `I'm ${N()}.`, LINES.hello[2]]); }
      else { tap(); place(); }
    };
    $app.querySelector('#place').onclick = () => { tap(); place(); };
    $app.querySelector('#topath').onclick = () => { tap(); hub = 'path'; pathScreen(); };
    holdForGrownups($app.querySelector('#grown'));
    if (awake) restSoon();
    if (updateReady) applyUpdate(); else autoUpdate();
  }

  function sectionSheet(sec) {
    const cards = GAMES.filter(g => g.sec === sec.id).map(g => `<button class="card" data-game="${g.id}">
        <span class="card-icon ${/^[\w]+$/.test(g.icon) ? 'txt' : ''}">${g.icon}</span>
        <span class="card-name">${esc(g.name)}</span>
      </button>`).join('');
    const d = document.createElement('div');
    d.className = 'sheet';
    d.innerHTML = `<div class="sheet-box sec-${sec.id}"><h3>${esc(LINES.places[sec.id].replace('!', ''))}</h3><div class="cards">${cards}</div></div>`;
    d.onclick = e => {
      const b = e.target.closest('.card');
      if (b) { d.remove(); tap(); startGame(b.dataset.game); }
      else if (!e.target.closest('.sheet-box')) d.remove();
    };
    document.body.appendChild(d);
    say(LINES.places[sec.id]);
  }
  const closeSheets = () => document.querySelectorAll('.sheet').forEach(s => s.remove());

  function pushNav() { try { history.pushState({ in: 1 }, ''); } catch (e) { /* ignore */ } }
  window.addEventListener('popstate', () => { closeSheets(); stopMic(); home(); });
  const goHome = () => { if (history.state && history.state.in) history.back(); else home(); };

  /* ---------- Pip's path ----------
     Stops in the order letters are taught. Each stop mixes a few activities around one
     letter (find it, hear it, write it), with word stops that only use letters met so far,
     and number and "words to know" stops in between. */
  const PATH = (() => {
    const stops = [], known = [];
    let num = 0, sight = 0;
    D.ORDER.forEach((l, i) => {
      known.push(l);
      stops.push({ kind: 'letter', letter: l, known: known.slice() });
      const n = i + 1;
      if (n >= 6 && n % 3 === 0) stops.push({ kind: 'words', known: known.slice() });
      if (n % 5 === 2 && num < 3) stops.push({ kind: 'numbers', set: num++ });
      if (n >= 12 && n % 6 === 0 && sight < 3) stops.push({ kind: 'sight', set: sight++ });
    });
    stops.push({ kind: 'words', known: known.slice() });
    stops.push({ kind: 'sentences', set: 0 }, { kind: 'sentences', set: 1 });
    return stops;
  })();
  const pathState = () => (store.path = Object.assign({ at: 0, done: {}, stars: {} }, store.path || {}));
  const stopLabel = st => ({ letter: st.letter, words: 'cat', numbers: '123', sight: 'the', sentences: 'I see' }[st.kind]);
  const isMilestone = i => (i + 1) % 5 === 0;

  // the letter she has found hardest so far, among those she has met
  function trickiest(known) {
    let best = null, bestScore = -Infinity;
    for (const l of known) {
      let seen = 0, missed = 0;
      for (const [k, v] of Object.entries(store.items)) if (k.endsWith('|' + l) || k.endsWith('|' + l.toUpperCase())) { seen += v[0]; missed += v[1]; }
      const score = (missed + 0.5) / (seen + 1) + Math.random() * 0.3 - (l === pathState().lastReview ? 1 : 0); // not the same one twice running
      if (score > bestScore) { bestScore = score; best = l; }
    }
    pathState().lastReview = best;
    return best;
  }
  const writeStage = t => (store.write || {})[t] || 0;
  function writeItem(t, review) {
    const stage = writeStage(t), digit = /\d/.test(t);
    if (digit) return { g: byId.traceNumbers, lv: stage, force: t };
    const up = t === t.toUpperCase();
    if (stage === 0 && !review) return { g: byId.traceLetters, lv: up ? 1 : 0, force: t };
    // traced it once: copy it next time; copied it cleanly: write it from memory
    return { g: byId.writeLetters, lv: (up ? 2 : 0) + (stage >= 2 ? 1 : 0), force: t };
  }
  function stopItems(i) {
    const st = PATH[i], lv = id => gstat(id).level;
    const ps = pathState(), quick = ps.quick; // she aced the last stop: a shorter one
    const It = (id, force, l) => ({ g: byId[id], lv: l == null ? Math.min(lv(id), byId[id].levels.length - 1) : l, force });
    const items = [];
    if (st.kind === 'letter') {
      const L = st.letter, earlier = st.known.filter(x => x !== L);
      items.push(It('findLetter', L, Math.max(1, lv('findLetter'))));
      if (!quick) items.push(It('matchCase', L, i % 2));
      if (D.START[L]) {
        items.push(It('soundPic', L));
        if (!quick) items.push(It('firstSound', L, Math.min(lv('firstSound'), 1)));
      }
      items.push(writeItem(L));
      if (earlier.length) {
        const r = trickiest(earlier);
        items.push(writeStage(r) >= 1 ? writeItem(r, true) : It('findLetter', r, 1));
      }
    } else if (st.kind === 'words') {
      const words = shuffle(D.CVC.filter(([w]) => [...w].every(c => st.known.includes(c))).map(x => x[0]));
      const rl = Math.min(lv('readWord'), 1);
      words.slice(0, 2).forEach(w => items.push(It('readWord', w, rl)));
      if (words[2]) items.push(It('buildWord', words[2], Math.min(lv('buildWord'), 1)));
      if (words[3]) items.push(It('firstSound', words[3], 2));
      items.push(writeItem(trickiest(st.known), true));
    } else if (st.kind === 'numbers') {
      const [lo, hi] = [[1, 5], [1, 10], [6, 20]][st.set];
      const pick = () => lo + rnd(hi - lo + 1);
      items.push(It('count', pick(), st.set), It('count', pick(), st.set));
      items.push(It('findNumber', pick(), Math.min(st.set, 2)), It('findNumber', pick(), Math.min(st.set, 2)));
      items.push(writeItem(String(rnd(10))));
    } else if (st.kind === 'sight') {
      shuffle(D.SIGHT[st.set]).slice(0, 3).forEach(w => items.push(It('sightWords', w, st.set)));
      items.push(It('readWord', null, Math.min(lv('readWord'), 1)), It('buildWord', null, Math.min(lv('buildWord'), 1)));
    } else {
      items.push(It('sentence', null, st.set), It('sentence', null, st.set), It('sightWords', null, 2), It('readWord', null, 2));
      items.push(writeItem(trickiest(D.ORDER), true));
    }
    return items;
  }

  function startStop(i) {
    const items = stopItems(i);
    clearTimeout(sleepTimer);
    awake = true;
    pushNav();
    run = { path: i, items, g: items[0].g, level: items[0].lv, i: 0, n: items.length, first: 0, used: new Set(), id: ++runId, marks: [] };
    nextQ();
  }

  function pathScreen() {
    runId++;
    hush();
    const ps = pathState(), id = runId;
    const GAP = 104, TOP = 150, W = 400;
    const pos = i => ({ x: 200 + 112 * Math.sin(i * 0.95), y: TOP + i * GAP });
    const H = TOP + PATH.length * GAP + 40;
    let d = '';
    PATH.forEach((_, i) => {
      const p = pos(i);
      if (!i) d = `M${p.x} ${p.y}`;
      else { const a = pos(i - 1); d += ` C${a.x} ${a.y + GAP * 0.55} ${p.x} ${p.y - GAP * 0.55} ${p.x} ${p.y}`; }
    });
    const deco = ['🌳', '🌿', '🌼', '🍄', '🌳', '🪨', '🌸', '🌲'];
    const decor = PATH.map((_, i) => { const p = pos(i); const x = p.x > 200 ? p.x - 150 - (i % 3) * 12 : p.x + 120 + (i % 2) * 14; return `<text x="${x}" y="${p.y + 10}" class="deco">${deco[i % deco.length]}</text>`; }).join('');
    const nodes = PATH.map((st, i) => {
      const p = pos(i), state = ps.done[i] ? 'done' : i === ps.at ? 'now' : i < ps.at ? 'done' : 'later';
      const stars = ps.stars[i] || 0;
      return `<g class="stop ${state} k-${st.kind}" data-i="${i}" transform="translate(${p.x} ${p.y})">
        ${state === 'now' ? '<circle r="44" class="halo"/>' : ''}
        <circle r="34" class="disc"/>
        <text y="${st.kind === 'letter' ? 11 : 8}" class="${st.kind === 'letter' ? 'big' : 'small'}">${esc(stopLabel(st))}</text>
        ${state === 'done' ? `<text y="58" class="stars">${'★'.repeat(stars)}<tspan class="off">${'★'.repeat(3 - stars)}</tspan></text>` : ''}
        ${isMilestone(i) && !ps.done[i] ? '<text x="34" y="-22" class="gift">🎁</text>' : ''}
      </g>`;
    }).join('');
    const pp = pos(ps.at);
    const pipX = pp.x > 200 ? pp.x - 118 : pp.x + 40;
    $app.innerHTML = `
      <div class="screen path-screen">
        <header class="hud path-hud">
          <h1>My <b>A</b><b>B</b><b>C</b></h1>
          <div class="home-btns">
            <button class="chip" id="world" aria-label="Play anything">🌳</button>
            <button class="chip" id="place" aria-label="${esc(N())}'s place">🏡 <span>${store.stickers.length}</span></button>
            <button class="chip quiet" id="grown" aria-label="Grown-ups (hold)">⚙</button>
          </div>
        </header>
        <div class="path-scroll" id="ps">
          <svg class="path-map" viewBox="0 0 ${W} ${H}" width="100%" style="aspect-ratio:${W}/${H}">
            <path d="${d}" class="trail-edge"/><path d="${d}" class="trail"/>
            ${decor}${nodes}
            <g class="path-pal" id="ppal" transform="translate(${pipX} ${pp.y - 56})">
              <svg width="80" height="82" viewBox="${PAL.BOX}" overflow="visible">${PAL.g(store.pal, 'idle')}</svg>
            </g>
          </svg>
        </div>
      </div>`;
    const sc = $app.querySelector('#ps');
    requestAnimationFrame(() => { const r = sc.querySelector('.stop.now') || sc.querySelector('.stop'); if (r) r.scrollIntoView({ block: 'center' }); });
    sc.querySelectorAll('.stop').forEach(g => g.onclick = () => {
      const i = +g.dataset.i;
      if (i <= ps.at) { tap(); startStop(i); }
      else { boop(); say(LINES.path.locked); }
    });
    $app.querySelector('#ppal').onclick = () => { pipTune(); palState('happy', 1300); say(N() === 'Pip' ? LINES.hello : [LINES.hello[0], `I'm ${N()}.`, LINES.hello[2]]); };
    $app.querySelector('#world').onclick = () => { tap(); hub = 'world'; world(); };
    $app.querySelector('#place').onclick = () => { tap(); place(); };
    holdForGrownups($app.querySelector('#grown'));
    if (updateReady) applyUpdate(); else autoUpdate();
    if (!alive(id)) return;
  }

  function holdForGrownups(g) {
    let timer = null;
    g.onpointerdown = () => { timer = setTimeout(() => { timer = null; grownups(); }, 650); };
    g.onpointerup = g.onpointerleave = () => { if (timer) { clearTimeout(timer); timer = null; } };
    g.oncontextmenu = e => e.preventDefault();
  }

  /* ---------- Pip's place ----------
     Stickers live in a sticker book along the bottom: drag one up into the yard, drag it
     back down to put it away, or tidy everything up. Tap a sticker and it wiggles while
     Pip says its name; feed Pip the food ones. Pip can be moved around, and wears the hats,
     colours and backgrounds won along the path. */
  const SCENES = {
    garden: `<rect width="100" height="100" fill="#CDEBFA"/><circle cx="68" cy="14" r="6" fill="#FFD35A"/>
      <path d="M0 34 Q 30 22 55 32 T 100 28 V 100 H 0 Z" fill="#B7E0A0"/><path d="M0 50 Q 40 42 70 49 T 100 47 V 100 H 0 Z" fill="#9AD27A"/>
      <path d="M0 90 Q 30 84 60 90 T 100 88 V 100 H 0 Z" fill="#7CC8EE"/>`,
    beach: `<rect width="100" height="100" fill="#BDE7F7"/><circle cx="32" cy="14" r="7" fill="#FFD35A"/>
      <rect y="38" width="100" height="22" fill="#4FB3D9"/><path d="M0 40 q 6 -3 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0" fill="none" stroke="#fff" stroke-width="1.2"/>
      <path d="M0 58 Q 30 52 60 57 T 100 55 V 100 H 0 Z" fill="#F3D9A4"/>`,
    night: `<rect width="100" height="100" fill="#22305E"/><circle cx="66" cy="16" r="7" fill="#FFF3C4"/><circle cx="69" cy="14" r="6" fill="#22305E"/>
      <g fill="#FFF3C4"><circle cx="26" cy="10" r=".8"/><circle cx="34" cy="22" r=".6"/><circle cx="48" cy="8" r=".9"/><circle cx="58" cy="26" r=".6"/><circle cx="74" cy="32" r=".7"/><circle cx="28" cy="34" r=".5"/><circle cx="40" cy="15" r=".5"/></g>
      <path d="M0 50 Q 40 40 70 48 T 100 46 V 100 H 0 Z" fill="#2E5E4E"/><path d="M0 70 Q 30 64 60 70 T 100 68 V 100 H 0 Z" fill="#244B3E"/>`,
    snow: `<rect width="100" height="100" fill="#DCEBF6"/><path d="M0 40 L 20 22 L 34 36 L 52 16 L 74 38 L 88 26 L 100 36 V 100 H 0 Z" fill="#B8CCE0"/>
      <path d="M0 52 Q 40 44 70 51 T 100 49 V 100 H 0 Z" fill="#FFFFFF"/><g fill="#fff"><circle cx="26" cy="12" r="1"/><circle cx="40" cy="8" r="1.2"/><circle cx="58" cy="14" r=".9"/><circle cx="72" cy="9" r="1.1"/></g>`,
    creek: `<rect width="100" height="100" fill="#D5EEF7"/><path d="M0 30 Q 25 20 50 28 T 100 24 V 100 H 0 Z" fill="#A9D68E"/>
      <path d="M100 40 C 70 42 72 58 50 62 C 28 66 30 84 0 88 V 100 H 100 Z" fill="#6FBFE6"/><path d="M100 40 C 70 42 72 58 50 62 C 28 66 30 84 0 88" fill="none" stroke="#9AD27A" stroke-width="2"/>
      <g fill="#9C9C9C"><ellipse cx="62" cy="64" rx="4" ry="2"/><ellipse cx="30" cy="80" rx="5" ry="2.2"/></g>`
  };
  const SCENE_ICON = { garden: '🌳', beach: '🏖️', night: '🌙', snow: '❄️', creek: '🏞️' };

  function place() {
    pushNav();
    runId++;
    const p = store.pal;
    p.scenes = p.scenes || ['garden'];
    p.scene = p.scene || 'garden';
    p.pos = p.pos || { x: 0.5, y: 0.56 };
    store.stickers.forEach(st => { if (st.out === undefined) st.out = false; }); // older stickers start in the book
    let tab = 'book';
    $app.innerHTML = `
      <div class="screen place">
        <div class="bar"><button class="round" id="x" aria-label="Back">←</button><h2>${esc(N())}'s place</h2><button class="round" id="tidy" aria-label="Tidy up">🧺</button></div>
        <div class="yard" id="yard">
          <svg class="yard-bg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">${SCENES[p.scene]}</svg>
          <div class="yard-pal" id="yp" aria-label="${esc(N())}"></div>
        </div>
        <div class="tabs">
          <button data-t="book" class="on">📖</button><button data-t="hats">🎩</button><button data-t="cols">🎨</button><button data-t="scenes">🖼️</button>
        </div>
        <div class="tray-row" id="tray"></div>
      </div>`;
    const yard = $app.querySelector('#yard'), tray = $app.querySelector('#tray'), yp = $app.querySelector('#yp');
    const name = e => D.STICKER_NAMES[e] || 'sticker';
    const placeYP = () => { yp.style.left = p.pos.x * 100 + '%'; yp.style.top = p.pos.y * 100 + '%'; yp.innerHTML = PAL.svg(p, 'idle'); };
    const overPip = (cx, cy) => { const r = yp.getBoundingClientRect(); return cx > r.left && cx < r.right && cy > r.top && cy < r.bottom; };
    const overYard = (cx, cy) => { const r = yard.getBoundingClientRect(); return cx > r.left && cx < r.right && cy > r.top && cy < r.bottom; };
    const yardXY = (cx, cy) => { const r = yard.getBoundingClientRect(); return { x: clamp((cx - r.left) / r.width, 0.06, 0.94), y: clamp((cy - r.top) / r.height, 0.06, 0.94) }; };
    async function feed(st) {
      st.out = false; st.fresh = false; save();
      palState('eat', 900); chomp();
      await wait(450);
      palState('happy', 1200);
      say(one(D.YUM));
      drawYard(); drawTray();
    }

    function drawYard() {
      yard.querySelectorAll('.stk').forEach(el => el.remove());
      store.stickers.forEach((st, i) => {
        if (!st.out) return;
        const el = document.createElement('span');
        el.className = 'stk'; el.textContent = st.e;
        el.style.left = st.x * 100 + '%'; el.style.top = st.y * 100 + '%';
        yard.appendChild(el);
        let down = null, moved = false;
        el.onpointerdown = e => { down = { x: e.clientX, y: e.clientY }; moved = false; try { el.setPointerCapture(e.pointerId); } catch (err) { /* ok */ } };
        el.onpointermove = e => {
          if (!down) return;
          if (!moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8) return;
          if (!moved) { moved = true; el.classList.add('drag'); tap(); }
          const r = yard.getBoundingClientRect();
          el.style.left = (e.clientX - r.left) / r.width * 100 + '%'; el.style.top = (e.clientY - r.top) / r.height * 100 + '%';
        };
        el.onpointerup = e => {
          if (!down) return;
          down = null; el.classList.remove('drag');
          if (!moved) { // a tap: wiggle and say its name
            el.classList.remove('wiggle'); void el.offsetWidth; el.classList.add('wiggle');
            tone([660, 880, 990], 0.08, 'triangle', 0.1);
            say(LINES.sticker(name(st.e)));
            return;
          }
          if (D.FOOD.includes(st.e) && overPip(e.clientX, e.clientY)) return feed(st);
          if (!overYard(e.clientX, e.clientY)) { st.out = false; save(); drawYard(); drawTray(); return; } // back in the book
          Object.assign(st, yardXY(e.clientX, e.clientY)); save();
        };
        el.onpointercancel = () => { down = null; el.classList.remove('drag'); drawYard(); };
      });
      const empty = !store.stickers.some(st => st.out);
      yard.classList.toggle('empty', empty);
    }

    function drawTray() {
      $app.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
      if (tab === 'book') {
        const inBook = store.stickers.map((st, i) => [st, i]).filter(([st]) => !st.out);
        tray.innerHTML = inBook.length
          ? inBook.map(([st, i]) => `<div class="book-cell ${st.fresh ? 'fresh' : ''}" data-i="${i}"><span>${st.e}</span><small>${esc(name(st.e))}</small></div>`).join('')
          : `<p class="tray-note">${store.stickers.length ? 'All your stickers are out!' : 'Finish a stop on the path to win stickers!'}</p>`;
        tray.querySelectorAll('.book-cell').forEach(cell => dragFromBook(cell, store.stickers[+cell.dataset.i]));
      } else if (tab === 'hats') {
        tray.innerHTML = `<button data-h="" class="${p.hat ? '' : 'on'}">🚫</button>` +
          PAL.HATS.map(h => (p.hats.includes(h) ? `<button data-h="${h}" class="${p.hat === h ? 'on' : ''}">${h}</button>` : '<button class="locked" disabled>?</button>')).join('');
      } else if (tab === 'cols') {
        tray.innerHTML = Object.keys(PAL.COLORS).map(c => (p.colors.includes(c)
          ? `<button data-c="${c}" class="${p.color === c ? 'on' : ''}"><i style="background:${PAL.COLORS[c].body}"></i></button>`
          : '<button class="locked" disabled>?</button>')).join('');
      } else {
        tray.innerHTML = Object.keys(SCENES).map(sc => (p.scenes.includes(sc)
          ? `<button data-s="${sc}" class="${p.scene === sc ? 'on' : ''}">${SCENE_ICON[sc]}</button>`
          : '<button class="locked" disabled>?</button>')).join('');
      }
    }

    // drag a sticker up out of the book (sideways still scrolls the book)
    function dragFromBook(cell, st) {
      let down = null, ghost = null;
      cell.onpointerdown = e => { down = { x: e.clientX, y: e.clientY, id: e.pointerId }; try { cell.setPointerCapture(e.pointerId); } catch (err) { /* ok */ } };
      cell.onpointermove = e => {
        if (!down) return;
        if (!ghost) {
          if (down.y - e.clientY < 12 || Math.abs(e.clientX - down.x) > down.y - e.clientY) return;
          ghost = document.createElement('span');
          ghost.className = 'stk drag ghost'; ghost.textContent = st.e;
          document.body.appendChild(ghost); tap();
        }
        ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px';
      };
      const end = e => {
        if (!down) return;
        const wasDrag = !!ghost;
        down = null;
        if (ghost) { ghost.remove(); ghost = null; }
        if (!wasDrag) { say(LINES.sticker(name(st.e))); return; }
        if (D.FOOD.includes(st.e) && overPip(e.clientX, e.clientY)) return feed(st);
        if (overYard(e.clientX, e.clientY)) { Object.assign(st, yardXY(e.clientX, e.clientY), { out: true, fresh: false }); save(); drawYard(); drawTray(); }
      };
      cell.onpointerup = end;
      cell.onpointercancel = () => { down = null; if (ghost) { ghost.remove(); ghost = null; } };
    }

    // Pip: tap for a hello, drag to move
    let pdown = null, pmoved = false;
    yp.onpointerdown = e => { pdown = { x: e.clientX, y: e.clientY }; pmoved = false; try { yp.setPointerCapture(e.pointerId); } catch (err) { /* ok */ } };
    yp.onpointermove = e => {
      if (!pdown) return;
      if (!pmoved && Math.hypot(e.clientX - pdown.x, e.clientY - pdown.y) < 8) return;
      pmoved = true;
      Object.assign(p.pos, yardXY(e.clientX, e.clientY));
      yp.style.left = p.pos.x * 100 + '%'; yp.style.top = p.pos.y * 100 + '%';
    };
    yp.onpointerup = () => {
      if (!pdown) return;
      pdown = null;
      if (pmoved) save(); else { pipTune(); palState('happy', 1300); say(LINES.hello[0]); }
    };

    $app.querySelector('#x').onclick = goHome;
    $app.querySelector('#tidy').onclick = () => { store.stickers.forEach(st => { st.out = false; }); save(); drawYard(); tab = 'book'; drawTray(); chime(); say(LINES.tidy); };
    $app.querySelector('.tabs').onclick = e => { const b = e.target.closest('button'); if (b) { tab = b.dataset.t; tap(); drawTray(); } };
    tray.onclick = e => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      if (b.dataset.h !== undefined) p.hat = b.dataset.h || null;
      if (b.dataset.c) p.color = b.dataset.c;
      if (b.dataset.s) { p.scene = b.dataset.s; yard.querySelector('.yard-bg').innerHTML = SCENES[p.scene]; }
      save(); placeYP(); drawTray(); chime(); palState('happy', 1100);
    };
    placeYP(); drawYard(); drawTray();
    // new stickers stop being "new" once she has seen the book
    setTimeout(() => { store.stickers.forEach(st => { st.fresh = false; }); save(); }, 4000);
  }

  /* ---------- running a round ---------- */
  function startGame(id) {
    const g = byId[id];
    const st = gstat(id);
    st.level = Math.min(st.level, g.levels.length - 1);
    clearTimeout(sleepTimer);
    awake = true;
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
          ${run.items ? `<span class="stop-tag">${esc(stopLabel(PATH[run.path]))}</span>` : `<button class="lvl" id="lvl" aria-label="Change level">Level ${level + 1}</button>`}
        </div>
        ${body}
      </div>`;
    $app.querySelector('#x').onclick = goHome;
    const lvlBtn = $app.querySelector('#lvl');
    if (lvlBtn) lvlBtn.onclick = levelSheet;
  }

  function levelSheet() {
    const { g } = run;
    const d = document.createElement('div');
    d.className = 'sheet';
    d.innerHTML = `<div class="sheet-box"><h3>${esc(g.name)}</h3>
      ${g.levels.map((l, i) => `<button data-l="${i}" class="opt ${i === run.level ? 'on' : ''}"><b>${i + 1}</b> ${esc(l)}</button>`).join('')}
      <button class="opt cancel">Close</button></div>`;
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
    if (run.i >= run.n) return run.items ? finishStop() : finish();
    if (run.items) {
      const it = run.items[run.i];
      run.g = it.g; run.level = it.lv; run.force = it.force;
    }
    const q = run.g.make(run.level);
    run.q = q;
    run.clean = true;
    ({ pick: renderPick, build: renderBuild, trace: renderTrace })[q.type](q);
    say(q.say);
  }

  const praiseClips = () => Clips.ids().filter(k => k.startsWith('praise-'));
  function cheer(q) {
    if (q.after) return q.after;
    const mine = praiseClips();
    if (mine.length) return { clip: one(mine) };
    return one(q.feed ? D.YUM : D.PRAISE);
  }

  async function answered(q) {
    const id = run.id;
    const st = (store.items[run.g.id + run.level + '|' + q.key] = itemStat(run.g.id + run.level, q.key));
    st[0]++; if (!run.clean) st[1]++;
    if (q.type === 'trace' && q.glyphs.length === 1 && run.clean) {
      const w = (store.write = store.write || {});
      w[q.key] = Math.max(w[q.key] || 0, Math.min(2, ['trace', 'copy', 'recall'].indexOf(q.mode || 'trace') + 1));
    }
    run.marks[run.i] = run.clean;
    if (run.clean) run.first++;
    save();
    chime();
    palState('happy', 1500);
    await Promise.all([say(cheer(q)), wait(950)]);
    if (!alive(id)) return;
    run.i++;
    nextQ();
  }

  function wireCommon(q) {
    const sp = $app.querySelector('#speak');
    if (sp) sp.onclick = () => say(q.again || q.say);
    const stim = $app.querySelector('.stim');
    if (stim && q.stimSay) stim.onclick = () => { if (q.stimHelps) run.clean = false; say(q.stimSay); };
  }

  function renderPick(q) {
    shell(`
      <div class="prompt">${palBtn()}</div>
      ${q.stim ? `<div class="stim ${q.stimSay ? 'tappable' : ''}">${q.stim}</div>` : '<div class="stim-gap"></div>'}
      <div class="choices cols-${q.cols} ${q.small ? 'small' : ''}">
        ${q.choices.map((c, i) => `<button class="choice" data-i="${i}">${c.html}</button>`).join('')}
      </div>`);
    wireCommon(q);
    let locked = false;
    $app.querySelectorAll('.choice').forEach(b => b.onclick = async () => {
      if (locked || b.disabled) return;
      const c = q.choices[+b.dataset.i];
      if (c.ok) {
        locked = true;
        const id = run.id;
        b.classList.add('yes');
        if (q.feed) {
          await wait(180);
          if (!alive(id)) return;
          palState('eat', 900);
          const food = b.firstElementChild;
          const flown = flyTo(food, $app.querySelector('#speak'));
          food.style.visibility = 'hidden';
          await flown;
          if (!alive(id)) return;
          chomp();
          await wait(380);
          if (!alive(id)) return;
        }
        answered(q);
      } else {
        run.clean = false;
        b.classList.add('nope'); b.disabled = true;
        boop();
        palState('think', 1200);
        if (c.say) say(c.say);
        else if (!q.oopsed) { q.oopsed = true; say(one(LINES.oops)); }
      }
    });
  }

  function renderBuild(q) {
    shell(`
      <div class="prompt">${palBtn()}</div>
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
        else { tap(); say(q.letters ? (sound(t) || LINES.letter(t.toUpperCase())) : LINES.word(t)); }
      } else {
        run.clean = false;
        boop();
        palState('think', 1000);
        if (!q.oopsed) { q.oopsed = true; say(one(LINES.oops)); }
        b.classList.remove('wob'); void b.offsetWidth; b.classList.add('wob');
      }
    });
  }

  /* ---------- tracing ---------- */
  const FONT = px => `700 ${px}px Andika, "Comic Sans MS", sans-serif`;
  function renderTrace(q) {
    const mode = q.mode || 'trace', free = mode !== 'trace';
    const S = Math.round(Math.min(window.innerWidth - 32, window.innerHeight * 0.52, 460));
    shell(`
      <div class="prompt">${palBtn()}${q.word ? `<div class="trace-word"><span class="tw-pic">${q.emoji}</span>${q.glyphs.map(g => `<b>${esc(g)}</b>`).join('')}</div>` : ''}${mode === 'copy' ? `<div class="model">${esc(q.glyphs[0])}</div>` : ''}</div>
      <div class="pad ${free ? 'blank' : ''}" style="width:${S}px;height:${S}px">
        <canvas id="guide"></canvas><canvas id="hint"></canvas><canvas id="ink"></canvas>
      </div>
      <div class="trace-btns">
        <button class="round big" id="clear" aria-label="Rub out">🧽</button>
        ${mode === 'recall' ? '<button class="round big" id="peek" aria-label="Peek">👀</button>' : ''}
        <button class="round big" id="skip" aria-label="Skip">➜</button>
      </div>`);
    wireCommon(q);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const guide = $app.querySelector('#guide'), hint = $app.querySelector('#hint'), ink = $app.querySelector('#ink');
    [guide, hint, ink].forEach(c => { c.width = c.height = S * dpr; c.style.width = c.style.height = S + 'px'; });
    const gc = guide.getContext('2d'), hc = hint.getContext('2d'), ic = ink.getContext('2d');
    gc.scale(dpr, dpr); hc.scale(dpr, dpr); ic.scale(dpr, dpr);
    const M = 96; // small hidden canvases used to mark the tracing
    const mk = () => { const c = document.createElement('canvas'); c.width = c.height = M; return c.getContext('2d', { willReadFrequently: true }); };
    const maskC = mk(), tolC = mk(), inkC = mk();
    let gi = 0, glyphPx = null, tolPx = null, shape = null, nudged = false, busy = false, last = null, hintTimer = null, strokes = [];
    const id = run.id;

    function drawGlyph(ctx, size, ch, stroke) {
      const fs = size * 0.62;
      ctx.font = FONT(fs);
      ctx.textBaseline = 'alphabetic';
      const w = ctx.measureText(ch).width;
      const x = (size - w) / 2, y = size * 0.67;
      if (stroke) { ctx.lineWidth = stroke; ctx.lineJoin = 'round'; ctx.strokeText(ch, x, y); }
      ctx.fillText(ch, x, y);
    }

    function setGlyph() {
      const ch = q.glyphs[gi];
      gc.clearRect(0, 0, S, S);
      ic.clearRect(0, 0, S, S);
      inkC.clearRect(0, 0, M, M);
      hc.clearRect(0, 0, S, S);
      clearTimeout(hintTimer);
      nudged = false;
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
      if (!free) drawGlyph(gc, S, ch);
      strokes = [];
      maskC.clearRect(0, 0, M, M); tolC.clearRect(0, 0, M, M);
      maskC.fillStyle = tolC.fillStyle = tolC.strokeStyle = '#000';
      drawGlyph(maskC, M, ch);
      drawGlyph(tolC, M, ch, M * 0.2);
      glyphPx = maskC.getImageData(0, 0, M, M).data;
      tolPx = tolC.getImageData(0, 0, M, M).data;
      shape = TRACE.analyse(glyphPx, M);
      window.MYABC_TRACE = { M, S, glyphPx, shape, ch, mode };
      $app.querySelectorAll('.trace-word b').forEach((b, k) => { b.className = k < gi ? 'done' : k === gi ? 'now' : ''; });
    }

    function seg(a, b) {
      ic.strokeStyle = '#3B3A6B'; ic.lineCap = ic.lineJoin = 'round'; ic.lineWidth = S * 0.085;
      ic.beginPath(); ic.moveTo(a.x, a.y); ic.lineTo(b.x, b.y); ic.stroke();
      const k = M / S;
      inkC.strokeStyle = '#000'; inkC.lineCap = inkC.lineJoin = 'round'; inkC.lineWidth = 2; // the path of her finger
      inkC.beginPath(); inkC.moveTo(a.x * k, a.y * k); inkC.lineTo(b.x * k, b.y * k); inkC.stroke();
    }
    function dot(p) { // a tap leaves a dot, so i and j can be finished
      const k = M / S;
      ic.fillStyle = '#3B3A6B';
      ic.beginPath(); ic.arc(p.x, p.y, S * 0.0425, 0, 7); ic.fill();
      inkC.fillStyle = '#000';
      inkC.beginPath(); inkC.arc(p.x * k, p.y * k, 1.2, 0, 7); inkC.fill();
    }

    // The parts still to trace glow, once most of the letter is done.
    // The parts still to trace glow, once she has made a good start.
    function showHint(r) {
      hc.clearRect(0, 0, S, S);
      const k = S / M;
      hc.fillStyle = 'rgba(168, 85, 247, .55)';
      r.unreached.forEach(p => { hc.beginPath(); hc.arc((p.x + 0.5) * k, (p.y + 0.5) * k, S * 0.055, 0, 7); hc.fill(); });
    }

    // writing without a guide: the letter shows faintly if she pauses without getting it
    function ghost(ms) {
      hc.clearRect(0, 0, S, S);
      hc.fillStyle = 'rgba(168, 85, 247, .3)';
      drawGlyph(hc, S, q.glyphs[gi]);
      run.clean = false;
      if (ms) setTimeout(() => { if (alive(id) && !busy) hc.clearRect(0, 0, S, S); }, ms);
    }
    const rivals = ch => (/\d/.test(ch) ? '0123456789' : ch === ch.toUpperCase() ? D.UPPER.join('') : D.LOWER.join('')).split('');
    function checkFree() {
      const ch = q.glyphs[gi];
      const r = TRACE.written(strokes, ch, M, drawGlyph, rivals(ch));
      window.MYABC_LAST = r;
      if (r.pass) return true;
      clearTimeout(hintTimer);
      hintTimer = setTimeout(() => {
        if (!alive(id) || busy || last || !strokes.length) return;
        ghost();
        if (!nudged) { nudged = true; say(LINES.lookAgain); }
      }, 3000);
      return false;
    }

    function check() {
      if (free) return checkFree();
      const r = TRACE.judge(shape, inkC.getImageData(0, 0, M, M).data, tolPx);
      if (r.pass) { hc.clearRect(0, 0, S, S); return true; }
      // Only hint once she has stopped drawing for a moment, not between strokes.
      clearTimeout(hintTimer);
      if (r.strayOk && r.progress >= 0.5) {
        hintTimer = setTimeout(() => {
          if (!alive(id) || busy || last) return;
          showHint(r);
          if (!nudged && r.missing.length) { nudged = true; say(LINES.nearly); }
        }, 2000);
      }
      return false;
    }

    async function passed() {
      busy = true;
      $app.querySelector('.pad').classList.add('yes');
      if (gi < q.glyphs.length - 1) {
        chime();
        palState('happy', 700);
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
      clearTimeout(hintTimer);
      e.preventDefault();
      try { ink.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
      last = pt(e); dot(last);
      strokes.push([{ x: last.x * M / S, y: last.y * M / S }]);
    };
    ink.onpointermove = e => {
      if (!last || busy) return;
      const p = pt(e); seg(last, p); last = p;
      strokes[strokes.length - 1].push({ x: p.x * M / S, y: p.y * M / S });
    };
    ink.onpointerup = ink.onpointercancel = () => {
      if (!last) return;
      last = null;
      if (!busy && check()) passed();
    };
    $app.querySelector('#clear').onclick = () => { if (!busy) { clearTimeout(hintTimer); strokes = []; ic.clearRect(0, 0, S, S); inkC.clearRect(0, 0, M, M); hc.clearRect(0, 0, S, S); } };
    const peek = $app.querySelector('#peek');
    if (peek) peek.onclick = () => { if (!busy) { tap(); ghost(2000); } };
    $app.querySelector('#skip').onclick = () => {
      if (busy) return;
      run.clean = false;
      if (gi < q.glyphs.length - 1) { gi++; setGlyph(); }
      else {
        busy = true; run.marks[run.i] = false;
        const s = (store.items[run.g.id + run.level + '|' + q.key] = itemStat(run.g.id + run.level, q.key));
        s[0]++; s[1]++; save(); run.i++; nextQ();
      }
    };

    const ready = document.fonts && document.fonts.load ? document.fonts.load(FONT(40), 'abc') : Promise.resolve();
    ready.catch(() => {}).then(() => { if (alive(id)) setGlyph(); });
  }

  /* ---------- end of round ---------- */
  function nextReward() {
    const p = store.pal;
    const n = store.stickers.length + p.hats.length + p.colors.length - 1; // rewards so far
    const hatsLeft = PAL.HATS.filter(h => !p.hats.includes(h));
    const colsLeft = Object.keys(PAL.COLORS).filter(c => !p.colors.includes(c));
    if (n % 5 === 1 && hatsLeft.length) { const h = hatsLeft[0]; p.hats.push(h); p.hat = h; return { type: 'hat', label: `A new hat for ${N()}!`, line: LINES.reward.hat }; }
    if (n % 5 === 3 && colsLeft.length) { const c = colsLeft[0]; p.colors.push(c); return { type: 'color', c, label: `A new colour for ${N()}!`, line: LINES.reward.color }; }
    return stickerReward();
  }

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
    const r = nextReward();
    save();
    const stars = pct >= 0.85 ? 3 : pct >= 0.5 ? 2 : 1;
    runId++;
    const look = r.type === 'color' ? Object.assign({}, store.pal, { color: r.c }) : store.pal;
    $app.innerHTML = `
      <div class="screen end sec-${g.sec}">
        <div class="stars">${[0, 1, 2].map(i => `<span class="${i < stars ? 'on' : ''}" style="animation-delay:${i * 0.18}s">★</span>`).join('')}</div>
        <div class="prize-row">
          <div class="end-pal">${PAL.svg(look, 'happy')}</div>
          ${r.type === 'sticker' ? `<div class="prize">${r.e}</div>` : ''}
        </div>
        <p class="prize-label">${esc(r.label)}</p>
        <div class="end-btns">
          <button class="bigbtn" id="again">🔁 <span>Again</span></button>
          <button class="bigbtn alt" id="homeb">🏠 <span>Home</span></button>
        </div>
        <button class="linkbtn" id="toplace">🏡 ${esc(N())}'s place</button>
        <p class="note">${first} of ${n} first go${note ? ' · ' + esc(note) : ''}</p>
      </div>`;
    fanfare();
    confetti();
    say([Clips.has('finish') ? { clip: 'finish' } : LINES.finished, r.line]);
    $app.querySelector('#again').onclick = () => { history.replaceState(null, ''); startGame(g.id); };
    $app.querySelector('#homeb').onclick = goHome;
    $app.querySelector('#toplace').onclick = () => { history.replaceState(null, ''); place(); };
  }

  function milestoneReward(k) {
    const p = store.pal;
    p.scenes = p.scenes || ['garden'];
    const kinds = ['hat', 'color', 'scene'];
    for (let t = 0; t < 3; t++) {
      const kind = kinds[(k + t) % 3];
      if (kind === 'hat') { const h = PAL.HATS.find(x => !p.hats.includes(x)); if (h) { p.hats.push(h); p.hat = h; return { type: 'hat', label: `A new hat for ${N()}!`, line: LINES.reward.hat }; } }
      if (kind === 'color') { const c = Object.keys(PAL.COLORS).find(x => !p.colors.includes(x)); if (c) { p.colors.push(c); return { type: 'color', c, label: `A new colour for ${N()}!`, line: LINES.reward.color }; } }
      if (kind === 'scene') { const sc = Object.keys(SCENES).find(x => !p.scenes.includes(x)); if (sc) { p.scenes.push(sc); p.scene = sc; return { type: 'scene', sc, label: 'A new place for the yard!', line: LINES.reward.scene }; } }
    }
    return null;
  }
  function stickerReward() {
    const have = store.stickers.map(s => s.e);
    const fresh = D.STICKERS.filter(s => !have.includes(s));
    const e = one(fresh.length ? fresh : D.STICKERS);
    store.stickers.push(Object.assign({ e, out: false, fresh: true }, freeSpot()));
    return { type: 'sticker', e, label: 'New sticker!', line: LINES.reward.sticker };
  }

  function finishStop() {
    const { path: i, first, n } = run;
    const ps = pathState();
    const pct = first / n, stars = pct >= 0.85 ? 3 : pct >= 0.5 ? 2 : 1;
    const firstTime = !ps.done[i];
    ps.done[i] = true;
    ps.stars[i] = Math.max(ps.stars[i] || 0, stars);
    ps.quick = pct >= 0.95;
    if (i === ps.at && ps.at < PATH.length - 1) ps.at++;
    const r = (firstTime && isMilestone(i) && milestoneReward(Math.floor(i / 5))) || stickerReward();
    save();
    runId++;
    const look = r.type === 'color' ? Object.assign({}, store.pal, { color: r.c }) : store.pal;
    const more = i + 1 < PATH.length;
    $app.innerHTML = `
      <div class="screen end sec-${run.g.sec}">
        <div class="stars">${[0, 1, 2].map(k => `<span class="${k < stars ? 'on' : ''}" style="animation-delay:${k * 0.18}s">★</span>`).join('')}</div>
        <div class="prize-row">
          <div class="end-pal">${PAL.svg(look, 'happy')}</div>
          ${r.type === 'sticker' ? `<div class="prize">${r.e}</div>` : r.type === 'scene' ? `<div class="prize scene-prize">${SCENE_ICON[r.sc]}</div>` : ''}
        </div>
        <p class="prize-label">${esc(r.label)}</p>
        <div class="end-btns">
          ${more ? '<button class="bigbtn" id="next">➜ <span>Next stop</span></button>' : ''}
          <button class="bigbtn alt" id="homeb">🗺 <span>Path</span></button>
        </div>
        <button class="linkbtn" id="toplace">🏡 ${esc(N())}'s place</button>
        <p class="note">${first} of ${n} first go</p>
      </div>`;
    fanfare();
    confetti();
    say([Clips.has('finish') ? { clip: 'finish' } : LINES.finished, r.line, more ? LINES.path.next : null]);
    if (more) $app.querySelector('#next').onclick = () => { history.replaceState(null, ''); startStop(Math.min(i + 1, ps.at)); };
    $app.querySelector('#homeb').onclick = goHome;
    $app.querySelector('#toplace').onclick = () => { history.replaceState(null, ''); place(); };
  }

  /* ---------- updates ----------
     The app is a page that can stay open for days, so it checks GitHub itself:
     on launch, whenever it comes back to the front, and from the grown-ups page.
     It fingerprints its own files; if they changed, it reloads at the next quiet moment. */
  const APP_FILES = ['index.html', 'css/style.css', 'js/data.js', 'js/pal.js', 'js/lines.js', 'js/trace.js', 'js/app.js', 'sw.js', 'audio/index.json'];
  let loadedPrint = null, updateReady = false, lastCheck = 0;
  async function fingerprint() {
    let h = 5381;
    for (const f of APP_FILES) {
      const r = await fetch(f + '?_=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) throw new Error('offline');
      const t = await r.text();
      for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0;
    }
    return (h >>> 0).toString(36);
  }
  // Returns 'same', 'new' or 'offline'.
  async function checkUpdate(force) {
    if (!force && Date.now() - lastCheck < 60 * 1000) return updateReady ? 'new' : 'same';
    lastCheck = Date.now();
    try {
      const now = await fingerprint();
      if (loadedPrint === null) { loadedPrint = now; return 'same'; }
      if (now === loadedPrint) return 'same';
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) await reg.update().catch(() => {});
      }
      updateReady = true;
      return 'new';
    } catch (e) { lastCheck = 0; return 'offline'; }
  }
  function applyUpdate() {
    // one reload per new version, so a hiccup can never cause a reload loop
    try { if (sessionStorage.getItem('myabc.reloads') >= 3) return; sessionStorage.setItem('myabc.reloads', (+sessionStorage.getItem('myabc.reloads') || 0) + 1); } catch (e) { /* ok */ }
    location.reload();
  }
  const quiet = () => !!document.querySelector('.world-screen, .path-screen') && !document.querySelector('.sheet');
  async function autoUpdate() {
    if (await checkUpdate(false) === 'new' && quiet()) applyUpdate();
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') autoUpdate(); });

  /* ---------- grown-ups ---------- */
  function tricky(id) {
    return Object.entries(store.items)
      .filter(([k, v]) => k.split('|')[0].replace(/\d$/, '') === id && v[1] > 0)
      .sort((a, b) => b[1][1] / b[1][0] - a[1][1] / a[1][0] || b[1][1] - a[1][1])
      .slice(0, 6).map(([k]) => k.split('|')[1]);
  }
  function summaryText() {
    const ps = pathState();
    const lines = [`My ABC progress, ${new Date().toISOString().slice(0, 10)}`,
      `Path: at stop ${ps.at + 1} of ${PATH.length} (${stopLabel(PATH[ps.at])}). Writes from memory: ${D.ORDER.filter(l => writeStage(l) >= 2).join(' ') || 'none'}. Copies: ${D.ORDER.filter(l => writeStage(l) === 1).join(' ') || 'none'}.`];
    GAMES.forEach(g => {
      const st = gstat(g.id);
      if (!st.rounds.length) { lines.push(`${g.name}: not played yet`); return; }
      const recent = st.rounds.slice(-5).map(r => `L${r.l + 1} ${r.s}/${r.n}`).join(', ');
      const t = tricky(g.id);
      lines.push(`${g.name}: now level ${st.level + 1}/${g.levels.length}, ${st.rounds.length} rounds. Recent: ${recent}.${t.length ? ' Tricky: ' + t.join(', ') + '.' : ''}`);
    });
    return lines.join('\n');
  }

  function grownups() {
    pushNav();
    runId++;
    hush();
    const rows = SECTIONS.map(sec => `<h3 class="g-sec sec-${sec.id}">${sec.name}</h3>` + GAMES.filter(g => g.sec === sec.id).map(g => {
      const st = gstat(g.id);
      const recent = st.rounds.slice(-5).map(r => `${r.s}/${r.n}`).join(' · ') || 'not played yet';
      const t = tricky(g.id);
      return `<div class="g-row">
        <div class="g-head"><b>${esc(g.name)}</b><span>${st.rounds.length} rounds</span></div>
        <div class="g-levels">${g.levels.map((l, i) => `<button data-g="${g.id}" data-l="${i}" class="${i === st.level ? 'on' : ''}">${i + 1}. ${esc(l)}</button>`).join('')}</div>
        <div class="g-meta">First-go scores: ${recent}${t.length ? `<br>Tricky: ${esc(t.join(', '))}` : ''}</div>
      </div>`;
    }).join('')).join('');
    $app.innerHTML = `
      <div class="screen grown">
        <div class="bar"><button class="round" id="x" aria-label="Back">←</button><h2>Grown-ups</h2><span></span></div>
        <p class="g-intro">Each game picks its own level: two strong rounds in a row moves up, a hard round moves back. Tap a level to set it yourself. Scores count answers that were right first go.</p>
        <div class="g-set">
          <label class="g-name">Friend's name <input id="pname" maxlength="12" value="${esc(N())}" autocomplete="off"></label>
          <button id="voice">🎙 Record your voice (${Clips.ids().length} saved)</button>
          <button id="rate">Voice speed: <b>${store.settings.rate < 0.8 ? 'slow' : store.settings.rate < 0.95 ? 'gentle' : 'normal'}</b></button>
          <button id="sfx">Sounds: <b>${store.settings.sfx ? 'on' : 'off'}</b></button>
          <button id="copy">Copy progress summary</button>
        </div>
        <h3 class="g-sec">Path</h3>
        <div class="g-row">
          <div class="g-head"><b>Stop ${pathState().at + 1} of ${PATH.length}: ${esc(stopLabel(PATH[pathState().at]))}</b><span>${Object.keys(pathState().done).length} done</span></div>
          <div class="g-levels"><button id="pback">◀ Back a stop</button><button id="pfwd">Skip ahead a stop ▶</button></div>
          <div class="g-meta">Writing from memory: ${D.ORDER.filter(l => writeStage(l) >= 2).join(' ') || 'none yet'}<br>Copying: ${D.ORDER.filter(l => writeStage(l) === 1).join(' ') || 'none yet'}</div>
          <button id="update">Check for updates${loadedPrint ? ` <span class="ver">(version ${loadedPrint})</span>` : ''}</button>
        </div>
        ${rows}
        <button id="reset" class="danger">Reset all progress</button>
        <p class="g-intro">${Voice.ready ? `Pip's voice: built-in recordings (${Object.keys(Voice.clips).length} lines), so no phone voice is needed.` : (hasSpeech ? "Pip's voice: recordings not loaded yet, using this phone's voice for now." : "Pip's voice: recordings not loaded yet, and this browser has no voice of its own.")}</p>
      </div>`;
    $app.querySelector('#x').onclick = goHome;
    $app.querySelectorAll('.g-levels button').forEach(b => b.onclick = () => {
      gstat(b.dataset.g).level = +b.dataset.l; save();
      b.parentNode.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    });
    const rerender = () => { history.replaceState(null, ''); grownups(); };
    $app.querySelector('#pname').onchange = e => { store.pal.name = e.target.value.trim().slice(0, 12) || 'Pip'; save(); };
    $app.querySelector('#pback').onclick = () => { const ps = pathState(); ps.at = Math.max(0, ps.at - 1); save(); rerender(); };
    $app.querySelector('#pfwd').onclick = () => { const ps = pathState(); ps.done[ps.at] = true; ps.at = Math.min(PATH.length - 1, ps.at + 1); save(); rerender(); };
    $app.querySelector('#voice').onclick = () => { history.replaceState(null, ''); voiceScreen(); };
    $app.querySelector('#rate').onclick = () => { const r = store.settings.rate; store.settings.rate = r < 0.8 ? 0.85 : r < 0.95 ? 1 : 0.7; save(); rerender(); say(LINES.speedTest); };
    $app.querySelector('#sfx').onclick = () => { store.settings.sfx = !store.settings.sfx; save(); rerender(); };
    $app.querySelector('#update').onclick = async e => {
      const b = e.currentTarget;
      b.textContent = 'Checking…';
      const r = await checkUpdate(true);
      if (r === 'new') { b.textContent = 'Updating…'; await wait(400); applyUpdate(); }
      else b.textContent = r === 'offline' ? 'No connection. Try again later.' : `Up to date (version ${loadedPrint})`;
    };
    $app.querySelector('#copy').onclick = async e => {
      const text = summaryText();
      try { await navigator.clipboard.writeText(text); e.target.textContent = 'Copied!'; }
      catch (err) { window.prompt('Copy this:', text); }
    };
    $app.querySelector('#reset').onclick = () => {
      if (!window.confirm('Clear all scores, levels, stickers, hats and colours? Voice recordings are kept.')) return;
      store.games = {}; store.items = {}; store.stickers = []; store.path = {}; store.write = {};
      Object.assign(store.pal, { hat: null, hats: [], color: 'brown', colors: ['brown'], scenes: ['garden'], scene: 'garden' });
      save(); rerender();
    };
  }

  /* ---------- recording your own voice ---------- */
  let mic = null, recorder = null;
  function stopMic() {
    try { if (recorder && recorder.state === 'recording') recorder.stop(); } catch (e) { /* ok */ }
    recorder = null;
    if (mic) { mic.getTracks().forEach(t => t.stop()); mic = null; }
  }
  const PRAISE_SLOTS = [1, 2, 3, 4, 5, 6].map(i => 'praise-' + i);
  const clipLabel = id => (id.startsWith('snd-') ? `the sound of “${id.slice(4)}”` : id === 'finish' ? 'the “round finished” cheer' : `praise ${id.slice(7)}`);

  function voiceScreen() {
    pushNav();
    runId++;
    hush();
    const canRec = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
    let sel = D.LOWER.map(l => 'snd-' + l).find(k => !Clips.has(k)) || 'snd-a';
    const tile = (id, text) => `<button class="v-tile" data-id="${id}">${text}</button>`;
    $app.innerHTML = `
      <div class="screen grown voice">
        <div class="bar"><button class="round" id="x" aria-label="Back">←</button><h2>Your voice</h2><span></span></div>
        <p class="g-intro">Tap a tile, then Record. Recordings stay on this phone and are never uploaded.</p>
        ${canRec ? '' : '<p class="g-intro warn">This browser cannot record. Open the app in Chrome and allow the microphone.</p>'}
        <h3 class="g-sec">Letter sounds</h3>
        <p class="g-intro">Say the pure sound, short and clean: “mmm”, not “em” or “muh”. Played when she builds words and matches sounds.</p>
        <div class="v-grid">${D.LOWER.map(l => tile('snd-' + l, l)).join('')}</div>
        <h3 class="g-sec">Praise</h3>
        <p class="g-intro">Anything you like, such as “Great job!” with her name. One plays at random after a right answer.</p>
        <div class="v-grid wide">${PRAISE_SLOTS.map((id, i) => tile(id, i + 1)).join('')}</div>
        <h3 class="g-sec">Round finished</h3>
        <div class="v-grid wide">${tile('finish', '🎉')}</div>
        <div class="v-ctl">
          <div id="v-what"></div>
          <div class="v-btns">
            <button id="v-rec" ${canRec ? '' : 'disabled'}>● Record</button>
            <button id="v-play">▶ Play</button>
            <button id="v-del">Delete</button>
          </div>
        </div>
      </div>`;
    const recBtn = $app.querySelector('#v-rec');
    const paint = () => {
      $app.querySelectorAll('.v-tile').forEach(t => { t.classList.toggle('has', Clips.has(t.dataset.id)); t.classList.toggle('on', t.dataset.id === sel); });
      $app.querySelector('#v-what').textContent = `${Clips.has(sel) ? 'Recorded' : 'Not recorded'}: ${clipLabel(sel)}`;
      $app.querySelector('#v-play').disabled = $app.querySelector('#v-del').disabled = !Clips.has(sel);
    };
    paint();
    $app.querySelector('#x').onclick = () => { stopMic(); goHome(); };
    $app.querySelectorAll('.v-tile').forEach(t => t.onclick = () => { if (recorder) return; sel = t.dataset.id; paint(); if (Clips.has(sel)) playClip(sel); });
    $app.querySelector('#v-play').onclick = () => playClip(sel);
    $app.querySelector('#v-del').onclick = async () => { await Clips.del(sel); paint(); };
    recBtn.onclick = async () => {
      if (recorder) { try { recorder.stop(); } catch (e) { /* ok */ } return; }
      try {
        mic = mic || await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) { $app.querySelector('#v-what').textContent = 'Microphone not allowed. Check the site permissions.'; return; }
      const id = sel, chunks = [];
      const r = recorder = new MediaRecorder(mic);
      r.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      r.onstop = async () => {
        if (recorder === r) recorder = null;
        recBtn.textContent = '● Record'; recBtn.classList.remove('live');
        if (!chunks.length || !document.querySelector('.voice')) return;
        await Clips.put(id, new Blob(chunks, { type: r.mimeType || 'audio/webm' }));
        if (document.querySelector('.voice')) paint();
        await playClip(id);
        // step on to the next empty letter so a run of 26 is quick
        if (id.startsWith('snd-') && sel === id) { const nxt = D.LOWER.map(l => 'snd-' + l).find(k => !Clips.has(k)); if (nxt) sel = nxt; }
        if (document.querySelector('.voice')) paint();
      };
      r.start();
      recBtn.textContent = '■ Stop'; recBtn.classList.add('live');
      setTimeout(() => { if (r.state === 'recording') r.stop(); }, id.startsWith('snd-') ? 2500 : 5000);
    };
  }

  // Recordings load before the first screen so they are ready for the first game.
  Promise.race([Promise.all([Clips.ready, Voice.load]), wait(1500)]).then(home);
  Voice.load.then(() => setTimeout(cacheVoice, 4000));
})();
