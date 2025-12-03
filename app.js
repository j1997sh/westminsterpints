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

let showAllLeague = false;

let previousPINX = null;

let userBudget = localStorage.getItem("budget") || null;
let userMax = localStorage.getItem("maxprice") || null;

/* ---------------------------------------------------
   FIREBASE SNAPSHOTS
--------------------------------------------------- */
onSnapshot(collection(db, "pubs"), snap => {
  pubs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  refresh();
});

onSnapshot(collection(db, "pints"), snap => {
  pintNames = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  refresh();
});

onSnapshot(collection(db, "prices"), snap => {
  prices = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  refresh();
});

/* ---------------------------------------------------
   GLOBAL REFRESH
--------------------------------------------------- */
function refresh() {
  populatePubSelect();
  populatePintNameSelect();
  populateLeaguePintName();
  computePubStats();
  renderCheapestBanner();
  renderPopularToday();
  renderTopTypesThisWeek();
  renderMoneyInvestedWeek();
  renderPINX();
  renderTicker();
  renderCheapestByPintName();
  renderLeague();
  renderRecent();
  renderBudget();
}

/* ---------------------------------------------------
   POPULATE SELECTS
--------------------------------------------------- */
function populatePubSelect() {
  const sel = document.getElementById("pintPubSelect");
  sel.innerHTML = pubs.map(p => `<option value="${p.id}">${p.name}</option>`).join("");
}

function populatePintNameSelect() {
  const sel = document.getElementById("pintNameSelect");
  sel.innerHTML = pintNames.map(p => `<option value="${p.id}">${p.name}</option>`).join("");
}

function populateLeaguePintName() {
  const sel = document.getElementById("leaguePintName");
  sel.innerHTML = "<option value='all'>All Pints</option>" +
    pintNames.map(p => `<option value="${p.name}">${p.name}</option>`).join("");

  const cheapestSel = document.getElementById("cheapestPintSelect");
  cheapestSel.innerHTML = pintNames.map(p => `<option value="${p.name}">${p.name}</option>`).join("");
}

/* ---------------------------------------------------
   ADD PINT NAME
--------------------------------------------------- */
document.getElementById("addPintNameBtn").onclick = async () => {
  const name = document.getElementById("newPintNameInput").value.trim();
  if (!name) return alert("Enter a pint name.");
  await addDoc(collection(db, "pints"), { name });
  document.getElementById("newPintNameInput").value = "";
  showToast("Pint name added!");
};

/* ---------------------------------------------------
   ADD PUB
--------------------------------------------------- */
document.getElementById("addPubBtn").onclick = async () => {
  const name = document.getElementById("pubNameInput").value.trim();
  if (!name) return alert("Enter pub name.");
  await addDoc(collection(db, "pubs"), { name });
  document.getElementById("pubNameInput").value = "";
  showToast("Pub added!");
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
   COMPUTE PUB STATS (avg & trend)
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
    pub.avg = sorted.reduce((a,b)=>a+b.price,0)/sorted.length;

    pub.trend = sorted.length > 1
      ? ((sorted[sorted.length-1].price - sorted[0].price)/sorted[0].price)*100
      : 0;
  });
}

/* ---------------------------------------------------
   CHEAPEST BANNER
--------------------------------------------------- */
function renderCheapestBanner() {
  const el = document.getElementById("cheapestBannerText");

  if (!prices.length) {
    el.innerText = "No data yet";
    return;
  }

  const c = [...prices].sort((a,b)=>a.price - b.price)[0];
  const pubName = pubs.find(p=>p.id===c.pubId)?.name || "Unknown Pub";
  el.innerText = `£${c.price.toFixed(2)} – ${c.pintName} at ${pubName}`;
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
  today.forEach(p => counts[p.pintName] = (counts[p.pintName] || 0) + 1);

  const top = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
  out.innerText = `${top[0]} (${top[1]})`;
}

/* ---------------------------------------------------
   TOP PINT TYPES THIS WEEK
--------------------------------------------------- */
function renderTopTypesThisWeek() {
  const out = document.getElementById("weeklyTypesValue");

  const week = prices.filter(p => Date.now() - p.timestamp < 7*86400000);
  if (!week.length) {
    out.innerText = "—";
    return;
  }

  const types = ["Lager","Ale","IPA","Cider","Guinness"];
  const counts = {};

  types.forEach(t => counts[t] = 0);
  week.forEach(p => counts[p.pintType]++);

  const sorted = types.map(t=>[t,counts[t]]).sort((a,b)=>b[1]-a[1]);
  out.innerText = sorted.slice(0,3).map(s => s[0]).join(", ");
}

