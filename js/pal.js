// The platypus friend. Drawn here as SVG so it looks the same on every phone.
const PAL = (() => {
  const COLORS = {
    brown: { body: '#9A6B4B', dark: '#7A5238', belly: '#EBD2B4' },
    blue: { body: '#5B8DB8', dark: '#3F6E97', belly: '#DCEBF5' },
    rose: { body: '#D9798F', dark: '#B85A72', belly: '#FBE1E6' },
    gold: { body: '#E0A32E', dark: '#B9821A', belly: '#FBEBC4' },
    mint: { body: '#4DB6A0', dark: '#34907C', belly: '#DCF3EC' },
    purple: { body: '#9B7AD8', dark: '#7858B8', belly: '#EBE2FA' }
  };
  const HATS = ['🎩', '👑', '🧢', '🎀', '🌸', '🎓', '👒', '⛑️'];
  const BOX = '-10 -8 220 224';

  // Inner drawing. state: idle | happy | think | sleep | eat
  function g({ color = 'brown', hat = null } = {}, state = 'idle') {
    const c = COLORS[color] || COLORS.brown;
    return `<g class="pal" data-s="${state}">
      <g class="p-tail"><ellipse cx="152" cy="170" rx="40" ry="17" fill="${c.dark}" transform="rotate(-20 152 170)"/></g>
      <ellipse cx="74" cy="194" rx="21" ry="9" fill="#565B77"/><ellipse cx="126" cy="194" rx="21" ry="9" fill="#565B77"/>
      <g class="p-body">
        <g class="p-arm p-arm-l"><ellipse cx="45" cy="138" rx="11" ry="21" fill="${c.dark}" transform="rotate(22 45 138)"/></g>
        <g class="p-arm p-arm-r"><ellipse cx="155" cy="138" rx="11" ry="21" fill="${c.dark}" transform="rotate(-22 155 138)"/></g>
        <ellipse cx="100" cy="124" rx="60" ry="70" fill="${c.body}"/>
        <ellipse cx="100" cy="150" rx="38" ry="37" fill="${c.belly}"/>
        <circle cx="60" cy="104" r="9" fill="#FF8FA3" opacity=".45"/><circle cx="140" cy="104" r="9" fill="#FF8FA3" opacity=".45"/>
        <g class="p-eyes">
          <circle cx="76" cy="84" r="8.5" fill="#2B2A4C"/><circle cx="79" cy="81" r="2.8" fill="#fff"/>
          <circle cx="124" cy="84" r="8.5" fill="#2B2A4C"/><circle cx="127" cy="81" r="2.8" fill="#fff"/>
        </g>
        <g class="p-smile" fill="none" stroke="#2B2A4C" stroke-width="4.5" stroke-linecap="round">
          <path d="M67 88 q9 -10 18 0"/><path d="M115 88 q9 -10 18 0"/>
        </g>
        <g class="p-shut" fill="none" stroke="#2B2A4C" stroke-width="4.5" stroke-linecap="round">
          <path d="M67 83 q9 8 18 0"/><path d="M115 83 q9 8 18 0"/>
        </g>
        <ellipse class="p-jaw" cx="100" cy="113" rx="33" ry="11" fill="#3E4257"/>
        <ellipse cx="100" cy="106" rx="45" ry="15" fill="#565B77"/>
        <circle cx="90" cy="101" r="2.2" fill="#3E4257"/><circle cx="110" cy="101" r="2.2" fill="#3E4257"/>
        ${hat ? `<text class="p-hat" x="100" y="60" text-anchor="middle" font-size="58">${hat}</text>` : ''}
      </g>
      <g class="p-zzz" fill="#7A7896" font-weight="700"><text x="150" y="58" font-size="24">z</text><text x="168" y="36" font-size="32">z</text></g>
    </g>`;
  }
  const svg = (opts, state, cls = '') => `<svg class="pal-svg ${cls}" viewBox="${BOX}" aria-hidden="true">${g(opts, state)}</svg>`;

  return { COLORS, HATS, BOX, g, svg };
})();
