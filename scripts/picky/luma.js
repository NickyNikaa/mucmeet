// scripts/picky/luma.js — Luma public events fuer Muenchen (luma.com/munich).
// Luma liefert die Event-Liste als eingebettetes __NEXT_DATA__-JSON im HTML,
// kein API-Key noetig. robots.txt erlaubt das Crawlen dieser Seite.
import { fetchHtml, normalizeEvent, classifyCategory } from "./utils.js";

const LISTING_URL = "https://luma.com/munich";

function fmtDateInMunich(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    // en-CA liefert direkt YYYY-MM-DD
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(d);
  } catch (_) {
    return null;
  }
}

function fmtTimeInMunich(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("de-DE", {
      timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hour12: false
    }).format(d);
  } catch (_) {
    return null;
  }
}

export async function scrapeLuma() {
  try {
    const html = await fetchHtml(LISTING_URL, { timeoutMs: 10000 });
    const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!m) {
      console.warn("[luma] __NEXT_DATA__ nicht gefunden (Seitenstruktur geaendert?)");
      return [];
    }
    let data;
    try {
      data = JSON.parse(m[1]);
    } catch (e) {
      console.warn(`[luma] JSON-Parse fehlgeschlagen: ${e.message}`);
      return [];
    }
    const entries = data?.props?.pageProps?.initialData?.data?.events || [];
    const events = [];
    for (const entry of entries) {
      const ev = entry?.event;
      if (!ev?.name || !ev?.start_at) continue;
      const date = fmtDateInMunich(ev.start_at);
      if (!date) continue;
      const addr = ev.geo_address_info || {};
      const venueName = addr.short_address || addr.address || addr.city_state || "München";
      events.push(normalizeEvent({
        title: ev.name,
        venueName,
        date,
        time: fmtTimeInMunich(ev.start_at),
        price: "siehe Luma",
        category: classifyCategory(ev.name, ""),
        source: "luma.com",
        sourceUrl: ev.url ? `https://luma.com/${ev.url}` : LISTING_URL,
        pitch: "",
        imageUrl: ev.cover_url || null
      }));
    }
    console.log(`[luma] ${LISTING_URL} → ${events.length}`);
    return events.slice(0, 60);
  } catch (e) {
    console.warn(`[luma] ${LISTING_URL}: ${e.message}`);
    return [];
  }
}
