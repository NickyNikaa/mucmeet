// scripts/picky/eventim.js — Eventim Muenchen.
import * as cheerio from "cheerio";
import { fetchHtml, normalizeEvent, classifyCategory } from "./utils.js";

const URLS = [
  "https://www.eventim.de/city/muenchen-11/",
  "https://www.eventim.de/city/muenchen-11/?affiliate=GMD"
];

const VENUE_MAP = {
  "Olympiastadion": "olympiastadion",
  "Allianz Arena": "allianz-arena",
  "Königsplatz": "koenigsplatz",
  "Tollwood": "tollwood",
  "Zenith": "zenith",
  "Olympiapark": "olympiapark"
};

function asArray(x) { return Array.isArray(x) ? x : (x ? [x] : []); }

function classifyConcert(title, desc, venueName) {
  const text = (title + " " + (desc || "") + " " + (venueName || "")).toLowerCase();
  if (/klassik|symphony|philharmoniker|orchester|opera|oper /.test(text)) return "live-music";
  if (/dj |electronic|techno|house|festival|rave/.test(text)) return "dj-club";
  return classifyCategory(title, desc);
}

async function parseFromUrl(url) {
  const events = [];
  try {
    const html = await fetchHtml(url, { timeoutMs: 12000 });
    const $ = cheerio.load(html);
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).text());
        const items = asArray(data["@graph"]).concat(asArray(data));
        for (const item of items) {
          if (!item || (item["@type"] !== "Event" && item["@type"] !== "MusicEvent" && item["@type"] !== "TheaterEvent")) continue;
          const start = item.startDate || "";
          const date = start.slice(0, 10);
          if (!date) continue;
          const endIso = item.endDate ? item.endDate.slice(0, 10) : null;
          const venueName = item.location?.name || "";
          const title = (item.name || "").trim();
          if (!title) continue;
          const price = item.offers?.lowPrice
            ? `ab ${item.offers.lowPrice}€`
            : item.offers?.price ? `${item.offers.price}€` : "siehe Eventim";
          const pitch = (item.description || "").replace(/\s+/g, " ").slice(0, 240);
          events.push(normalizeEvent({
            title,
            venueId: VENUE_MAP[Object.keys(VENUE_MAP).find(k => venueName.includes(k)) || ""] || null,
            venueName: venueName || "Eventim",
            date,
            endDate: endIso,
            time: start.slice(11, 16) || null,
            category: classifyConcert(title, pitch, venueName),
            price,
            source: "eventim.de",
            sourceUrl: item.url || url,
            pitch,
            imageUrl: asArray(item.image)[0] || null,
            trending: true
          }));
        }
      } catch (_) { /* ignorieren */ }
    });
  } catch (e) {
    console.warn(`[eventim] ${url}: ${e.message}`);
  }
  return events;
}

export async function scrapeEventim() {
  const all = [];
  for (const u of URLS) all.push(...await parseFromUrl(u));
  const seen = new Set();
  return all.filter(e => {
    if (seen.has(e.sourceUrl)) return false;
    seen.add(e.sourceUrl);
    return true;
  }).slice(0, 60);
}
