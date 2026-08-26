// scripts/picky/glockenbachwerkstatt.js — Community/Queer/Pop-up-Hub im Glockenbach.
import * as cheerio from "cheerio";
import { fetchHtml, parseGermanDate, parseTime, normalizeEvent } from "./utils.js";

const URL = "https://www.glockenbachwerkstatt.de/veranstaltungen/";

export async function scrapeGlockenbachwerkstatt() {
  const events = [];
  try {
    const html = await fetchHtml(URL);
    const $ = cheerio.load(html);
    $("article, .event-item, .veranstaltung, .tribe-events-calendar-list__event, .post, .entry").each((_, node) => {
      const $node = $(node);
      const title = $node.find("h1,h2,h3,.tribe-events-calendar-list__event-title").first().text().trim();
      if (!title || title.length < 4) return;
      const text = $node.text().replace(/\s+/g, " ").trim();
      const date = parseGermanDate(text);
      if (!date) return;
      const timeMatch = text.match(/(\d{1,2}[:.]\d{2})\s*(Uhr|h)/i);
      const pitch = text.slice(0, 280) + (text.length > 280 ? "…" : "");
      events.push(normalizeEvent({
        title,
        venueId: null,
        venueName: "Glockenbachwerkstatt",
        date,
        time: timeMatch ? parseTime(timeMatch[1]) : null,
        price: /eintritt frei|free/i.test(text) ? "Eintritt frei"
             : (text.match(/(\d+(?:[,.]\d+)?)\s*(?:€|Euro)/i)?.[0] || "auf Anfrage"),
        source: "glockenbachwerkstatt.de",
        sourceUrl: URL,
        pitch
      }));
    });
  } catch (e) {
    console.warn(`[glockenbach] ${e.message}`);
  }
  return events;
}
