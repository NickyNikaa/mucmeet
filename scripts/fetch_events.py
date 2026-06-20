#!/usr/bin/env python3
"""
MUCmeet – täglicher Event-Fetch (zwei automatische Quellen).

1) Ticketmaster Discovery API  -> große Publikums-Events (Konzerte, Sport,
   Theater, Festivals) mit echten Fotos.
2) SerpAPI "Google Events"      -> aggregiert Google-Event-Ergebnisse
   (inkl. Eventbrite, Meetup, lokale Veranstalter) – schließt die
   Community-/Business-/Gastro-Lücke, die Ticketmaster nicht abdeckt.

Beide Quellen sind optional. Aktivierung über Umgebungsvariablen:
  TICKETMASTER_API_KEY  (kostenlos: https://developer.ticketmaster.com/)
  SERPAPI_KEY           (kostenlos 100 Abrufe/Monat: https://serpapi.com/)

Die kuratierten Community-Events stehen direkt in index.html und bleiben
unberührt. Dieses Skript schreibt nur events.json (zusätzliche Events).
"""

import hashlib
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import date, datetime, timezone

OUT = os.path.join(os.path.dirname(__file__), "..", "events.json")
MAX_EVENTS = 200
DOW = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]

MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "mär": 3, "apr": 4, "may": 5, "mai": 5,
    "jun": 6, "jul": 7, "aug": 8, "sep": 9, "oct": 10, "okt": 10,
    "nov": 11, "dec": 12, "dez": 12,
}


def http_get(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "MUCmeet/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8")


def norm_title(t: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (t or "").lower())[:40]


def classify(title: str) -> str:
    t = (title or "").lower()
    rules = [
        ("run", r"\blauf|\brun\b|marathon|5k|10k"),
        ("cycle", r"cycl|rennrad|gravel|\bbike|fahrrad|velo"),
        ("yoga", r"yoga"),
        ("pilates", r"pilates"),
        ("padel", r"padel"),
        ("tennis", r"tennis"),
        ("walk", r"walk|wander|spazier|hike|hiking"),
        ("biz", r"business|network|startup|founder|gründer|unternehm|pitch|\bb2b\b|sales|karriere|career|investor"),
        ("gastro", r"dinner|supper|\bwein|wine|\bfood|kulinar|tasting|brunch|restaurant|gastro|cooking|kochen"),
        ("date", r"single|dating|speed.?dating|kennenlern|flirt"),
        ("music", r"konzert|concert|festival|live|\bdj\b|\bclub\b|party|musik|\btour\b|rave"),
    ]
    for cat, pat in rules:
        if re.search(pat, t):
            return cat
    return "popup"


def fmt_time(local_date: str, local_time: str) -> str:
    try:
        d = datetime.strptime(local_date, "%Y-%m-%d")
        dow = DOW[d.weekday()]
    except Exception:
        dow = ""
    t = (local_time or "")[:5]
    return (dow + " " + t).strip() or "Termin siehe Link"


def parse_loose_date(text: str):
    """Aus Texten wie 'Jul 8', 'Aug 12 – 14', '8. Juli' ein YYYY-MM-DD machen."""
    if not text:
        return None
    s = text.lower().replace(".", " ")
    mon = None
    for token, num in MONTHS.items():
        if token in s:
            mon = num
            break
    dm = re.search(r"\b(\d{1,2})\b", s)
    if not mon or not dm:
        return None
    day = int(dm.group(1))
    today = date.today()
    for yr in (today.year, today.year + 1):
        try:
            d = date(yr, mon, day)
        except ValueError:
            return None
        if d >= today:
            return d.isoformat()
    return None


# ---------------------------------------------------------------- Ticketmaster
def pick_image(images) -> str:
    if not images:
        return ""
    wide = [i for i in images if i.get("ratio") == "16_9" and i.get("width", 0) >= 640]
    chosen = sorted(wide or images, key=lambda i: i.get("width", 0), reverse=True)
    return chosen[0].get("url", "")


