/* ---------------------------------------------------
   FIREBASE SETUP
--------------------------------------------------- */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  getDocs
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
   STATE
--------------------------------------------------- */
let pubs = [];
let pintNames = [];
let prices = [];

let showAll = false;

/* Budget */
let userBudget = localStorage.getItem("budget") || null;
let userMax = localStorage.getItem("maxprice") || null;

/* For PINX arrows */
let previousPINX = null;

/* ---------------------------------------------------
   SNAPSHOTS
--------------------------------------------------- */
onSnapshot(collection(db, "pubs"), (snap) => {
  pubs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  refreshUI();
});

onSnapshot(collection(db, "pints"), (snap) => {
  pintNames = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  refreshUI();
});

onSnapshot(collection(db, "prices"), (snap) => {
  prices = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  refreshUI();
});

/* ---------------------------------------------------
   REFRESH UI
--------------------------------------------------- */
function refreshUI() {
  populatePubSelect();
  populatePintNameSelect();
  computePubStats();
  renderCheapestBanner();
  renderPopularToday();
  renderTopTypesThisWeek();
  renderMoneyInvestedWeek();
  renderPINX();
  renderTicker();
  renderLeague();
  renderRecent();
  renderBudget();
}

/* ---------------------------------------------------
   POPULATE SELECTS
--------------------------------------------------- */
function populatePubSelect() {
  const sel = document.getElementById("pintPubSelect");
  if (!pubs.length) {
    sel.innerHTML = "<option>No pubs yet</option>";
    return;
  }
  sel.innerHTML = pubs.map(p => `<option value="${p.id}">${p.name}</option>`).join("");
}

function populatePintNameSelect() {
  const sel = document.getElementById("pintNameSelect");
  if (!pintNames.length) {
    sel.innerHTML = "<option>No pint names yet</option>";
    return;
  }
  sel.innerHTML = pintNames.map(p => `<option value="${p.id}">${p.name}</option>`).join("");
}

/* ---------------------------------------------------
   ADD PINT NAME (New)
--------------------------------------------------- */
document.getElementById("addPintNameBtn").onclick = async () => {
  const name = document.getElementById("newPintNameInput").value.trim();
  if (!name) return alert("Please enter a pint name.");
  await addDoc(collection(db, "pints"), { name });
  document.getElementById("newPintNameInput").value = "";
  showToast("Pint name added!");
};

/* ---------------------------------------------------
   ADD PINT PRICE
--------------------------------------------------- */
document.getElementById("addPintPriceBtn").onclick = async () => {
  const pubId = document.getElementById("pintPubSelect").value;
  const pintNameId = document.getElementById("pintNameSelect").value;
  const pintType = document.getElementById("pintTypeSelect").value;
  const price = parseFloat(document.getElementById("pintPriceInput").value);

  if (!pubId || !pintNameId || !price) return alert("Missing fields.");

  const pintObj = pintNames.find(p => p.id === pintNameId);

  await addDoc(collection(db, "prices"), {
    pubId,
    pintName: pintObj.name,
    pintType,
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
   COMPUTE PUB STATS (avg + trend)
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
      const last = sorted[sorted.length-1].price;
      pub.trend = ((last - first)/first)*100;
    } else {
      pub.trend = 0;
    }
  });
}

/* ---------------------------------------------------
   CHEAPEST PINT BANNER
--------------------------------------------------- */
function renderCheapestBanner() {
  const banner = document.getElementById("cheapestBannerText");

  if (!prices.length) {
    banner.innerText = "No data yet";
    return;
  }

  const cheapest = [...prices].sort((a,b)=>a.price - b.price)[0];
  const pubName = pubs.find(p=>p.id === cheapest.pubId)?.name || "Unknown Pub";

  banner.innerText = `£${cheapest.price.toFixed(2)} – ${cheapest.pintName} at ${pubName}`;
}

/* ---------------------------------------------------
   MOST POPULAR PINT TODAY
--------------------------------------------------- */
function renderPopularToday() {
  const out = document.getElementById("popularPintValue");

  const today = prices.filter(p => Date.now() - p.timestamp < 86400000);
  if (!today.length) {
    out.innerText = "—";
    return;
  }

  const counts = {};
  today.forEach(p => counts[p.pintName] = (counts[p.pintName]||0)+1);

  const top = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
  out.innerText = `${top[0]} (${top[1]})`;
}

