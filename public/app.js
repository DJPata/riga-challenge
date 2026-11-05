import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  getFirestore, doc, collection, onSnapshot, setDoc, updateDoc, addDoc, getDoc, getDocs,
  runTransaction, increment, serverTimestamp, query, orderBy, limit, limitToLast, writeBatch, arrayUnion,
  arrayRemove, FieldPath,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { getMessaging, getToken, isSupported as messagingSupported } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging.js";
import { firebaseConfig, VAPID_KEY } from "./firebase-config.js";
import { CATEGORIES, JOKER, FINALE, IMPOSTER_WORDS, LOCATIONS, WHO_WOULD, SCHEDULE, TRIP } from "./tasks.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (s) => document.querySelector(s);
const LEVEL_NAMES = { 1: "Leicht", 3: "Mittel", 5: "Hardcore" };
const REFUSE_PENALTY = -2;

// ---------- Einstellungen ----------
const TASK_MINUTES = 60;      // so lange hat man für eine Aufgabe Zeit
const COOLDOWN_MINUTES = 30;  // frühestens so lange nach dem letzten Ziehen gibt es die nächste Aufgabe
const MIN = 60 * 1000;
let testMode = false;         // im Admin-Bereich umschaltbar: keine Wartezeit

// ---------- Zeitplan ----------
// Während der Reise bestimmt der Zeitplan, welche Aufgaben kommen. Vorher wählt man den Ort selbst (zum Testen).
const T = (iso) => new Date(iso).getTime();
const EVENTS = SCHEDULE.map((e) => ({ ...e, s: T(e.start), e: T(e.end) }));
const TRIP_START = T(TRIP.start);
const TRIP_END = T(TRIP.end);
// Zeit-Simulation zum Testen (Admin → Zeitplan testen), wirkt nur auf diesem Handy und nur auf Ort/Programm
const simOffset = () => { try { return Number(localStorage.getItem("riga-sim") || 0); } catch { return 0; } };
const nowS = () => Date.now() + simOffset();
const inTrip = (t) => t >= TRIP_START && t < TRIP_END;
const eventAt = (t) => EVENTS.find((e) => t >= e.s && t < e.e) || null;
const nextEventAfter = (t) => EVENTS.filter((e) => e.s > t).sort((a, b) => a.s - b.s)[0] || null;
const scheduleMode = () => inTrip(nowS()) || !!eventAt(nowS());
const evTitle = (e, t = nowS()) => (e.surprise && t < e.s ? `${e.teaserIcon || "❓"} ${e.teaserTitle || "Überraschung"}` : `${e.icon} ${e.title}`);
const hm = (t) => new Date(t).toLocaleTimeString("de-DE", { timeZone: "Europe/Riga", hour: "2-digit", minute: "2-digit" });
const dayHm = (t) => new Date(t).toLocaleString("de-DE", { timeZone: "Europe/Riga", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const penalty = () => (eventAt(nowS())?.noBooze ? "10 Liegestütze" : "Strafshot");

// ---------- Standort ----------
let loc = null;
const normLoc = (l) => (l === "husky" ? "outdoor" : l) || null; // alter Name
function effectiveLoc() {
  if (!me) return null;
  if ((me.barUntil || 0) > Date.now()) return "bar";
  const t = nowS();
  const ev = eventAt(t);
  if (ev) return ev.loc;
  if (inTrip(t)) return "stadt";
  return normLoc(me.loc);
}
const taskText = (t) => (typeof t === "string" ? t : t.t);
// Aufgaben mit "where" kommen nur an diesen Orten. Husky-Aufgaben bleiben bis zur Tour geheim.
const fitsLoc = (t) => {
  if (typeof t === "string" || !t.where) return true;
  if (!loc || loc === "alles") return !t.where.every((w) => w === "husky");
  return t.where.includes(loc);
};
function catsFor(locId) {
  const L = LOCATIONS.find((l) => l.id === locId);
  if (!L || !L.cats) return CATEGORIES;
  const cats = L.cats.map((id) => CATEGORIES.find((c) => c.id === id));
  return [cats[0], ...cats]; // Hauptkategorie des Orts doppelt so wahrscheinlich
}
function renderLocGrid() {
  const box = $("#loc-grid");
  box.innerHTML = "";
  LOCATIONS.filter((l) => !l.hidden).forEach((l) => {
    const b = document.createElement("button");
    b.className = "loc-tile" + (l.id === loc ? " on" : "");
    b.innerHTML = `<span class="i">${l.icon}</span><span class="n"></span>`;
    b.querySelector(".n").textContent = l.name;
    b.onclick = () => updateDoc(doc(db, "players", meId), { loc: l.id });
    box.appendChild(b);
  });
}
function renderWhere() {
  const auto = scheduleMode();
  $("#loc-grid").classList.toggle("hidden", auto);
  $("#loc-manual-hint").classList.toggle("hidden", auto);
  $("#sched-now").classList.toggle("hidden", !auto);
  $("#loc-title").textContent = auto ? "📍 Programm" : "Schritt 1 · Wo bist du gerade?";
  const t = nowS();
  const barOn = (me?.barUntil || 0) > Date.now();
  if (auto) {
    const ev = eventAt(t);
    const nx = nextEventAfter(t);
    const L = LOCATIONS.find((l) => l.id === loc);
    $("#sched-now").innerHTML = `
      <div class="now-line"><span class="now-big">${ev ? evTitle(ev, t) : "🎲 Freies Programm"}</span>
        ${ev ? `<span class="muted small">bis ${hm(ev.e)}</span>` : ""}</div>
      <div class="muted small">Aufgaben: ${barOn ? "🍺 Bar" : L ? `${L.icon} ${L.name}` : "–"}${ev?.noBooze && !barOn ? " · Strafen hier: 10 Liegestütze statt Shot" : ""}</div>
      ${nx ? `<div class="next-line">Als Nächstes: <b>${evTitle(nx, t)}</b> · ${dayHm(nx.s)}</div>` : ""}`;
  }
  const b = $("#bar-btn");
  b.textContent = barOn ? `🍺 Bar-Modus an (bis ${hm(me.barUntil)}) · beenden` : "🍺 Wir sind in einer Bar";
  b.classList.toggle("on", barOn);
  b.classList.toggle("hidden", !auto);
}
let meId = localStorage.getItem("riga-player");
let me = null;

// ---------- Hilfsfunktionen ----------
const slug = (s) => s.trim().toLowerCase().replace(/[^a-z0-9äöüß]+/g, "-").replace(/^-|-$/g, "");
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.add("hidden"), 2600);
}
function shuffle(a) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// Automatische Hinweise im Chat
function chatSystem(text, kind) {
  return addDoc(collection(db, "chat"), { byId: meId, who: me?.name || "", text, system: true, kind, at: serverTimestamp() });
}
function log(entry) {
  return addDoc(collection(db, "log"), { byId: meId, ...entry, at: serverTimestamp() });
}

// ---------- Benachrichtigungen ----------
let swReg = null;
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").then((r) => (swReg = r)).catch(() => {});
}
function notify(title, body) {
  toast(`${title}: ${body}`);
  if (!("Notification" in window) || Notification.permission !== "granted" || !document.hidden) return;
  try {
    if (swReg) swReg.showNotification(title, { body, icon: "icon.svg", tag: "riga-" + Date.now() });
    else new Notification(title, { body });
  } catch {}
}
function updateNotifyBtn() {
  const b = $("#notify-btn");
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const installed = window.navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
  if (!("Notification" in window)) {
    if (isIOS && !installed) {
      b.textContent = "iPhone: erst zum Home-Bildschirm hinzufügen";
      $("#notify-hint").innerHTML =
        "So geht's: In Safari unten auf <b>Teilen</b> (□↑) → <b>Zum Home-Bildschirm</b>. Dann die App über das neue Symbol öffnen und hier auf „Benachrichtigungen erlauben“ tippen.";
      $("#notify-hint").classList.remove("hidden");
    } else {
      b.textContent = "Auf diesem Gerät nicht verfügbar";
    }
    b.disabled = true;
  } else if (Notification.permission === "granted") {
    b.textContent = "Benachrichtigungen sind an ✓";
    b.disabled = true;
  }
}
$("#notify-btn").onclick = async () => {
  if (!("Notification" in window)) return;
  const perm = await Notification.requestPermission();
  updateNotifyBtn();
  if (perm === "granted") registerPush(true);
};
updateNotifyBtn();

