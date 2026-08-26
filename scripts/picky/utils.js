// scripts/picky/utils.js — Shared helpers for die uebernommenen picky-Scraper.
// 1:1 aus picky-app/lib/utils.js uebernommen (Datumsparsing, HTTP, Kategorien).

const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export async function fetchHtml(url, { timeoutMs = 10000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml" },
      signal: ctrl.signal
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

export async function fetchJson(url, { timeoutMs = 10000, headers = {} } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept": "application/json", ...headers },
      signal: ctrl.signal
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

const MONTHS = {
  januar: 1, jänner: 1, jan: 1, february: 2, februar: 2, feb: 2,
  märz: 3, mar: 3, april: 4, apr: 4, mai: 5, juni: 6, jun: 6,
  juli: 7, jul: 7, august: 8, aug: 8, september: 9, sep: 9, sept: 9,
  oktober: 10, okt: 10, november: 11, nov: 11, dezember: 12, dez: 12
};

export function parseGermanDate(str, fallbackYear = new Date().getFullYear()) {
  if (!str) return null;
  const s = str.toLowerCase().trim();
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = s.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (dmy) {
    let y = parseInt(dmy[3], 10);
    if (y < 100) y += 2000;
    return `${y}-${String(dmy[2]).padStart(2,"0")}-${String(dmy[1]).padStart(2,"0")}`;
  }
  const dmonth = s.match(/(\d{1,2})\.?\s+([a-zäöü]+)\s*(\d{4})?/);
  if (dmonth) {
    const m = MONTHS[dmonth[2]];
    if (m) {
      const y = dmonth[3] ? parseInt(dmonth[3], 10) : fallbackYear;
      return `${y}-${String(m).padStart(2,"0")}-${String(dmonth[1]).padStart(2,"0")}`;
    }
  }
  return null;
}

export function parseTime(str) {
  if (!str) return null;
  const m = String(str).match(/(\d{1,2})[:.](\d{2})/);
  if (!m) return null;
  return `${String(m[1]).padStart(2,"0")}:${m[2]}`;
}

export const CATEGORIES = [
  { id: "live-music",     label: "🎵 Live-Musik",        keywords: ["live", "band", "konzert", "concert", "music"] },
  { id: "dj-club",        label: "🎧 Club / DJ",          keywords: ["dj", "club", "techno", "house", "rave"] },
  { id: "underground",    label: "🕳️ Underground",        keywords: ["underground", "warehouse", "afterhour", "after hour", "secret"] },
  { id: "karaoke",        label: "🎤 Karaoke",            keywords: ["karaoke"] },
  { id: "open-mic",       label: "🎙️ Open Mic",           keywords: ["open mic", "openmic", "open-mic", "jam session"] },
  { id: "silent-disco",   label: "🎧 Silent Disco",       keywords: ["silent disco"] },
  { id: "wine-tasting",   label: "🍷 Weinprobe",          keywords: ["wein", "wine", "tasting", "weinprobe", "weinverkostung"] },
  { id: "popup-dinner",   label: "👨‍🍳 Pop-up Dinner",     keywords: ["pop-up dinner", "popup dinner", "gastkoch", "guest chef", "supper club"] },
  { id: "popup",          label: "🛍️ Pop-up Store",       keywords: ["pop-up", "popup", "popupstore", "pop up store"] },
  { id: "themed-dinner",  label: "🍽️ Themen-Dinner",      keywords: ["menü", "menu", "gala", "trüffel", "truffle", "saison"] },
  { id: "chef-table",     label: "🍳 Chef's Table",       keywords: ["chef's table", "chefstable", "küchenparty"] },
  { id: "brunch",         label: "🥐 Brunch-Special",     keywords: ["brunch", "frühstück", "breakfast"] },
  { id: "sober",          label: "🚫 Sober Curious",      keywords: ["alkoholfrei", "dry january", "sober", "0,0", "mocktail"] },
  { id: "community",      label: "💛 Community",          keywords: ["community", "treffen", "stammtisch", "meet up", "meetup", "flinta", "queer", "lesbian", "lgbt", "lgbtq", "pride", "csd"] },
  { id: "market",         label: "🧺 Markt / Flohmarkt",  keywords: ["markt", "flohmarkt", "hofflohmarkt", "trödel", "bazaar"] },
  { id: "vernissage",     label: "🎨 Vernissage / Kunst", keywords: ["vernissage", "ausstellung", "exhibition", "gallery", "kunst"] },
  { id: "workshop",       label: "🛠️ Workshop",           keywords: ["workshop", "kurs", "class", "masterclass"] },
  { id: "book-reading",   label: "📚 Lesung",             keywords: ["lesung", "reading", "book", "buch", "poetry"] },
  { id: "rooftop-sundown",label: "🌇 Rooftop / Sundown",  keywords: ["rooftop", "sundown", "sunset", "terrasse open"] },
  { id: "wellness",       label: "🧘 Wellness / Yoga",    keywords: ["yoga", "wellness", "meditation", "sound bath"] },
  { id: "sports-watch",   label: "⚽ Sport gucken",        keywords: ["public viewing", "watch party", "em", "wm", "fußball", "champions league"] },
  { id: "gaming",         label: "🎮 Gaming / Game Night",keywords: ["gaming", "game night", "videogame", "esport"] },
  { id: "themed-night",   label: "🎭 Themen-Night",       keywords: ["night", "abend", "themen"] },
  { id: "party",          label: "🎉 Party",              keywords: ["party", "fest", "celebration", "feier", "after work"] }
];

export function classifyCategory(title = "", description = "") {
  const text = (title + " " + description).toLowerCase();
  for (const c of CATEGORIES) {
    for (const kw of c.keywords) if (text.includes(kw)) return c.id;
  }
  return "themed-night";
}

export function makeEventId(source, title, date) {
  const slug = (title || "event").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  return `${source}-${slug}-${date || ""}`.replace(/-+$/g, "");
}

export function normalizeEvent({
  id, title, venueId, venueName, date, endDate, time, category, price, source, sourceUrl, pitch, imageUrl, trending
}) {
  let end = null;
  if (endDate && date && endDate >= date && endDate !== date) end = endDate;
  return {
    id: id || makeEventId(source || "manual", title, date),
    title: (title || "Untitled Event").trim(),
    venueId: venueId || null,
    venueName: venueName || "",
    date: date || null,
    endDate: end,
    time: time || null,
    category: category || classifyCategory(title, pitch),
    price: price || "auf Anfrage",
    source: source || "manuell",
    sourceUrl: sourceUrl || null,
    pitch: (pitch || "").trim(),
    imageUrl: imageUrl || null,
    trending: trending === true
  };
}

export function dedupeAndPrune(events) {
  const seen = new Map();
  const todayIso = new Date().toISOString().slice(0, 10);
  for (const e of events) {
    if (!e.date) continue;
    const lastDay = e.endDate || e.date;
    if (lastDay < todayIso) continue;
    const k = `${e.title.toLowerCase().slice(0,40)}|${e.date}|${(e.venueName||"").toLowerCase().slice(0,20)}`;
    if (!seen.has(k)) seen.set(k, e);
  }
  return Array.from(seen.values()).sort((a, b) => a.date.localeCompare(b.date));
}
