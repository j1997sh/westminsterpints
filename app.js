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
   GLOBAL STATE
--------------------------------------------------- */
let pubs = [];
let pintNames = [];
let prices = [];

let previousPINX = null;
let showFullLeague = false;

/* ---------------------------------------------------
   SNAPSHOT LISTENERS (LIVE SYNC)
--------------------------------------------------- */
onSnapshot(collection(db, "pubs"), snap => {
  pubs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  refreshEverything();
});

onSnapshot(collection(db, "pintNames"), snap => {
  pintNames = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  refreshEverything();
});

onSnapshot(collection(db, "prices"), snap => {
  prices = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  refreshEverything();
});

/* ---------------------------------------------------
   GLOBAL REFRESH (CALLED EVERY TIME DATA CHANGES)
--------------------------------------------------- */
function refreshEverything() {
  populateSelectors();
  computePubStats();

  renderCheapestBanner();
  renderPopularToday();
  renderTopTypesThisWeek();
  renderPINX();
  renderTicker();
  renderCheapestByPintName();
  renderRecentFeed();

  renderLeagueTables();
  renderDrinksMenu();

  renderSwingometer();       // NEW
  renderPintClusters();      // NEW
}

/* ---------------------------------------------------
   POPULATE SELECT BOXES
--------------------------------------------------- */
function populateSelectors() {
  const pubSel = document.getElementById("pintPubSelect");
  const pintSel = document.getElementById("pintNameSelect");
  const cheapestSel = document.getElementById("cheapestPintSelect");
  const menuPubSel = document.getElementById("drinksMenuSelect");
  const leaguePintSel = document.getElementById("leaguePintName");

  if (pubSel)
    pubSel.innerHTML = pubs
      .map(p => `<option value="${p.id}">${p.name}</option>`)
      .join("");

  if (pintSel)
    pintSel.innerHTML = pintNames
      .map(p => `<option value="${p.id}">${p.name}</option>`)
      .join("");

  if (cheapestSel)
    cheapestSel.innerHTML = pintNames
      .map(p => `<option value="${p.name}">${p.name}</option>`)
      .join("");

  if (menuPubSel)
    menuPubSel.innerHTML = pubs
      .map(p => `<option value="${p.id}">${p.name}</option>`)
      .join("");

  if (leaguePintSel)
    leaguePintSel.innerHTML =
      `<option value="all">All Pints</option>` +
      pintNames.map(p => `<option value="${p.name}">${p.name}</option>`).join("");
}

/* ---------------------------------------------------
   PUB STATS (AVG + TREND)
--------------------------------------------------- */
function computePubStats() {
  pubs.forEach(pub => {
    const list = prices.filter(p => p.pubId === pub.id);
    if (!list.length) {
      pub.avgPrice = null;
      pub.trend = 0;
      return;
    }

    const sorted = [...list].sort((a, b) => a.timestamp - b.timestamp);
    pub.avgPrice = sorted.reduce((a, b) => a + b.price, 0) / sorted.length;

    if (sorted.length >= 2) {
      const first = sorted[0].price;
      const last = sorted[sorted.length - 1].price;
      pub.trend = ((last - first) / first) * 100;
    }
  });
}

/* ---------------------------------------------------
   TOAST (REUSED EVERYWHERE)
--------------------------------------------------- */
function showToast(msg) {
  const t = document.getElementById("toast");
  t.innerText = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}
/* ---------------------------------------------------
   ADD PUB
--------------------------------------------------- */
async function addPub() {
  const name = document.getElementById("pubNameInput").value.trim();
  if (!name) {
    showToast("Enter a pub name.");
    return;
  }

  await addDoc(collection(db, "pubs"), {
    name,
    category: "Westminster"
  });

  document.getElementById("pubNameInput").value = "";
  showToast("Pub added.");
}

/* ---------------------------------------------------
   ADD PINT NAME
--------------------------------------------------- */
async function addPintName() {
  const name = document.getElementById("newPintNameInput").value.trim();
  if (!name) {
    showToast("Enter a pint name.");
    return;
  }

  await addDoc(collection(db, "pintNames"), { name });
  document.getElementById("newPintNameInput").value = "";
  showToast("Pint name added.");
}

