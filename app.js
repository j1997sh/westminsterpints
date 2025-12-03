/* ---------------------------------------------------
   FIREBASE INITIALISATION
--------------------------------------------------- */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBHUGgt8F4OQJjdx11qOMPC0iRJGFZmU8E",
  authDomain: "westminsterpints.firebaseapp.com",
  projectId: "westminsterpints",
  storageBucket: "westminsterpints.appspot.com",
  messagingSenderId: "913960848966",
  appId: "1:913960848966:web:df6355a6b5b25dbdc5c447"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ---------------------------------------------------
   STATE STORAGE
--------------------------------------------------- */
let pubs = [];
let pints = [];
let prices = [];

/* User budget */
let userBudget = localStorage.getItem("budget") || null;
let userMaxPrice = localStorage.getItem("maxPrice") || null;

/* PINX old value */
let previousPINX = null;

/* Show all toggle */
let showAll = false;

/* ---------------------------------------------------
   SUBSCRIPTIONS
--------------------------------------------------- */
onSnapshot(collection(db, "pubs"), snap => {
  pubs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  refreshUI();
});

onSnapshot(collection(db, "pints"), snap => {
  pints = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  refreshUI();
});

onSnapshot(collection(db, "prices"), snap => {
  prices = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  refreshUI();
});

/* ---------------------------------------------------
   UI REFRESHER (MAIN LOOP)
--------------------------------------------------- */
function refreshUI() {
  populatePubSelect();
  populatePintSelect();
  computePubStats();
  renderPINX();
  renderCheapest();
  renderLeague();
  renderBudgetHelper();
  renderRecent();
  renderGoodInvestments();
}

/* ---------------------------------------------------
   POPULATE SELECT MENUS
--------------------------------------------------- */
function populatePubSelect() {
  const sel = document.getElementById("pintPubSelect");
  if (!pubs.length) {
    sel.innerHTML = "<option>No pubs yet</option>";
    return;
  }
  sel.innerHTML = pubs.map(p => `<option value="${p.id}">${p.name}</option>`).join("");
}

function populatePintSelect() {
  const sel = document.getElementById("pintSelect");
  if (!pints.length) {
    sel.innerHTML = "<option>No pints yet</option>";
    return;
  }
  sel.innerHTML = pints.map(p => `<option value="${p.id}">${p.name}</option>`).join("");
}

/* ---------------------------------------------------
   COMPUTE PUB STATS
--------------------------------------------------- */
function computePubStats() {
  pubs.forEach(pub => {
    const entries = prices.filter(p => p.pubId === pub.id);

    if (!entries.length) {
      pub.avg = null;
      pub.trend = 0;
      return;
    }

    const sorted = [...entries].sort((a,b)=>a.timestamp - b.timestamp);
    pub.avg = sorted.reduce((a,b)=>a+b.price,0) / sorted.length;

    if (sorted.length >= 2) {
      const first = sorted[0].price;
      const last = sorted[sorted.length - 1].price;
      pub.trend = ((last - first) / first) * 100;
    } else {
      pub.trend = 0;
    }
  });
}

/* ---------------------------------------------------
   ADD PINT PRICE
--------------------------------------------------- */
document.getElementById("addPintBtn").onclick = async () => {
  const pubId = document.getElementById("pintPubSelect").value;
  const pintId = document.getElementById("pintSelect").value;
  const price = parseFloat(document.getElementById("pintPriceInput").value);

  if (!pubId || !pintId || !price) {
    alert("Please fill all fields.");
    return;
  }

  const pintObj = pints.find(p => p.id === pintId);

  await addDoc(collection(db, "prices"), {
    pubId,
    pintName: pintObj.name,
    type: pintObj.type,
    price,
    timestamp: Date.now()
  });

  document.getElementById("pintPriceInput").value = "";

  showToast("Pint price added!");
};

