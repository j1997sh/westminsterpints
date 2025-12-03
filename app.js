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

/* ---------------------------------------------------
   SNAPSHOTS (LIVE DATA SYNC)
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
   GLOBAL REFRESH
--------------------------------------------------- */
function refreshEverything() {
  populateSelectors();
  renderCheapestBanner();
  renderPopularToday();
  renderPINX();
  renderTicker();
  renderCheapestByPintName();
  renderBudgetResults();
  renderPubMenus();
  renderPubLeague();
  renderRecentSubmissions();
  renderSwingometer();
  renderPintClusters();
  renderRarityTable();
  renderPintTypeFinder();
}

/* ---------------------------------------------------
   SELECT BOX POPULATION
--------------------------------------------------- */
function populateSelectors() {
  const pubSelect = document.getElementById("addPintPubSelect");
  const typeSelect = document.getElementById("addPintTypeSelect");
  const pintNameSelect = document.getElementById("cheapestPintNameSelect");
  const finderSelect = document.getElementById("pintTypeFinderSelect");

  if (pubSelect)
    pubSelect.innerHTML = pubs.map(p => `<option value="${p.id}">${p.name}</option>`).join("");

  if (typeSelect)
    typeSelect.innerHTML = pintNames.map(p => `<option value="${p.name}">${p.name}</option>`).join("");

  if (pintNameSelect)
    pintNameSelect.innerHTML = pintNames.map(p => `<option value="${p.name}">${p.name}</option>`).join("");

  if (finderSelect)
    finderSelect.innerHTML = pintNames.map(p => `<option value="${p.name}">${p.name}</option>`).join("");
}

/* ---------------------------------------------------
   TOAST
--------------------------------------------------- */
function showToast(msg) {
  const t = document.getElementById("toast");
  t.innerText = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2000);
}
/* ---------------------------------------------------
   ADD PUB
--------------------------------------------------- */
async function addPub() {
  const name = document.getElementById("newPubNameInput").value.trim();

  if (!name) {
    showToast("Enter a pub name.");
    return;
  }

  await addDoc(collection(db, "pubs"), {
    name,
    category: "Westminster"
  });

  document.getElementById("newPubNameInput").value = "";
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
  const pubId = document.getElementById("addPintPubSelect").value;
  const pintType = document.getElementById("addPintTypeSelect").value;
  const price = Number(document.getElementById("addPintPriceInput").value);

  if (!pubId || !pintType || !price || price <= 0) {
    showToast("Enter all pint details.");
    return;
  }

  // Convert pintType -> pintName (because this select IS the name list)
  const selectedNameObj = pintNames.find(p => p.name === pintType);

  await addDoc(collection(db, "prices"), {
    pubId,
    pintName: selectedNameObj.name,
    pintType: "Lager", // default: you said pint type is not Lager/Premium anymore
    price,
    timestamp: Date.now()
  });

  document.getElementById("addPintPriceInput").value = "";
  showToast("Pint price added.");
}

/* ---------------------------------------------------
   BIND BUTTONS
--------------------------------------------------- */
document.getElementById("addPubBtn").addEventListener("click", addPub);
document.getElementById("addPintNameBtn").addEventListener("click", addPintName);
document.getElementById("addPintPriceBtn").addEventListener("click", addPintPrice);
document.getElementById("runBudgetBtn").addEventListener("click", runBudgetPlanner);
document.getElementById("findCheapestByNameBtn").addEventListener("click", renderCheapestByPintName);
document.getElementById("findPintTypeBtn").addEventListener("click", renderPintTypeFinder);
/* ---------------------------------------------------
   CHEAPEST PINT BANNER
--------------------------------------------------- */
function renderCheapestBanner() {
  const el = document.getElementById("cheapestBannerText");
  if (!prices.length || !pubs.length) {
    el.textContent = "No data yet.";
    return;
  }

  const cheapest = [...prices].sort((a, b) => a.price - b.price)[0];
  const pub = pubs.find(p => p.id === cheapest.pubId);

  el.textContent = `£${cheapest.price.toFixed(2)} — ${cheapest.pintName} at ${pub?.name ?? "Unknown Pub"}`;
}

/* ---------------------------------------------------
   CHEAPEST BY PINT NAME
--------------------------------------------------- */
function renderCheapestByPintName() {
  const pint = document.getElementById("cheapestPintNameSelect").value;
  const el = document.getElementById("cheapestPintByNameResult");

  if (!pint) {
    el.textContent = "Select a pint.";
    return;
  }

  const relevant = prices.filter(p => p.pintName === pint);
  if (!relevant.length) {
    el.textContent = "No submissions yet.";
    return;
  }

  const cheapest = relevant.sort((a, b) => a.price - b.price)[0];
  const pub = pubs.find(p => p.id === cheapest.pubId);

  el.textContent = `Cheapest is £${cheapest.price.toFixed(2)} at ${pub?.name ?? "Unknown Pub"}`;
}