/* ---------------------------------------------------
   ADD PINT PRICE
--------------------------------------------------- */
async function addPintPrice() {
  const pubId = document.getElementById("pintPubSelect").value;
  const pintId = document.getElementById("pintNameSelect").value;
  const type = document.getElementById("pintTypeSelect").value;
  const price = Number(document.getElementById("pintPriceInput").value);

  if (!pubId || !pintId || !type || !price || price <= 0) {
    showToast("Enter all pint details.");
    return;
  }

  const pintNameObj = pintNames.find(p => p.id === pintId);

  await addDoc(collection(db, "prices"), {
    pubId,
    pintName: pintNameObj.name,
    pintType: type,
    price,
    timestamp: Date.now()
  });

  document.getElementById("pintPriceInput").value = "";
  showToast("Pint price added.");
}

/* ---------------------------------------------------
   BUTTON EVENT BINDINGS
--------------------------------------------------- */
document.getElementById("addPubBtn").addEventListener("click", addPub);
document.getElementById("addPintNameBtn").addEventListener("click", addPintName);
document.getElementById("addPintPriceBtn").addEventListener("click", addPintPrice);

/* ---------------------------------------------------
   BUDGET PLANNER BUTTON
--------------------------------------------------- */
document.getElementById("runBudgetBtn").addEventListener("click", runBudgetPlanner);
/* ---------------------------------------------------
   CHEAPEST PINT BANNER
--------------------------------------------------- */
function renderCheapestBanner() {
  const banner = document.getElementById("cheapestBannerText");
  if (!prices.length || !pubs.length) {
    banner.textContent = "Loading…";
    return;
  }

  // Find absolute cheapest price
  const cheapest = [...prices].sort((a, b) => a.price - b.price)[0];
  if (!cheapest) {
    banner.textContent = "No pint data yet.";
    return;
  }

  const pub = pubs.find(p => p.id === cheapest.pubId);
  banner.textContent = `£${cheapest.price.toFixed(2)} — ${cheapest.pintName} at ${pub?.name ?? "Unknown Pub"}`;
}

/* ---------------------------------------------------
   CHEAPEST BY PINT NAME SELECTOR
--------------------------------------------------- */
function renderCheapestByPintName() {
  const output = document.getElementById("cheapestPintResult");
  const selected = document.getElementById("cheapestPintSelect")?.value;
  if (!selected) {
    output.textContent = "Select a pint.";
    return;
  }

  const relevant = prices.filter(p => p.pintName === selected);
  if (!relevant.length) {
    output.textContent = "No submissions for this pint.";
    return;
  }

  const cheapest = [...relevant].sort((a, b) => a.price - b.price)[0];
  const pub = pubs.find(p => p.id === cheapest.pubId);

  output.textContent = `Cheapest is £${cheapest.price.toFixed(2)} at ${pub?.name ?? "Unknown Pub"}`;
}

/* ---------------------------------------------------
   PINX INDEX (AVERAGE PRICE)
--------------------------------------------------- */
function renderPINX() {
  const field = document.getElementById("pinxValue");
  const investedField = document.getElementById("moneyInvestedInline");

  if (!prices.length) {
    field.textContent = "—";
    investedField.textContent = "—";
    return;
  }

  const avg = prices.reduce((a, b) => a + b.price, 0) / prices.length;
  const rounded = avg.toFixed(2);

  // Compare to previous to generate arrow
  let changeIcon = "";
  if (previousPINX !== null) {
    if (avg > previousPINX) changeIcon = "🔺";
    else if (avg < previousPINX) changeIcon = "🔻";
    else changeIcon = "⏺️";
  }
  previousPINX = avg;

  field.textContent = `£${rounded} ${changeIcon}`;

  // Fake “investment” indicator
  investedField.textContent = `📦 £${(prices.length * avg).toFixed(0)} invested this week`;
}

/* ---------------------------------------------------
   MOST POPULAR PINT TODAY
--------------------------------------------------- */
function renderPopularToday() {
  const field = document.getElementById("popularPintValue");
  if (!prices.length) {
    field.textContent = "—";
    return;
  }

  // Count occurrences by pintName
  const counts = {};
  prices.forEach(p => {
    if (!counts[p.pintName]) counts[p.pintName] = 0;
    counts[p.pintName]++;
  });

  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  field.textContent = top ? `${top[0]} (${top[1]} entries)` : "—";
}

