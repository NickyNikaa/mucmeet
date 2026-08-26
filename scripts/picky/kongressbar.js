// scripts/picky/kongressbar.js — Kongressbar Live-Bands & DJ events.
import * as cheerio from "cheerio";
import { fetchHtml, parseGermanDate, parseTime, normalizeEvent, classifyCategory } from "./utils.js";

const URL = "https://kongressbar.de/events-live-bands-djs/";

export async function scrapeKongressbar() {
  const events = [];
  try {
    const html = await fetchHtml(URL);
    const $ = cheerio.load(html);
    $("article, .event, .vc_row, .post").each((_, node) => {
      const $node = $(node);
      const title = $node.find("h1,h2,h3,h4").first().text().trim();
      if (!title || title.length < 4) return;
      const text = $node.text().replace(/\s+/g, " ").trim();
      const date = parseGermanDate(text);
      if (!date) return;
      const timeMatch = text.match(/(\d{1,2}[:.]\d{2})/);
      const pitch = text.slice(0, 280) + (text.length > 280 ? "…" : "");
      events.push(normalizeEvent({
        title,
        venueId: null,
        venueName: "Kongressbar",
        date,
        time: timeMatch ? parseTime(timeMatch[1]) : "20:00",
        category: classifyCategory(title, pitch),
        price: "Eintritt frei",
        source: "kongressbar.de",
        sourceUrl: URL,
        pitch
      }));
    });
  } catch (e) {
    console.warn(`[kongressbar] ${e.message}`);
  }
  return events;
}
