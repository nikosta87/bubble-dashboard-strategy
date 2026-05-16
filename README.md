# Bubble Dashboard Strategy

Eine Home-Assistant Dashboard Strategy, die automatisch ein bereichsbasiertes Dashboard mit [Bubble Card](https://github.com/Clooos/Bubble-Card) generiert.

Der Startpunkt ist bewusst klein gehalten: Home-View, Raum-Views, Bubble-Buttons für steuerbare Entitäten und ein Footer über `horizontal-buttons-stack`.

## Voraussetzungen

- Home Assistant mit Dashboard Strategies
- Bubble Card installiert, am einfachsten über HACS
- Bereiche und Geräte/Entitäten in Home Assistant gepflegt

## Installation zum Testen

1. Projekt bauen:

   ```bash
   npm install
   npm run build
   ```

2. `dist/bubble-dashboard-strategy.js` nach Home Assistant kopieren:

   ```bash
   cp dist/bubble-dashboard-strategy.js /config/www/bubble-dashboard-strategy.js
   ```

3. Resource in Home Assistant hinzufügen:

   ```yaml
   lovelace:
     mode: storage
     resources:
       - url: /local/bubble-dashboard-strategy.js
         type: module
   ```

4. Neues Dashboard erstellen und im Raw-Konfigurationseditor eintragen:

   ```yaml
   strategy:
     type: custom:bubble-dashboard
   ```

## Konfiguration

Optional:

```yaml
strategy:
  type: custom:bubble-dashboard
  title: Mein Zuhause
  max_entities_per_area: 24
  ignored_domains:
    - sensor
  ignored_entities:
    - light.unused_light
```

## Veröffentlichung über GitHub

Für die private Phase:

```bash
git init
git add .
git commit -m "Initial Bubble Dashboard Strategy"
gh repo create bubble-dashboard-strategy --private --source=. --remote=origin --push
```

Wenn die Strategy stabil läuft, kann das Repository auf öffentlich gestellt werden:

```bash
gh repo edit bubble-dashboard-strategy --visibility public
```

Für HACS ist wichtig, dass im Repository unter `dist/` eine JavaScript-Datei liegt, die genauso heißt wie das Repository: `bubble-dashboard-strategy.js`.

## Roadmap

- Grafischer Strategy-Editor
- Pop-ups pro Raum
- bessere Domain-Gruppierung für Licht, Klima, Sicherheit und Medien
- Label-basierte Filterung
- Theme-Variablen für Bubble Card