// ---------- Push (kommt auch, wenn die App zu ist) ----------
// Der Server (functions/index.js) schickt zu jedem Pflicht-Alarm eine Push-Nachricht an alle Geräte,
// die hier ihren Token hinterlegt haben.
async function registerPush(loud = false) {
  try {
    if (!VAPID_KEY || !("Notification" in window) || Notification.permission !== "granted") return;
    if (!(await messagingSupported())) return loud && toast("Push wird von diesem Browser nicht unterstützt");
    const reg = await navigator.serviceWorker.register("sw.js");
    await navigator.serviceWorker.ready;
    const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if (!token) return;
    await setDoc(doc(db, "tokens", token.slice(-40).replace(/[^A-Za-z0-9_-]/g, "_")), {
      token, playerId: meId || null, name: me?.name || null, ua: navigator.userAgent.slice(0, 120), updatedAt: Date.now(),
    });
    $("#notify-btn").textContent = "Push-Benachrichtigungen sind an ✓";
    if (loud) toast("Push ist an: Alarme kommen jetzt auch bei geschlossener App 🔔");
  } catch (e) {
    console.error("Push", e);
    if (loud) toast("Push konnte nicht eingerichtet werden: " + e.message);
  }
}

// ---------- Beitreten ----------
async function start() {
  await signInAnonymously(auth);
  watchReset();

  onSnapshot(collection(db, "players"), (snap) => {
    const box = $("#existing-players");
    box.innerHTML = "";
    snap.forEach((d) => {
      const b = document.createElement("button");
      b.className = "chip";
      b.textContent = d.data().name;
      b.onclick = () => enter(d.id);
      box.appendChild(b);
    });
  });

  if (meId) {
    const snap = await getDoc(doc(db, "players", meId));
    if (snap.exists()) return enter(meId);
  }
}

$("#join-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("#join-name").value.trim();
  if (!name) return;
  const id = slug(name);
  const ref = doc(db, "players", id);
  if (!(await getDoc(ref)).exists()) {
    await setDoc(ref, { name, points: 0, secrets: [], titles: [] });
    await log({ who: name, text: "ist dem Spiel beigetreten" });
  }
  enter(id);
});

function enter(id) {
  meId = id;
  localStorage.setItem("riga-player", id);
  $("#join").classList.add("hidden");
  $("#game").classList.remove("hidden");
  renderLocGrid();
  resetReels();
  listenGame();
  startTicker();
  setTimeout(() => registerPush(false), 2500);
}

// ---------- Live-Daten ----------
let unsubs = [];
function listenGame() {
  unsubs.forEach((u) => u());
  unsubs = [
    onSnapshot(doc(db, "players", meId), (s) => {
      if (!s.exists()) return switchPlayer();
      me = s.data();
      updateLoc();
      $("#me-name").textContent = me.name;
      $("#me-points").textContent = me.points;
      renderSecrets();
      tick();
    }),
    onSnapshot(query(collection(db, "players"), orderBy("points", "desc")), (snap) => {
      boardDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderBoard();
      renderTitles();
      renderAccusedOptions();
      renderGericht();
      renderPoll();
      renderKasse();
    }),
    onSnapshot(query(collection(db, "log"), orderBy("at", "desc"), limit(80)), (snap) => {
      // Neue Einträge von anderen mit Punkten → Benachrichtigung
      if (logLoaded) {
        snap.docChanges().forEach((ch) => {
          const e = ch.doc.data();
          if (ch.type !== "added" || e.byId === meId || ch.doc.metadata.hasPendingWrites) return;
          if (e.points) notify(`${e.who} ${e.points > 0 ? "+" : ""}${e.points} Punkte`, e.text);
        });
      }
      logLoaded = true;
      const ul = $("#feed");
      ul.innerHTML = "";
      snap.forEach((d) => {
        const e = d.data();
        const li = document.createElement("li");
        const time = e.at ? e.at.toDate().toLocaleString("de-DE", { weekday: "short", hour: "2-digit", minute: "2-digit" }) : "";
        const pts = e.points ? `<span class="${e.points > 0 ? "pts-plus" : "pts-minus"}">${e.points > 0 ? "+" : ""}${e.points}</span> ` : "";
        li.innerHTML = `${pts}<span class="who"></span> <span class="txt"></span><div class="time">${time}</div>`;
        li.querySelector(".who").textContent = e.who;
        li.querySelector(".txt").textContent = e.text;
        ul.appendChild(li);
      });
    }),
    onSnapshot(doc(db, "game", "settings"), (s) => {
      testMode = !!(s.exists() && s.data().testMode);
      alarmSetting = !!(s.exists() && s.data().alarm);
      $("#alarm-toggle").textContent = alarmSetting
        ? "Pflicht-Alarm: AN"
        : inTestRound() ? "Pflicht-Alarm: AN (Testrunde)" : "Pflicht-Alarm: aus";
      $("#test-mode").textContent = testMode ? "Testmodus: AN (keine Wartezeit)" : "Testmodus: aus";
      tick();
    }),
    onSnapshot(query(collection(db, "trials"), orderBy("at", "desc"), limit(30)), (s) => {
      trials = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderGericht();
    }),
    onSnapshot(query(collection(db, "polls"), orderBy("at", "desc"), limit(60)), (s) => {
      polls = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderPoll();
    }),
    onSnapshot(query(collection(db, "rounds"), orderBy("at", "desc"), limit(200)), (s) => {
      rounds = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderKasse();
    }),
    onSnapshot(doc(db, "game", "imposter"), (s) => {
      imp = s.exists() ? s.data() : null;
      renderImposter();
    }),
    onSnapshot(query(collection(db, "chat"), orderBy("at", "asc"), limitToLast(150)), (snap) => {
      if (chatLoaded) {
        snap.docChanges().forEach((ch) => {
          const m = ch.doc.data();
          if (ch.type === "added" && m.byId !== meId) {
            if (activeTab !== "chat") {
              unread++;
              if (!m.system) notify(`💬 ${m.who}`, m.text);
            }
          }
        });
      }
      chatLoaded = true;
      renderChat(snap);
    }),
  ];
}
let logLoaded = false;
let chatLoaded = false;
let unread = 0;
let activeTab = "wheel";

// ---------- Chat ----------
function renderChat(snap) {
  const ul = $("#chat-list");
  ul.innerHTML = "";
  snap.forEach((d) => {
    const m = d.data();
    const li = document.createElement("li");
    if (m.system) li.className = `system ${m.kind || ""}`;
    else if (m.byId === meId) li.className = "mine";
    if (m.system) {
      li.textContent = m.text;
      ul.appendChild(li);
      return;
    }
    const time = m.at ? m.at.toDate().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "";
    li.innerHTML = `<div><span class="who"></span><span class="time">${time}</span></div><div class="txt"></div>`;
    li.querySelector(".who").textContent = m.who;
    li.querySelector(".txt").textContent = m.text;
    ul.appendChild(li);
  });
  updateBadge();
  if (activeTab === "chat") window.scrollTo(0, document.body.scrollHeight);
}
function updateBadge() {
  const b = $("#chat-badge");
  b.textContent = unread > 9 ? "9+" : unread;
  b.classList.toggle("hidden", unread === 0);
}
$("#chat-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = $("#chat-input");
  const text = input.value.trim();
  if (!text || !me) return;
  input.value = "";
  await addDoc(collection(db, "chat"), { byId: meId, who: me.name, text, at: serverTimestamp() });
});

// ---------- Imposter ----------
let imp = null;
const impRef = () => doc(db, "game", "imposter");
const inRound = () => !!imp?.players?.some((p) => p.id === meId);
const pName = (id) => imp?.players?.find((p) => p.id === id)?.name || "?";

function showImp(id) {
  ["#imp-lobby", "#imp-running", "#imp-voting", "#imp-done", "#imp-outside"].forEach((s) =>
    $(s).classList.toggle("hidden", s !== id)
  );
}

