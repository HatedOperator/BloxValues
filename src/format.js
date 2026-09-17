'use strict';

/** Display formatting helpers shared by commands and the stock watcher. */

const RARITY_COLORS = {
  common: 0x9d9d9d,
  uncommon: 0x57f287,
  rare: 0x3498db,
  legendary: 0xa55eea,
  mythical: 0xe74c3c,
  limited: 0xf1c40f,
  gamepass: 0x11806a,
};

const RARITY_EMOJI = {
  common: '⚪',
  uncommon: '🟢',
  rare: '🔵',
  legendary: '🟣',
  mythical: '🔴',
  limited: '🟡',
  gamepass: '🎫',
};

const TREND_EMOJI = {
  stable: '⚖️',
  overpaid: '🔺',
  underpaid: '🔻',
  rising: '📈',
  dropping: '📉',
  neutral: '➡️',
};

function rarityColor(rarity) {
  return RARITY_COLORS[String(rarity).toLowerCase()] ?? null;
}

function rarityEmoji(rarity) {
  return RARITY_EMOJI[String(rarity).toLowerCase()] ?? '✨';
}

function trendEmoji(trend) {
  return TREND_EMOJI[String(trend).toLowerCase()] ?? '➡️';
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

/** 8000000 → "8,000,000" (beli shop prices) */
function withCommas(n) {
  if (n === null || n === undefined || n === '') return 'N/A';
  const num = Number(n);
  if (Number.isNaN(num)) return String(n);
  return num.toLocaleString('en-US');
}

/** Demand as "8/10" (site uses a 1–10 scale). */
function demandLabel(n) {
  if (n === null || n === undefined) return 'N/A';
  return `${n}/10`;
}

/** "🍈 Dragon • 350M • Perm 6.5B • Demand 8/10 • ⚖️" — one line per stock fruit. */
function stockFruitLine(fruit) {
  const parts = [`**${fruit.name}**`];
  if (fruit.value.regular !== null && fruit.value.regular !== undefined) {
    parts.push(`\`${compactValue(fruit.value.regular)}\``);
  }
  if (fruit.value.permanent) {
    parts.push(`perm \`${compactValue(fruit.value.permanent)}\``);
  }
  const demand = demandLabel(fruit.demand.regular);
  if (demand !== 'N/A') parts.push(`demand ${demand}`);
  if (fruit.trend.regular) parts.push(trendEmoji(fruit.trend.regular));
  return parts.join(' • ');
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
  rarityColor,
  rarityEmoji,
  trendEmoji,
  compactValue,
  withCommas,
  demandLabel,
  stockFruitLine,
  discordRelative,
  discordDateTime,
};
