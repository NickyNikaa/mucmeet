#!/usr/bin/env node
// scripts/fetch_places.mjs — Taeglicher Orte-Import (Restaurants & Bars).
// Ersetzt die fruehere Live-Abfrage an die picky-app-Vercel-API: die OSM-Abfrage
// laeuft jetzt einmal taeglich hier (statt bei jedem Seitenaufruf live beim Nutzer),
// das Ergebnis wird mit places-curated.json (statisch, Nickys eigene Liste) gemischt
// und als places.json geschrieben — die Seite laedt das dann sofort, ohne auf eine
// live Overpass-Anfrage zu warten.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "places.json");
const CURATED = path.join(__dirname, "..", "places-curated.json");

const OVERPASS = "https://overpass-api.de/api/interpreter";
const MUNICH_BBOX = "48.085,11.39,48.244,11.78";
const QUERY = `[out:json][timeout:90];(
  node["amenity"~"^(restaurant|bar|pub|cafe|biergarten|nightclub)$"]["name"](${MUNICH_BBOX});
  way["amenity"~"^(restaurant|bar|pub|cafe|biergarten|nightclub)$"]["name"](${MUNICH_BBOX});
);out center tags;`;

const CUISINE_MAP = {
  italian: "italian", pizza: "italian", pasta: "italian",
  bavarian: "bavarian", german: "bavarian", austrian: "bavarian",
  french: "french",
  japanese: "japanese", sushi: "japanese", ramen: "japanese",
  chinese: "asian-fusion", thai: "asian-fusion", korean: "asian-fusion", asian: "asian-fusion",
  vietnamese: "vietnamese",
  mediterranean: "mediterranean",
  greek: "greek",
  middle_eastern: "middle-eastern", turkish: "middle-eastern",
  lebanese: "middle-eastern", israeli: "middle-eastern", arabic: "middle-eastern",
  vegan: "vegan",
  vegetarian: "vegetarian",
  steak_house: "steakhouse", american: "steakhouse",
  breakfast: "brunch", brunch: "brunch", coffee_shop: "brunch",
  cocktail: "cocktail-bar",
  wine: "wine-bar",
  international: "international", regional: "european"
};

function mapCuisine(s) {
  if (!s) return [];
  return s.split(/[;,]/).map(c => CUISINE_MAP[c.trim().toLowerCase()]).filter(Boolean).slice(0, 2);
}

function enrichTags(type, amenity, cuisine, features) {
  const occasion = new Set();
  const mood = new Set();
  if (type === "bar") {
    ["casual", "date", "group", "celebration"].forEach(o => occasion.add(o));
    ["lively", "chic", "trendy"].forEach(m => mood.add(m));
    if (cuisine.includes("cocktail-bar")) { mood.add("romantic"); mood.add("elegant"); }
    if (cuisine.includes("wine-bar")) { mood.add("cozy"); mood.add("romantic"); }
    if (amenity === "nightclub") { occasion.delete("date"); mood.delete("romantic"); }
  } else {
    ["casual", "date", "family"].forEach(o => occasion.add(o));
    ["cozy", "lively"].forEach(m => mood.add(m));
    if (cuisine.includes("italian")) { occasion.add("celebration"); mood.add("romantic"); mood.add("traditional"); }
    if (cuisine.includes("french")) { occasion.add("celebration"); occasion.add("business"); mood.add("elegant"); mood.add("romantic"); }
    if (cuisine.includes("japanese") || cuisine.includes("asian-fusion") || cuisine.includes("vietnamese")) { mood.add("chic"); mood.add("trendy"); }
    if (cuisine.includes("bavarian")) { occasion.add("group"); occasion.add("business"); mood.add("traditional"); }
    if (cuisine.includes("greek") || cuisine.includes("mediterranean") || cuisine.includes("middle-eastern")) { occasion.add("group"); mood.add("trendy"); }
    if (cuisine.includes("steakhouse")) { occasion.add("business"); occasion.add("celebration"); mood.add("elegant"); }
    if (cuisine.includes("vegan") || cuisine.includes("vegetarian")) { mood.add("trendy"); }
    if (cuisine.includes("brunch")) { occasion.add("casual"); mood.add("cozy"); mood.add("trendy"); }
    if (features.includes("beer-garden")) { occasion.add("group"); occasion.add("family"); mood.add("lively"); mood.add("traditional"); }
    if (features.includes("terrace")) { mood.add("lively"); }
  }
  return { occasion: [...occasion], mood: [...mood] };
}