function renderImposter() {
  const status = imp?.status || "lobby";
  const players = imp?.players || [];
  $("#imp-round").textContent = imp?.round || 1;

  if (status === "lobby") {
    showImp("#imp-lobby");
    const box = $("#imp-lobby-players");
    box.innerHTML = players.length ? "" : '<span class="muted small">Noch niemand beigetreten</span>';
    players.forEach((p) => {
      const c = document.createElement("span");
      c.className = "chip" + (p.id === meId ? " on" : "");
      c.textContent = p.name;
      box.appendChild(c);
    });
    $("#imp-join").textContent = inRound() ? "Verlassen" : "Beitreten";
    $("#imp-start").disabled = players.length < 3 || !inRound();
    return;
  }

  if (status !== "done" && !inRound()) return showImp("#imp-outside");

  if (status === "running") {
    showImp("#imp-running");
    const isImp = imp.imposterId === meId;
    $("#imp-cat").textContent = `Kategorie: ${imp.category}`;
    $("#imp-word").textContent = isImp ? "Du bist der IMPOSTER 🕵️" : imp.word;
    $("#imp-starter").textContent = `${pName(imp.starterId)} fängt an, dann reihum.`;
    return;
  }

  if (status === "voting") {
    showImp("#imp-voting");
    const votes = imp.votes || {};
    $("#imp-vote-count").textContent = `(${Object.keys(votes).length}/${players.length} abgestimmt)`;
    const list = $("#imp-vote-list");
    list.innerHTML = "";
    players.forEach((p) => {
      if (p.id === meId) return;
      const b = document.createElement("button");
      b.className = "btn" + (votes[meId] === p.id ? " mine" : "");
      b.innerHTML = `<span></span><span>${votes[meId] === p.id ? "✓" : ""}</span>`;
      b.firstChild.textContent = p.name;
      b.onclick = () => updateDoc(impRef(), new FieldPath("votes", meId), p.id);
      list.appendChild(b);
    });
    return;
  }

  // done
  showImp("#imp-done");
  const r = imp.result || {};
  $("#imp-result").textContent = r.caught
    ? `Gefangen! ${pName(imp.imposterId)} war der Imposter.`
    : `${pName(imp.imposterId)} war der Imposter und ist entkommen!`;
  const counts = Object.entries(r.counts || {})
    .sort((a, b) => b[1] - a[1])
    .map(([id, n]) => `${pName(id)} ${n}`)
    .join(" · ");
  $("#imp-result-detail").textContent = `Das Wort war „${imp.word}“. Stimmen: ${counts || "keine"}`;
  $("#imp-guess-box").classList.toggle("hidden", !(r.caught && !r.guessDone));
}

$("#imp-join").onclick = async () => {
  const me_ = { id: meId, name: me.name };
  const snap = await getDoc(impRef());
  if (!snap.exists()) {
    await setDoc(impRef(), { status: "lobby", round: 1, players: [me_], votes: {} });
  } else if (inRound()) {
    const mine = imp.players.find((p) => p.id === meId);
    await updateDoc(impRef(), { players: arrayRemove(mine) });
  } else {
    await updateDoc(impRef(), { players: arrayUnion(me_) });
  }
};

$("#imp-start").onclick = async () => {
  try {
    await runTransaction(db, async (tx) => {
      const s = await tx.get(impRef());
      const d = s.data();
      if (!d || d.status !== "lobby") throw new Error("Runde läuft schon");
      if (d.players.length < 3) throw new Error("Mindestens 3 Spieler");
      const category = rand(Object.keys(IMPOSTER_WORDS));
      tx.update(impRef(), {
        status: "running",
        category,
        word: rand(IMPOSTER_WORDS[category]),
        imposterId: rand(d.players).id,
        starterId: rand(d.players).id,
        votes: {},
        result: null,
      });
    });
    await log({ who: me.name, text: "hat eine Imposter-Runde gestartet 🕵️" });
  } catch (e) {
    toast(e.message);
  }
};

// Begriff nur beim Gedrückthalten zeigen
const secret = $("#imp-secret");
["pointerdown"].forEach((ev) => secret.addEventListener(ev, () => secret.classList.add("show")));
["pointerup", "pointerleave", "pointercancel"].forEach((ev) =>
  secret.addEventListener(ev, () => secret.classList.remove("show"))
);
secret.addEventListener("contextmenu", (e) => e.preventDefault());

$("#imp-to-vote").onclick = () => updateDoc(impRef(), { status: "voting", votes: {} });

$("#imp-reveal").onclick = async () => {
  const voted = Object.keys(imp?.votes || {}).length;
  if (voted < imp.players.length && !confirmReveal()) return;
  let outcome = null;
  try {
    await runTransaction(db, async (tx) => {
      const s = await tx.get(impRef());
      const d = s.data();
      if (d.status !== "voting") throw new Error("Schon aufgelöst");
      const counts = {};
      Object.values(d.votes || {}).forEach((id) => (counts[id] = (counts[id] || 0) + 1));
      const max = Math.max(0, ...Object.values(counts));
      const top = Object.keys(counts).filter((id) => counts[id] === max);
      const caught = max > 0 && top.length === 1 && top[0] === d.imposterId;
      if (caught) {
        d.players
          .filter((p) => p.id !== d.imposterId)
          .forEach((p) => tx.update(doc(db, "players", p.id), { points: increment(2) }));
      } else {
        tx.update(doc(db, "players", d.imposterId), { points: increment(5) });
      }
      tx.update(impRef(), { status: "done", result: { caught, counts, guessDone: false } });
      outcome = { caught, d };
    });
  } catch (e) {
    return toast(e.message);
  }
  const { caught, d } = outcome;
  const impName = d.players.find((p) => p.id === d.imposterId)?.name;
  if (caught) {
    await log({ who: "Alle außer " + impName, text: `haben den Imposter ${impName} gefangen (Wort: ${d.word})`, points: 2 });
  } else {
    await log({ who: impName, byId: d.imposterId, text: `ist als Imposter entkommen (Wort: ${d.word})`, points: 5 });
  }
};
function confirmReveal() {
  return window.confirm("Noch nicht alle haben abgestimmt. Trotzdem auflösen?");
}

async function finishGuess(right) {
  const d = imp;
  await updateDoc(impRef(), { "result.guessDone": true });
  if (right) {
    await updateDoc(doc(db, "players", d.imposterId), { points: increment(2) });
    await log({ who: pName(d.imposterId), byId: d.imposterId, text: `hat als Imposter das Wort „${d.word}“ erraten`, points: 2 });
  }
}
$("#imp-guess-yes").onclick = () => finishGuess(true);
$("#imp-guess-no").onclick = () => finishGuess(false);

$("#imp-new").onclick = () =>
  setDoc(impRef(), { status: "lobby", round: (imp?.round || 1) + 1, players: [], votes: {} });

// ---------- Rangliste ----------
let boardDocs = [];
const mmss = (ms) => {
  const t = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};
function playerStatus(p) {
  const now = Date.now();
  const L = LOCATIONS.find((l) => l.id === normLoc(p.loc));
  const where = L ? `${L.icon} ${L.name}` : "📍 kein Ort";
  if (p.current) return `${where} · ⏳ Aufgabe läuft, noch ${Math.max(0, Math.ceil((p.current.deadline - now) / MIN))} min`;
  const wait = (p.lastDrawAt || 0) + COOLDOWN_MINUTES * MIN - now;
  if (!testMode && wait > 0) return `${where} · ☕ Pause, noch ${Math.ceil(wait / MIN)} min`;
  return `${where} · ✅ bereit`;
}
function renderBoard() {
  const ol = $("#board");
  ol.innerHTML = "";
  boardDocs.forEach((p) => {
    const li = document.createElement("li");
    if (p.id === meId) li.className = "me";
    li.innerHTML = `<div class="name"><span></span><small class="muted"></small></div><span class="pts">${p.points}</span>`;
    li.querySelector(".name span").textContent = p.name;
    li.querySelector(".name small").textContent = playerStatus(p);
    ol.appendChild(li);
  });
}

