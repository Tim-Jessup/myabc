// Everything the app says out loud. The games build their prompts from these, and
// tools/make_voice.py turns LINES.all() into the audio files in audio/.
// If you add or change a line, run that script again so it gets a recording.
const LINES = (() => {
  const L = {
    hello: ['Hello!', "I'm Pip.", "Let's play!"],
    places: { letters: 'The letter tree!', sounds: 'The sound bell!', words: 'The word house!', writing: 'The big pencil!' },
    intro: {
      findLetter: "I'm hungry for letters!",
      matchCase: 'These letters lost their partners. Can you help me?',
      firstSound: 'I found some things.',
      readWord: "I can't read these words. Can you help? Which picture is it?",
      sightWords: "I'm hungry for words!",
      buildWord: 'Oh no, my words fell apart!',
      sentence: 'My sentences got mixed up. Put it back:',
      traceLetters: 'Help me learn to write.',
      traceWords: 'Help me write words.',
      writeLetters: 'Can you write letters all by yourself?',
      buildSight: 'Can you build these tricky words?'
    },
    // writing without a guide
    copyLetter: T => `Can you write ${T}, just like this?`,
    writeLittle: T => `Can you write little ${T}?`,
    writeBig: T => `Can you write big ${T}?`,
    lookAgain: 'Have a look... now you try!',
    showMe: "Good try! Here's how it looks.",
    // a wrong answer: curious and kind, never "wrong"
    oops: ["Hmm, not that one. Let's look again!", 'Ooh, tricky one! Try another.', 'Oops! Have another go.', 'So close! Have a look again.'],
    path: { go: "Let's go!", next: 'Hooray! On to the next stop!', locked: "We're not there yet. Let's keep walking!" },
    sticker: name => `${/^[aeiou]/.test(name) ? 'An' : 'A'} ${name}!`,
    tidy: 'All tidy!',
    // introducing something new
    newLetter: "Here's a new letter!",
    newWord: "Here's a new word!",
    thisIs: x => `This is ${x}.`,
    inWord: (T, w) => `Can you see the ${T} in ${w}?`,
    wordSays: w => `This word says ${w}.`,
    tricky: "It's a tricky word, so we just remember it.",
    inSentence: w => `Can you see ${w}?`,
    sayIt: x => `Can you say ${x}? Press the button and say it!`,
    heard: ['I heard you!', 'Great saying!', 'Lovely!'],
    noMic: 'Say it out loud!',
    buildSight: w => `Build the word ${w}.`,
    newPrize: 'A new prize for your collection!',
    gatePass: 'You passed the challenge! Hooray!',
    // the prize room
    room: 'Look at all your prizes!',
    roomDusty: 'Some of your prizes are a bit dusty. Shall we polish them?',
    dusty: "This one's a bit dusty!",
    allClean: 'Everything is sparkling!',
    sparkly: ['Sparkly!', 'So shiny!', 'Look how they shine!'],
    nudge: "I'd love a new prize. Shall we play a game?",
    findLetter: T => `Find the letter ${T}.`,
    bigToLittle: T => `This is big ${T}. Find little ${T}.`,
    littleToBig: T => `This is little ${T}. Find big ${T}.`,
    startsWithQ: w => `${w}. What letter does ${w} start with?`,
    endsWithQ: w => `${w}. What letter is at the end of ${w}?`,
    forWord: (T, w) => `${T}, for ${w}.`,
    endsWith: (w, T) => `${w} ends with ${T}.`,
    wantStarts: T => `I want something that starts with ${T}.`,
    whichOne: 'Which one?',
    whichStarts: T => `Which one starts with ${T}?`,
    startsWith: (w, T) => `${w} starts with ${T}.`,
    word: w => `${w}.`,
    letter: T => `${T}.`,
    readWord: 'Read the word. Which picture is it?',
    findWord: w => `Find the word: ${w}.`,
    build: w => `${w}. Build ${w}.`,
    sentence: s => `${s}.`,
    traceLetter: T => `Trace the letter ${T}.`,
    writeWord: w => `Write the word ${w}.`,
    nearly: 'Nearly! Trace the glowing bit.',
    finished: 'You did it!',
    reward: { hat: 'I got a new hat!', color: 'I can change colour now!', sticker: 'A new sticker for my place!', scene: 'A new place for my yard!' },
    speedTest: 'This is how fast I talk.'
  };

  // Every line the app can say, for making the recordings.
  L.all = (D, C) => {
    const out = new Set();
    const add = x => [].concat(x).forEach(s => out.add(s));
    const letters = D.UPPER;
    const startWords = Object.values(D.START).flat().map(x => x[0]);
    const pictureWords = D.CVC.concat(D.LONGER).map(x => x[0]);
    add(L.hello); add(Object.values(L.places)); add(Object.values(L.intro));
    add([L.whichOne, L.readWord, L.nearly, L.finished, L.speedTest, L.lookAgain, L.showMe, L.tidy]);
    add(L.oops); add(Object.values(L.path));
    letters.forEach(T => add([L.copyLetter(T), L.writeLittle(T), L.writeBig(T)]));
    Object.values(D.STICKER_NAMES).forEach(n => add(L.sticker(n)));
    add([L.newLetter, L.newWord, L.tricky, L.noMic, L.newPrize, L.gatePass, L.room, L.roomDusty, L.dusty, L.allClean, L.nudge]);
    add(L.heard); add(L.sparkly);
    letters.forEach(T => add([L.thisIs(T), L.sayIt(T)]));
    D.SIGHT.flat().forEach(w => add([L.word(w), L.wordSays(w), L.inSentence(w), L.sayIt(w), L.writeWord(w), L.buildSight(w)]));
    if (C) Object.entries(C.LETTER_WORD).forEach(([l, [w]]) => add([L.word(w), L.inWord(l.toUpperCase(), w)]));
    add(Object.values(L.reward)); add(D.PRAISE); add(D.YUM);
    letters.forEach(T => add([L.findLetter(T), L.bigToLittle(T), L.littleToBig(T), L.letter(T), L.traceLetter(T), L.wantStarts(T), L.whichStarts(T)]));
    Object.entries(D.START).forEach(([l, ws]) => ws.forEach(([w]) => add([L.startsWithQ(w), L.forWord(l.toUpperCase(), w), L.startsWith(w, l.toUpperCase())])));
    D.CVC.forEach(([w]) => add([L.endsWithQ(w), L.endsWith(w, w[w.length - 1].toUpperCase())]));
    startWords.concat(pictureWords).forEach(w => add(L.word(w)));
    pictureWords.forEach(w => add([L.build(w), L.writeWord(w)]));
    D.SIGHT.flat().forEach(w => add(L.findWord(w)));
    D.SENTENCES.flat().forEach(s => { add(L.sentence(s)); s.split(' ').forEach(w => add(L.word(w))); });
    return [...out];
  };

  // Lines are matched to recordings by their words, ignoring case and punctuation.
  // A line that is just a capital letter is the letter's name ("A" said "ay"),
  // which is different from the word "a".
  L.key = s => {
    const k = String(s).toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
    return /^[A-Z]\W*$/.test(String(s).trim()) ? 'letter ' + k : k;
  };

  return L;
})();
if (typeof module !== 'undefined') module.exports = LINES;