function mapPlace(e) {
  const t = e.tags || {};
  const amenity = t.amenity;
  const type = ["bar", "pub", "nightclub"].includes(amenity) ? "bar" : "restaurant";
  let cuisine = mapCuisine(t.cuisine);
  if (cuisine.length === 0) {
    if (amenity === "bar" || amenity === "pub" || amenity === "nightclub") cuisine = ["cocktail-bar"];
    else if (amenity === "cafe") cuisine = ["brunch"];
    else if (amenity === "biergarten") cuisine = ["bavarian"];
    else cuisine = ["international"];
  }
  const features = [];
  if (t.outdoor_seating === "yes") features.push("terrace");
  if (amenity === "biergarten" || t.beer_garden === "yes") features.push("beer-garden");
  if (t["diet:vegan"] === "yes" || t["diet:vegan"] === "only") features.push("vegan");
  const { occasion, mood } = enrichTags(type, amenity, cuisine, features);
  const hood = t["addr:suburb"] || t["addr:city_district"] || t["addr:city"] || "München";
  const bits = [];
  if (t.cuisine) bits.push(t.cuisine.replace(/[_;]/g, " "));
  if (t["addr:street"]) bits.push(t["addr:street"]);
  if (t.opening_hours) bits.push("geöffnet: " + String(t.opening_hours).slice(0, 60));
  const pitch = bits.length > 0
    ? "Aus OpenStreetMap. " + bits.join(" · ")
    : "Aus OpenStreetMap — von der Community kartiert.";
  const url = t.website || t["contact:website"] || `https://www.openstreetmap.org/${e.type}/${e.id}`;
  let price = 2;
  if (amenity === "cafe") price = 1;
  return {
    id: `osm-${e.type[0]}${e.id}`,
    type, name: t.name,
    neighborhood: hood,
    cuisine, price,
    occasion, mood,
    exclusivity: 1,
    features, pitch,
    bookingUrl: url,
    osm: true
  };
}

function scoreAndFilter(elements) {
  const candidates = elements.filter(e => {
    const t = e.tags || {};
    if (!t.name) return false;
    return t.cuisine || t.website || t["contact:website"];
  });
  const scored = candidates.map(e => {
    const t = e.tags || {};
    let s = 0;
    if (t.website || t["contact:website"]) s += 3;
    if (t.cuisine) s += 2;
    if (t.opening_hours) s += 1;
    if (t.outdoor_seating === "yes") s += 1;
    if (t["addr:street"]) s += 1;
    if (t.phone || t["contact:phone"]) s += 1;
    return { e, s };
  });
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, 800).map(({ e }) => mapPlace(e));
}

async function fetchOsmPlaces() {
  try {
    const r = await fetch(OVERPASS, {
      method: "POST",
      body: "data=" + encodeURIComponent(QUERY),
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "mucmeet-bot/0.1" },
      signal: AbortSignal.timeout(90000)
    });
    if (!r.ok) throw new Error(`Overpass HTTP ${r.status}`);
    const data = await r.json();
    return scoreAndFilter(data.elements || []);
  } catch (e) {
    console.warn("[fetch_places] OSM fehlgeschlagen:", e.message);
    return [];
  }
}

async function main() {
  let curated = [];
  try {
    curated = JSON.parse(await readFile(CURATED, "utf-8"));
  } catch (e) {
    console.warn("[fetch_places] places-curated.json nicht lesbar:", e.message);
  }
  const osm = await fetchOsmPlaces();

  const seen = new Set();
  const merged = [];
  [...curated, ...osm].forEach(p => {
    const k = (p.name || "").toLowerCase().trim();
    if (p.name && !seen.has(k)) { seen.add(k); merged.push(p); }
  });

  await writeFile(OUT, JSON.stringify({
    meta: { generatedAt: new Date().toISOString(), curated: curated.length, osm: osm.length, total: merged.length },
    places: merged
  }, null, 1), "utf-8");
  console.log(`[fetch_places] ${curated.length} kuratiert + ${osm.length} OSM -> places.json (${merged.length} gesamt)`);
}

main().catch(e => {
  console.error("[fetch_places] Abbruch:", e);
  process.exitCode = 0;
});