// ---------- Einarmiger Bandit ----------
const LEVEL_WEIGHTS = [1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 5, 5, 5, 5]; // 45 % / 35 % / 20 %
const BONUS = [
  { id: "x1", icon: "×1", label: "Normal", w: 14 },
  { id: "x2", icon: "×2", label: "Doppelt", w: 3 },
  { id: "joker", icon: "🃏", label: "+ Joker", w: 3 },
];
const LEVEL_SYM = { 1: { icon: "🟢", label: "Leicht" }, 3: { icon: "🟠", label: "Mittel" }, 5: { icon: "🔴", label: "Hardcore" } };
const SYM_H = 92;
let spinning = false;

const weighted = (items) => {
  const total = items.reduce((a, b) => a + b.w, 0);
  let r = Math.random() * total;
  return items.find((i) => (r -= i.w) < 0) || items[0];
};
const symHtml = (s) => `<div class="sym"><span class="i">${s.icon}</span><span class="l">${s.label}</span></div>`;
const catSym = (c) => ({ icon: c.icon, label: c.short || c.name });

function resetReels() {
  const q = { icon: "❔", label: "" };
  ["#reel0", "#reel1", "#reel2"].forEach((id) => {
    const el = $(id);
    el.style.transition = "none";
    el.style.transform = "translateY(0)";
    el.innerHTML = symHtml(q);
  });
}
function spinReel(el, pool, final, ms) {
  const items = Array.from({ length: 22 }, () => rand(pool));
  items.push(final);
  el.style.transition = "none";
  el.style.transform = "translateY(0)";
  el.innerHTML = items.map(symHtml).join("");
  el.offsetHeight; // Reflow, damit die Animation neu startet
  el.style.transition = `transform ${ms}ms cubic-bezier(.12,.75,.2,1)`;
  el.style.transform = `translateY(-${(items.length - 1) * SYM_H}px)`;
}

function slotState() {
  if (!me) return { ok: false, msg: "" };
  if (!loc) return { ok: false, msg: "Wähle zuerst oben, wo du bist." };
  if (me.current) return { ok: false, msg: "Erst die laufende Aufgabe abschließen." };
  const al = activeAlarm();
  if (al && (me.lastDrawAt || 0) < al) return { ok: true, msg: "⏰ Pflicht-Alarm! Jetzt ziehen.", alarm: true };
  const wait = (me.lastDrawAt || 0) + COOLDOWN_MINUTES * MIN - Date.now();
  if (!testMode && wait > 0) return { ok: false, msg: `☕ Nächste Aufgabe in ${mmss(wait)}`, wait: true };
  return { ok: true, msg: "Bereit! Zieh am Hebel." };
}

$("#pull").addEventListener("click", async () => {
  const st = slotState();
  if (!st.ok || spinning) return toast(st.msg || "Moment…");
  spinning = true;
  hideCards();
  tick();
  const cats = catsFor(loc);
  const cat = rand(cats);
  const lvl = rand(LEVEL_WEIGHTS);
  const bonus = weighted(BONUS);
  $(".slot").classList.add("running");
  spinReel($("#reel0"), cats.map(catSym), catSym(cat), 1600);
  spinReel($("#reel1"), Object.values(LEVEL_SYM), LEVEL_SYM[lvl], 2300);
  spinReel($("#reel2"), BONUS, bonus, 3000);
  if (navigator.vibrate) navigator.vibrate(40);
  setTimeout(async () => {
    $(".slot").classList.remove("running");
    if (navigator.vibrate) navigator.vibrate([60, 40, 120]);
    try {
      await drawTask(cat, lvl, bonus);
    } catch (e) {
      console.error(e);
      toast("Fehler beim Ziehen, bitte nochmal.");
    }
    spinning = false;
    tick();
  }, 3150);
});

function hideCards() {
  ["#joker-card"].forEach((s) => $(s).classList.add("hidden"));
}
$("#joker-ok").onclick = () => $("#joker-card").classList.add("hidden");

// Zieht eine noch nicht benutzte Aufgabe (gemeinsamer Pool für alle)
async function drawTask(cat, lvl, bonus) {
  const stateRef = doc(db, "game", "state");
  let all = cat.tasks[lvl].map((t, i) => ({ id: `${cat.id}-${lvl}-${i}`, text: taskText(t), ok: fitsLoc(t) }));
  if (all.some((t) => t.ok)) all = all.filter((t) => t.ok);
  all = all.map(({ id, text }) => ({ id, text }));

  const task = await runTransaction(db, async (tx) => {
    const s = await tx.get(stateRef);
    let used = s.exists() ? s.data().used || [] : [];
    let free = all.filter((t) => !used.includes(t.id));
    if (!free.length) {
      // Topf leer → diese Kategorie/Stufe neu mischen
      used = used.filter((u) => !u.startsWith(`${cat.id}-${lvl}-`));
      free = all;
    }
    const pick = rand(free);
    tx.set(stateRef, { used: [...used, pick.id] }, { merge: true });
    return pick;
  });

  const now = Date.now();
  const mult = bonus.id === "x2" ? 2 : 1;
  const entry = { ...task, cat: cat.name, icon: cat.icon, lvl, mult, drawnAt: now, deadline: now + TASK_MINUTES * MIN };
  const ref = doc(db, "players", meId);
  const multTxt = mult > 1 ? " ×2" : "";

  if (bonus.id === "joker") {
    const jt = rand(JOKER.cards);
    $("#joker-text").textContent = jt;
    $("#joker-card").classList.remove("hidden");
    await log({ who: me.name, text: `bekommt zusätzlich einen Joker: ${jt}` });
  }

  if (cat.secret) {
    delete entry.deadline;
    await updateDoc(ref, { secrets: arrayUnion(entry), lastDrawAt: now });
    await log({ who: me.name, text: `hat eine ${LEVEL_NAMES[lvl]}-Geheimmission gezogen 🤫${multTxt}` });
    toast("Geheimmission gespeichert. Pssst!");
    return;
  }

  await updateDoc(ref, { current: entry, lastDrawAt: now });
  await log({ who: me.name, text: `muss: ${task.text} (${cat.icon} ${LEVEL_NAMES[lvl]}${multTxt}, ${TASK_MINUTES} min Zeit)` });
}

// aktuelle Aufgabe anzeigen
const taskPoints = (cur) => cur.lvl * (cur.mult || 1);
function renderCurrent() {
  const cur = me?.current;
  if (!cur) return $("#task-card").classList.add("hidden");
  const multTxt = (cur.mult || 1) > 1 ? " · ×2" : "";
  $("#task-meta").textContent = `${cur.icon} ${cur.cat} · ${LEVEL_NAMES[cur.lvl]}${multTxt} · ${taskPoints(cur)} P.`;
  $("#task-text").textContent = cur.text;
  $("#task-card").classList.remove("hidden");
  tick();
}

let resolving = false;
async function resolveCurrent(res) {
  const cur = me?.current;
  if (!cur || resolving) return;
  resolving = true;
  const full = taskPoints(cur);
  const pts = res === "done" ? full : res === "half" ? Math.ceil(full / 2) : REFUSE_PENALTY;
  const label = {
    done: "hat geschafft",
    half: "hat versucht",
    refuse: `hat verweigert (${penalty()}!)`,
    expired: `hat die Zeit verpennt ⏰ (${penalty()}!)`,
  }[res];
  try {
    await updateDoc(doc(db, "players", meId), { points: increment(pts), current: null });
    await log({ who: me.name, text: `${label}: ${cur.text}`, points: pts });
    const sign = pts > 0 ? `+${pts}` : `${pts}`;
    const chatTxt = {
      done: `✅ ${me.name} hat die Aufgabe geschafft (${sign}): „${cur.text}“`,
      half: `🤏 ${me.name} hat die Aufgabe nur halb geschafft (${sign}): „${cur.text}“`,
      refuse: `❌ ${me.name} hat die Aufgabe verweigert (${sign}, ${penalty()}! ${penalty() === "Strafshot" ? "🥃" : "💪"}): „${cur.text}“`,
      expired: `⏰ ${me.name} hat die Zeit verpennt (${sign}, ${penalty()}! ${penalty() === "Strafshot" ? "🥃" : "💪"}): „${cur.text}“`,
    }[res];
    await chatSystem(chatTxt, res === "done" ? "ok" : res === "half" ? "half" : "fail");
    toast(pts > 0 ? `+${pts} Punkte` : res === "expired" ? `Zeit abgelaufen: ${pts} Punkte` : `${pts} Punkte. Prost!`);
  } finally {
    resolving = false;
  }
}
document.querySelectorAll("[data-res]").forEach((b) => b.addEventListener("click", () => resolveCurrent(b.dataset.res)));