/* ---------------------------------------------------
   TOP PINT TYPES THIS WEEK
--------------------------------------------------- */
function renderTopTypesThisWeek() {
  const out = document.getElementById("weeklyTypesValue");
  const bars = document.getElementById("weeklyTypeBars");

  const week = prices.filter(p => Date.now() - p.timestamp < 7*86400000);
  if (!week.length) {
    out.innerText = "—";
    bars.innerHTML = "";
    return;
  }

  const types = ["Lager","Ale","IPA","Cider","Guinness"];
  const counts = {};

  types.forEach(t => counts[t] = 0);
  week.forEach(p => counts[p.pintType]++);

  const sorted = types.map(t=>[t,counts[t]]).sort((a,b)=>b[1]-a[1]);

  out.innerText = sorted.slice(0,3).map(s => s[0]).join(", ");

  bars.innerHTML = sorted.map(s => `
    <div class="poll-bar">
      <div class="poll-fill" style="width:${(s[1]/week.length)*100}%"></div>
      <span class="poll-type-label">${s[0]}</span>
      <span class="poll-percent">${s[1]}</span>
    </div>
  `).join("");
}

/* ---------------------------------------------------
   MONEY INVESTED IN PINX THIS WEEK
--------------------------------------------------- */
function renderMoneyInvestedWeek() {
  const out = document.getElementById("moneyInvestedValue");

  const week = prices.filter(p => Date.now() - p.timestamp < 7*86400000);

  const total = week.reduce((a,b)=>a+b.price,0);
  out.innerText = `£${total.toFixed(2)}`;
}

/* ---------------------------------------------------
   PINX INDEX
--------------------------------------------------- */
function renderPINX() {
  const out = document.getElementById("pinxValue");
  const valid = pubs.filter(p=>p.avg !== null);
  if (!valid.length) {
    out.innerText = "—";
    return;
  }

  const avg = valid.reduce((a,b)=>a+b.avg,0)/valid.length;
  const pinx = Math.round(avg*100);

  let arrow = "";
  if (previousPINX !== null) {
    if (pinx > previousPINX) arrow = " 🔺";
    else if (pinx < previousPINX) arrow = " 🔻";
    else arrow = " ⏸️";
  }
  previousPINX = pinx;

  out.innerText = pinx + arrow;
}

/* ---------------------------------------------------
   LIVE TICKER
--------------------------------------------------- */
function renderTicker() {
  const t = document.getElementById("tickerText");

  if (!prices.length) {
    t.innerText = "Not enough data yet.";
    return;
  }

  const items = [];

  // Cheapest pint
  const cheapest = [...prices].sort((a,b)=>a.price-b.price)[0];
  items.push(`Cheapest now £${cheapest.price.toFixed(2)} (${cheapest.pintName})`);

  // Most active pub
  const counts = {};
  prices.forEach(p => counts[p.pubId] = (counts[p.pubId]||0)+1);
  const active = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
  const activePub = pubs.find(p=>p.id===active[0])?.name || "";
  items.push(`${activePub} active`);

  // Average price
  const avg = prices.reduce((a,b)=>a+b.price,0)/prices.length;
  items.push(`Avg £${avg.toFixed(2)}`);

  t.innerText = items.join(" • ");
}

/* ---------------------------------------------------
   LEAGUE TABLE
--------------------------------------------------- */
document.getElementById("showAllPubsBtn").onclick = () => {
  showAll = !showAll;
  document.getElementById("allPubsGrid").style.display = showAll ? "grid" : "none";
  document.getElementById("showAllPubsBtn").innerText = showAll ? "Hide ▲" : "Show All ▼";
};

