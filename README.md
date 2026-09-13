MUCmeet
Muenchner Event-Plattform mit Instagram-Social-Layer (Prototyp).
Live: https://nickynikaa.github.io/mucmeet/

Taeglicher Auto-Import (04:00 UTC, GitHub Actions):
- Ticketmaster + SerpAPI (scripts/fetch_events.py) - grosse Publikums-Events. SerpAPI/Google Events deckt nebenbei auch Eventbrite- und Meetup-Treffer ab, die bei Google indexiert sind.
- Venue-Scraper (scripts/fetch_venues.mjs, uebernommen aus dem eingestellten Projekt picky-app) - Tantris, Kongressbar, Resident Advisor, Glockenbachwerkstatt, Mit Vergnuegen, Eventbrite (inkl. Business/Hobbies), Eventim, muenchen.de Feste, Luma (luma.com/munich). Manche Quellen (Eventbrite, RA) blockieren Anfragen von GitHub-Cloud-IPs teilweise - lokal/auf dem Mac liefern sie zuverlaessiger.

Bewusst NICHT eingebaut (Stand 2026-09-13):
- Meetup: eigene Such-/Standort-URLs sind in Meetups robots.txt gesperrt; Meetup-Events, die bei Google gelistet sind, kommen ueber SerpAPI mit rein.
- Facebook Events: kein oeffentliches Such-API mehr, aktive Bot-Abwehr inkl. Login-Zwang - ein taeglicher Cron-Scraper ohne Login faende praktisch nichts Verlaessliches.
- OpenTable Experiences: robots.txt sperrt unbenannte Bots (nur Google/Bing erlaubt), Verbindungen werden bei automatisierten Requests aktiv gekappt (Bot-Erkennung) - selbst mit Browser-User-Agent kein zuverlaessiger Zugriff.

Manuell testen: npm install \&\& node scripts/fetch_venues.mjs