// ---------- Pflicht-Alarm: jede Stunde zu einer zufälligen Minute ----------
const ALARM_WINDOW_MIN = 15;                          // so lange hat man nach dem Alarm Zeit zum Ziehen
const alarmHourOk = (h) => h >= 10 || h < 2;          // nur zwischen 10:00 und 01:59 Uhr Riga-Zeit (= 9:00–0:59 deutsche Zeit)
const HOUR = 60 * MIN;
let alarmSetting = false;                             // im Admin-Bereich für alle umschaltbar

// Testrunde: bis zu diesem Zeitpunkt ist der Pflicht-Alarm automatisch für alle an
const TEST_ROUND_END = new Date("2026-11-08T22:00:00+01:00").getTime();
const inTestRound = () => Date.now() < TEST_ROUND_END;
// Alarme laufen: während der Reise automatisch, sonst in der Testrunde oder wenn im Admin eingeschaltet.
// Pausiert bei Programmpunkten mit pause (Anreise, Abflug).
const alarmOnAt = (t) => (alarmSetting || t < TEST_ROUND_END || inTrip(t)) && !EVENTS.some((e) => e.pause && t >= e.s && t < e.e);
const alarmEnabled = () => alarmSetting || inTestRound() || inTrip(Date.now());

// Zufällige, aber auf allen Handys gleiche Alarmzeit innerhalb einer Stunde
function alarmAt(hourIdx) {
  let x = (hourIdx * 2654435761) >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 2246822519) >>> 0;
  x ^= x >>> 13; x = Math.imul(x, 3266489917) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0; // immer positiv
  return hourIdx * HOUR + (x % 3600) * 1000;
}
const RIGA_HOUR = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Riga", hour: "2-digit", hourCycle: "h23" });
const alarmAllowed = (t) => alarmHourOk(Number(RIGA_HOUR.format(t))) && alarmOnAt(t); // Ruhezeit nach Riga-Uhrzeit
function lastAlarm(now = Date.now()) {
  for (let h = Math.floor(now / HOUR), k = 0; k < 30; k++, h--) {
    const t = alarmAt(h);
    if (t <= now && alarmAllowed(t)) return t;
  }
  return null;
}
function nextAlarm(now = Date.now()) {
  for (let h = Math.floor(now / HOUR), k = 0; k < 30; k++, h++) {
    const t = alarmAt(h);
    if (t > now && alarmAllowed(t)) return t;
  }
  return null;
}
function activeAlarm(now = Date.now()) {
  const t = lastAlarm(now);
  return t && now - t < ALARM_WINDOW_MIN * MIN ? t : null;
}

// Ton (Web Audio). iPhone: erst nach einer Berührung erlaubt, und nicht im Lautlos-Modus.
let audioCtx = null;
function unlockAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch {}
}
document.addEventListener("pointerdown", unlockAudio, { passive: true });
function beepSeries(offset) {
  const t0 = audioCtx.currentTime + offset;
  for (let i = 0; i < 6; i++) {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "square";
    o.frequency.value = i % 2 ? 660 : 880;
    const t = t0 + i * 0.25;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g).connect(audioCtx.destination);
    o.start(t);
    o.stop(t + 0.24);
  }
}
function playAlarm() {
  unlockAudio();
  if (!audioCtx) return;
  try { beepSeries(0); beepSeries(2); beepSeries(4); } catch {}
}

function fireAlarm(at, test = false) {
  playAlarm();
  if (navigator.vibrate) navigator.vibrate([400, 150, 400, 150, 800]);
  $("#alarm-overlay").classList.remove("hidden");
  if (test) return;
  notify("⏰ Pflicht-Alarm", `Alle müssen jetzt eine Aufgabe ziehen! ${ALARM_WINDOW_MIN} Minuten Zeit.`);
  // eine Chat-Meldung pro Alarm (feste ID, egal wie viele Handys sie schreiben)
  setDoc(doc(db, "chat", `alarm-${at}`), {
    byId: "system", who: "", system: true, kind: "alarm", at: serverTimestamp(),
    text: `⏰ Pflicht-Alarm! Alle ziehen jetzt eine Aufgabe – ${ALARM_WINDOW_MIN} Minuten Zeit, Pause wird übersprungen.`,
  }).catch(() => {});
}
$("#alarm-go").onclick = () => {
  $("#alarm-overlay").classList.add("hidden");
  document.querySelector('.tabbar [data-tab="wheel"]').click();
};
$("#alarm-close").onclick = () => $("#alarm-overlay").classList.add("hidden");

function checkAlarm() {
  const card = $("#alarm-card");
  $("#test-banner").classList.toggle("hidden", !inTestRound());
  const now = Date.now();
  if (!activeAlarm(now) && !nextAlarm(now)) return card.classList.add("hidden");
  card.classList.remove("hidden");
  const al = activeAlarm(now);
  if (al) {
    let seen = null;
    try { seen = localStorage.getItem("riga-alarm"); } catch {}
    if (seen !== String(al)) {
      try { localStorage.setItem("riga-alarm", String(al)); } catch {}
      fireAlarm(al);
    }
    const done = (me.lastDrawAt || 0) >= al;
    card.className = "alarm-card " + (done ? "done" : "active");
    $("#alarm-label").textContent = done
      ? "✅ Pflicht-Aufgabe gezogen"
      : `⏰ PFLICHT-ALARM! Jetzt ziehen – noch ${mmss(al + ALARM_WINDOW_MIN * MIN - now)}`;
  } else {
    const nx = nextAlarm(now);
    card.className = "alarm-card";
    $("#alarm-label").textContent = nx ? `⏰ Nächster Pflicht-Alarm in ${mmss(nx - now)}` : "";
  }
}

// ---------- Zeitplan-Meldungen (Teaser 1 h vorher, Start) ----------
// Der Server schickt dazu Push-Nachrichten. Hier: Chat-Meldung und Hinweis, falls die App offen ist.
const SCHED_MSGS = EVENTS.flatMap((e) => [
  ...(e.teasers || []).map((t, i) => ({ id: `${e.id}-t${i}`, at: e.s + t.min * MIN, title: e.surprise ? `${e.teaserIcon || "❓"} ${e.teaserTitle || "Überraschung"}` : `${e.icon} ${e.title}`, text: t.text })),
  ...(e.startText ? [{ id: `${e.id}-start`, at: e.s, title: `${e.icon} ${e.title}`, text: e.startText }] : []),
]);
function checkSchedule() {
  const now = Date.now();
  SCHED_MSGS.forEach((m) => {
    if (now < m.at || now - m.at > 20 * MIN) return;
    let seen = null;
    try { seen = localStorage.getItem("riga-sched-" + m.id); } catch {}
    if (seen) return;
    try { localStorage.setItem("riga-sched-" + m.id, "1"); } catch {}
    notify(m.title, m.text);
    setDoc(doc(db, "chat", `sched-${m.id}`), { byId: "system", who: "", system: true, kind: "sched", at: serverTimestamp(), text: m.text }).catch(() => {});
  });
}
function updateLoc() {
  const l = effectiveLoc();
  if (l !== loc) {
    loc = l;
    renderLocGrid();
    if (!spinning) resetReels();
  }
  renderWhere();
}
// Zeitplan für den Server ablegen (Push für Teaser und Alarm-Pausen)
async function publishSchedule() {
  const cfg = {
    messages: SCHED_MSGS,
    pauses: EVENTS.filter((e) => e.pause).map((e) => ({ s: e.s, e: e.e })),
    tripStart: TRIP_START, tripEnd: TRIP_END, testRoundEnd: TEST_ROUND_END,
  };
  const version = JSON.stringify(cfg).length + ":" + SCHED_MSGS.map((m) => m.id + m.at).join("|").length + ":" + JSON.stringify(cfg).split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  try {
    const cur = await getDoc(doc(db, "game", "schedule"));
    if (!cur.exists() || cur.data().version !== version) await setDoc(doc(db, "game", "schedule"), { ...cfg, version });
  } catch {}
}