/* ---------------------------------------------------
   TOP TYPES THIS WEEK
--------------------------------------------------- */
function renderTopTypesThisWeek() {
  const field = document.getElementById("weeklyTypesValue");

  if (!prices.length) {
    field.textContent = "—";
    return;
  }

  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = prices.filter(p => p.timestamp >= cutoff);

  const counts = {};
  recent.forEach(p => {
    if (!counts[p.pintType]) counts[p.pintType] = 0;
    counts[p.pintType]++;
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!sorted.length) {
    field.textContent = "—";
    return;
  }

  const [type, num] = sorted[0];
  field.textContent = `${type} (${num})`;
}

/* ---------------------------------------------------
   LIVE TICKER
--------------------------------------------------- */
function renderTicker() {
  const el = document.getElementById("tickerText");

  if (!prices.length) {
    el.textContent = "Waiting for price submissions…";
    return;
  }

  const items = prices.slice(-10).map(
    p => `${p.pintName} £${p.price.toFixed(2)} @ ${pubs.find(x => x.id === p.pubId)?.name}`
  );

  el.textContent = items.join("   •   ");
}

/* ---------------------------------------------------
   RECENT SUBMISSIONS FEED (LAST 5)
--------------------------------------------------- */
function renderRecentFeed() {
  const wrap = document.getElementById("recentFeed");
  wrap.innerHTML = "";

  const latest = [...prices].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);

  latest.forEach(p => {
    const pub = pubs.find(x => x.id === p.pubId)?.name ?? "Unknown Pub";
    const row = document.createElement("div");
    row.className = "feed-item";
    row.textContent = `${p.pintName} — £${p.price.toFixed(2)} at ${pub}`;
    wrap.appendChild(row);
  });
}

/* ---------------------------------------------------
   PUB LEAGUE TABLES
--------------------------------------------------- */
function renderLeagueTables() {
  const filterType = document.getElementById("leagueFilter").value;
  const filterPintName = document.getElementById("leaguePintName").value;

  // Compute average price per pub
  const enriched = pubs.map(pub => {
    const list = prices.filter(p => p.pubId === pub.id);

    // Filter by pint type?
    const filtered = list.filter(p => {
      if (filterType !== "all" && p.pintType !== filterType) return false;
      if (filterPintName !== "all" && p.pintName !== filterPintName) return false;
      return true;
    });

    if (!filtered.length) {
      return { ...pub, avg: null };
    }

    const avg = filtered.reduce((a, b) => a + b.price, 0) / filtered.length;
    return { ...pub, avg };
  });

  const cheapestEl = document.getElementById("cheapestTable");
  const expensiveEl = document.getElementById("expensiveTable");
  const fullEl = document.getElementById("fullLeagueTable");

  cheapestEl.innerHTML = "";
  expensiveEl.innerHTML = "";
  fullEl.innerHTML = "";

  const valid = enriched.filter(e => e.avg !== null);

  const sorted = [...valid].sort((a, b) => a.avg - b.avg);

  // --- Top 5 cheapest ---
  sorted.slice(0, 5).forEach(pub => {
    cheapestEl.innerHTML += `
      <tr>
        <td>${pub.name}</td>
        <td>£${pub.avg.toFixed(2)}</td>
      </tr>`;
  });

  // --- Top 5 most expensive ---
  sorted.slice(-5).forEach(pub => {
    expensiveEl.innerHTML += `
      <tr>
        <td>${pub.name}</td>
        <td>£${pub.avg.toFixed(2)}</td>
      </tr>`;
  });

  // --- Full league (toggle) ---
  if (showFullLeague) {
    fullEl.style.display = "table";
    sorted.forEach(pub => {
      fullEl.innerHTML += `
        <tr>
          <td>${pub.name}</td>
          <td>£${pub.avg.toFixed(2)}</td>
        </tr>`;
    });
  } else {
    fullEl.style.display = "none";
  }

  document.getElementById("showAllPubsBtn").onclick = () => {
    showFullLeague = !showFullLeague;
    renderLeagueTables();
  };
}

