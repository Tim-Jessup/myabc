// Spaced repetition, flashcard style. Every skill she learns is a card:
//   letter:s:see  (pick s out of a set)     letter:s:sound  (what starts with s)
//   letter:s:write (write s from memory)    number:3:see / number:3:count / number:3:write
//   sight:the:see / sight:the:spell         word:cat:read / word:cat:spell
// A card sits in a box. Each box comes back after a longer gap. Three ways an answer can go:
//   clean   right first go: up a box
//   helped  right in the end, after a wrong try or a peek: down a box, so it comes back
//           sooner, but it's done for now (it gets polished)
//   missed  skipped: down two boxes, and it stays dusty until she gets it
// "Dust" is how overdue a card is, or a miss she hasn't put right yet. It's what the prize
// room shows.
const CARDS = (() => {
  const DAY = 864e5;
  const GAPS = [10 / 1440, 1, 3, 7, 14, 30]; // days, box 0 to 5

  const key = (type, v, skill) => `${type}:${v}:${skill}`;
  const itemOf = k => k.split(':').slice(0, 2).join(':');

  function ensure(store, k, box = 0, now = Date.now()) {
    store.cards = store.cards || {};
    if (!store.cards[k]) store.cards[k] = { box, due: now + GAPS[box] * DAY, seen: 0, miss: 0, last: now };
    return store.cards[k];
  }

  function grade(store, k, result, now = Date.now()) {
    const c = store.cards && store.cards[k];
    if (!c) return;
    if (result === true) result = 'clean';
    if (result === false) result = 'missed';
    c.seen++; c.last = now;
    if (result === 'clean') { c.box = Math.min(GAPS.length - 1, c.box + 1); c.lastOk = now; }
    else if (result === 'helped') { c.miss++; c.lastMiss = now; c.lastOk = now; c.box = Math.max(0, c.box - 1); }
    else { c.miss++; c.lastMiss = now; c.box = Math.max(0, c.box - 2); }
    c.due = now + GAPS[c.box] * DAY;
  }

  // 0 shiny, 1 a little dusty (due), 2 dusty, 3 very dusty
  function dust(c, now = Date.now()) {
    if (!c) return 0;
    const gap = GAPS[c.box] * DAY, over = now - c.due;
    let d = over < 0 ? 0 : over < gap ? 1 : over < 3 * gap ? 2 : 3;
    if (c.lastMiss && !(c.lastOk >= c.lastMiss)) d = Math.max(d, 2); // a miss not yet put right
    return d;
  }

  const cardsOf = (store, item) => Object.entries(store.cards || {}).filter(([k]) => itemOf(k) === item);
  const itemDust = (store, item, now = Date.now()) => cardsOf(store, item).reduce((m, [, c]) => Math.max(m, dust(c, now)), 0);

  // the cards most in need of practice, spread across different items where possible
  function queue(store, n, ok = () => true, now = Date.now()) {
    const all = Object.entries(store.cards || {}).filter(([k]) => ok(k));
    const score = ([, c]) => dust(c, now) * 100 + (now - c.due) / DAY + (5 - c.box) * 2 + Math.random();
    all.sort((a, b) => score(b) - score(a));
    const out = [], used = new Set();
    for (const [k] of all) { if (out.length < n && !used.has(itemOf(k))) { out.push(k); used.add(itemOf(k)); } }
    for (const [k] of all) { if (out.length < n && !out.includes(k)) out.push(k); }
    return out;
  }

  return { key, itemOf, ensure, grade, dust, itemDust, cardsOf, queue, GAPS, DAY };
})();