// Programm-Übersicht
function renderProgram() {
  const t = nowS();
  let lastDay = "";
  $("#program").innerHTML = EVENTS.map((e) => {
    const day = new Date(e.s).toLocaleDateString("de-DE", { timeZone: "Europe/Riga", weekday: "long", day: "2-digit", month: "2-digit" });
    const head = day !== lastDay ? `<li class="day">${day}</li>` : "";
    lastDay = day;
    const state = t >= e.e ? "past" : t >= e.s ? "now" : "";
    return `${head}<li class="${state}"><span class="pt">${hm(e.s)}–${hm(e.e)}</span><span>${evTitle(e, t)}</span></li>`;
  }).join("");
}

// Bar-Knopf: 3 Stunden Bar-Aufgaben (nur für dich)
$("#bar-btn").onclick = () =>
  updateDoc(doc(db, "players", meId), { barUntil: (me.barUntil || 0) > Date.now() ? 0 : Date.now() + 3 * 60 * MIN });

// Admin: Zeitplan testen (Zeit nur auf diesem Handy vorspulen)
(function setupSim() {
  const sel = $("#sim-select");
  sel.innerHTML = '<option value="">Echte Zeit</option>' +
    EVENTS.map((e) => `<option value="${e.s + 30 * MIN}">${dayHm(e.s + 30 * MIN)} · ${e.icon} ${e.title}</option>`).join("") +
    `<option value="${T("2026-12-04T22:00:00+02:00")}">Fr 22:00 · Bars (abends)</option>`;
  sel.onchange = () => {
    try {
      if (sel.value) localStorage.setItem("riga-sim", String(Number(sel.value) - Date.now()));
      else localStorage.removeItem("riga-sim");
    } catch {}
    updateSimBanner();
    updateLoc();
    renderProgram();
  };
})();
function updateSimBanner() {
  const off = simOffset();
  $("#sim-banner").classList.toggle("hidden", !off);
  if (off) $("#sim-banner").textContent = `🧪 Simulation: ${dayHm(nowS())} (nur auf diesem Handy) · Punkte → Admin → Echte Zeit`;
}

// ---------- Sekundentakt: Countdown, Wartezeit, Ablauf ----------
function tick() {
  if (!me) return;
  const cur = me.current;
  if (cur) {
    const left = cur.deadline - Date.now();
    $("#task-timer").textContent = mmss(left);
    const frac = Math.max(0, Math.min(1, left / (TASK_MINUTES * MIN)));
    $("#task-bar").style.width = `${frac * 100}%`;
    $("#task-card").classList.toggle("urgent", left < 10 * MIN);
    if (left <= 0) resolveCurrent("expired");
  }
  checkAlarm();
  checkSchedule();
  updateLoc();
  const st = slotState();
  $("#pull").disabled = !st.ok || spinning;
  $("#slot-status").textContent = spinning ? "Rattert…" : st.msg;
}
let tickerStarted = false;
function startTicker() {
  if (tickerStarted) return;
  tickerStarted = true;
  setInterval(tick, 1000);
  setInterval(renderBoard, 15000);
  setInterval(() => { renderProgram(); updateSimBanner(); }, 30000);
  renderProgram();
  updateSimBanner();
  publishSchedule();
}

// Geheimmissionen
function renderSecrets() {
  renderCurrent();
  const list = me?.secrets || [];
  $("#secrets").classList.toggle("hidden", !list.length);
  const ul = $("#secret-list");
  ul.innerHTML = "";
  list.forEach((m) => {
    const li = document.createElement("li");
    li.innerHTML = `<div class="muted small">${m.icon} ${LEVEL_NAMES[m.lvl]} · ${m.lvl} P.</div>
      <div class="txt"></div>
      <div class="row"><button class="btn primary">Geschafft</button><button class="btn danger">Erwischt</button></div>`;
    li.querySelector(".txt").textContent = m.text;
    const [ok, caught] = li.querySelectorAll("button");
    ok.onclick = () => resolveSecret(m, true);
    caught.onclick = () => resolveSecret(m, false);
    ul.appendChild(li);
  });
}

async function resolveSecret(m, success) {
  const ref = doc(db, "players", meId);
  const remaining = (me.secrets || []).filter((s) => s.id !== m.id);
  const pts = success ? m.lvl : 0;
  await updateDoc(ref, { secrets: remaining, points: increment(pts) });
  await log({
    who: me.name,
    text: `${success ? "hat die Geheimmission erfüllt" : "wurde bei der Geheimmission erwischt"}: ${m.text}`,
    points: pts,
  });
  await chatSystem(
    success
      ? `🤫✅ ${me.name} hat eine Geheimmission erfüllt (+${pts}): „${m.text}“`
      : `🤫❌ ${me.name} wurde bei der Geheimmission erwischt: „${m.text}“`,
    success ? "ok" : "fail"
  );
}

// ---------- Gemeinsame Helfer ----------
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const nameOf = (id) => boardDocs.find((p) => p.id === id)?.name || "?";
const ago = (t) => {
  const m = Math.round((Date.now() - t) / MIN);
  return m < 1 ? "gerade eben" : m < 60 ? `vor ${m} min` : `vor ${Math.round(m / 60)} h`;
};

// ---------- Riga-Gericht ----------
let trials = [];
const QUICK_CHARGES = ["Handy am Tisch", "Englisch geredet", "Über Arbeit geredet", "Runde geschwänzt", "Zu spät", "Eingeschlafen", "Gejammert"];
$("#trial-quick").innerHTML = QUICK_CHARGES.map((c) => `<button type="button" class="chip">${esc(c)}</button>`).join("");
$("#trial-quick").querySelectorAll("button").forEach((b) => (b.onclick = () => ($("#trial-charge").value = b.textContent)));

function renderAccusedOptions() {
  const sel = $("#trial-accused");
  const cur = sel.value;
  sel.innerHTML = '<option value="">Wen klagst du an?</option>' +
    boardDocs.filter((p) => p.id !== meId).map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("");
  sel.value = cur;
}

$("#trial-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const accusedId = $("#trial-accused").value;
  const charge = $("#trial-charge").value.trim();
  if (!accusedId || !charge) return toast("Wen und warum?");
  if (trials.some((t) => t.status === "open" && t.byId === meId)) return toast("Du hast schon eine offene Anklage");
  await addDoc(collection(db, "trials"), {
    byId: meId, byName: me.name, accusedId, accusedName: nameOf(accusedId), charge, votes: {}, status: "open", at: Date.now(),
  });
  await chatSystem(`⚖️ ${me.name} klagt ${nameOf(accusedId)} an: „${charge}“. Jetzt unter Spiele → Gericht abstimmen!`, "trial");
  $("#trial-charge").value = "";
  $("#trial-accused").value = "";
  toast("Anklage erhoben ⚖️");
});

const jurors = (t) => boardDocs.filter((p) => p.id !== t.accusedId && p.id !== t.byId);

function renderGericht() {
  const open = trials.filter((t) => t.status === "open");
  const box = $("#trial-open");
  box.innerHTML = "";
  open.forEach((t) => {
    const votes = t.votes || {};
    const j = jurors(t);
    const voted = j.filter((p) => votes[p.id]).length;
    const canVote = meId !== t.accusedId && meId !== t.byId;
    const mine = votes[meId];
    const card = document.createElement("div");
    card.className = "card trial";
    card.innerHTML = `
      <p class="eyebrow">⚖️ Offene Anklage · ${ago(t.at)}</p>
      <p class="task-text">${esc(t.byName)} gegen ${esc(t.accusedName)}</p>
      <p class="charge">„${esc(t.charge)}“</p>
      ${canVote ? `<div class="levels">
        <button class="btn ${mine === "guilty" ? "primary" : ""}" data-v="guilty">👎 Schuldig</button>
        <button class="btn ${mine === "innocent" ? "primary" : ""}" data-v="innocent">👍 Unschuldig</button>
      </div>` : `<p class="muted small">${meId === t.accusedId ? "Du bist angeklagt. Verteidige dich mündlich!" : "Du bist der Ankläger."}</p>`}
      <p class="muted small">${voted}/${j.length} Geschworene haben abgestimmt</p>
      <button class="btn wide" data-verdict>🔨 Urteil verkünden</button>`;
    card.querySelectorAll("[data-v]").forEach((b) => (b.onclick = () => updateDoc(doc(db, "trials", t.id), new FieldPath("votes", meId), b.dataset.v)));
    card.querySelector("[data-verdict]").onclick = () => verdict(t.id);
    box.appendChild(card);
  });
  const done = trials.filter((t) => t.status === "closed").slice(0, 8);
  $("#trial-done").innerHTML = done.length
    ? done.map((t) => `<li>${t.verdict === "guilty" ? "👎 <b>Schuldig</b>" : "👍 <b>Freispruch</b>"}: ${esc(t.accusedName)} – „${esc(t.charge)}“
        <div class="time">Ankläger ${esc(t.byName)} · ${ago(t.at)} · ${t.g || 0}:${t.i || 0} Stimmen</div></li>`).join("")
    : '<li class="muted small">Noch keine Urteile.</li>';
}

