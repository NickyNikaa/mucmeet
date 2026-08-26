// scripts/picky/tantris.js — Tantris seasonal-highlights & current-events pages.
import * as cheerio from "cheerio";
import { fetchHtml, parseGermanDate, parseTime, normalizeEvent, classifyCategory } from "./utils.js";

const URLS = [
  "https://tantris.de/de/aktuelle-veranstaltungen/",
  "https://tantris.de/de/saisonale-highlights/"
];

export async function scrapeTantris() {
  const events = [];
  for (const url of URLS) {
    try {
      const html = await fetchHtml(url);
      const $ = cheerio.load(html);
      const candidates = $("article, .event, .highlight, .veranstaltung, .news-item, .col-12 > div").toArray();
      for (const node of candidates) {
        const $node = $(node);
        const title = $node.find("h1,h2,h3,h4").first().text().trim();
        if (!title || title.length < 5) continue;
        const text = $node.text().replace(/\s+/g, " ").trim();
        if (text.length < 30) continue;
        const date = parseGermanDate(text);
        if (!date) continue;
        const timeMatch = text.match(/(\d{1,2}[:.]\d{2})\s*(Uhr)?/);
        const priceMatch = text.match(/(\d+(?:[,.]\d+)?)\s*(?:€|Euro|EUR)/i);
        const pitch = text.slice(0, 280) + (text.length > 280 ? "…" : "");
        events.push(normalizeEvent({
          title,
          venueId: "tantris",
          venueName: "Tantris",
          date,
          time: timeMatch ? parseTime(timeMatch[1]) : null,
          category: classifyCategory(title, pitch),
          price: priceMatch ? `${priceMatch[1].replace(",", ".")}€` : "auf Anfrage",
          source: "tantris.de",
          sourceUrl: url,
          pitch
        }));
      }
    } catch (e) {
      console.warn(`[tantris] ${url}: ${e.message}`);
    }
  }
  return events;
}
