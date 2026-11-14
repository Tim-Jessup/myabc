// Word lists and pictures. Edit freely: everything the games use lives here.
const DATA = (() => {
  const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const LOWER = 'abcdefghijklmnopqrstuvwxyz'.split('');

  // Letters that little eyes mix up. Used for the harder "find the letter" level.
  const CONFUSABLE = [
    ['b', 'd', 'p', 'q'], ['m', 'n', 'u', 'w'], ['i', 'l', 'j', 't'],
    ['a', 'e', 'o', 'c'], ['h', 'n', 'r', 'k'], ['f', 't', 'l', 'k'],
    ['v', 'w', 'y', 'x'], ['g', 'q', 'p', 'y'], ['s', 'z', 'c', 'e']
  ];

  // Pictures for "what does it start with". [word, emoji]. Plain first sounds only.
  const START = {
    a: [['apple', '🍎'], ['ant', '🐜']],
    b: [['banana', '🍌'], ['bus', '🚌'], ['bee', '🐝'], ['book', '📖']],
    c: [['cat', '🐱'], ['cow', '🐮'], ['carrot', '🥕']],
    d: [['dog', '🐶'], ['duck', '🦆'], ['door', '🚪']],
    e: [['egg', '🥚'], ['elephant', '🐘']],
    f: [['fish', '🐟'], ['frog', '🐸'], ['fox', '🦊']],
    g: [['goat', '🐐'], ['grapes', '🍇']],
    h: [['hat', '🎩'], ['horse', '🐴'], ['house', '🏠']],
    i: [['iguana', '🦎']],
    j: [['juice', '🧃']],
    k: [['kangaroo', '🦘'], ['key', '🔑'], ['koala', '🐨']],
    l: [['lion', '🦁'], ['leaf', '🍃'], ['lemon', '🍋']],
    m: [['moon', '🌙'], ['mouse', '🐭'], ['milk', '🥛']],
    n: [['nose', '👃'], ['nut', '🥜']],
    o: [['octopus', '🐙'], ['orange', '🍊']],
    p: [['pig', '🐷'], ['pizza', '🍕'], ['penguin', '🐧']],
    q: [['queen', '👸']],
    r: [['rabbit', '🐰'], ['rocket', '🚀'], ['rainbow', '🌈']],
    s: [['sun', '☀️'], ['snake', '🐍'], ['sock', '🧦'], ['star', '⭐']],
    t: [['tiger', '🐯'], ['train', '🚂'], ['tree', '🌳']],
    u: [['umbrella', '☂️']],
    v: [['van', '🚐'], ['violin', '🎻']],
    w: [['web', '🕸️'], ['watermelon', '🍉']],
    y: [['yo-yo', '🪀']],
    z: [['zebra', '🦓']]
  };

  // Short "sound it out" words with a clear picture.
  const CVC = [
    ['cat', '🐱'], ['dog', '🐶'], ['pig', '🐷'], ['hen', '🐔'], ['bug', '🐛'],
    ['sun', '☀️'], ['hat', '🎩'], ['bed', '🛏️'], ['bus', '🚌'], ['fox', '🦊'],
    ['bat', '🦇'], ['pen', '🖊️'], ['map', '🗺️'], ['van', '🚐'], ['log', '🪵'],
    ['web', '🕸️'], ['bin', '🗑️'], ['box', '📦'], ['nut', '🥜'], ['leg', '🦵'],
    ['rat', '🐀'], ['cap', '🧢'], ['can', '🥫'], ['pin', '📌'], ['ten', '🔟'],
    ['egg', '🥚'], ['ant', '🐜'], ['bag', '🛍️'], ['gem', '💎'], ['man', '👨']
  ];

  // A step up: four and five letter words.
  const LONGER = [
    ['frog', '🐸'], ['duck', '🦆'], ['fish', '🐟'], ['ship', '🚢'], ['star', '⭐'],
    ['moon', '🌙'], ['tree', '🌳'], ['book', '📖'], ['cake', '🎂'], ['bird', '🐦'],
    ['drum', '🥁'], ['bell', '🔔'], ['sock', '🧦'], ['ring', '💍'], ['milk', '🥛'],
    ['crab', '🦀'], ['hand', '✋'], ['goat', '🐐'], ['lion', '🦁'],
    ['snail', '🐌'], ['train', '🚂'], ['apple', '🍎'], ['house', '🏠'], ['horse', '🐴']
  ];

  const SIGHT = [
    ['I', 'a', 'the', 'is', 'it', 'in', 'to', 'and', 'me', 'we', 'go', 'my'],
    ['no', 'see', 'he', 'she', 'you', 'can', 'at', 'on', 'up', 'am', 'like', 'look'],
    ['was', 'are', 'said', 'come', 'here', 'play', 'this', 'that', 'have', 'they', 'with', 'what']
  ];

  const SENTENCES = [
    ['I see a cat', 'I can run', 'Look at me', 'I am up', 'We can go', 'I like you',
      'It is hot', 'I see you', 'Go to bed', 'He can hop'],
    ['The dog is big', 'I like my hat', 'The sun is hot', 'We go to bed', 'She has a pen',
      'He is on a bus', 'The fox can hop', 'I can see the moon', 'Look at the big pig',
      'The cat is on the bed']
  ];

  const COUNTABLES = ['🍎', '⭐', '🐟', '🐞', '🌸', '🚗', '🎈', '🍓', '🐥', '🦋'];

  const STICKERS = ['🦘', '🐨', '🦉', '🐢', '🦄', '🐬', '🦋', '🐝', '🐙', '🦊', '🐼', '🦁',
    '🐸', '🐧', '🦜', '🐳', '🦖', '🐞', '🌈', '🚀', '🍉', '🍦', '🎈', '⭐', '🌻', '🍓',
    '🧸', '🎨', '🚂', '🏰', '🦩', '🐿️', '🦔', '🐠', '🪁', '🌙'];

  // What the friend says after a right answer. YUM is for the games where it eats the answer.
  const PRAISE = ['Thank you!', 'You did it!', 'Great helping!', 'Yes!', 'Well done!', 'You got it!'];
  const YUM = ['Yum!', 'Yum yum!', 'Delicious!', 'More please!', 'Tasty!'];

  return { UPPER, LOWER, CONFUSABLE, START, CVC, LONGER, SIGHT, SENTENCES, COUNTABLES, STICKERS, PRAISE, YUM };
})();
