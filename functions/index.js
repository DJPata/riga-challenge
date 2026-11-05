// Server-Teil der Riga-Challenge. Läuft jede Minute und schickt Push-Nachrichten an alle Handys:
//  1. Pflicht-Alarm (stündlich zu zufälliger Minute)
//  2. Zeitplan-Meldungen (Teaser vorher, Startmeldung) aus game/schedule, das die App dort ablegt
// WICHTIG: Alarm-Berechnung und Ruhezeit müssen mit public/app.js übereinstimmen.
// Zeitplan, Reisezeit und Testrunde kommen aus Firestore (game/schedule), Änderungen brauchen also keinen neuen Deploy.

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const ALARM_WINDOW_MIN = 15;
const TEST_ROUND_END_DEFAULT = new Date("2026-11-08T22:00:00+01:00").getTime();
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

async function sendPush(title, body, tag) {
  const snap = await db.collection("tokens").get();
  const docs = snap.docs.filter((d) => d.get("token"));
  let ok = 0;
  for (let i = 0; i < docs.length; i += 500) {
    const chunk = docs.slice(i, i + 500);
    const res = await admin.messaging().sendEachForMulticast({
      tokens: chunk.map((d) => d.get("token")),
      data: { title, body, tag, url: "./" },
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
  return `${ok}/${docs.length}`;
}

// nur einmal pro Schlüssel (falls die Funktion doppelt läuft)
async function once(key) {
  try {
    await db.doc(`sent/${key}`).create({ at: Date.now() });
    return true;
  } catch {
    return false;
  }
}

exports.pflichtAlarm = onSchedule(
  { schedule: "every 1 minutes", timeZone: "Europe/Riga", region: "europe-west3", retryCount: 0 },
  async () => {
    const now = Date.now();
    const cfg = (await db.doc("game/schedule").get()).data() || {};
    const settings = (await db.doc("game/settings").get()).data() || {};

    // 1. Zeitplan-Meldungen (fällig in den letzten 3 Minuten)
    for (const m of cfg.messages || []) {
      if (m.at > now || now - m.at > 3 * MIN) continue;
      if (!(await once(`sched-${m.id}`))) continue;
      await db.doc(`chat/sched-${m.id}`).set({
        byId: "system", who: "", system: true, kind: "sched", at: admin.firestore.FieldValue.serverTimestamp(), text: m.text,
      });
      logger.info(`Zeitplan ${m.id}: ${await sendPush(m.title, m.text, `sched-${m.id}`)} Push gesendet`);
    }

    // 2. Pflicht-Alarm
    const t = alarmAt(Math.floor(now / HOUR));
    if (t > now || now - t > 2 * MIN) return;
    if (!alarmHourOk(Number(RIGA_HOUR.format(t)))) return;
    const testEnd = cfg.testRoundEnd || TEST_ROUND_END_DEFAULT;
    const inTrip = cfg.tripStart && t >= cfg.tripStart && t < cfg.tripEnd;
    if (!settings.alarm && t >= testEnd && !inTrip) return;
    if ((cfg.pauses || []).some((p) => t >= p.s && t < p.e)) return;
    if (!(await once(`alarm-${t}`))) return;

    const body = `Alle müssen jetzt eine Aufgabe ziehen! ${ALARM_WINDOW_MIN} Minuten Zeit.`;
    await db.doc(`chat/alarm-${t}`).set({
      byId: "system", who: "", system: true, kind: "alarm", at: admin.firestore.FieldValue.serverTimestamp(),
      text: `⏰ Pflicht-Alarm! Alle ziehen jetzt eine Aufgabe – ${ALARM_WINDOW_MIN} Minuten Zeit, Pause wird übersprungen.`,
    });
    logger.info(`Pflicht-Alarm ${new Date(t).toISOString()}: ${await sendPush("⏰ Pflicht-Alarm!", body, `alarm-${t}`)} Push gesendet`);
  }
);
