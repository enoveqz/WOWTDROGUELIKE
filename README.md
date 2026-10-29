# Kingshot — Riders of Aether

Ein eigenständiges **Low-Poly-Fantasy-Action-Roguelite mit Tower-Defense-Mechaniken**, direkt im Browser spielbar.
Wähle Rasse, Klasse und Reittier, verteidige den Aetherkristall gegen Gegnerwellen, baue Türme, kämpfe selbst –
und schalte zwischen den Runs dauerhafte Verbesserungen frei.

Gebaut mit **TypeScript, Vite und Three.js**. Alle Modelle, Effekte, Icons und Sounds werden prozedural erzeugt –
es gibt keine externen Asset-Dateien und keine Abhängigkeit von fremden Servern.

---

## Schnellstart

```bash
npm install
npm run dev        # Entwicklungsserver (http://localhost:5173)
```

| Befehl              | Zweck                                                       |
| ------------------- | ----------------------------------------------------------- |
| `npm run dev`       | Entwicklungsserver mit Hot Reload                           |
| `npm run build`     | Typprüfung (`tsc --noEmit`) + Production-Build nach `dist/` |
| `npm run preview`   | Production-Build lokal ansehen                              |
| `npm run typecheck` | Nur Typprüfung                                              |
| `npm test`          | Unit-Tests (Zufall, Werte, Wellen, Talente, Speichern)      |

Voraussetzung: Node.js ≥ 20.19 (empfohlen: 22).

> Tipp: Nach dem ersten `npm install` die entstandene `package-lock.json` einchecken.
> Der Workflow nutzt dann automatisch das reproduzierbare `npm ci`.

---

## GitHub Pages einrichten (einmalig)

1. Repository → **Settings → Pages**
2. Unter **Build and deployment → Source** die Option **GitHub Actions** wählen.
3. Auf `main` pushen (oder den Workflow unter **Actions → Build & Deploy to GitHub Pages → Run workflow** manuell starten).

Der Workflow `.github/workflows/deploy.yml` installiert die Abhängigkeiten, führt Tests und Typprüfung aus,
baut mit Vite und veröffentlicht `dist/` über `actions/upload-pages-artifact` + `actions/deploy-pages`.
Danach ist das Spiel unter `https://<benutzer>.github.io/<repository>/` erreichbar.

`vite.config.js` verwendet `base: './'` – alle Asset-Pfade sind relativ. Der Build funktioniert dadurch unabhängig
vom Repository-Namen (auch bei Groß-/Kleinschreibung) und ebenso auf jedem anderen Static-Host.

---

## Spielablauf

**Startmenü → Heldenwahl → Levelwahl → Kampf → Wellenverteidigung → Upgrade-Auswahl → Boss → Sieg/Niederlage → Belohnungen → Talente/Freischaltungen → nächster Run**

- Gegner laufen über markierte Routen zum **Aetherkristall** und greifen ihn an. Fällt der Kristall, endet der Run.
- Auf leuchtenden Sechseck-Bauplätzen entstehen **Türme**: Pfeilturm (Einzelziel), Arkanturm (Flächenschaden),
  Frostobelisk (Verlangsamung, später Einfrieren). Jeder Turm hat 3 Stufen und kann verkauft werden (60 % Erstattung).
- Der Held kämpft selbst: Standardangriff, vier Klassenfähigkeiten, eine Rassenfähigkeit, Ausweichrolle.
  Fällt er, kehrt er nach 7 s am Kristall zurück.
- Nach festgelegten Wellen gibt es eine **Auswahl aus drei Upgrades** (gewöhnlich/selten/episch/Relikt).
  Gleiche Tags schalten **Synergien** frei, Relikte sind stark, haben aber einen Haken.
- Jeder Run hat einen **Seed**: Ereignis (z. B. Blutmond, Aethersturm), Wellenvarianten, Elite-Affixe und
  Upgrade-Angebote sind reproduzierbar zufällig.
- Auch verlorene Runs bringen **Aethersplitter** und **Kontoerfahrung** (→ Talentpunkte) sowie **Reittier-Erfahrung**.

### Inhalte