/* ---------------------------------------------------
   MONEY INVESTED (weekly)
--------------------------------------------------- */
function renderMoneyInvestedWeek() {
  const out = document.getElementById("moneyInvestedValue");

  const week = prices.filter(p => Date.now() - p.timestamp < 7*86400000);
  const total = week.reduce((a,b)=>a+b.price,0);

  out.innerText = `£${total.toFixed(2)}`;

  const inline = document.getElementById("moneyInvestedInline");
  if (inline) inline.innerText = `Money This Week: £${total.toFixed(2)}`;
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

  // cheapest
  const cheapest = [...prices].sort((a,b)=>a.price-b.price)[0];
  items.push(`Cheapest £${cheapest.price.toFixed(2)} (${cheapest.pintName})`);

  // most active pub
  const counts = {};
  prices.forEach(p => counts[p.pubId] = (counts[p.pubId]||0)+1);
  const active = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
  const pubName = pubs.find(p=>p.id===active[0])?.name || "";
  items.push(`${pubName} active`);

  // avg price
  const avg = prices.reduce((a,b)=>a+b.price,0)/prices.length;
  items.push(`Avg £${avg.toFixed(2)}`);

  t.innerText = items.join(" • ");
}

/* ---------------------------------------------------
   CHEAPEST BY PINT NAME
--------------------------------------------------- */
document.getElementById("cheapestPintSelect").onchange = renderCheapestByPintName;

function renderCheapestByPintName() {
  const pint = document.getElementById("cheapestPintSelect").value;
  const out = document.getElementById("cheapestPintResult");

  const relevant = prices.filter(p => p.pintName === pint);
  if (!relevant.length) {
    out.innerText = "No data yet.";
    return;
  }

  const cheapest = relevant.sort((a,b)=>a.price - b.price)[0];
  const pub = pubs.find(p=>p.id===cheapest.pubId)?.name || "Unknown Pub";

  out.innerText = `Cheapest ${pint} is £${cheapest.price.toFixed(2)} at ${pub}`;
}

/* ---------------------------------------------------
   PUB LEAGUE (football style)
--------------------------------------------------- */
document.getElementById("showAllPubsBtn").onclick = () => {
  showAllLeague = !showAllLeague;
  document.getElementById("fullLeagueTable").style.display = showAllLeague ? "" : "none";
  document.getElementById("showAllPubsBtn").innerText =
    showAllLeague ? "Hide Full League ▲" : "Show Full League ▼";

  renderLeague();
};

function renderLeague() {
  const typeFilter = document.getElementById("leagueFilter").value;
  const nameFilter = document.getElementById("leaguePintName").value;

  let list = pubs.filter(p => p.avg !== null);

  // pint TYPE filter
  if (typeFilter !== "all") {
    list = list.filter(pub =>
      prices.some(pr => pr.pubId === pub.id && pr.pintType === typeFilter)
    );
  }

  // pint NAME filter
  if (nameFilter !== "all") {
    list = list.filter(pub =>
      prices.some(pr => pr.pubId === pub.id && pr.pintName === nameFilter)
    );
  }

  // Top 5 cheapest
  const cheap5 = [...list].sort((a,b)=>a.avg - b.avg).slice(0,5);
  document.getElementById("cheapestTable").innerHTML =
    makeLeagueRows(cheap5);

  // Top 5 most expensive
  const exp5 = [...list].sort((a,b)=>b.avg - a.avg).slice(0,5);
  document.getElementById("expensiveTable").innerHTML =
    makeLeagueRows(exp5);

  // Full league (if expanded)
  if (showAllLeague) {
    const full = [...list].sort((a,b)=>a.avg - b.avg);
    document.getElementById("fullLeagueTable").innerHTML =
      makeLeagueRows(full, true);
  }
}

/* RENDER LEAGUE TABLE ROWS */
function makeLeagueRows(list, includeHeader = false) {
  let html = "";

  if (includeHeader) {
    html += `
      <tr>
        <th>Pos</th>
        <th>Pub</th>
        <th>Avg Price</th>
      </tr>
    `;
  }

  return html + list.map((pub, i) => `
    <tr>
      <td>${i+1}</td>
      <td>${pub.name}</td>
      <td>£${pub.avg.toFixed(2)}</td>
    </tr>
  `).join("");
}

/* ---------------------------------------------------
   RECENT FEED (5 most recent)
--------------------------------------------------- */
function renderRecent() {
  const out = document.getElementById("recentFeed");

  const recent = [...prices]
    .sort((a,b)=>b.timestamp - a.timestamp)
    .slice(0,5);

  out.innerHTML = recent.map(r => {
    const pub = pubs.find(p=>p.id===r.pubId)?.name || "Unknown Pub";
    return `<div class="feed-item">£${r.price.toFixed(2)} – ${r.pintName} at ${pub}</div>`;
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
      .map(p => `${p.name} (£${p.avg.toFixed(2)})`)
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
