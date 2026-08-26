#!/usr/bin/env node
// scripts/fetch_venues.mjs — Taeglicher Zusatz-Import: Restaurant/Bar/Club-Scraper,
// urspruenglich aus dem eingestellten Projekt "picky-app" uebernommen (12.06.2026:
// ansehen als reine Event-Quelle fuer MUCmeet statt eigener App).
//
// Laeuft NACH scripts/fetch_events.py im selben Workflow-Lauf: liest das von dort
// bereits geschriebene events.json, ergaenzt die hier gescrapten Venue-Events und
// schreibt die zusammengefuehrte, deduplizierte, sortierte Liste zurueck.
//
// Kein API-Key noetig (reines HTML/JSON-LD-Scraping). Einzelne Quellen duerfen
// jederzeit fehlschlagen (Website-Redesign etc.) ohne den Lauf abzubrechen.

import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { scrapeTantris } from "./picky/tantris.js";
import { scrapeKongressbar } from "./picky/kongressbar.js";
import { scrapeRA } from "./picky/ra-co.js";
import { scrapeGlockenbachwerkstatt } from "./picky/glockenbachwerkstatt.js";
import { scrapeMitVergnuegen } from "./picky/mit-vergnuegen.js";
import { scrapeEventbrite } from "./picky/eventbrite.js";
import { scrapeEventim } from "./picky/eventim.js";
import { scrapeMuenchenFestivals } from "./picky/muenchen-festivals.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "events.json");
const MAX_TOTAL = 300;
const DOW = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"]; // JS getDay(): 0=So

const SOURCES = [
  ["tantris", scrapeTantris],
  ["kongressbar", scrapeKongressbar],
  ["ra-co", scrapeRA],
  ["glockenbach", scrapeGlockenbachwerkstatt],
  ["mit-vergnuegen", scrapeMitVergnuegen],
  ["eventbrite", scrapeEventbrite],
  ["eventim", scrapeEventim],
  ["muenchen-feste", scrapeMuenchenFestivals]
];

// picky-Kategorien (feiner, nightlife/gastro-lastig) -> MUCmeet-Kategorien
// (run/cycle/yoga/pilates/padel/tennis/walk/biz/gastro/date/music/popup).
const CAT_MAP = {
  "live-music": "music", "dj-club": "music", "underground": "music",
  "karaoke": "music", "open-mic": "music", "silent-disco": "music", "party": "music",
  "wine-tasting": "gastro", "popup-dinner": "gastro", "themed-dinner": "gastro",
  "chef-table": "gastro", "brunch": "gastro", "sober": "gastro",
  "wellness": "yoga",
  "rooftop-sundown": "popup", "sports-watch": "popup", "gaming": "popup",
  "community": "popup", "market": "popup", "vernissage": "popup",
  "workshop": "popup", "book-reading": "popup", "themed-night": "popup",
  "popup": "popup"
};

function normTitle(t) {
  return (t || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);
}

function fmtTime(dateIso, time) {
  let dow = "";
  try {
    const d = new Date(dateIso + "T00:00:00Z");
    dow = DOW[d.getUTCDay()];
  } catch (_) { /* egal */ }
  const t = (time || "").slice(0, 5);
  const label = `${dow} ${t}`.trim();
  return label || "Termin siehe Link";
}

function toMucmeetEvent(e) {
  const id = "pk-" + createHash("md5").update(`${e.source}|${e.title}|${e.date}`).digest("hex").slice(0, 10);
  return {
    id,
    cat: CAT_MAP[e.category] || "popup",
    title: e.title,
    date: e.date,
    time: fmtTime(e.date, e.time),
    loc: e.venueName || "München",
    ig: "",
    igUrl: e.sourceUrl || "",
    desc: (e.pitch || "").slice(0, 170) || `Über ${e.source} gefunden.`,
    img: e.imageUrl || ""
  };
}

async function loadExisting() {
  try {
    const raw = await readFile(OUT, "utf-8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (_) {
    return [];
  }
}

async function main() {
  const existing = await loadExisting();

  const results = await Promise.allSettled(SOURCES.map(([, fn]) => fn()));
  const scraped = [];
  results.forEach((r, i) => {
    const name = SOURCES[i][0];
    if (r.status === "fulfilled") {
      console.log(`[fetch_venues] ${name}: ${r.value.length} Events`);
      scraped.push(...r.value);
    } else {
      console.warn(`[fetch_venues] ${name} fehlgeschlagen: ${r.reason?.message || r.reason}`);
    }
  });

  const todayIso = new Date().toISOString().slice(0, 10);
  const seen = new Set(existing.map(e => `${normTitle(e.title)}|${e.date}`));
  const merged = existing.slice();

  let added = 0;
  for (const e of scraped) {
    if (!e.date || e.date < todayIso) continue; // vergangene Events raus
    const key = `${normTitle(e.title)}|${e.date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(toMucmeetEvent(e));
    added++;
  }

  merged.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const out = merged.slice(0, MAX_TOTAL);

  await writeFile(OUT, JSON.stringify(out, null, 1), "utf-8");
  console.log(`[fetch_venues] ${added} neue Venue-Events ergaenzt -> events.json (gesamt ${out.length})`);
}

main().catch(e => {
  console.error("[fetch_venues] Abbruch:", e);
  process.exitCode = 0; // nie den Workflow rot machen wegen einer Scraper-Quelle
});