| Bereich     | Inhalt |
| ----------- | ------ |
| Rassen      | Menschen von Valcrest, Waldelfen der Sylvaren, Grollhauer-Orks, Steinbart-Zwerge (freischaltbar) – je eine passive und eine aktive Fähigkeit mit eigenem Farbschema und Modell |
| Klassen     | Krieger, Magier, Waldläufer (mit Geisterwolf-Begleiter), Schurke (freischaltbar) – je 4 Fähigkeiten mit Kosten und Abklingzeiten |
| Reittiere   | Sturmross, Schattenwolf, Glutechse – Auf-/Absitzen, Tempo, eigener Ansturm, Stufen 1–10 |
| Level       | Flüsterwald (Wald), Sonnenglut-Dünen (Wüste), Frostzinnen (Schnee), Glutschlund (Vulkan) – je eigene Routen, Herausforderung und Boss |
| Gegner      | Nahkämpfer, Fernkämpfer, schnelle Hetzer, gepanzerte Oger, heilende Fluchwirker, Elite-Champions, Elite-Affixe |
| Bosse       | Morgrath (Treant), Khepra (Skarabäus), Valdris (Frostwyrm), Pyrax (Glutkoloss) mit markierten Spezialangriffen |
| Roguelite   | 32 Upgrades inkl. 6 Relikte, 8 Synergien, 5 Run-Ereignisse, Neuwürfeln |
| Meta        | 3 Talentbäume (Kampfkunst, Erbe, Reitkunst) mit Voraussetzungen, Aetherschmiede (dauerhafte Boni & Freischaltungen) |

---

## Steuerung (MMORPG-Stil)

| Eingabe                     | Aktion |
| --------------------------- | ------ |
| `W` / `S`                   | Vorwärts / rückwärts laufen |
| `A` / `D`                   | Drehen – mit gehaltener rechter Maustaste: seitwärts laufen |
| Linke Maustaste ziehen      | Kamera drehen und neigen (Figur bleibt stehen) |
| Rechte Maustaste ziehen     | Kamera drehen, die Figur dreht sich mit |
| Beide Maustasten            | Vorwärts laufen |
| Linksklick                  | Ziel wählen · Bauplatz öffnen |
| Rechtsklick                 | Gegner automatisch angreifen · Bauplatz öffnen |
| `Tab`                       | Nächstes Ziel |
| `1` – `4`                   | Klassenfähigkeiten (auf das Ziel bzw. den Gegner vor dir) |
| `R`                         | Rassenfähigkeit |
| `Leertaste`                 | Ausweichrolle · im Sattel: Reittier-Ansturm |
| `E`                         | Am Bauplatz: Turmmenü · sonst Auf-/Absitzen |
| `B`                         | Baumodus (alle Bauplätze & Reichweiten) |
| `N`                         | Nächste Welle früher rufen (Bonusgold) |
| Mausrad                     | Zoom |
| `Esc`                       | Menü schließen → Baumodus beenden → Ziel abwählen → Pause |

Das Turmmenü ist nicht modal: Kampftasten funktionieren weiter, Verkaufen braucht eine Bestätigung,
und ein per `E` geöffnetes Menü schließt sich, sobald man sich entfernt.

### Sanfter Einstieg

- Neue Konten starten mit Mensch + Krieger + Sturmross. Weitere Rassen, Klassen und Reittiere werden mit
  der Kontostufe frei (Stufe 2: Waldelfen, Waldläufer; Stufe 3: Orks, Magier; Stufe 4: Zwerge/Schurke kaufbar).
- Fähigkeiten werden wie in MMORPGs nach und nach erlernt: 1 und 2 sofort, 3 und Rassenfähigkeit ab Stufe 2, 4 ab Stufe 3.
- Im Flüsterwald: 45 s Vorbereitung, sehr kleine erste Wellen, Frostobelisk ab Welle 3, Arkanturm ab Welle 5,
  erstes Upgrade nach Welle 2. Der erste Run hat kein Zufallsereignis.
- Ein Questlog führt Schritt für Schritt durch Laufen, Bauen, Angreifen, Fähigkeiten und Reiten.

Alle Tasten sind unter **Einstellungen → Tastenbelegung** frei belegbar (Belegung über `KeyboardEvent.code`,
funktioniert also auch mit QWERTZ). Klicks auf UI-Elemente lösen keine Kampfaktionen aus.

---

## Architektur

