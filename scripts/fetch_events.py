#!/usr/bin/env python3
"""
MUCmeet – täglicher Event-Fetch.

Holt aktuelle München-Events über die Ticketmaster Discovery API (kostenlos)
und schreibt sie als events.json. Die kuratierten Community-/Gastro-Events
liegen direkt in index.html und bleiben unberührt – diese Datei ergänzt nur
die großen, automatisch auffindbaren Events (Konzerte, Festivals, Sport,
Bühne) mit echten Fotos.

Aktivierung: Umgebungsvariable TICKETMASTER_API_KEY setzen
(kostenloser Key von https://developer.ticketmaster.com/).
Ohne Key passiert nichts – die Seite läuft dann nur mit kuratierten Events.
"""

import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone

API_KEY = os.environ.get("TICKETMASTER_API_KEY", "").strip()
BASE = "https://app.ticketmaster.com/discovery/v2/events.json"
OUT = os.path.join(os.path.dirname(__file__), "..", "events.json")

# Wie viele Events maximal aus der API übernehmen
MAX_EVENTS = 120

# Deutsche Wochentags-Kürzel
DOW = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]


def map_cat(segment: str, genre: str) -> str:
    """Ticketmaster-Klassifikation -> MUCmeet-Kategorie."""
    s = (segment or "").lower()
    g = (genre or "").lower()
    if s == "music":
        return "music"
    if s == "sports":
        if "tennis" in g:
            return "tennis"
        if "cycl" in g or "bike" in g:
            return "cycle"
        if "running" in g or "marathon" in g:
            return "run"
        return "popup"
    # Arts & Theatre, Film, Family, Misc -> Pop-up & Kultur-Bucket
    return "popup"


def pick_image(images) -> str:
    """Möglichst breites, hochauflösendes Bild wählen."""
    if not images:
        return ""
    wide = [i for i in images if i.get("ratio") == "16_9" and i.get("width", 0) >= 640]
    chosen = wide or images
    chosen = sorted(chosen, key=lambda i: i.get("width", 0), reverse=True)
    return chosen[0].get("url", "")


def fmt_time(local_date: str, local_time: str) -> str:
    try:
        d = datetime.strptime(local_date, "%Y-%m-%d")
        dow = DOW[d.weekday()]
    except Exception:
        dow = ""
    t = (local_time or "")[:5]
    return (dow + " " + t).strip() or "Termin siehe Ticketmaster"


def fetch_segment(segment_name: str):
    """Eine Seite Events für ein Segment holen."""
    params = {
        "apikey": API_KEY,
        "city": "Munich",
        "countryCode": "DE",
        "size": 100,
        "sort": "date,asc",
        "startDateTime": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    if segment_name:
        params["segmentName"] = segment_name
    url = BASE + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "MUCmeet/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data.get("_embedded", {}).get("events", [])


def transform(ev: dict):
    name = ev.get("name")
    start = ev.get("dates", {}).get("start", {})
    date = start.get("localDate")
    if not name or not date:
        return None
    cls = (ev.get("classifications") or [{}])[0]
    segment = (cls.get("segment") or {}).get("name", "")
    genre = (cls.get("genre") or {}).get("name", "")
    venues = (ev.get("_embedded") or {}).get("venues") or [{}]
    venue = venues[0].get("name", "")
    city = (venues[0].get("city") or {}).get("name", "München")
    loc = ", ".join([p for p in [venue, city] if p]) or "München"
    parts = [p for p in [segment, genre] if p]
    desc = (" · ".join(parts) + f" in {venue}. " if parts else "") + "Tickets & Infos über Ticketmaster."
    return {
        "id": "tm-" + str(ev.get("id")),
        "cat": map_cat(segment, genre),
        "title": name,
        "date": date,
        "time": fmt_time(date, start.get("localTime", "")),
        "loc": loc,
        "ig": "",
        "igUrl": ev.get("url", "https://www.ticketmaster.de/city/munchen/"),
        "desc": desc.strip(),
        "img": pick_image(ev.get("images")),
    }


def main():
    if not API_KEY:
        print("Kein TICKETMASTER_API_KEY gesetzt – überspringe API-Fetch. "
              "events.json bleibt unverändert.")
        # events.json nicht überschreiben, damit vorhandene Daten erhalten bleiben
        if not os.path.exists(OUT):
            with open(OUT, "w", encoding="utf-8") as f:
                json.dump([], f)
        return 0

    seen, out = set(), []
    for seg in ["Music", "Sports", "Arts & Theatre", "Family"]:
        try:
            for ev in fetch_segment(seg):
                item = transform(ev)
                if item and item["id"] not in seen:
                    seen.add(item["id"])
                    out.append(item)
        except Exception as e:  # eine fehlerhafte Kategorie soll nicht alles stoppen
            print(f"Warnung: Segment '{seg}' fehlgeschlagen: {e}", file=sys.stderr)

    out.sort(key=lambda x: x["date"])
    out = out[:MAX_EVENTS]
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f"{len(out)} München-Events von Ticketmaster geschrieben -> events.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
