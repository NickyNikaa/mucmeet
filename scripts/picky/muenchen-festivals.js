// scripts/picky/muenchen-festivals.js — muenchen.de Feste & Festivals.
import * as cheerio from "cheerio";
import { fetchHtml, parseGermanDate, normalizeEvent, classifyCategory } from "./utils.js";

const URL = "https://www.muenchen.de/veranstaltungen/event/feste-festivals";

function parseSpan(str) {
  if (!str) return { date: null, endDate: null };
  const s = str.replace(/\s+/g, " ").trim();
  const range = s.match(/(\d{1,2}\.?\s*(?:[a-zäöü]+|\d{1,2})\.?\s*\d{0,4})\s*[-–]\s*(\d{1,2}\.?\s*(?:[a-zäöü]+|\d{1,2})\.?\s*\d{0,4})/i);
  if (range) {
    const start = parseGermanDate(range[1]);
    let end = parseGermanDate(range[2]);
    if (start && !end) end = start;
    return { date: start, endDate: end };
  }
  const single = parseGermanDate(s);
  return { date: single, endDate: null };
}

function classifyFestival(title, desc) {
  const t = (title + " " + (desc || "")).toLowerCase();
  if (/markt|flohmarkt|hofflohmarkt|trödel/.test(t)) return "market";
  if (/oktoberfest|frühlingsfest|sommerfest|stadtfest|volksfest/.test(t)) return "party";
  if (/tollwood|festival/.test(t)) return "community";
  if (/konzert|musik|live/.test(t)) return "live-music";
  return classifyCategory(title, desc);
}

export async function scrapeMuenchenFestivals() {
  const events = [];
  try {
    const html = await fetchHtml(URL, { timeoutMs: 12000 });
    const $ = cheerio.load(html);
    const candidates = $("article, .m-teaser, .m-event, .m-card, .o-list__item, .teaser, .event-card, li").toArray();
    const seenTitles = new Set();
    for (const node of candidates) {
      const $node = $(node);
      const title = ($node.find("h1,h2,h3,h4,.title,.headline").first().text() || "").replace(/\s+/g, " ").trim();
      if (!title || title.length < 4 || seenTitles.has(title)) continue;
      const text = $node.text().replace(/\s+/g, " ").trim();
      if (text.length < 20) continue;
      const { date, endDate } = parseSpan(text);
      if (!date) continue;
      seenTitles.add(title);
      const hrefRel = $node.find("a[href]").first().attr("href") || "";
      const href = hrefRel.startsWith("http") ? hrefRel
                 : hrefRel.startsWith("/") ? "https://www.muenchen.de" + hrefRel
                 : URL;
      const pitch = text.slice(0, 240) + (text.length > 240 ? "…" : "");
      const isBigFestival = /tollwood|oktoberfest|frühlingsfest|sommerfest|stadtfest|streetlife/i.test(title);
      events.push(normalizeEvent({
        title,
        venueName: "München · Festival",
        date,
        endDate,
        time: null,
        category: classifyFestival(title, pitch),
        price: /eintritt frei|kostenlos|gratis/i.test(text) ? "Eintritt frei" : "siehe Veranstalter",
        source: "muenchen.de",
        sourceUrl: href,
        pitch,
        trending: isBigFestival
      }));
    }
  } catch (e) {
    console.warn(`[muenchen-festivals] ${e.message}`);
  }
  return events.slice(0, 40);
}
