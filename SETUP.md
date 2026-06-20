# MUCmeet – Auto-Import aktivieren (täglicher Event-Cron)

Die Seite läuft auch ohne weitere Schritte mit den kuratierten Events.
Um zusätzlich **automatisch täglich echte München-Events** (Konzerte, Festivals,
Sport, Bühne – mit echten Fotos) zu importieren, einmalig Folgendes tun:

## 1. Kostenlosen Ticketmaster-API-Key holen (~2 Min)
1. Auf <https://developer.ticketmaster.com/> registrieren (gratis).
2. Nach dem Login erscheint unter **My Apps** automatisch ein Key
   („Consumer Key"). Diesen kopieren.

## 2. Key als GitHub-Secret hinterlegen
1. Im Repo `NickyNikaa/mucmeet` auf GitHub:
   **Settings → Secrets and variables → Actions → New repository secret**
2. Name: `TICKETMASTER_API_KEY`
   Value: *(den kopierten Key einfügen)* → **Add secret**

## 1b. (Optional) Zweite Quelle: SerpAPI „Google Events"
Deckt zusätzlich Community-/Business-/Gastro-Events ab (inkl. Eventbrite/Meetup,
die Google listet) – die Ticketmaster nicht hat.
1. Auf <https://serpapi.com/> registrieren (kostenlos, 100 Abrufe/Monat).
2. Den **API Key** aus dem Dashboard kopieren.
3. Als zweites GitHub-Secret hinterlegen (gleicher Weg wie unten),
   Name: `SERPAPI_KEY`.

Beide Quellen sind unabhängig – du kannst nur Ticketmaster, nur SerpAPI
oder beide nutzen. Das Skript mischt und dedupliziert automatisch.

## 3. Fertig
- Der Workflow `Update events (täglich)` läuft danach jede Nacht (~06:00 München),
  holt die Events und schreibt sie in `events.json`. Die Seite zeigt sie
  automatisch zusätzlich zu den kuratierten Events an.
- Sofort testen: GitHub → Tab **Actions** → „Update events (täglich)" →
  **Run workflow**. Nach ~1 Min ist `events.json` gefüllt.

## Wie es zusammenhängt
- **Kuratierte Events** (Run-Clubs, Supper Clubs, Padel, Gastro …): stehen direkt
  in `index.html` – die findet keine API automatisch, die pflegen wir von Hand.
- **Automatische Events**: `scripts/fetch_events.py` holt sie von Ticketmaster
  und schreibt `events.json`.
- **Täglicher Lauf**: `.github/workflows/update-events.yml` (GitHub Actions Cron).
- **Anzeige**: `index.html` lädt beim Öffnen `events.json` dazu und mischt beides.

> Hinweis: Eventbrite bietet **keine** öffentliche Event-Suche per API mehr
> (seit 2020 abgeschaltet). Ticketmaster ist die beste kostenlose Quelle für
> die großen Events. Für noch breitere Abdeckung gäbe es kostenpflichtige
> Anbieter (PredictHQ, SerpAPI Google Events) – bei Bedarf einbaubar.