async function verdict(id) {
  const t = trials.find((x) => x.id === id);
  const j = jurors(t);
  const voted = j.filter((p) => (t.votes || {})[p.id]).length;
  if (j.length && voted < Math.ceil(j.length / 2)) return toast(`Erst muss mindestens die Hälfte abstimmen (${voted}/${j.length})`);
  if (voted < j.length && !window.confirm("Noch nicht alle haben abgestimmt. Trotzdem Urteil verkünden?")) return;
  let res;
  try {
    res = await runTransaction(db, async (tx) => {
      const ref = doc(db, "trials", id);
      const d = (await tx.get(ref)).data();
      if (!d || d.status !== "open") throw new Error("Schon entschieden");
      const v = Object.values(d.votes || {});
      const g = v.filter((x) => x === "guilty").length;
      const i = v.filter((x) => x === "innocent").length;
      const guilty = g > i; // Gleichstand = Freispruch
      const loser = guilty ? d.accusedId : d.byId;
      tx.update(doc(db, "players", loser), { points: increment(-1) });
      tx.update(ref, { status: "closed", verdict: guilty ? "guilty" : "innocent", g, i, closedAt: Date.now() });
      return { d, guilty, g, i };
    });
  } catch (e) {
    return toast(e.message);
  }
  const { d, guilty, g, i } = res;
  const loserName = guilty ? d.accusedName : d.byName;
  const loserId = guilty ? d.accusedId : d.byId;
  await log({
    who: loserName, byId: loserId, points: -1,
    text: guilty ? `wurde schuldig gesprochen (${g}:${i}): „${d.charge}“ 🥃` : `hat falsch angeklagt (${g}:${i}): „${d.charge}“ 🥃`,
  });
  await chatSystem(
    guilty
      ? `🔨 SCHULDIG (${g}:${i})! ${d.accusedName} wegen „${d.charge}“: −1 Punkt und ${penalty()} 🥃`
      : `🔨 FREISPRUCH (${g}:${i})! ${d.accusedName} ist unschuldig. Ankläger ${d.byName}: −1 Punkt und ${penalty()} 🥃`,
    "fail"
  );
}

// ---------- Wer würde am ehesten …? ----------
let polls = [];
function renderPoll() {
  const open = polls.find((p) => p.status === "open");
  const last = polls.find((p) => p.status === "closed");
  $("#poll-open").classList.toggle("hidden", !open);
  $("#poll-none").classList.toggle("hidden", !!open);
  if (open) {
    const votes = open.votes || {};
    $("#poll-q").textContent = "Wer würde am ehesten " + open.q;
    const list = $("#poll-options");
    list.innerHTML = "";
    boardDocs.forEach((p) => {
      const b = document.createElement("button");
      b.className = "btn" + (votes[meId] === p.id ? " mine" : "");
      b.innerHTML = `<span>${esc(p.name)}${p.id === meId ? " (du)" : ""}</span><span>${votes[meId] === p.id ? "✓" : ""}</span>`;
      b.onclick = () => updateDoc(doc(db, "polls", open.id), new FieldPath("votes", meId), p.id);
      list.appendChild(b);
    });
    const n = Object.keys(votes).length;
    $("#poll-count").textContent = `${n}/${boardDocs.length} haben abgestimmt (geheim)`;
  }
  $("#poll-last").classList.toggle("hidden", !last);
  if (last) {
    $("#poll-last-q").textContent = "Wer würde am ehesten " + last.q;
    const counts = last.counts || {};
    const max = Math.max(1, ...Object.values(counts));
    $("#poll-last-bars").innerHTML = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([id, c]) => `<div class="bar-row ${c === max ? "win" : ""}"><span class="bn">${esc(nameOf(id))}</span>
        <span class="bt"><i style="width:${(c / max) * 100}%"></i></span><span class="bc">${c}</span></div>`)
      .join("");
  }
}

$("#poll-new").onclick = async () => {
  if (polls.some((p) => p.status === "open")) return;
  const used = new Set(polls.map((p) => p.qi));
  let free = WHO_WOULD.map((_, i) => i).filter((i) => !used.has(i));
  if (!free.length) free = WHO_WOULD.map((_, i) => i);
  const qi = rand(free);
  await addDoc(collection(db, "polls"), { qi, q: WHO_WOULD[qi].q, title: WHO_WOULD[qi].title, votes: {}, status: "open", at: Date.now(), byId: meId });
  await chatSystem(`🗳️ Neue Frage: Wer würde am ehesten ${WHO_WOULD[qi].q} Jetzt unter Spiele abstimmen!`, "poll");
};

$("#poll-reveal").onclick = async () => {
  const open = polls.find((p) => p.status === "open");
  if (!open) return;
  const n = Object.keys(open.votes || {}).length;
  if (n < 2) return toast("Mindestens 2 Stimmen nötig");
  if (n < boardDocs.length && !window.confirm("Noch nicht alle haben abgestimmt. Trotzdem aufdecken?")) return;
  let res;
  try {
    res = await runTransaction(db, async (tx) => {
      const ref = doc(db, "polls", open.id);
      const d = (await tx.get(ref)).data();
      if (!d || d.status !== "open") throw new Error("Schon aufgedeckt");
      const counts = {};
      Object.values(d.votes || {}).forEach((id) => (counts[id] = (counts[id] || 0) + 1));
      const max = Math.max(...Object.values(counts));
      const winners = Object.keys(counts).filter((id) => counts[id] === max);
      const majority = Object.entries(d.votes || {}).filter(([, t]) => winners.includes(t)).map(([v]) => v);
      majority.forEach((v) => tx.update(doc(db, "players", v), { points: increment(1) }));
      winners.forEach((w) => tx.update(doc(db, "players", w), { titles: arrayUnion(d.title) }));
      tx.update(ref, { status: "closed", counts, winners, closedAt: Date.now() });
      return { d, winners, max, majority };
    });
  } catch (e) {
    return toast(e.message);
  }
  const { d, winners, max, majority } = res;
  const wn = winners.map(nameOf).join(" & ");
  await chatSystem(`🗳️ Wer würde am ehesten ${d.q} → ${wn} (${max} Stimmen) ist jetzt „${d.title}“ 🏅. Mehrheit getroffen: +1 für ${majority.map(nameOf).join(", ") || "niemanden"}`, "poll");
  await log({ who: wn, text: `bekommt den Titel „${d.title}“ 🏅` });
};

function renderTitles() {
  const withT = boardDocs.filter((p) => (p.titles || []).length);
  $("#titles").innerHTML = withT.length
    ? withT.map((p) => `<li><b>${esc(p.name)}</b>: ${p.titles.map((t) => `<span class="title-chip">${esc(t)}</span>`).join(" ")}</li>`).join("")
    : '<li class="muted small">Noch keine Titel. Spiele → Wer würde?</li>';
}

