# ImmoGame — Immobilien-Investment-Rechner

Ein professionelles Browser-Tool zur Analyse von Immobilien-Investments mit Echtzeit-Berechnungen, PDF-Export und Cloud-Speicherung über Supabase.

![ImmoGame Screenshot](https://img.shields.io/badge/Status-Live-brightgreen) ![License](https://img.shields.io/badge/License-Private-blue)

## Features

### 🏠 Deal-Checker (Schnell-Check)
- Sofort-Bewertung eines Immobilien-Deals
- Bruttomietrendite, Kaufpreisfaktor, monatlicher Cashflow
- Farbcodierte Ampel-Bewertung

### 📊 Deep-Dive Analyse
- Detaillierte 10-Jahres-Simulation
- Cashflow-Entwicklung (vor/nach Steuern)
- Vermögensaufbau-Chart (Tilgung + Wertsteigerung + kumulierter Cashflow)
- Exit-Szenario mit IRR, EK-Multiple und EK-Rendite
- Vollständiger Annuitätenplan
- AfA-Berechnung (§7 Abs. 4 EStG, Sonderregel Neubau)
- **PDF-Exposé-Export** für professionelle Dokumentation

### 🔥 Stress-Test
- Sensitivitätsanalyse mit Heatmap
- Cashflow-Reaktion auf Zins- & Mietänderungen
- Best-/Worst-/Base-Case Szenarien

### ☁️ Cloud-Speicherung
- OAuth-Authentifizierung (Google / GitHub) via Supabase
- Row Level Security (RLS) — jeder User sieht nur seine eigenen Deals
- Deals speichern, laden und löschen
- JSON-Export und -Import als Backup

## Tech-Stack

| Komponente | Technologie |
|---|---|
| **Frontend** | Vanilla JS (ES Modules) |
| **Styling** | Tailwind CSS (CDN) |
| **Charts** | Chart.js |
| **PDF-Export** | jsPDF |
| **Auth & DB** | Supabase (OAuth + PostgreSQL) |
| **Hosting** | Netlify (Static) |

## Projekt-Struktur

```
ImmoGame/
├── index.html          # Haupt-HTML mit Tailwind-UI
├── netlify.toml        # Netlify-Konfiguration
├── src/
│   ├── css/
│   │   └── style.css   # Custom CSS (Animationen, Dark-Mode)
│   ├── js/
│   │   ├── api/
│   │   │   ├── auth.js     # Supabase OAuth (Google/GitHub)
│   │   │   └── storage.js  # CRUD-Operationen für Deals (Supabase)
│   │   ├── core/
│   │   │   ├── calculator.js # Finanzberechnungen & Simulation
│   │   │   └── constants.js  # Bundesländer, Defaults, Sensitivität
│   │   └── main.js         # App-Logik, UI, Charts, PDF-Export
└── README.md
```

## Lokale Entwicklung

```bash
# Server starten
python3 -m http.server 8080

# Öffne im Browser
open http://localhost:8080
```

## Deployment auf Netlify

1. Repository mit GitHub verbinden
2. Netlify erkennt `netlify.toml` automatisch
3. **Build Command:** _(leer lassen — statische Seite)_
4. **Publish Directory:** `.`
5. Deploy! 🚀

### Supabase konfigurieren

Nach dem Deployment die neue Netlify-URL als **Site URL** und als **Redirect URL** im Supabase Dashboard eintragen:

1. **Authentication → URL Configuration → Site URL:** `https://deine-app.netlify.app`
2. **Authentication → URL Configuration → Redirect URLs:** `https://deine-app.netlify.app` hinzufügen

Damit funktioniert die OAuth-Anmeldung (Google/GitHub) auch auf der Live-Seite.

## Umgebungsvariablen

Die Supabase-Konfiguration befindet sich direkt in `src/auth.js` (Anon-Key, öffentlich). Für eine Produktionsumgebung empfiehlt sich die Verwendung von Netlify Environment Variables.

## Lizenz

Privates Projekt — Alle Rechte vorbehalten.
