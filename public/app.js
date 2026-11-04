import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  getFirestore, doc, collection, onSnapshot, setDoc, updateDoc, addDoc, getDoc, getDocs,
  runTransaction, increment, serverTimestamp, query, orderBy, limit, limitToLast, writeBatch, arrayUnion,
  arrayRemove, FieldPath,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { CATEGORIES, JOKER, BINGO, FINALE, IMPOSTER_WORDS, LOCATIONS } from "./tasks.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (s) => document.querySelector(s);
const LEVEL_NAMES = { 1: "Leicht", 3: "Mittel", 5: "Hardcore" };
const REFUSE_PENALTY = -2;
const BINGO_LINE_POINTS = 2;

// ---------- Einstellungen ----------
const TASK_MINUTES = 60;      // so lange hat man für eine Aufgabe Zeit
const COOLDOWN_MINUTES = 30;  // frühestens so lange nach dem letzten Ziehen gibt es die nächste Aufgabe
const MIN = 60 * 1000;
let testMode = false;         // im Admin-Bereich umschaltbar: keine Wartezeit

// ---------- Standort (pro Spieler) ----------
let loc = null;
const normLoc = (l) => (l === "husky" ? "outdoor" : l) || null; // alter Name
const taskText = (t) => (typeof t === "string" ? t : t.t);
const fitsLoc = (t) => !loc || loc === "alles" || typeof t === "string" || !t.where || t.where.includes(loc);
function catsFor(locId) {
  const L = LOCATIONS.find((l) => l.id === locId);
  if (!L || !L.cats) return CATEGORIES;
  const cats = L.cats.map((id) => CATEGORIES.find((c) => c.id === id));
  return [cats[0], ...cats]; // Hauptkategorie des Orts doppelt so wahrscheinlich
}
function renderLocGrid() {
  const box = $("#loc-grid");
  box.innerHTML = "";
  LOCATIONS.forEach((l) => {
    const b = document.createElement("button");
    b.className = "loc-tile" + (l.id === loc ? " on" : "");
    b.innerHTML = `<span class="i">${l.icon}</span><span class="n"></span>`;
    b.querySelector(".n").textContent = l.name;
    b.onclick = () => updateDoc(doc(db, "players", meId), { loc: l.id });
    box.appendChild(b);
  });
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
  await Notification.requestPermission();
  updateNotifyBtn();
};
updateNotifyBtn();

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
    const fields = shuffle(BINGO).slice(0, 24);
    fields.splice(12, 0, "FREI");
    const marks = Array(25).fill(false);
    marks[12] = true;
    await setDoc(ref, { name, points: 0, secrets: [], bingo: { fields, marks, lines: 0 } });
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
}

// ---------- Live-Daten ----------
let unsubs = [];
function listenGame() {
  unsubs.forEach((u) => u());
  unsubs = [
    onSnapshot(doc(db, "players", meId), (s) => {
      if (!s.exists()) return switchPlayer();
      me = s.data();
      if (normLoc(me.loc) !== loc) {
        loc = normLoc(me.loc);
        renderLocGrid();
        if (!spinning) resetReels();
      }
      $("#me-name").textContent = me.name;
      $("#me-points").textContent = me.points;
      renderSecrets();
      renderBingo();
      tick();
    }),
    onSnapshot(query(collection(db, "players"), orderBy("points", "desc")), (snap) => {
      boardDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderBoard();
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
      alarmOn = !!(s.exists() && s.data().alarm);
      $("#alarm-toggle").textContent = alarmOn ? "Pflicht-Alarm: AN" : "Pflicht-Alarm: aus";
      $("#test-mode").textContent = testMode ? "Testmodus: AN (keine Wartezeit)" : "Testmodus: aus";
      tick();
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
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
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
    refuse: "hat verweigert (Strafshot!)",
    expired: "hat die Zeit verpennt ⏰ (Strafshot!)",
  }[res];
  try {
    await updateDoc(doc(db, "players", meId), { points: increment(pts), current: null });
    await log({ who: me.name, text: `${label}: ${cur.text}`, points: pts });
    const sign = pts > 0 ? `+${pts}` : `${pts}`;
    const chatTxt = {
      done: `✅ ${me.name} hat die Aufgabe geschafft (${sign}): „${cur.text}“`,
      half: `🤏 ${me.name} hat die Aufgabe nur halb geschafft (${sign}): „${cur.text}“`,
      refuse: `❌ ${me.name} hat die Aufgabe verweigert (${sign}, Strafshot! 🥃): „${cur.text}“`,
      expired: `⏰ ${me.name} hat die Zeit verpennt (${sign}, Strafshot! 🥃): „${cur.text}“`,
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
const alarmHourOk = (h) => h >= 10 || h < 2;          // nur zwischen 10:00 und 01:59 Uhr (Uhrzeit des Handys)
const HOUR = 60 * MIN;
let alarmOn = false;                                  // im Admin-Bereich für alle umschaltbar

// Zufällige, aber auf allen Handys gleiche Alarmzeit innerhalb einer Stunde
function alarmAt(hourIdx) {
  let x = (hourIdx * 2654435761) >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 2246822519) >>> 0;
  x ^= x >>> 13; x = Math.imul(x, 3266489917) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0; // immer positiv
  return hourIdx * HOUR + (x % 3600) * 1000;
}
const alarmAllowed = (t) => alarmHourOk(new Date(t).getHours());
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
  if (!alarmOn) return null;
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
  if (!alarmOn) return card.classList.add("hidden");
  card.classList.remove("hidden");
  const now = Date.now();
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

// ---------- Bingo ----------
const LINES = (() => {
  const l = [];
  for (let i = 0; i < 5; i++) {
    l.push([0, 1, 2, 3, 4].map((j) => i * 5 + j));
    l.push([0, 1, 2, 3, 4].map((j) => j * 5 + i));
  }
  l.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);
  return l;
})();
const countLines = (marks) => LINES.filter((line) => line.every((i) => marks[i])).length;

function renderBingo() {
  const b = me?.bingo;
  if (!b) return;
  const grid = $("#bingo-grid");
  grid.innerHTML = "";
  b.fields.forEach((f, i) => {
    const cell = document.createElement("button");
    cell.className = "cell" + (i === 12 ? " free" : b.marks[i] ? " marked" : "");
    cell.textContent = f;
    if (i !== 12) cell.onclick = () => toggleBingo(i);
    grid.appendChild(cell);
  });
  $("#bingo-lines").textContent = b.lines;
}

async function toggleBingo(i) {
  const marks = [...me.bingo.marks];
  marks[i] = !marks[i];
  const lines = countLines(marks);
  const diff = lines - me.bingo.lines;
  await updateDoc(doc(db, "players", meId), {
    "bingo.marks": marks,
    "bingo.lines": lines,
    points: increment(diff * BINGO_LINE_POINTS),
  });
  if (diff > 0) {
    await log({ who: me.name, text: "ruft BINGO! 🎯", points: diff * BINGO_LINE_POINTS });
    toast("BINGO! 🎯");
  }
}

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
$("#alarm-toggle").onclick = () => setDoc(doc(db, "game", "settings"), { alarm: !alarmOn }, { merge: true });
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
      for (const c of ["players", "log", "chat"]) left += await deleteAllIn(c);
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