```
src/
├── main.ts              Einstieg, WebGL-Prüfung, Lade-/Fehlerzustand
├── app.ts               Renderer, Hauptschleife, Menü ↔ Run, Pause, Einstellungen
├── core/                Seedbarer Zufall (mulberry32), Mathematik, Event-Emitter
├── config/              Zentrale, rein datengetriebene Spieldefinitionen (ohne Three.js, testbar)
│   ├── stats.ts         Wertesystem: (Basis + Σadd) × (1 + Σmul), Caps
│   ├── classes.ts       Klassen, Fähigkeiten, Standardangriffe
│   ├── races.ts         Rassen, Passive, Aktive, Aussehen
│   ├── mounts.ts        Reittiere, Ansturm, Stufen
│   ├── enemies.ts       Gegner, Bosse, Elite-Affixe
│   ├── towers.ts        Türme und Stufen
│   ├── upgrades.ts      Upgrades, Relikte, Synergien, Run-Ereignisse, Angebotslogik
│   ├── talents.ts       Talentbäume, Kontostufen, dauerhafte Boni
│   ├── levels.ts        Level: Routen, Bauplätze, Wellen-Themen, Herausforderung, Boss
│   ├── waves.ts         Wellengenerator (budgetbasiert, seedbar)
│   ├── biomes.ts        Biome: Farben, Licht, Nebel, Dekoration, Wetter
│   └── keybinds.ts      Aktionen und Standardbelegung
├── meta/                Speichern/Laden (localStorage, Migration), Belohnungen, Freischaltungen
├── audio/               Prozedurale Web-Audio-Effekte und generative Musik
├── world/               Gelände, Dekoration (Instancing), prozedurale Modelle, Effekt-Pools, Lebensbalken
├── game/                Run-Logik
│   ├── run.ts           Ein Run: besitzt alle Systeme, Upgrades, Herausforderungen, Sieg/Niederlage
│   ├── player.ts        Held, Bewegung, Kollision, Reittier, Begleiter, Animation
│   ├── abilities.ts     Klassen- und Rassenfähigkeiten
│   ├── enemies.ts       Gegner-KI (Routen, Aggro, Leine, Belagerung), Bossmechaniken, Pooling
│   ├── towers.ts        Bauen, Aufwerten, Verkaufen, Zielwahl, Angriffe
│   ├── waves.ts         Countdown, Spawning, Wellenbonus
│   ├── combat.ts        Schadensberechnung, Projektile, Bodenzonen/Fallen
│   ├── input.ts         Tastatur/Maus → Aktionen
│   ├── camera.ts        Verfolgerkamera, Zoom, Drehen, Kamerawackeln
│   └── showcase.ts      3D-Bühne für Menü und Heldenwahl
├── ui/                  Glass-UI: Bildschirme, HUD, Minimap, Turmmenü, Upgrade-Wahl, Pause, Tooltips
└── styles/main.css      Glassmorphism-Design
tests/run-tests.ts       Unit-Tests ohne Framework (node --experimental-strip-types)
```

**Erweitern:** Ein neues Level ist ein Eintrag in `config/levels.ts` (Routen, Bauplätze, Wellen-Themen, Boss).
Eine neue Rasse/Klasse/Reittier/Upgrade/Talent ist ebenfalls ein Datensatz; Fähigkeiten mit neuer Mechanik
erhalten einen `case` in `game/abilities.ts`. Die Tests prüfen u. a., dass Bauplätze neben den Routen liegen,
Routen am Kristall enden und jede Welle Gegner enthält.

**Performance:** geteilte Geometrien/Materialien, Instancing für Dekoration, gepoolte Gegner, Projektile,
Partikel und Effekte, Gegner-Obergrenze (75 gleichzeitig), Qualitätsstufen (Pixelratio, Schatten, Dekorationsdichte,
Partikelmenge). Fehlt die Web Audio API, bleibt das Spiel stumm, aber voll spielbar.

---

## Bekannte Einschränkungen

- Desktop mit Maus und Tastatur ist die Zielplattform; Layouts sind responsiv, eine Touch-Steuerung gibt es noch nicht.
- Gegner folgen festen Wegpunkt-Routen (bewusst nachvollziehbar, wie im Tower-Defense-Genre üblich); abseits davon
  wird nur kurzzeitig verfolgt und Hindernissen ausgewichen.
- Balancing ist auf einen ersten Durchlauf abgestimmt und profitiert von weiterem Spieltest-Feedback.
- Musik ist bewusst minimal (generative Flächen); echte Kompositionen ließen sich über `audio/audio.ts` ergänzen.

Eigenständiges Fan-Projekt mit eigenen Namen, Figuren und Assets – keine geschützten Inhalte Dritter.