/* ---------------------------------------------------
   ADD PUB
--------------------------------------------------- */
document.getElementById("addPubBtn").onclick = async () => {
  const name = document.getElementById("pubNameInput").value.trim();
  if (!name) return;

  await addDoc(collection(db, "pubs"), { name });
  document.getElementById("pubNameInput").value = "";
  showToast("Pub added!");
};

/* ---------------------------------------------------
   PINX INDEX
--------------------------------------------------- */
function renderPINX() {
  if (!pubs.length) return;

  const valid = pubs.filter(p => p.avg);
  if (!valid.length) return;

  const avg = valid.reduce((a,b)=>a+b.avg,0) / valid.length;
  const pinx = Math.round(avg * 100);

  const el = document.getElementById("pinxValue");

  let direction = "";
  if (previousPINX !== null) {
    if (pinx > previousPINX) direction = " 🔺";
    else if (pinx < previousPINX) direction = " 🔻";
    else direction = " ⏸️";
  }

  el.innerText = pinx + direction;

  previousPINX = pinx;
}

/* ---------------------------------------------------
   CHEAPEST PINT
--------------------------------------------------- */
function renderCheapest() {
  const valid = pubs.filter(p => p.avg !== null);
  if (!valid.length) return;

  const cheapest = [...valid].sort((a,b)=>a.avg - b.avg)[0];

  document.getElementById("cheapestTop").innerText =
    `£${cheapest.avg.toFixed(2)} at ${cheapest.name}`;
}

/* ---------------------------------------------------
   LEAGUE TABLE
--------------------------------------------------- */
function renderLeague() {
  const typeFilter = document.getElementById("leagueFilter").value;

  const filteredPrices = typeFilter === "all"
    ? pubs
    : pubs.filter(pub =>
        prices.some(p => p.pubId === pub.id && p.type === typeFilter)
      );

  const valid = filteredPrices.filter(p => p.avg !== null);

  const cheapest5 = [...valid].sort((a,b)=>a.avg - b.avg).slice(0,5);
  const expensive5 = [...valid].sort((a,b)=>b.avg - a.avg).slice(0,5);

  document.getElementById("topCheapest").innerHTML =
    cheapest5.map(pub => pubTile(pub)).join("");

  document.getElementById("topExpensive").innerHTML =
    expensive5.map(pub => pubTile(pub)).join("");

  /* Show All */
  if (showAll) {
    const allSorted = [...valid].sort((a,b)=>a.avg - b.avg);
    document.getElementById("allPubs").style.display = "grid";
    document.getElementById("allPubs").innerHTML =
      allSorted.map(pub => pubTile(pub)).join("");

    drawAllSparks(allSorted);
  } else {
    document.getElementById("allPubs").style.display = "none";
  }

  drawAllSparks(cheapest5);
  drawAllSparks(expensive5);
}

/* Expand/Collapse */
document.getElementById("showAllBtn").onclick = () => {
  showAll = !showAll;
  document.getElementById("showAllBtn").innerText =
    showAll ? "Hide ▲" : "Show All ▼";
  renderLeague();
};

/* ---------------------------------------------------
   PUB TILE HTML
--------------------------------------------------- */
function pubTile(pub) {
  return `
    <div class="pub-tile" style="border-left-color:${trendColor(pub.trend)}">
      <div class="pub-header">
        <span>${pub.name}</span>
        <span>£${pub.avg.toFixed(2)}</span>
      </div>
      <div class="pub-badges">${makeBadges(pub)}</div>
      <canvas class="spark" id="spark-${pub.id}"></canvas>
    </div>
  `;
}

function makeBadges(pub) {
  const b = [];
  if (pub.avg < 5) b.push("⭐ Cheap");
  if (pub.trend < -2) b.push("📉 Falling");
  if (pub.trend > 2) b.push("📈 Rising");
  return b.join(" • ") || "—";
}

function trendColor(t) {
  if (t < 0) return "var(--green)";
  if (t > 0) return "var(--red)";
  return "#888";
}

