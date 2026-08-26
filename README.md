MUCmeet
Muenchner Event-Plattform mit Instagram-Social-Layer (Prototyp).
Live: https://nickynikaa.github.io/mucmeet/

Taeglicher Auto-Import (04:00 UTC, GitHub Actions):
- Ticketmaster + SerpAPI (scripts/fetch_events.py) - grosse Publikums-Events
- Venue-Scraper (scripts/fetch_venues.mjs, uebernommen aus dem eingestellten Projekt picky-app) - Tantris, Kongressbar, Resident Advisor, Glockenbachwerkstatt, Mit Vergnuegen, Eventbrite, Eventim, muenchen.de Feste. Manche Quellen (Eventbrite, RA) blockieren Anfragen von GitHub-Cloud-IPs teilweise - lokal/auf dem Mac liefern sie zuverlaessiger.

Manuell testen: npm install \&\& node scripts/fetch_venues.mjs