// ---------- Rundenkasse ----------
let rounds = [];
const euro = (n) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
function kasseStats() {
  return boardDocs.map((p) => {
    const mine = rounds.filter((r) => r.byId === p.id);
    return { id: p.id, name: p.name, count: mine.length, sum: mine.reduce((a, r) => a + (r.amount || 0), 0) };
  });
}
function nextPayer() {
  const st = kasseStats();
  if (!st.length) return null;
  return st.sort((a, b) => a.count - b.count || a.sum - b.sum || a.name.localeCompare(b.name))[0];
}
function renderKasse() {
  const nx = nextPayer();
  $("#kasse-next").textContent = nx ? `${nx.name}${nx.id === meId ? " (du!) 🫵" : " 🫵"}` : "–";
  $("#kasse-stats").innerHTML = kasseStats()
    .sort((a, b) => b.count - a.count || b.sum - a.sum)
    .map((r) => `<tr class="${r.id === meId ? "me" : ""}"><td>${esc(r.name)}</td><td>${r.count}</td><td>${r.sum ? euro(r.sum) : "–"}</td></tr>`)
    .join("");
  const ul = $("#kasse-list");
  ul.innerHTML = rounds.length ? "" : '<li class="muted small">Noch keine Runde bezahlt.</li>';
  rounds.slice(0, 40).forEach((r) => {
    const li = document.createElement("li");
    li.innerHTML = `🍺 <b>${esc(r.byName)}</b> ${r.amount ? euro(r.amount) : ""} ${r.note ? "· " + esc(r.note) : ""}
      <div class="time">${new Date(r.at).toLocaleString("de-DE", { weekday: "short", hour: "2-digit", minute: "2-digit" })}</div>`;
    if (r.byId === meId) {
      const b = document.createElement("button");
      b.className = "undo";
      b.textContent = "↩︎ löschen";
      b.onclick = async () => {
        if (!window.confirm("Diese Runde wirklich löschen?")) return;
        const bt = writeBatch(db);
        bt.delete(doc(db, "rounds", r.id));
        await bt.commit();
      };
      li.appendChild(b);
    }
    ul.appendChild(li);
  });
}
$("#kasse-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const raw = $("#kasse-amount").value.replace(/[^\d,.]/g, "").replace(",", ".");
  const num = parseFloat(raw);
  if (raw && (!isFinite(num) || num < 0)) return toast("Betrag bitte als Zahl, z. B. 24,50");
  const amount = raw ? Math.round(num * 100) / 100 : null;
  const note = $("#kasse-note").value.trim();
  await addDoc(collection(db, "rounds"), { byId: meId, byName: me.name, amount: amount || null, note, at: Date.now() });
  $("#kasse-amount").value = "";
  $("#kasse-note").value = "";
  const nx = nextPayer();
  await chatSystem(`🍺 ${me.name} hat eine Runde geschmissen${amount ? ` (${euro(amount)})` : ""}${note ? ` in ${note}` : ""}. Prost! Als Nächstes ist ${nx ? nx.name : "jemand"} dran 🫵`, "ok");
  toast("Runde eingetragen 🍺");
});

// ---------- Unter-Reiter im Spiele-Tab ----------
document.querySelectorAll("#seg button").forEach((b) =>
  b.addEventListener("click", () => {
    document.querySelectorAll("#seg button").forEach((x) => x.classList.toggle("on", x === b));
    document.querySelectorAll("#tab-spiele .pane").forEach((p) => p.classList.toggle("hidden", p.id !== `pane-${b.dataset.pane}`));
  })
);

// ---------- Finale & Admin ----------
$("#finale").onclick = async () => {
  const snap = await getDocs(query(collection(db, "players"), orderBy("points", "asc"), limit(1)));
  if (snap.empty) return;
  const loser = snap.docs[0].data();
  const text = rand(FINALE);
  const el = $("#finale-text");
  el.textContent = `${loser.name}: ${text}`;
  el.classList.remove("hidden");
  await log({ who: loser.name, text: `bekommt die Verlierer-Aufgabe: ${text}` });
};

function switchPlayer() {
  localStorage.removeItem("riga-player");
  location.reload();
}
$("#switch-player").onclick = switchPlayer;
$("#test-mode").onclick = () => setDoc(doc(db, "game", "settings"), { testMode: !testMode }, { merge: true });
$("#alarm-toggle").onclick = () => setDoc(doc(db, "game", "settings"), { alarm: !alarmSetting }, { merge: true });
$("#alarm-test").onclick = () => fireAlarm(Date.now(), true);

// ---------- Alles zurücksetzen (mit Code) ----------
const RESET_CODE = "1012"; // hier ändern, wenn ihr einen anderen Code wollt
const SEEN_RESET = "riga-reset";

async function deleteAllIn(colName) {
  const snap = await getDocs(collection(db, colName));
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 400) {
    const b = writeBatch(db);
    docs.slice(i, i + 400).forEach((d) => b.delete(d.ref));
    await b.commit();
  }
  return docs.length;
}

$("#reset-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const code = $("#reset-code").value.trim();
  if (code !== RESET_CODE) return toast("Falscher Code");
  $("#reset").disabled = true;
  toast("Setze alles zurück …");
  try {
    // 1. Alle Geräte abmelden, damit niemand mehr schreibt
    const resetId = Date.now();
    await setDoc(doc(db, "game", "meta"), { resetId });
    localStorage.setItem(SEEN_RESET, String(resetId));
    unsubs.forEach((u) => u());
    unsubs = [];
    await new Promise((r) => setTimeout(r, 2500));
    // 2. Alles löschen und so lange wiederholen, bis nichts mehr übrig ist
    for (let round = 0; round < 3; round++) {
      let left = 0;
      for (const c of ["players", "log", "chat", "trials", "polls", "rounds"]) left += await deleteAllIn(c);
      const b = writeBatch(db);
      ["state", "imposter", "settings"].forEach((d) => b.delete(doc(db, "game", d)));
      await b.commit();
      if (left === 0) break;
      await new Promise((r) => setTimeout(r, 1500));
    }
    toast("Alles zurückgesetzt ✓");
  } catch (err) {
    console.error(err);
    toast("Zurücksetzen fehlgeschlagen: " + err.message);
  }
  localStorage.removeItem("riga-player");
  setTimeout(() => location.reload(), 1200);
});

// Andere Geräte: bei einem Reset abmelden und neu laden
function watchReset() {
  onSnapshot(doc(db, "game", "meta"), (s) => {
    const id = s.exists() ? String(s.data().resetId) : null;
    if (!id) return;
    const seen = localStorage.getItem(SEEN_RESET);
    if (seen === null) return localStorage.setItem(SEEN_RESET, id); // erstes Mal auf diesem Gerät
    if (seen !== id) {
      localStorage.setItem(SEEN_RESET, id);
      localStorage.removeItem("riga-player");
      unsubs.forEach((u) => u());
      unsubs = [];
      toast("Das Spiel wurde zurückgesetzt");
      setTimeout(() => location.reload(), 1500);
    }
  });
}

// ---------- Tabs ----------
document.querySelectorAll(".tabbar button").forEach((b) =>
  b.addEventListener("click", () => {
    document.querySelectorAll(".tabbar button").forEach((x) => x.classList.toggle("active", x === b));
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("hidden", t.id !== `tab-${b.dataset.tab}`));
    activeTab = b.dataset.tab;
    if (activeTab === "wheel") tick();
    if (activeTab === "chat") {
      unread = 0;
      updateBadge();
      window.scrollTo(0, document.body.scrollHeight);
    } else {
      window.scrollTo(0, 0);
    }
  })
);

// ---------- Update-Erkennung ----------
// Bei jedem automatischen Deploy schreibt GitHub die Version in version.json.
// Ändert sie sich, erscheint oben ein Hinweis zum Neuladen.
let appVersion = null;
async function checkVersion() {
  try {
    const r = await fetch("version.json", { cache: "no-store" });
    if (!r.ok) return;
    const { version } = await r.json();
    if (!appVersion) appVersion = version;
    else if (version !== appVersion) $("#update-banner").classList.remove("hidden");
  } catch {}
}
$("#update-banner").onclick = () => location.reload();
checkVersion();
setInterval(checkVersion, 60 * 1000);
document.addEventListener("visibilitychange", () => !document.hidden && checkVersion());

start().catch((e) => {
  console.error(e);
  toast("Verbindung fehlgeschlagen. Firebase-Konfiguration prüfen.");
});