/* ---------------------------------------------------
   SPARKLINE DRAWER
--------------------------------------------------- */
function drawAllSparks(list) {
  list.forEach(pub => drawSpark(pub.id));
}

function drawSpark(pubId) {
  const canvas = document.getElementById(`spark-${pubId}`);
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;

  const pts = prices
    .filter(p => p.pubId === pubId)
    .sort((a,b)=>a.timestamp - b.timestamp)
    .slice(-20);

  if (pts.length < 2) return;

  const values = pts.map(p => p.price);
  const max = Math.max(...values);
  const min = Math.min(...values);

  ctx.beginPath();
  ctx.strokeStyle = values.at(-1) >= values[0]
    ? "var(--green)"
    : "var(--red)";
  ctx.lineWidth = 2;

  values.forEach((v,i) => {
    const x = (i / (values.length - 1)) * canvas.width;
    const y = canvas.height - ((v - min) / (max - min)) * canvas.height;

    if (i === 0) ctx.moveTo(x,y);
    else ctx.lineTo(x,y);
  });

  ctx.stroke();
}

/* ---------------------------------------------------
   BUDGET HELPER
--------------------------------------------------- */
function renderBudgetHelper() {
  const div = document.getElementById("budgetResults");

  if (!userBudget || !userMaxPrice) {
    div.innerHTML = "Enter your budget above.";
    return;
  }

  const b = parseFloat(userBudget);
  const max = parseFloat(userMaxPrice);

  const possible = Math.floor(b / max);

  let html = `
    <strong>You can buy:</strong><br>
    <strong>${possible} pint(s)</strong> at £${max.toFixed(2)} max per pint.<br><br>
  `;

  const affordable = pubs.filter(pub => pub.avg && pub.avg <= max);

  if (affordable.length) {
    html += `<strong>Pubs in your range:</strong><br>`;
    html += affordable
      .map(p => `${p.name} – £${p.avg.toFixed(2)} (${Math.floor(b/p.avg)} pints)`)
      .join("<br>");
  } else {
    html += "No pubs fit your budget.";
  }

  div.innerHTML = html;
}

document.getElementById("saveBudgetBtn").onclick = () => {
  userBudget = document.getElementById("budgetInput").value;
  userMaxPrice = document.getElementById("maxPriceInput").value;

  localStorage.setItem("budget", userBudget);
  localStorage.setItem("maxPrice", userMaxPrice);

  renderBudgetHelper();
  showToast("Budget updated!");
};

/* ---------------------------------------------------
   RECENT SUBMISSIONS
--------------------------------------------------- */
function renderRecent() {
  const div = document.getElementById("recentFeedContent");

  const recent = [...prices]
    .sort((a,b)=>b.timestamp - a.timestamp)
    .slice(0,10);

  div.innerHTML = recent.map(r => {
    const pubName = pubs.find(p=>p.id===r.pubId)?.name || "Unknown Pub";
    return `<div class="feed-entry">
      ${r.pintName} @ ${pubName} (£${r.price.toFixed(2)})
    </div>`;
  }).join("");
}

/* ---------------------------------------------------
   GOOD INVESTMENTS
--------------------------------------------------- */
function renderGoodInvestments() {
  const div = document.getElementById("goodInvestments");

  const opportunities = pubs.filter(p =>
    p.avg && p.trend < -2
  );

  if (!opportunities.length) {
    div.innerHTML = "No opportunities right now.";
    return;
  }

  div.innerHTML = opportunities.map(p =>
    `💡 <strong>${p.name}</strong> — £${p.avg.toFixed(2)} (↓ ${Math.abs(p.trend).toFixed(1)}%)`
  ).join("<br>");
}

/* ---------------------------------------------------
   TOASTS
--------------------------------------------------- */
function showToast(msg) {
  const t = document.getElementById("flashToast");
  t.innerText = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}
