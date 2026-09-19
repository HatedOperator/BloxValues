'use strict';

/** Display formatting helpers shared by commands and the stock watcher. */

const RARITY_COLORS = {
  common: 0x9d9d9d,
  uncommon: 0x57f287,
  rare: 0x3498db,
  legendary: 0xf1c40f,
  mythical: 0xe74c3c,
  limited: 0xe67e22,
  gamepass: 0x11806a,
};

const RARITY_EMOJI = {
  common: '⚪',
  uncommon: '🟢',
  rare: '🔵',
  legendary: '🟡',
  mythical: '🔴',
  limited: '🟠',
  gamepass: '🎫',
};

/** Dealer-stock rarity ladder (0 = most common). */
const RARITY_RANK = {
  common: 0,
  uncommon: 1,
  rare: 2,
  legendary: 3,
  mythical: 4,
};

const TREND_EMOJI = {
  stable: '⚖️',
  overpaid: '🔺',
  underpaid: '🔻',
  rising: '📈',
  dropping: '📉',
  neutral: '➡️',
};

/** A fruit worth a heads-up: Legendary/Mythical rarity or solid trade value. */
const NOTABLE_MIN_VALUE = 1_000_000;
/** An "ultra rare": Mythical rarity or huge trade value — gets its own alert. */
const ULTIMATE_MIN_VALUE = 10_000_000;

const FRUIT_EMOJIS = {
  rocket: '🚀',
  spin: '🌀',
  chop: '🔪',
  spring: '🌱',
  bomb: '💣',
  smoke: '💨',
  spike: '🌵',
  flame: '🔥',
  falcon: '🦅',
  ice: '🧊',
  sand: '🏝️',
  dark: '🌑',
  diamond: '💎',
  light: '💡',
  rubber: '🧽',
  barrier: '🛡️',
  magma: '🌋',
  ghost: '👻',
  quake: '🌊',
  buddha: '🧘',
  love: '❤️',
  spider: '🕷️',
  sound: '🔊',
  phoenix: '🔆',
  portal: '🚪',
  lightning: '🌩️',
  pain: '😖',
  blizzard: '❄️',
  shadow: '🌘',
  venom: '☠️',
  control: '🎛️',
  spirit: '✨',
  dragon: '🐉',
  'west dragon': '🐉',
  'east dragon': '🐉',
  leopard: '🐆',
  kitsune: '🦊',
  't-rex': '🦖',
  mammoth: '🦣',
  yeti: '🐻‍❄️',
  tiger: '🐯',
  gas: '♨️',
  creation: '🎨',
  werewolf: '🐺',
  blade: '⚔️',
  magnet: '🧲',
  eagle: '🪶',
};

function rarityColor(rarity) {
  return RARITY_COLORS[String(rarity).toLowerCase()] ?? null;
}

function rarityEmoji(rarity) {
  return RARITY_EMOJI[String(rarity).toLowerCase()] ?? '✨';
}

function rarityRank(rarity) {
  return RARITY_RANK[String(rarity).toLowerCase()] ?? -1;
}

function fruitEmoji(name) {
  return FRUIT_EMOJIS[String(name).toLowerCase()] ?? '🍎';
}

function trendEmoji(trend) {
  return TREND_EMOJI[String(trend).toLowerCase()] ?? '➡️';
}

/** Highest-rarity fruit in a stock (ties → higher value). */
function bestFruit(fruits) {
  if (!fruits?.length) return null;
  return fruits.reduce((best, f) => {
    const rankDiff = rarityRank(f.rarity) - rarityRank(best.rarity);
    if (rankDiff > 0) return f;
    if (rankDiff === 0 && (f.value?.regular ?? -1) > (best.value?.regular ?? -1)) return f;
    return best;
  });
}

/** 600000000 → "600M", 5490000000 → "5.49B", null → "N/A" */
function compactValue(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return 'N/A';
  n = Number(n);
  if (n < 0) return 'N/A';
  const units = [
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ];
  for (const [size, suffix] of units) {
    if (n >= size) {
      const v = n / size;
      const s = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
      return s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') + suffix;
    }
  }
  return String(n);
}

/** 8000000 → "8,000,000" */
function withCommas(n) {
  if (n === null || n === undefined || n === '') return 'N/A';
  const num = Number(n);
  if (Number.isNaN(num)) return String(n);
  return num.toLocaleString('en-US');
}

/** Dealer price as a chip: 420000 → "`$420,000`" */
function priceChip(beli) {
  if (!beli) return '';
  return '`$' + withCommas(beli) + '`';
}

function demandLabel(n) {
  if (n === null || n === undefined) return 'N/A';
  return `${n}/10`;
}

/** Fruits that deserve a ping line (Legendary/Mythical or ≥1M value). */
function notableFruits(fruits) {
  return (fruits ?? []).filter(
    (f) => rarityRank(f.rarity) >= 3 || (f.value?.regular ?? 0) >= NOTABLE_MIN_VALUE,
  );
}

/** Fruits that deserve the extra "ultra rare" alert (Mythical or ≥10M). */
function ultimateFruits(fruits) {
  return (fruits ?? []).filter(
    (f) => rarityRank(f.rarity) >= 4 || (f.value?.regular ?? 0) >= ULTIMATE_MIN_VALUE,
  );
}

/** Discord relative-time markup from epoch millis: "<t:1694966400:R>". */
function discordRelative(epochMs) {
  if (!epochMs) return null;
  return `<t:${Math.floor(epochMs / 1000)}:R>`;
}

function discordDateTime(epochMs) {
  if (!epochMs) return null;
  return `<t:${Math.floor(epochMs / 1000)}:f>`;
}

module.exports = {
  RARITY_COLORS,
  RARITY_RANK,
  NOTABLE_MIN_VALUE,
  ULTIMATE_MIN_VALUE,
  rarityColor,
  rarityEmoji,
  rarityRank,
  fruitEmoji,
  trendEmoji,
  bestFruit,
  compactValue,
  withCommas,
  priceChip,
  demandLabel,
  notableFruits,
  ultimateFruits,
  discordRelative,
  discordDateTime,
};
