// scripts/picky/eventbrite.js — Eventbrite public events fuer Muenchen.
import * as cheerio from "cheerio";
import { fetchHtml, normalizeEvent, classifyCategory } from "./utils.js";

const LISTING_URLS = [
  "https://www.eventbrite.de/d/germany--munich/all-events/",
  "https://www.eventbrite.de/d/germany--munich/all-events/?page=2",
  "https://www.eventbrite.de/d/germany--munich/music--events/",
  "https://www.eventbrite.de/d/germany--munich/food-and-drink--events/",
  "https://www.eventbrite.de/d/germany--munich/nightlife--events/"
];

function parseJsonLd($, sourceUrl) {
  const events = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const text = $(el).text();
      const data = JSON.parse(text);
      const arr = data["@graph"] ? data["@graph"]
                : Array.isArray(data) ? data
                : [data];
      for (const it of arr) {
        if (!it || it["@type"] !== "Event") continue;
        const date = (it.startDate || "").slice(0, 10);
        if (!date) continue;
        events.push(normalizeEvent({
          title: it.name || "",
          venueName: it.location?.name || "München",
          date,
          time: (it.startDate || "").slice(11, 16) || null,
          price: it.offers?.lowPrice ? `ab ${it.offers.lowPrice} €` : "siehe Eventbrite",
          category: classifyCategory(it.name, it.description),
          source: "eventbrite.de",
          sourceUrl: it.url || sourceUrl,
          pitch: (it.description || "").slice(0, 240),
          imageUrl: it.image?.url || (typeof it.image === "string" ? it.image : null)
        }));
      }
    } catch (_) {}
  });
  return events;
}

function parseServerData($, sourceUrl) {
  const events = [];
  $("script").each((_, el) => {
    const txt = $(el).text();
    if (!txt.includes("__SERVER_DATA__")) return;
    const m = txt.match(/window\.__SERVER_DATA__\s*=\s*(\{[\s\S]*?\});/);
    if (!m) return;
    try {
      const data = JSON.parse(m[1]);
      const list = data?.search_data?.events?.results
                ?? data?.results
                ?? [];
      for (const it of list) {
        const start = it.start_date || it.start?.local || it.start;
        if (!start) continue;
        const date = String(start).slice(0, 10);
        events.push(normalizeEvent({
          title: it.name || "",
          venueName: it.primary_venue?.name || it.venue?.name || "München",
          date,
          time: String(start).slice(11, 16) || null,
          price: it.is_free ? "Eintritt frei" : (it.ticket_availability?.minimum_ticket_price?.display || "siehe Eventbrite"),
          category: classifyCategory(it.name, it.summary || it.description),
          source: "eventbrite.de",
          sourceUrl: it.url || sourceUrl,
          pitch: (it.summary || it.description || "").slice(0, 240),
          imageUrl: it.image?.url || it.image_url || null
        }));
      }
    } catch (_) {}
  });
  return events;
}

function parseCards($, sourceUrl) {
  const events = [];
  $('a[href*="/e/"]').each((_, el) => {
    const href = $(el).attr("href");
    if (!href || !/\/e\/[a-z0-9-]+/i.test(href)) return;
    const title = $(el).find('h2, h3, [class*="title"]').first().text().trim()
               || $(el).attr("aria-label")
               || "";
    if (!title || title.length < 4) return;
    const ctx = $(el).closest('article, div[class*="card"], div[class*="event"]').text();
    const dateMatch = ctx.match(/(\d{1,2})\.\s*(Jan|Feb|März|Apr|Mai|Jun|Jul|Aug|Sep|Okt|Nov|Dez)\.?\s*(\d{2,4})?/i);
    if (!dateMatch) return;
    const months = {jan:1,feb:2,'märz':3,apr:4,mai:5,jun:6,jul:7,aug:8,sep:9,okt:10,nov:11,dez:12};
    const monthKey = dateMatch[2].toLowerCase().replace(".", "");
    const m = months[monthKey];
    if (!m) return;
    const y = dateMatch[3] ? (dateMatch[3].length === 2 ? 2000 + parseInt(dateMatch[3]) : parseInt(dateMatch[3])) : new Date().getFullYear();
    const d = String(dateMatch[1]).padStart(2, "0");
    const date = `${y}-${String(m).padStart(2,"0")}-${d}`;
    events.push(normalizeEvent({
      title,
      venueName: "München",
      date,
      time: null,
      price: "siehe Eventbrite",
      category: classifyCategory(title, ""),
      source: "eventbrite.de",
      sourceUrl: href.startsWith("http") ? href : `https://www.eventbrite.de${href}`,
      pitch: "",
      imageUrl: $(el).find("img").attr("src") || null
    }));
  });
  return events;
}

async function scrapeOne(url) {
  try {
    const html = await fetchHtml(url, { timeoutMs: 10000 });
    const $ = cheerio.load(html);
    const ld = parseJsonLd($, url);
    if (ld.length) return ld;
    const server = parseServerData($, url);
    if (server.length) return server;
    return parseCards($, url);
  } catch (e) {
    console.warn(`[eventbrite] ${url}: ${e.message}`);
    return [];
  }
}

export async function scrapeEventbrite() {
  const results = await Promise.allSettled(LISTING_URLS.map(scrapeOne));
  const events = [];
  const seenTitles = new Set();
  results.forEach((r, i) => {
    if (r.status !== "fulfilled") return;
    console.log(`[eventbrite] ${LISTING_URLS[i]} → ${r.value.length}`);
    for (const ev of r.value) {
      const key = `${ev.title}::${ev.date}`;
      if (seenTitles.has(key)) continue;
      seenTitles.add(key);
      events.push(ev);
    }
  });
  return events.slice(0, 80);
}