/* ---------------------------------------------------
   BUDGET PLANNER
--------------------------------------------------- */
function runBudgetPlanner() {
  const budget = Number(document.getElementById("budgetInput").value);
  const el = document.getElementById("budgetResult");

  if (!budget || budget <= 0) {
    el.textContent = "Enter a valid budget.";
    return;
  }

  const pubStats = pubs.map(pub => {
    const local = prices.filter(p => p.pubId === pub.id);
    if (!local.length) return { pub, best: Infinity };

    const best = Math.min(...local.map(p => p.price));
    return { pub, best };
  });

  const affordable = pubStats
    .filter(x => x.best !== Infinity)
    .filter(x => x.best <= budget)
    .map(x => ({
      pub: x.pub,
      pints: Math.floor(budget / x.best),
      price: x.best
    }))
    .sort((a, b) => b.pints - a.pints);

  if (!affordable.length) {
    el.textContent = "No pubs match your budget.";
    return;
  }

  const best = affordable[0];

  el.textContent = `${best.pub.name}: ${best.pints} pints (cheapest £${best.price.toFixed(2)})`;
}

/* ---------------------------------------------------
   PINX INDEX
--------------------------------------------------- */
function renderPINX() {
  const el = document.getElementById("pinxValue");

  if (!prices.length) {
    el.textContent = "—";
    return;
  }

  const avg = prices.reduce((a, b) => a + b.price, 0) / prices.length;
  const rounded = avg.toFixed(2);

  let icon = "";
  if (previousPINX !== null) {
    if (avg > previousPINX) icon = "🔺";
    else if (avg < previousPINX) icon = "🔻";
    else icon = "⏺️";
  }
  previousPINX = avg;

  el.textContent = `£${rounded} ${icon}`;
}