/* ---------------------------------------------------
   DRINKS MENU (PER PUB)
--------------------------------------------------- */
function renderDrinksMenu() {
  const pubId = document.getElementById("drinksMenuSelect").value;
  const table = document.getElementById("drinksMenuTable");

  const list = prices.filter(p => p.pubId === pubId);

  const grouped = {};
  list.forEach(p => {
    if (!grouped[p.pintName]) grouped[p.pintName] = [];
    grouped[p.pintName].push(p.price);
  });

  table.innerHTML = `
    <tr>
      <th>Pint</th>
      <th>Cheapest</th>
      <th>Average</th>
      <th>Trend</th>
    </tr>
  `;

  for (const [name, vals] of Object.entries(grouped)) {
    const cheapest = Math.min(...vals);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;

    let trend = "⏺️";
    if (vals.length >= 2) {
      const sorted = [...vals].sort();
      if (sorted[sorted.length - 1] > sorted[0]) trend = "🔺";
      if (sorted[sorted.length - 1] < sorted[0]) trend = "🔻";
    }

    table.innerHTML += `
      <tr>
        <td>${name}</td>
        <td>£${cheapest.toFixed(2)}</td>
        <td>£${avg.toFixed(2)}</td>
        <td>${trend}</td>
      </tr>
    `;
  }
}

/* ---------------------------------------------------
   BUDGET PLANNER
--------------------------------------------------- */
function runBudgetPlanner() {
  const budget = Number(document.getElementById("budgetInput").value);
  const max = Number(document.getElementById("budgetMaxInput").value);

  const output = document.getElementById("budgetResult");

  if (!budget || !max) {
    output.textContent = "Enter budget and max price.";
    return;
  }

  const cheapPubs = pubs.map(pub => {
    const relevant = prices.filter(p => p.pubId === pub.id && p.price <= max);
    if (!relevant.length) return { pub, count: 0 };

    const count = Math.floor(budget / (relevant.sort((a, b) => a.price - b.price)[0].price));
    return { pub, count };
  });

  const best = cheapPubs.sort((a, b) => b.count - a.count)[0];

  if (!best || best.count === 0) {
    output.textContent = "No pubs match your criteria.";
    return;
  }

  output.textContent = `${best.pub.name}: ${best.count} pints possible.`;
}
/* ---------------------------------------------------
   PINT RARITY ENGINE
--------------------------------------------------- */
function rarityEmoji(count) {
  if (count >= 10) return "🍺";       // Common
  if (count >= 6) return "⭐";        // Popular
  if (count >= 3) return "🔶";       // Limited
  if (count >= 1) return "🟥";       // Rare
  return "❌";                       // Not sold
}

/* ---------------------------------------------------
   AVAILABILITY SWING-O-METER
   Using last 7 days vs previous 7 days
--------------------------------------------------- */
function renderSwingometer() {
  const table = document.getElementById("swingTable");
  table.innerHTML = "";

  if (!prices.length || !pintNames.length) {
    table.innerHTML = "<tr><td>No data yet.</td></tr>";
    return;
  }

  const now = Date.now();
  const cutoff1 = now - 7 * 24 * 60 * 60 * 1000;      // last 7 days
  const cutoff2 = now - 14 * 24 * 60 * 60 * 1000;     // previous 7 days

  const lastWeek = prices.filter(p => p.timestamp >= cutoff1);
  const prevWeek = prices.filter(p => p.timestamp < cutoff1 && p.timestamp >= cutoff2);

  const result = [];

  pintNames.forEach(pint => {
    const name = pint.name;

    const pubsLast = new Set(lastWeek.filter(x => x.pintName === name).map(x => x.pubId));
    const pubsPrev = new Set(prevWeek.filter(x => x.pintName === name).map(x => x.pubId));

    const countLast = pubsLast.size;
    const countPrev = pubsPrev.size;

    const swing = countLast - countPrev;

    let status = "Stable";
    let rowClass = "";
    if (swing > 0) {
      status = "Gaining";
      rowClass = "swing-positive";
    }
    if (swing < 0) {
      status = "Dropping";
      rowClass = "swing-negative";
    }

    result.push({
      name,
      countLast,
      swing,
      status,
      rowClass,
      rarity: rarityEmoji(countLast),
      pubs: Array.from(pubsLast)
    });
  });

  // Sort by largest swing
  result.sort((a, b) => b.swing - a.swing);

  table.innerHTML = `
    <tr>
      <th>Pint</th>
      <th>Swing</th>
      <th>Status</th>
      <th>Availability</th>
      <th></th>
    </tr>
  `;

  result.forEach(item => {
    const pubCount = item.countLast;
    const swingText = item.swing > 0 ? `+${item.swing}` : item.swing;

    table.innerHTML += `
      <tr class="${item.rowClass}">
        <td>${item.name} ${item.rarity}</td>
        <td>${swingText} pubs</td>
        <td>${item.swing > 0 ? "🔺 Gaining" : item.swing < 0 ? "🔻 Dropping" : "⏺️ Stable"}</td>
        <td>${pubCount} pubs</td>
        <td><button class="view-pubs-btn" data-pint="${item.name}">View Pubs</button></td>
      </tr>
    `;
  });

  // Bind modal buttons
  document.querySelectorAll(".view-pubs-btn").forEach(btn => {
    btn.addEventListener("click", () => openPubModal(btn.dataset.pint));
  });
}

