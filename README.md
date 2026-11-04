# Riga-Challenge

Web-App für 6 Spieler: Einarmiger Bandit mit Aufgaben (3 Stufen), Geheimmissionen, Joker, Pflicht-Alarm, Riga-Gericht, „Wer würde am ehesten“, Imposter, Rundenkasse, Chat, Live-Rangliste und Verlauf. Alles synchron über Firebase.

## Einrichten (ca. 15 Minuten)

1. **Firebase-Projekt anlegen:** [console.firebase.google.com](https://console.firebase.google.com) → Projekt hinzufügen (Analytics kann aus bleiben).
2. **Firestore aktivieren:** Build → Firestore Database → Datenbank erstellen → Standort `eur3 (Europe)` → Produktionsmodus.
3. **Anonyme Anmeldung aktivieren:** Build → Authentication → Jetzt starten → Anmeldemethode → *Anonym* aktivieren.
4. **Web-App registrieren:** Projekteinstellungen (Zahnrad) → Allgemein → „Deine Apps“ → Web (`</>`) → Name eingeben. Die angezeigte `firebaseConfig` in `public/firebase-config.js` einfügen.
5. **Index anlegen ist nicht nötig** (alle Abfragen nutzen nur ein Feld).
6. **Deployen** im Ordner `riga-challenge`:
   ```bash
   firebase login
   firebase use --add          # dein Projekt auswählen
   firebase deploy
   ```
7. Den Link `https://DEIN_PROJEKT.web.app` in die Gruppe schicken. Tipp: Auf dem Handy „Zum Home-Bildschirm“ hinzufügen.

## Automatisch veröffentlichen (GitHub)

Jeder Push auf den Branch `main` veröffentlicht die App automatisch auf https://boys-trip-efcf9.web.app (Workflow `.github/workflows/deploy.yml`). Den Fortschritt sieht man im Repository unter **Actions**.

Einmalige Einrichtung des Zugangs (im Projektordner auf dem PC):
```bash
firebase init hosting:github
```
Repository `DJPata/riga-challenge` angeben. Das legt das GitHub-Secret `FIREBASE_SERVICE_ACCOUNT_BOYS_TRIP_EFCF9` an. Build-Skript: Nein. Automatisch bei Merge deployen: Ja, Branch `main`. Die dabei erzeugten Workflow-Dateien auf dem PC werden nicht gebraucht.

Nach einem Deploy zeigt die App allen Spielern oben „🔄 Update da – tippen zum Laden“.

Firestore-Regeln (`firestore.rules`) werden nicht automatisch veröffentlicht. Bei Änderungen daran einmal `firebase deploy --only firestore:rules` ausführen.

## Lokal testen

```bash
firebase serve
```
Dann `http://localhost:5000` öffnen (zwei Browserfenster = zwei Spieler).

## So funktioniert's

- **Schritt 1 – Wo bist du?** Jeder wählt über die Kacheln seinen Ort: Bar, Weihnachtsmarkt, Outdoor, Stadt oder Alles. Ohne Ort kann man nicht ziehen.
- **Schritt 2 – Einarmiger Bandit:** Drei Walzen: Kategorie (passend zum Ort, die Ortskategorie kommt doppelt so oft), Stufe (Leicht 45 %, Mittel 35 %, Hardcore 20 %) und Bonus (Normal, Doppelte Punkte oder zusätzlich ein Joker).
- **Countdown:** Für jede Aufgabe hat man 60 Minuten. Läuft die Zeit ab, zählt das wie Verweigern (−2, Strafshot). Ab 10 Minuten Restzeit blinkt die Uhr rot.
- **Wartezeit:** Eine neue Aufgabe gibt es frühestens 30 Minuten nach dem letzten Ziehen. Wer schneller fertig ist, wartet den Rest.
- **Testrunde:** Bis So, 8.11.2026, 22:00 Uhr ist der Pflicht-Alarm automatisch für alle an, oben steht ein Testrunden-Hinweis. Danach gilt wieder der Admin-Schalter (`TEST_ROUND_END` in `app.js`). Vor der Reise mit Code zurücksetzen.
- **Pflicht-Alarm:** Jede Stunde zu einer zufälligen Minute (auf allen Handys gleich) klingelt es: Ton, Vibration (Android), großes Alarmfenster und eine Meldung im Chat. Dann muss jeder innerhalb von 15 Minuten eine Aufgabe ziehen, die Pause wird übersprungen. Oben im Aufgabe-Tab läuft der Countdown zum nächsten Alarm. Aktiv nur zwischen 10:00 und 01:59 Uhr. Einschalten für alle unter *Punkte → Admin → Pflicht-Alarm*. Dort gibt es auch „Alarm testen“ (nur auf dem eigenen Handy). iPhone: Ton nur, wenn das Handy nicht auf lautlos steht und die App offen ist.
- **Aufgabe abschließen:** Geschafft = volle Punkte, Versucht = halbe Punkte, Verweigert = −2 und Strafshot.
- **Rangliste:** Zeigt bei jedem Spieler den Ort und ob er gerade eine Aufgabe hat, Pause macht oder bereit ist.
- **Gemeinsamer Pool:** Jede gezogene Aufgabe ist für alle verbraucht. Ist ein Topf leer, wird er neu gemischt.
- **Geheimmissionen** landen in „Meine Geheimmissionen“ und werden später aufgelöst. Die anderen sehen im Verlauf nur, dass du eine hast.
- **Joker** gelten sofort und stehen im Verlauf.
- **Riga-Gericht** (Spiele → Gericht): Jeder kann jemanden anklagen (Schnellwahl oder eigener Vorwurf, eine offene Anklage pro Person). Die übrigen Spieler sind Geschworene. Urteil, wenn mindestens die Hälfte abgestimmt hat. Schuldig: Angeklagter −1 und Strafshot. Freispruch (auch bei Gleichstand): Ankläger −1 und Strafshot.
- **Wer würde am ehesten …?** (Spiele → Wer würde?): 42 Fragen. Alle stimmen geheim ab, dann wird aufgedeckt. Wer mit der Mehrheit stimmt: +1. Der Gewinner bekommt einen Ehrentitel (stehen unter Punkte → 🏅 Ehrentitel). Fragen in `tasks.js` bei `WHO_WOULD`.
- **Rundenkasse** (Kasse): „Ich hab eine Runde bezahlt“ mit optionalem Betrag und Ort. Zeigt Runden und Summe pro Person und wer als Nächstes dran ist (wenigste Runden, dann kleinste Summe). Eigene Einträge lassen sich löschen.
- **Finale:** In der Rangliste zieht der Letzte seine Verlierer-Aufgabe.
- **Imposter:** Unter *Spiele → Imposter* treten alle Mitspieler der Runde bei (mind. 3). Sobald einer startet, ist die Runde zu. Alle sehen den gleichen Begriff (Lettland, Weihnachten oder Männerausflug), nur der Imposter nicht. Begriff durch Gedrückthalten aufdecken, reihum ein Wort sagen, dann abstimmen. Gefangen: alle anderen +2, errät der Imposter danach das Wort: er +2. Entkommen: Imposter +5.
- **Chat:** Gruppen-Chat mit Zähler für ungelesene Nachrichten. Wer eine Aufgabe oder Geheimmission schafft, verweigert oder die Zeit verpennt, wird automatisch im Chat gemeldet (grün, gelb oder rot umrandet).
- **Benachrichtigungen:** Punkte der anderen und neue Chat-Nachrichten erscheinen als Hinweis. Unter *Punkte* lassen sich System-Benachrichtigungen erlauben (funktionieren, solange die App im Hintergrund offen ist; auf dem iPhone nur, wenn die App über „Zum Home-Bildschirm“ installiert ist).
- **Admin:** Spieler wechseln, Testmodus (keine Wartezeit) und Zurücksetzen mit Code (Standard: `1012`, änderbar oben bei `RESET_CODE` in `app.js`). Das Zurücksetzen meldet alle Geräte ab und löscht Spieler, Punkte, Aufgaben, Chat, Verlauf und Imposter. Vor der Reise den Testmodus wieder ausschalten!

## Aufgaben anpassen

Alle Aufgaben stehen in `public/tasks.js`. Einfach Zeilen ergänzen oder löschen und neu deployen. Eine Aufgabe nur für bestimmte Orte schreibt man so: `{ t: "Text", where: ["bar", "markt"] }`. Welche Kategorien an welchem Ort in den Automaten kommen, steht oben in `LOCATIONS`. Zeitlimit und Wartezeit stehen oben in `app.js` (`TASK_MINUTES`, `COOLDOWN_MINUTES`), die Alarm-Einstellungen bei `ALARM_WINDOW_MIN` und `alarmHourOk`.
