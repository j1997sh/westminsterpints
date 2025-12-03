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

/* ---------------------------------------------------
   SNAPSHOTS
--------------------------------------------------- */
onSnapshot(collection(db, "pubs"), snap => {
  pubs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  refreshEverything();
});

onSnapshot(collection(db, "pints"), snap => {
  pintNames = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  refreshEverything();
});

onSnapshot(collection(db, "prices"), snap => {
  prices = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  refreshEverything();
});

/* ---------------------------------------------------
   GLOBAL REFRESH
--------------------------------------------------- */
function refreshEverything() {
  populatePubSelect();
  populatePintNameSelect();
  populateLeaguePintName();
  populateDrinksMenuPubDropdown();

  computePubStats();

  renderCheapestBanner();
  renderPopularToday();
  renderTopTypesThisWeek();
  renderMoneyInvestedWeek();
  renderPINX();
  renderTicker();
  renderCheapestByPintName();
  renderRecent();

  renderLeague();
  renderDrinksMenu();

  renderSwingometer();
  renderPintClusters();
}

/* ---------------------------------------------------
   POPULATE SELECTS
--------------------------------------------------- */
function populatePubSelect() {
  const sel = document.getElementById("pintPubSelect");
  if (!sel) return;
  sel.innerHTML = pubs.map(p => `<option value="${p.id}">${p.name}</option>`).join("");
}

function populatePintNameSelect() {
  const sel = document.getElementById("pintNameSelect");
  if (!sel) return;
  sel.innerHTML = pintNames.map(p => `<option value="${p.id}">${p.name}</option>`).join("");
}

function populateLeaguePintName() {
  const sel = document.getElementById("leaguePintName");
  if (!sel) return;

  sel.innerHTML = "<option value='all'>All Pints</option>" +
    pintNames.map(p => `<option value="${p.name}">${p.name}</option>`).join("");

  const cheapestSel = document.getElementById("cheapestPintSelect");
  if (cheapestSel) {
    cheapestSel.innerHTML =
      pintNames.map(p => `<option value="${p.name}">${p.name}</option>`).join("");
  }
}

function populateDrinksMenuPubDropdown() {
  const sel = document.getElementById("drinksMenuSelect");
  if (!sel) return;
  sel.innerHTML = pubs.map(p => `<option value="${p.id}">${p.name}</option>`).join("");
}

/* ---------------------------------------------------
   ADD PINT NAME
--------------------------------------------------- */
document.getElementById("addPintNameBtn").onclick = async () => {
  const name = document.getElementById("newPintNameInput").value.trim();
  if (!name) return alert("Enter pint name.");
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
    const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp);
    pub.avg = sorted.reduce((a, b) => a + b.price, 0) / sorted.length;

    if (sorted.length >= 2) {
      const first = sorted[0].price;
      const last = sorted[sorted.length - 1].price;
      pub.trend = ((last - first) / first) * 100;
    }
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
  const c = [...prices].sort((a,b)=>a.price-b.price)[0];
  const pubName = pubs.find(p=>p.id===c.pubId)?.name || "Unknown Pub";
  el.innerText = `£${c.price.toFixed(2)} – ${c.pintName} at ${pubName}`;
}

/* ---------------------------------------------------
   MOST POPULAR TODAY
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
   TOP TYPES THIS WEEK
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
  out.innerText = sorted.slice(0,3).map(s=>s[0]).join(", ");
}

/* ---------------------------------------------------
   MONEY INVESTED WEEK
--------------------------------------------------- */
function renderMoneyInvestedWeek() {
  const week = prices.filter(p => Date.now() - p.timestamp < 7*86400000);
  const total = week.reduce((a,b)=>a+b.price,0);
  document.getElementById("moneyInvestedInline").innerText =
    `Money This Week: £${total.toFixed(2)}`;
}

/* ---------------------------------------------------
   PINX INDEX
--------------------------------------------------- */
function renderPINX() {
  const out = document.getElementById("pinxValue");
  const valid = pubs.filter(p => p.avg !== null);
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
    else arrow = " ➖";
  }
  previousPINX = pinx;

  out.innerText = pinx + arrow;
}

/* ---------------------------------------------------
   TICKER
--------------------------------------------------- */
function renderTicker() {
  const t = document.getElementById("tickerText");
  if (!prices.length) {
    t.innerText = "Not enough data yet.";
    return;
  }

  const items = [];
  const cheapest = [...prices].sort((a,b)=>a.price-b.price)[0];
  items.push(`Cheapest £${cheapest.price.toFixed(2)} (${cheapest.pintName})`);
  const counts = {};
  prices.forEach(p => counts[p.pubId] = (counts[p.pubId]||0)+1);
  const active = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
  const pubName = pubs.find(p=>p.id===active[0])?.name || "";
  items.push(`${pubName} active`);
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

  out.innerText = `Cheapest ${pint}: £${cheapest.price.toFixed(2)} at ${pub}`;
}