def fetch_ticketmaster(key: str):
    base = "https://app.ticketmaster.com/discovery/v2/events.json"
    out = []
    for seg in ["Music", "Sports", "Arts & Theatre", "Family"]:
        params = {
            "apikey": key, "city": "Munich", "countryCode": "DE", "size": 100,
            "sort": "date,asc",
            "startDateTime": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "segmentName": seg,
        }
        try:
            data = json.loads(http_get(base + "?" + urllib.parse.urlencode(params)))
            for ev in data.get("_embedded", {}).get("events", []):
                start = ev.get("dates", {}).get("start", {})
                date_ = start.get("localDate")
                name = ev.get("name")
                if not name or not date_:
                    continue
                cls = (ev.get("classifications") or [{}])[0]
                segment = (cls.get("segment") or {}).get("name", "")
                genre = (cls.get("genre") or {}).get("name", "")
                venues = (ev.get("_embedded") or {}).get("venues") or [{}]
                venue = venues[0].get("name", "")
                city = (venues[0].get("city") or {}).get("name", "München")
                cat = classify(name)
                if cat == "popup":  # bei TM lieber an Segment orientieren
                    seg_l = segment.lower()
                    cat = "music" if seg_l == "music" else "popup"
                out.append({
                    "id": "tm-" + str(ev.get("id")),
                    "cat": cat,
                    "title": name,
                    "date": date_,
                    "time": fmt_time(date_, start.get("localTime", "")),
                    "loc": ", ".join([p for p in [venue, city] if p]) or "München",
                    "ig": "",
                    "igUrl": ev.get("url", "https://www.ticketmaster.de/city/munchen/"),
                    "desc": (f"{segment} · {genre} in {venue}. " if segment else "") + "Tickets & Infos über Ticketmaster.",
                    "img": pick_image(ev.get("images")),
                })
        except Exception as e:
            print(f"Warnung TM/{seg}: {e}", file=sys.stderr)
    return out


# -------------------------------------------------------------------- SerpAPI
SERP_QUERIES = [
    "Business Networking Events München",
    "Community Events München",
    "Food und Wein Events München",
]


def fetch_serpapi(key: str):
    out = []
    for q in SERP_QUERIES:
        params = {
            "engine": "google_events", "q": q,
            "location": "Munich, Bavaria, Germany",
            "hl": "de", "gl": "de", "api_key": key,
        }
        url = "https://serpapi.com/search.json?" + urllib.parse.urlencode(params)
        try:
            data = json.loads(http_get(url))
        except Exception as e:
            print(f"Warnung SerpAPI/'{q}': {e}", file=sys.stderr)
            continue
        for ev in data.get("events_results", []):
            title = ev.get("title")
            d = ev.get("date", {}) or {}
            iso = parse_loose_date(d.get("start_date") or d.get("when", ""))
            if not title or not iso:
                continue
            addr = ev.get("address") or []
            loc = ", ".join(addr[:2]) if addr else (ev.get("venue", {}) or {}).get("name", "München")
            when = (d.get("when") or "")[:32]
            link = ev.get("link") or ("https://www.google.com/search?q=" + urllib.parse.quote(title))
            out.append({
                "id": "se-" + hashlib.md5((title + iso).encode("utf-8")).hexdigest()[:10],
                "cat": classify(title),
                "title": title,
                "date": iso,
                "time": when or "Termin siehe Link",
                "loc": loc or "München",
                "ig": "",
                "igUrl": link,
                "desc": (ev.get("description") or "")[:170] or "Gefunden über Google Events.",
                "img": ev.get("thumbnail") or ev.get("image") or "",
            })
    return out


# ------------------------------------------------------------------------ main
def main():
    tm_key = os.environ.get("TICKETMASTER_API_KEY", "").strip()
    serp_key = os.environ.get("SERPAPI_KEY", "").strip()

    if not tm_key and not serp_key:
        print("Keine API-Keys gesetzt – events.json bleibt unverändert.")
        if not os.path.exists(OUT):
            with open(OUT, "w", encoding="utf-8") as f:
                json.dump([], f)
        return 0

    collected = []
    if tm_key:
        collected += fetch_ticketmaster(tm_key)
    if serp_key:
        collected += fetch_serpapi(serp_key)

    # Quellenübergreifend deduplizieren (gleicher Titel)
    seen, out = set(), []
    for e in collected:
        k = norm_title(e["title"])
        if k and k not in seen:
            seen.add(k)
            out.append(e)

    out.sort(key=lambda x: x["date"])
    out = out[:MAX_EVENTS]
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

    src = []
    if tm_key:
        src.append("Ticketmaster")
    if serp_key:
        src.append("SerpAPI/Google Events")
    print(f"{len(out)} Events geschrieben -> events.json (Quellen: {', '.join(src)})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
