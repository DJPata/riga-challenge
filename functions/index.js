// Server-Teil der Riga-Challenge: schickt zu jedem Pflicht-Alarm eine Push-Nachricht an alle Handys.
// Läuft jede Minute und prüft, ob gerade ein Alarm fällig ist.
// WICHTIG: Alarm-Berechnung, Ruhezeit und Testrunde müssen mit public/app.js übereinstimmen.

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const ALARM_WINDOW_MIN = 15;
const TEST_ROUND_END = new Date("2026-11-08T22:00:00+01:00").getTime();
const alarmHourOk = (h) => h >= 10 || h < 2; // 10:00–01:59 Riga-Zeit
const RIGA_HOUR = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Riga", hour: "2-digit", hourCycle: "h23" });

// gleiche Formel wie in app.js
function alarmAt(hourIdx) {
  let x = (hourIdx * 2654435761) >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 2246822519) >>> 0;
  x ^= x >>> 13; x = Math.imul(x, 3266489917) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  return hourIdx * HOUR + (x % 3600) * 1000;
}

exports.pflichtAlarm = onSchedule(
  { schedule: "every 1 minutes", timeZone: "Europe/Riga", region: "europe-west3", retryCount: 0 },
  async () => {
    const now = Date.now();
    const t = alarmAt(Math.floor(now / HOUR));
    // fällig, wenn der Alarm in den letzten 2 Minuten lag
    if (t > now || now - t > 2 * MIN) return;
    if (!alarmHourOk(Number(RIGA_HOUR.format(t)))) return;

    const settings = (await db.doc("game/settings").get()).data() || {};
    if (!settings.alarm && now >= TEST_ROUND_END) return;

    // jeden Alarm nur einmal senden
    try {
      await db.doc(`alarms/${t}`).create({ at: t, sentAt: now });
    } catch {
      return;
    }

    const body = `Alle müssen jetzt eine Aufgabe ziehen! ${ALARM_WINDOW_MIN} Minuten Zeit.`;
    await db.doc(`chat/alarm-${t}`).set({
      byId: "system", who: "", system: true, kind: "alarm", at: admin.firestore.FieldValue.serverTimestamp(),
      text: `⏰ Pflicht-Alarm! Alle ziehen jetzt eine Aufgabe – ${ALARM_WINDOW_MIN} Minuten Zeit, Pause wird übersprungen.`,
    });

    const snap = await db.collection("tokens").get();
    const docs = snap.docs.filter((d) => d.get("token"));
    let ok = 0;
    for (let i = 0; i < docs.length; i += 500) {
      const chunk = docs.slice(i, i + 500);
      const res = await admin.messaging().sendEachForMulticast({
        tokens: chunk.map((d) => d.get("token")),
        data: { title: "⏰ Pflicht-Alarm!", body, tag: `alarm-${t}`, url: "./" },
        webpush: { headers: { Urgency: "high", TTL: String(ALARM_WINDOW_MIN * 60) } },
        apns: { headers: { "apns-priority": "10" } },
      });
      ok += res.successCount;
      // Tokens von Geräten, die es nicht mehr gibt, aufräumen
      await Promise.all(
        res.responses.map((r, j) => {
          const code = r.error && r.error.code;
          if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
            return chunk[j].ref.delete();
          }
          return null;
        })
      );
    }
    logger.info(`Pflicht-Alarm ${new Date(t).toISOString()}: ${ok}/${docs.length} Push gesendet`);
  }
);