/* ---------------------------------------------------
   PUB LEAGUE TABLES
--------------------------------------------------- */
document.getElementById("showAllPubsBtn").onclick = () => {
  showAllLeague = !showAllLeague;
  document.getElementById("fullLeagueTable").style.display =
    showAllLeague ? "" : "none";
  document.getElementById("showAllPubsBtn").innerText =
    showAllLeague ? "Hide Full League ▲" : "Show Full League ▼";

  renderLeague();
};

function renderLeague() {
  const typeFilter = document.getElementById("leagueFilter").value;
  const nameFilter = document.getElementById("leaguePintName").value;

  let list = pubs.filter(p => p.avg !== null);

  if (typeFilter !== "all") {
    list = list.filter(pub =>
      prices.some(pr => pr.pubId === pub.id && pr.pintType === typeFilter)
    );
  }

  if (nameFilter !== "all") {
    list = list.filter(pub =>
      prices.some(pr => pr.pubId === pub.id && pr.pintName === nameFilter)
    );
  }

  const cheap5 = [...list].sort((a,b)=>a.avg - b.avg).slice(0,5);
  const exp5 = [...list].sort((a,b)=>b.avg - a.avg).slice(0,5);

  document.getElementById("cheapestTable").innerHTML =
    makeLeagueRows(cheap5, true);
  document.getElementById("expensiveTable").innerHTML =
    makeLeagueRows(exp5, true);

  if (showAllLeague) {
    const full = [...list].sort((a,b)=>a.avg - b.avg);
    document.getElementById("fullLeagueTable").innerHTML =
      makeLeagueRows(full, true);
  }
}

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
  return html + list.map((pub,i)=>`
    <tr>
      <td>${i+1}</td>
      <td>${pub.name}</td>
      <td>£${pub.avg.toFixed(2)}</td>
    </tr>
  `).join("");
}

/* ---------------------------------------------------
   DRINKS MENU
--------------------------------------------------- */
document.getElementById("drinksMenuSelect").onchange = renderDrinksMenu;

function renderDrinksMenu() {
  const pubId = document.getElementById("drinksMenuSelect").value;
  const table = document.getElementById("drinksMenuTable");
  if (!pubId || !table) return;

  const entries = prices.filter(p => p.pubId === pubId);
  if (!entries.length) {
    table.innerHTML = "<tr><td>No drinks recorded</td></tr>";
    return;
  }

  const groups = {};
  entries.forEach(p => {
    if (!groups[p.pintName]) groups[p.pintName] = [];
    groups[p.pintName].push(p);
  });

  const rows = Object.keys(groups)
    .sort((a,b)=>a.localeCompare(b))
    .map(name => buildDrinksMenuRow(name, groups[name]))
    .join("");

  table.innerHTML = `
    <tr>
      <th>Pint</th>
      <th>Type</th>
      <th>Cheapest</th>
      <th>Average</th>
      <th>Trend</th>
    </tr>
    ${rows}
  `;
}

function buildDrinksMenuRow(name, items) {
  const cheapest = Math.min(...items.map(i=>i.price));
  const avg = items.reduce((a,b)=>a+b.price,0)/items.length;

  const sorted = [...items].sort((a,b)=>a.timestamp - b.timestamp);
  const first = sorted[0].price;
  const last = sorted[sorted.length-1].price;

  let trend = "➖";
  if (last > first) trend = "📈";
  else if (last < first) trend = "📉";

  const type = items[0].pintType;

  return `
    <tr>
      <td>${name}</td>
      <td>${type}</td>
      <td>£${cheapest.toFixed(2)}</td>
      <td>£${avg.toFixed(2)}</td>
      <td>${trend}</td>
    </tr>
  `;
}

/* ---------------------------------------------------
   RECENT FEED
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
   RARITY BADGE (helper)
--------------------------------------------------- */
function getRarityBadge(count) {
  if (count >= 10) return "🍺";
  if (count >= 6) return "⭐";
  if (count >= 3) return "🔶";
  if (count >= 1) return "🟥";
  return "❌";
}

/* ---------------------------------------------------
   SWING-O-METER
--------------------------------------------------- */
function renderSwingometer() {
  const table = document.getElementById("swingTable");
  if (!table) return;

  const now = Date.now();
  const weekMs = 7 * 86400000;

  const thisWeek = prices.filter(p => now - p.timestamp < weekMs);
  const lastWeek = prices.filter(p => now - p.timestamp >= weekMs &&
                                      now - p.timestamp < weekMs*2);

  const result = [];

  pintNames.forEach(p => {
    const name = p.name;

    const pubsThis = new Set(thisWeek.filter(x=>x.pintName===name).map(x=>x.pubId));
    const pubsLast = new Set(lastWeek.filter(x=>x.pintName===name).map(x=>x.pubId));

    const swing = pubsThis.size - pubsLast.size;

    const status =
      swing > 0 ? "🔺 Gaining" :
      swing < 0 ? "🔻 Losing" :
      "➖ Stable";

    const rarity = getRarityBadge(pubsThis.size);

    result.push({
      name,
      swing,
      status,
      count: pubsThis.size,
      rarity,
      pubs: [...pubsThis].map(id => pubs.find(p=>p.id===id)?.name || "Unknown Pub")
    });
  });

  result.sort((a,b)=>b.swing - a.swing);

  const rows = result.map(r => `
    <tr class="${r.swing>0?'swing-positive':r.swing<0?'swing-negative':''}">
      <td>${r.name} ${r.rarity}</td>
      <td>${r.swing>0?'+':''}${r.swing} pubs</td>
      <td>${r.status}</td>
      <td>${r.count} pubs</td>
      <td><button onclick="openPubModal('${r.name}')">View Pubs</button></td>
    </tr>
  `).join("");

  table.innerHTML = `
    <tr>
      <th>Pint</th>
      <th>Swing</th>
      <th>Status</th>
      <th>Availability</th>
      <th>Action</th>
    </tr>
    ${rows}
  `;
}