/* ---------------------------------------------------
   MOST POPULAR PINT TODAY
--------------------------------------------------- */
function renderPopularToday() {
  const el = document.getElementById("mostPopularPint");
  if (!prices.length) {
    el.textContent = "—";
    return;
  }

  const counts = {};
  prices.forEach(p => {
    counts[p.pintName] = (counts[p.pintName] || 0) + 1;
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  el.textContent = `${sorted[0][0]} (${sorted[0][1]})`;
}

/* ---------------------------------------------------
   LIVE TICKER
--------------------------------------------------- */
function renderTicker() {
  const el = document.getElementById("tickerText");

  if (!prices.length) {
    el.textContent = "Waiting for submissions...";
    return;
  }

  const last10 = prices.slice(-10);
  const items = last10.map(p => {
    const pub = pubs.find(x => x.id === p.pubId)?.name ?? "Unknown Pub";
    return `${p.pintName} £${p.price.toFixed(2)} @ ${pub}`;
  });

  el.textContent = items.join(" • ");
}

/* ---------------------------------------------------
   RECENT SUBMISSIONS (LAST 5)
--------------------------------------------------- */
function renderRecentSubmissions() {
  const el = document.getElementById("recentSubmissions");
  el.innerHTML = "";

  const latest = [...prices]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5);

  latest.forEach(p => {
    const pubName = pubs.find(x => x.id === p.pubId)?.name ?? "Unknown Pub";
    el.innerHTML += `
      <div class="feed-item">
        £${p.price.toFixed(2)} — ${p.pintName} at ${pubName}
      </div>
    `;
  });
}

/* ---------------------------------------------------
   PUB MENUS
--------------------------------------------------- */
function renderPubMenus() {
  const wrap = document.getElementById("pubMenusContainer");
  wrap.innerHTML = "";

  pubs.forEach(pub => {
    const local = prices.filter(p => p.pubId === pub.id);

    if (!local.length) return;

    const grouped = {};
    local.forEach(p => {
      grouped[p.pintName] = grouped[p.pintName] || [];
      grouped[p.pintName].push(p.price);
    });

    let html = `
      <div class="menu-block">
        <h3>${pub.name}</h3>
        <table>
          <tr>
            <th>Pint</th>
            <th>Cheapest</th>
            <th>Average</th>
          </tr>
    `;

    for (const [name, vals] of Object.entries(grouped)) {
      const cheapest = Math.min(...vals);
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;

      html += `
        <tr>
          <td>${name}</td>
          <td>£${cheapest.toFixed(2)}</td>
          <td>£${avg.toFixed(2)}</td>
        </tr>
      `;
    }

    html += `</table></div>`;
    wrap.innerHTML += html;
  });
}

/* ---------------------------------------------------
   PUB LEAGUE TABLE
--------------------------------------------------- */
function renderPubLeague() {
  const cheap = document.getElementById("cheapestTable");
  const exp = document.getElementById("expensiveTable");
  const full = document.getElementById("fullLeagueTable");

  cheap.innerHTML = "";
  exp.innerHTML = "";
  full.innerHTML = "";

  const stats = pubs.map(pub => {
    const local = prices.filter(p => p.pubId === pub.id);
    if (!local.length) return { pub, avg: null };

    const avg = local.reduce((a, b) => a + b.price, 0) / local.length;
    return { pub, avg };
  }).filter(x => x.avg !== null);

  const sorted = stats.sort((a, b) => a.avg - b.avg);

  // Top 5 cheapest
  sorted.slice(0, 5).forEach(x => {
    cheap.innerHTML += `
      <tr>
        <td>${x.pub.name}</td>
        <td>£${x.avg.toFixed(2)}</td>
      </tr>
    `;
  });

  // Top 5 expensive
  sorted.slice(-5).forEach(x => {
    exp.innerHTML += `
      <tr>
        <td>${x.pub.name}</td>
        <td>£${x.avg.toFixed(2)}</td>
      </tr>
    `;
  });

  // Full table
  sorted.forEach(x => {
    full.innerHTML += `
      <tr>
        <td>${x.pub.name}</td>
        <td>£${x.avg.toFixed(2)}</td>
      </tr>
    `;
  });

  document.getElementById("showFullLeagueBtn").onclick = () => {
    full.style.display = full.style.display === "none" ? "block" : "none";
  };
}
/* ---------------------------------------------------
   RARITY EMOJIS
--------------------------------------------------- */
function rarityEmoji(count) {
  if (count >= 10) return "🍺";   // Common
  if (count >= 6) return "⭐";    // Popular
  if (count >= 3) return "🔶";    // Limited
  if (count >= 1) return "🟥";    // Rare
  return "❌";                    // Not sold
}

/* ---------------------------------------------------
   AVAILABILITY SWING-O-METER
   Last 7 days vs previous 7 days
--------------------------------------------------- */
function renderSwingometer() {
  const table = document.getElementById("swingTable");
  table.innerHTML = "";

  if (!prices.length || !pintNames.length) {
    table.innerHTML = "<tr><td>No data yet</td></tr>";
    return;
  }

  const now = Date.now();
  const last7 = now - 7 * 24 * 60 * 60 * 1000;
  const prev7 = now - 14 * 24 * 60 * 60 * 1000;

  const recent = prices.filter(p => p.timestamp >= last7);
  const previous = prices.filter(p => p.timestamp < last7 && p.timestamp >= prev7);

  let output = [];

  pintNames.forEach(p => {
    const name = p.name;

    const recentPubs = new Set(recent.filter(x => x.pintName === name).map(x => x.pubId));
    const previousPubs = new Set(previous.filter(x => x.pintName === name).map(x => x.pubId));

    const swing = recentPubs.size - previousPubs.size;

    output.push({
      pint: name,
      swing,
      count: recentPubs.size,
      status: swing > 0 ? "Gaining" : swing < 0 ? "Dropping" : "Stable",
      pubs: [...recentPubs],
      rarity: rarityEmoji(recentPubs.size)
    });
  });

  output.sort((a, b) => b.swing - a.swing);

  table.innerHTML = `
    <tr>
      <th>Pint</th>
      <th>Swing</th>
      <th>Status</th>
      <th>Availability</th>
      <th></th>
    </tr>
  `;

  output.forEach(row => {
    table.innerHTML += `
      <tr class="${row.swing > 0 ? "swing-positive" : row.swing < 0 ? "swing-negative" : ""}">
        <td>${row.pint} ${row.rarity}</td>
        <td>${row.swing > 0 ? "+" + row.swing : row.swing}</td>
        <td>${row.status}</td>
        <td>${row.count} pubs</td>
        <td><button class="viewPubsBtn" data-pint="${row.pint}">View</button></td>
      </tr>
    `;
  });

  document.querySelectorAll(".viewPubsBtn").forEach(btn => {
    btn.addEventListener("click", () => openPubModal(btn.dataset.pint));
  });
}

/* ---------------------------------------------------
   OPEN MODAL (Pubs Serving Pint)
--------------------------------------------------- */
function openPubModal(pintName) {
  const modal = document.getElementById("pubModal");
  const list = document.getElementById("modalPubList");

  list.innerHTML = "";

  const pubIds = new Set(prices.filter(p => p.pintName === pintName).map(p => p.pubId));

  if (pubIds.size === 0) {
    list.innerHTML = "<p>No pubs currently serving this pint.</p>";
  } else {
    pubIds.forEach(id => {
      const pub = pubs.find(p => p.id === id);
      list.innerHTML += `<p>${pub ? pub.name : "Unknown Pub"}</p>`;
    });
  }

  modal.style.display = "block";
}

document.getElementById("closeModalBtn").onclick = () => {
  document.getElementById("pubModal").style.display = "none";
};

/* ---------------------------------------------------
   PINT CLUSTER DETECTOR
   Groups pints by natural average price tiers
--------------------------------------------------- */
function renderPintClusters() {
  const box = document.getElementById("clusterContent");
  box.innerHTML = "";

  if (!prices.length) {
    box.textContent = "No data yet.";
    return;
  }

  const grouped = {};
  prices.forEach(p => {
    grouped[p.pintName] = grouped[p.pintName] || [];
    grouped[p.pintName].push(p.price);
  });

  const averages = Object.entries(grouped).map(([name, vals]) => ({
    name,
    avg: vals.reduce((a, b) => a + b, 0) / vals.length
  }));

  const tiers = [
    { label: "💚 Budget (£≤5.30)",       min: 0,    max: 5.30 },
    { label: "💛 Standard (£5.31–5.90)", min: 5.31, max: 5.90 },
    { label: "💙 Premium (£5.91–6.50)",  min: 5.91, max: 6.50 },
    { label: "❤️ Deluxe (£6.51+)",       min: 6.51, max: Infinity }
  ];

  tiers.forEach(t => {
    const list = averages.filter(a => a.avg >= t.min && a.avg <= t.max);

    box.innerHTML += `
      <div class="cluster-block">
        <h3>${t.label}</h3>
        ${list.length ? "" : "<p>No pints in this tier.</p>"}
      </div>
    `;

    const block = box.lastElementChild;

    list.sort((a, b) => a.avg - b.avg).forEach(p => {
      block.innerHTML += `<p>${p.name} — £${p.avg.toFixed(2)}</p>`;
    });
  });
}

/* ---------------------------------------------------
   PINT RARITY TABLE (Full List)
--------------------------------------------------- */
function renderRarityTable() {
  const box = document.getElementById("rarityTable");
  box.innerHTML = "";

  if (!prices.length) {
    box.textContent = "No data yet.";
    return;
  }

  const counts = {};
  prices.forEach(p => {
    counts[p.pintName] = counts[p.pintName] || new Set();
    counts[p.pintName].add(p.pubId);
  });

  box.innerHTML = `
    <table class="nice-table">
      <tr>
        <th>Pint</th>
        <th>Availability</th>
        <th>Status</th>
      </tr>
    </table>
  `;

  const table = box.querySelector("table");

  pintNames.forEach(p => {
    const pubsSet = counts[p.name] || new Set();
    const count = pubsSet.size;

    table.innerHTML += `
      <tr>
        <td>${p.name}</td>
        <td>${count} pubs</td>
        <td>${rarityEmoji(count)}</td>
      </tr>
    `;
  });
}

/* ---------------------------------------------------
   PINT TYPE FINDER (Where to get the cheapest Peroni / etc.)
--------------------------------------------------- */
function renderPintTypeFinder() {
  const name = document.getElementById("pintTypeFinderSelect").value;
  const el = document.getElementById("pintTypeFinderResult");

  if (!name) {
    el.textContent = "Select a pint.";
    return;
  }

  const relevant = prices.filter(p => p.pintName === name);
  if (!relevant.length) {
    el.textContent = "No data yet.";
    return;
  }

  const cheapest = relevant.sort((a, b) => a.price - b.price)[0];
  const pub = pubs.find(p => p.id === cheapest.pubId);

  el.textContent = `Cheapest ${name} is £${cheapest.price.toFixed(2)} at ${pub?.name ?? "Unknown Pub"}`;
}

/* ---------------------------------------------------
   MOBILE NAV SCROLL
--------------------------------------------------- */
document.querySelectorAll(".bottom-nav button").forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.target;
    document.getElementById(target).scrollIntoView({ behavior: "smooth" });
  });
});

/* ---------------------------------------------------
   INIT
--------------------------------------------------- */
function init() {
  console.log("Westminster Pints Exchange Loaded");
}

init();