/* ---------------------------------------------------
   OPEN MODAL OF PUBS THAT SELL A GIVEN PINT
--------------------------------------------------- */
function openPubModal(pintName) {
  const modal = document.getElementById("pubModal");
  const title = document.getElementById("modalTitle");
  const list = document.getElementById("modalPubList");

  title.textContent = pintName + " — Available at:";
  list.innerHTML = "";

  const pubIds = new Set(prices.filter(p => p.pintName === pintName).map(p => p.pubId));

  if (pubIds.size === 0) {
    list.innerHTML = "<li>No pubs currently selling this pint.</li>";
  } else {
    pubIds.forEach(id => {
      const pub = pubs.find(p => p.id === id);
      list.innerHTML += `<li>${pub ? pub.name : "Unknown Pub"}</li>`;
    });
  }

  modal.style.display = "block";
}

document.getElementById("modalClose").onclick = () => {
  document.getElementById("pubModal").style.display = "none";
};

/* ---------------------------------------------------
   PRICE CLUSTER DETECTOR
--------------------------------------------------- */
function renderPintClusters() {
  const box = document.getElementById("clusterContent");
  box.innerHTML = "";

  if (!prices.length) {
    box.textContent = "No data yet.";
    return;
  }

  // Compute average price per pint
  const grouped = {};
  prices.forEach(p => {
    if (!grouped[p.pintName]) grouped[p.pintName] = [];
    grouped[p.pintName].push(p.price);
  });

  const averages = Object.entries(grouped).map(([name, vals]) => ({
    name,
    avg: vals.reduce((a, b) => a + b, 0) / vals.length
  }));

  // Define tiers
  const tiers = [
    { label: "💚 Budget Tier (£≤5.30)", min: 0, max: 5.30 },
    { label: "💛 Standard Tier (£5.31–£5.90)", min: 5.31, max: 5.90 },
    { label: "💙 Premium Tier (£5.91–£6.50)", min: 5.91, max: 6.50 },
    { label: "❤️ Deluxe Tier (£≥6.51)", min: 6.51, max: Infinity }
  ];

  tiers.forEach(tier => {
    const list = averages
      .filter(p => p.avg >= tier.min && p.avg <= tier.max)
      .sort((a, b) => a.avg - b.avg);

    box.innerHTML += `
      <div class="cluster-group">
        <h3>${tier.label}</h3>
        ${list.length ? "" : "<p>No pints here</p>"}
      </div>
    `;

    const groupDiv = box.lastElementChild;

    list.forEach(p => {
      const row = document.createElement("div");
      row.textContent = `${p.name} — £${p.avg.toFixed(2)}`;
      groupDiv.appendChild(row);
    });
  });
}

/* ---------------------------------------------------
   MOBILE NAVIGATION HELPERS
--------------------------------------------------- */
function scrollToId(id) {
  document.getElementById(id).scrollIntoView({ behavior: "smooth" });
}

/* ---------------------------------------------------
   INITIALISE APP
--------------------------------------------------- */
function init() {
  // nothing more needed — live snapshots trigger everything
  console.log("Westminster Pints Exchange initialised.");
}

init();