/* ---------------------------------------------------
   MODAL POPUP
--------------------------------------------------- */
window.openPubModal = function(pintName) {
  const modal = document.getElementById("pubModal");
  const title = document.getElementById("modalTitle");
  const list = document.getElementById("modalPubList");

  const now = Date.now();
  const weekMs = 7 * 86400000;

  const thisWeek = prices.filter(p => now - p.timestamp < weekMs);
  const pubsThis = [...new Set(thisWeek.filter(p=>p.pintName===pintName).map(p=>p.pubId))];

  title.innerText = `${pintName} — Pubs Serving This Pint`;
  list.innerHTML = pubsThis.map(id => {
    const pubName = pubs.find(p=>p.id===id)?.name || "Unknown Pub";
    return `<li>${pubName}</li>`;
  }).join("");

  modal.style.display = "block";
};

document.getElementById("modalClose").onclick = () =>
  document.getElementById("pubModal").style.display = "none";

window.onclick = e => {
  const modal = document.getElementById("pubModal");
  if (e.target === modal) modal.style.display = "none";
};

/* ---------------------------------------------------
   PINT CLUSTER DETECTOR
--------------------------------------------------- */
function renderPintClusters() {
  const container = document.getElementById("clusterContent");
  if (!container) return;

  if (!prices.length) {
    container.innerHTML = "No data available.";
    return;
  }

  const averages = pintNames.map(p => {
    const entries = prices.filter(x=>x.pintName === p.name);
    if (!entries.length) return null;
    const avg = entries.reduce((a,b)=>a+b.price,0)/entries.length;
    return { pint: p.name, avg };
  }).filter(x=>x !== null);

  const sorted = [...averages].sort((a,b)=>a.avg - b.avg);

  const budget = sorted.filter(x=>x.avg <= 5.30);
  const standard = sorted.filter(x=>x.avg > 5.30 && x.avg <= 5.90);
  const premium = sorted.filter(x=>x.avg > 5.90 && x.avg <= 6.50);
  const deluxe = sorted.filter(x=>x.avg > 6.50);

  const makeGroup = (title, list, color) => `
    <div class="cluster-group">
      <h3>${title}</h3>
      ${list.length ? list.map(x => `• ${x.pint}`).join("<br>") : "No pints here"}
    </div>
  `;

  container.innerHTML =
    makeGroup("💚 Budget Tier (£≤5.30)", budget) +
    makeGroup("💛 Standard Tier (£5.31–£5.90)", standard) +
    makeGroup("🔵 Premium Tier (£5.91–£6.50)", premium) +
    makeGroup("🔴 Deluxe Tier (£6.51+)", deluxe);
}

/* ---------------------------------------------------
   BUDGET PLANNER V2
--------------------------------------------------- */
document.getElementById("runBudgetBtn").onclick = () => {
  const budget = parseFloat(document.getElementById("budgetInput").value);
  const max = parseFloat(document.getElementById("budgetMaxInput").value);
  const out = document.getElementById("budgetResult");

  if (!budget || !max) {
    out.innerText = "Please enter both budget and max price.";
    return;
  }

  const eligiblePubs = pubs
    .map(pub => {
      const pintEntries = prices.filter(p => p.pubId === pub.id && p.price <= max);
      if (!pintEntries.length) return null;

      const cheapest = Math.min(...pintEntries.map(e=>e.price));
      const pints = Math.floor(budget / cheapest);

      return {
        pub,
        cheapest,
        pints,
        affordable: pintEntries
      };
    })
    .filter(x => x !== null && x.pints > 0);

  if (!eligiblePubs.length) {
    out.innerText = "No pubs fit your criteria.";
    return;
  }

  const best = eligiblePubs.sort((a,b)=>b.pints - a.pints)[0];

  const pintNamesAvailable = [...new Set(
    best.affordable.map(e => `${e.pintName} (£${e.price.toFixed(2)})`)
  )];

  out.innerHTML = `
    <strong>Best pub for your budget:</strong><br>
    🏆 ${best.pub.name}<br>
    Cheapest pint: £${best.cheapest.toFixed(2)}<br>
    You can buy <strong>${best.pints}</strong> pints<br><br>
    <strong>Affordable pints here:</strong><br>
    ${pintNamesAvailable.join("<br>")}
  `;
};

/* ---------------------------------------------------
   TOAST NOTIFICATION
--------------------------------------------------- */
function showToast(msg) {
  const t = document.getElementById("toast");
  t.innerText = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}
