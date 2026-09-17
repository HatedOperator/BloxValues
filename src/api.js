'use strict';

/**
 * Blox Fruits data client.
 *
 * Two public, keyless sources (bloxfruitsvalues.com):
 *  - Values : GET /api/v1/values          → every item with trade values/demand/trend
 *  - Stock  : GET /stock                  → Next.js page whose RSC payload embeds an
 *                                           `initialSnapshot` with the live Normal &
 *                                           Mirage dealer stock + reset timers
 */

const VALUES_URL = 'https://bloxfruitsvalues.com/api/v1/values';
const STOCK_URL = 'https://bloxfruitsvalues.com/stock';
const SITE_BASE = 'https://bloxfruitsvalues.com';
const USER_AGENT =
  'BloxValues-DiscordBot/1.0 (+https://github.com/HatedOperator/BloxValues)';

const VALUES_TTL_MS = 10 * 60 * 1000; // values move slowly
const STOCK_TTL_MS = 20 * 1000; // /stock command shouldn't hammer the page
const REQUEST_TIMEOUT_MS = 15_000;
const RETRIES = 2;

class ApiError extends Error {
  constructor(message, { status } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function fetchWithRetry(url) {
  let lastError;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': USER_AGENT, accept: 'application/json, text/html' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) throw new ApiError(`HTTP ${res.status} for ${url}`, { status: res.status });
      return res;
    } catch (error) {
      lastError = error;
      if (error instanceof ApiError && error.status && error.status < 500) throw error;
      if (attempt < RETRIES) {
        await new Promise((r) => setTimeout(r, 750 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

/* ── Values ─────────────────────────────────────────────────────────────── */

const valuesCache = { items: null, at: 0, inflight: null };

function normalizeItem(raw) {
  const meta = raw.metadata ?? {};
  return {
    id: raw.id,
    name: raw.name,
    category: raw.category ?? 'Other',
    rarity: raw.rarity ?? meta.tier ?? 'Unknown',
    image: raw.image ?? null,
    tradeable: meta.tradeable ?? null,
    type: meta.type ?? meta.fruitType ?? null,
    value: {
      regular: meta.regValue ?? null,
      permanent: meta.permValue ?? null,
    },
    demand: {
      regular: meta.regDemand ?? null,
      permanent: meta.permDemand ?? null,
    },
    trend: {
      regular: meta.regTrend ?? raw.trend ?? null,
      permanent: meta.permTrend ?? null,
    },
    beliPrice: meta.beliPrice ?? null,
    robuxPrice: meta.robuxPrice ?? null,
    bestUsedFor: meta.bestUsedFor || null,
    updatedAt: raw.updatedAt ?? null,
    valueUrl: raw.valuePath
      ? SITE_BASE + raw.valuePath
      : `${SITE_BASE}/values/${String(raw.category ?? 'fruits').toLowerCase()}/${slugify(raw.name)}`,
  };
}

function slugify(name) {
  return String(name).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
}

/** Full item list (fruits, gamepasses, limiteds). Cached ~10 minutes. */
async function fetchValues({ force = false } = {}) {
  if (!force && valuesCache.items && Date.now() - valuesCache.at < VALUES_TTL_MS) {
    return valuesCache.items;
  }
  if (valuesCache.inflight) return valuesCache.inflight;

  valuesCache.inflight = (async () => {
    const res = await fetchWithRetry(VALUES_URL);
    const body = await res.json();
    const items = (body.items ?? []).map(normalizeItem);
    if (!items.length) throw new ApiError('Values API returned no items');
    valuesCache.items = items;
    valuesCache.at = Date.now();
    return items;
  })();

  try {
    return await valuesCache.inflight;
  } finally {
    valuesCache.inflight = null;
  }
}

/* ── Stock ──────────────────────────────────────────────────────────────── */

const stockCache = { snapshot: null, at: 0, inflight: null };

// Reassemble Next.js's streamed RSC payload from the inline <script> pushes.
function flightText(html) {
  let out = '';
  for (const m of html.matchAll(/self\.__next_f\.push\(([\s\S]*?)\)<\/script>/g)) {
    try {
      out += JSON.parse(m[1]);
    } catch {
      /* malformed chunk — skip */
    }
  }
  return out;
}

// Extract the balanced JSON object that follows `key` in the flight stream.
function extractObject(text, key) {
  const idx = text.indexOf(key);
  if (idx === -1) return null;
  const start = text.indexOf('{', idx);
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (c === '\\') {
      escaped = true;
      continue;
    }
    if (c === '"') inString = !inString;
    if (inString) continue;
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function normalizeSide(side) {
  if (!side || !Array.isArray(side.fruits)) return null;
  return {
    startedAt: side.window?.startedAt ?? null,
    resetsAt: side.window?.resetsAt ?? null,
    periodMs: side.window?.periodMs ?? null,
    fruits: side.fruits.map((f) => ({
      name: f.name,
      image: f.image ?? null,
      rarity: f.rarity ?? null,
      fruitType: f.fruitType ?? null,
      beliPrice: f.beliPrice ?? null,
      robuxPrice: f.robuxPrice ?? null,
      value: { regular: f.regularValue ?? null, permanent: f.permanentValue ?? null },
      demand: { regular: f.regularDemand ?? null, permanent: f.permanentDemand ?? null },
      trend: { regular: f.regularTrend ?? null, permanent: f.permanentTrend ?? null },
      bestUsedFor: f.bestUsedFor ?? null,
      valueUrl: f.valuePath ? SITE_BASE + f.valuePath : null,
    })),
  };
}

/**
 * Live dealer stock: { normal, mirage, fetchedAt }.
 * Each side: { startedAt, resetsAt, periodMs, fruits[] }.
 * Cached ~20s so commands stay snappy without extra page loads.
 */
async function fetchStock({ force = false } = {}) {
  if (!force && stockCache.snapshot && Date.now() - stockCache.at < STOCK_TTL_MS) {
    return stockCache.snapshot;
  }
  if (stockCache.inflight) return stockCache.inflight;

  stockCache.inflight = (async () => {
    const res = await fetchWithRetry(STOCK_URL);
    const html = await res.text();
    const snapshot = extractObject(flightText(html), '"initialSnapshot"');
    const normal = normalizeSide(snapshot?.normal);
    const mirage = normalizeSide(snapshot?.mirage);
    if (!normal || !mirage) {
      throw new ApiError('Could not extract stock snapshot from page (layout may have changed)');
    }
    const result = {
      normal,
      mirage,
      fetchedAt: snapshot.fetchedAt ?? Date.now(),
      stale: Boolean(snapshot.stale),
    };
    stockCache.snapshot = result;
    stockCache.at = Date.now();
    return result;
  })();

  try {
    return await stockCache.inflight;
  } finally {
    stockCache.inflight = null;
  }
}

/* ── Item lookup helpers ────────────────────────────────────────────────── */

function normalizeQuery(s) {
  return String(s).toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

/** Find an item by (fuzzy) name; exact-ish matches ranked first. */
async function findItem(query) {
  const items = await fetchValues();
  const q = normalizeQuery(query);
  if (!q) return null;
  return (
    items.find((i) => normalizeQuery(i.name) === q) ??
    items.find((i) => normalizeQuery(i.name).startsWith(q)) ??
    items.find((i) => normalizeQuery(i.name).includes(q)) ??
    null
  );
}

/** Autocomplete candidates for a partial name. */
async function searchItems(query, limit = 25) {
  const items = await fetchValues();
  const q = normalizeQuery(query);
  if (!q) return items.slice(0, limit);
  const scored = [];
  for (const item of items) {
    const n = normalizeQuery(item.name);
    let score = -1;
    if (n === q) score = 0;
    else if (n.startsWith(q)) score = 1;
    else if (n.includes(q)) score = 2;
    if (score >= 0) scored.push({ item, score: score * 1000 + item.name.length });
  }
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, limit).map((s) => s.item);
}

module.exports = {
  ApiError,
  fetchValues,
  fetchStock,
  findItem,
  searchItems,
  normalizeQuery,
  SITE_BASE,
};