function renderLeague() {
  const filterType = document.getElementById("leagueFilter").value;

  let list = pubs.filter(p=>p.avg !== null);

  if (filterType !== "all") {
    list = list.filter(pub =>
      prices.some(pr => pr.pubId === pub.id && pr.pintType === filterType)
    );
  }

  const cheapest5 = [...list].sort((a,b)=>a.avg-b.avg).slice(0,5);
  const expensive5 = [...list].sort((a,b)=>b.avg-a.avg).slice(0,5);

  document.getElementById("topCheapest").innerHTML =
    cheapest5.map(pubTile).join("");

  document.getElementById("topExpensive").innerHTML =
    expensive5.map(pubTile).join("");

  if (showAll) {
    const allSorted = [...list].sort((a,b)=>a.avg-b.avg);
    document.getElementById("allPubsGrid").innerHTML =
      allSorted.map(pubTile).join("");
    drawSparks(allSorted);
  }

  drawSparks(cheapest5);
  drawSparks(expensive5);
}

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

function trendColor(t) {
  if (t < 0) return "#1DB954";
  if (t > 0) return "#D7263D";
  return "#aaa";
}

function makeBadges(pub) {
  const b = [];
  if (pub.avg < 5) b.push("⭐ Cheap");
  if (pub.trend > 2) b.push("📈 Rising");
  if (pub.trend < -2) b.push("📉 Falling");
  return b.join(" • ") || "—";
}

/* ---------------------------------------------------
   SPARKLINES
--------------------------------------------------- */
function drawSparks(list) {
  list.forEach(pub => drawSpark(pub.id));
}

function drawSpark(pubId) {
  const canvas = document.getElementById(`spark-${pubId}`);
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;

  const pts = prices
    .filter(p=>p.pubId===pubId)
    .sort((a,b)=>a.timestamp - b.timestamp)
    .slice(-20);

  if (pts.length < 2) return;

  const vals = pts.map(p=>p.price);
  const min = Math.min(...vals);
  const max = Math.max(...vals);

  ctx.beginPath();
  ctx.lineWidth = 2;
  ctx.strokeStyle = vals.at(-1) >= vals[0] ? "#1DB954" : "#D7263D";

  vals.forEach((v,i)=>{
    const x = (i/(vals.length-1)) * canvas.width;
    const y = canvas.height - ((v-min)/(max-min)) * canvas.height;
    if (i===0) ctx.moveTo(x,y);
    else ctx.lineTo(x,y);
  });

  ctx.stroke();
}

/* ---------------------------------------------------
   RECENT FEED
--------------------------------------------------- */
function renderRecent() {
  const out = document.getElementById("recentFeed");
  const recent = [...prices].sort((a,b)=>b.timestamp-a.timestamp).slice(0,15);

  out.innerHTML = recent.map(r => {
    const pubName = pubs.find(p=>p.id===r.pubId)?.name || "Unknown";
    return `<div class="feed-item">
      £${r.price.toFixed(2)} – ${r.pintName} at ${pubName}
    </div>`;
  }).join("");
}

/* ---------------------------------------------------
   BUDGET HELPER
--------------------------------------------------- */
function renderBudget() {
  const out = document.getElementById("budgetOutput");

  if (!userBudget || !userMax) {
    out.innerText = "Set your budget above.";
    return;
  }

  const b = parseFloat(userBudget);
  const m = parseFloat(userMax);
  const pints = Math.floor(b/m);

  out.innerHTML = `
    You can buy <strong>${pints}</strong> pints at £${m}.<br><br>
  `;

  const affordable = pubs.filter(pub => pub.avg && pub.avg <= m);

  if (affordable.length) {
    out.innerHTML += `<strong>Affordable pubs:</strong><br>`;
    out.innerHTML += affordable
      .map(p=>`${p.name} (£${p.avg.toFixed(2)})`)
      .join("<br>");
  } else {
    out.innerHTML += "No pubs fit your budget.";
  }
}

document.getElementById("saveBudgetBtn").onclick = () => {
  userBudget = document.getElementById("budgetInput").value;
  userMax = document.getElementById("budgetMaxInput").value;
  localStorage.setItem("budget", userBudget);
  localStorage.setItem("maxprice", userMax);
  renderBudget();
  showToast("Budget saved!");
};

/* ---------------------------------------------------
   TOASTS
--------------------------------------------------- */
function showToast(msg) {
  const t = document.getElementById("toast");
  t.innerText = msg;
  t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"),2500);
}
