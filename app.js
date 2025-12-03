/* ---------------------------------------------------
   FIREBASE IMPORTS
--------------------------------------------------- */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ---------------------------------------------------
   FIREBASE CONFIG
--------------------------------------------------- */
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
   STATE VARIABLES
--------------------------------------------------- */
let pubs = [];
let prices = [];
let admin = false;
let filterType = "all";
let leagueFilterType = "all";
let previousCheapest = null;

/* Budget (localStorage) */
let userBudget = localStorage.getItem("budget") || null;
let userMaxPrice = localStorage.getItem("maxPrice") || null;

/* ---------------------------------------------------
   FIRESTORE LISTENERS
--------------------------------------------------- */
onSnapshot(collection(db, "pubs"), snap => {
  pubs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  refreshUI();
});
onSnapshot(collection(db, "prices"), snap => {
  prices = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  refreshUI();
});

/* ---------------------------------------------------
   ADD PINT
--------------------------------------------------- */
document.getElementById("addPintBtn").onclick = async () => {
  const pubId = document.getElementById("pintPubSelect").value;
  const pintName = document.getElementById("pintNameInput").value;
  const type = document.getElementById("pintTypeSelect").value;
  const price = parseFloat(document.getElementById("pintPriceInput").value);

  if (!pubId || !pintName || !price) return alert("Missing fields");

  await addDoc(collection(db, "prices"), {
    pubId, pintName, type, price,
    timestamp: Date.now()
  });

  document.getElementById("pintNameInput").value = "";
  document.getElementById("pintPriceInput").value = "";
};

/* ---------------------------------------------------
   ADD PUB
--------------------------------------------------- */
document.getElementById("addPubBtn").onclick = async () => {
  const name = document.getElementById("pubNameInput").value;
  if (!name) return;

  await addDoc(collection(db, "pubs"], {
    name,
    avgPrice: 0,
    trendPercent24: 0
  });

  document.getElementById("pubNameInput").value = "";
};

/* ---------------------------------------------------
   LEAGUE FILTER
--------------------------------------------------- */
document.getElementById("leagueFilter").onchange = e => {
  leagueFilterType = e.target.value;
  refreshUI();
};

/* ---------------------------------------------------
   BUDGET HELPER
--------------------------------------------------- */
document.getElementById("saveBudgetBtn").onclick = () => {
  const b = document.getElementById("budgetInput").value;
  const m = document.getElementById("maxPriceInput").value;

  if (!b || !m) return;

  userBudget = b;
  userMaxPrice = m;

  localStorage.setItem("budget", b);
  localStorage.setItem("maxPrice", m);

  renderBudgetHelper();
};

/* ---------------------------------------------------
   ADMIN PANEL
--------------------------------------------------- */
document.getElementById("adminToggle").onclick = () => {
  admin = !admin;
  document.getElementById("adminToggle").innerText =
    admin ? "⚙️ Admin: ON" : "⚙️ Admin: OFF";
  document.getElementById("adminPanel").style.display =
    admin ? "block" : "none";
  refreshUI();
};

/* ---------------------------------------------------
   MAIN UI REFRESH
--------------------------------------------------- */
function refreshUI() {
  populatePubSelect();
  computePubStats();
  renderPINX();
  renderCheapestTop();
  renderPollingIntent();
  renderMiniStats();
  renderBudgetHelper();
  renderPubTiles();
  renderRecentFeed();
  renderGoodInvestments();
  renderAdmin();
}

/* ---------------------------------------------------
   POPULATE PUB SELECT
--------------------------------------------------- */
function populatePubSelect() {
  const sel = document.getElementById("pintPubSelect");
  sel.innerHTML = pubs.map(p => `<option value="${p.id}">${p.name}</option>`).join("");
}

/* ---------------------------------------------------
   COMPUTE PUB METRICS
--------------------------------------------------- */
function computePubStats() {
  pubs.forEach(pub => {
    let entries = prices.filter(p => p.pubId === pub.id);

    if (!entries.length) {
      pub.avgPrice = 0;
      pub.trendPercent24 = 0;
      pub.activity = 0;
      return;
    }

    pub.avgPrice =
      entries.reduce((a,b)=>a+b.price,0) / entries.length;

    const now = Date.now();
    const day = entries.filter(e => now - e.timestamp < 86400000);

    if (day.length > 1) {
      const first = day[0].price;
      const last = day[day.length - 1].price;
      pub.trendPercent24 = ((last - first) / first) * 100;
    } else pub.trendPercent24 = 0;

    pub.activity = day.length;
  });
}

/* ---------------------------------------------------
   PINX INDEX
--------------------------------------------------- */
function renderPINX() {
  if (!pubs.length) return;
  const avg = pubs.reduce((a,b)=>a+b.avgPrice,0) / pubs.length;
  document.getElementById("pinxValue").innerText = Math.round(avg * 100);
}

/* ---------------------------------------------------
   CHEAPEST PINT + TOAST ALERT
--------------------------------------------------- */
function renderCheapestTop() {
  const valid = pubs.filter(p => p.avgPrice > 0);
  if (!valid.length) return;

  const c = valid.sort((a,b)=>a.avgPrice - b.avgPrice)[0];

  document.getElementById("cheapestTop").innerHTML =
    `£${c.avgPrice.toFixed(2)} at ${c.name}`;

  if (previousCheapest && previousCheapest !== c.name) {
    showToast(`🎉 New Cheapest Pint! ${c.name} at £${c.avgPrice.toFixed(2)}`);
  }

  previousCheapest = c.name;
}

/* ---------------------------------------------------
   TOAST FUNCTION
--------------------------------------------------- */
function showToast(msg) {
  const t = document.getElementById("flashToast");
  t.innerText = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3500);
}

/* ---------------------------------------------------
   POLLING INTENT
--------------------------------------------------- */
function renderPollingIntent() {
  const div = document.getElementById("pollingBars");
  const lead = document.getElementById("pollingLeader");

  let recent = [...prices]
    .sort((a,b)=>b.timestamp - a.timestamp)
    .slice(0,30);

  const types = ["Lager","Ale","IPA","Guinness","Cider"];

  let counts = {};
  types.forEach(t => counts[t] = 0);

  recent.forEach(r => counts[r.type]++);

  const total = recent.length || 1;

  div.innerHTML = types.map(t => {
    const pct = (counts[t] / total) * 100;
    return `
      <div class="poll-bar">
        <div class="poll-fill" style="width:${pct}%; background:var(--blue)"></div>
        <span class="poll-type-label">${t}</span>
        <span class="poll-percent">${pct.toFixed(0)}%</span>
      </div>
    `;
  }).join("");

  const leading = types.sort((a,b)=>counts[b]-counts[a])[0];
  lead.innerText = `${leading} leads the pint polls today.`;
}

/* ---------------------------------------------------
   MINI STATS
--------------------------------------------------- */
function renderMiniStats() {
  const div = document.getElementById("miniStatsContent");

  let valid = pubs.filter(p=>p.avgPrice>0);
  if (!valid.length) {
    div.innerHTML = "Not enough data.";
    return;
  }

  const avg = valid.reduce((a,b)=>a+b.avgPrice,0) / valid.length;
  const cheapest = valid.sort((a,b)=>a.avgPrice - b.avgPrice)[0];
  const active = valid.sort((a,b)=>b.activity - a.activity)[0];

  div.innerHTML = `
    <div class="mini-stat"><strong>Avg Price:</strong> £${avg.toFixed(2)}</div>
    <div class="mini-stat"><strong>Cheapest Pub:</strong> ${cheapest.name}</div>
    <div class="mini-stat"><strong>Most Active:</strong> ${active.name}</div>
  `;
}

/* ---------------------------------------------------
   BUDGET HELPER
--------------------------------------------------- */
function renderBudgetHelper() {
  const div = document.getElementById("budgetResults");
  if (!userBudget || !userMaxPrice) {
    div.innerHTML = "Set your budget above.";
    return;
  }

  let affordable = pubs.filter(p =>
    p.avgPrice > 0 &&
    p.avgPrice <= userMaxPrice
  );

  if (!affordable.length) {
    div.innerHTML = "No affordable pints under your max price.";
    return;
  }

  div.innerHTML = `
    <strong>Affordable Pubs:</strong><br>
    ${affordable.map(p=>`${p.name} (£${p.avgPrice.toFixed(2)})`).join("<br>")}
  `;
}

/* ---------------------------------------------------
   PUB TILES
--------------------------------------------------- */
function trendColor(v) {
  if (v < 0) return "var(--green)";
  if (v > 0) return "var(--red)";
  return "#ccc";
}

function renderPubTiles() {
  const mode = document.getElementById("leagueMode").value;
  let list = pubs.filter(p => p.avgPrice > 0);

  if (leagueFilterType !== "all") {
    list = list.filter(pub =>
      prices.some(pr => pr.pubId === pub.id && pr.type === leagueFilterType)
    );
  }

  if (mode === "cheapest") list.sort((a,b)=>a.avgPrice - b.avgPrice);
  if (mode === "drops") list.sort((a,b)=>a.trendPercent24 - b.trendPercent24);
  if (mode === "rises") list.sort((a,b)=>b.trendPercent24 - a.trendPercent24);

  const container = document.getElementById("pubTiles");

  container.innerHTML = list.map(pub => `
    <div class="pub-tile" style="border-left-color:${trendColor(pub.trendPercent24)}">

      <div class="pub-header">
        <span>${pub.name}</span>
        <span>£${pub.avgPrice.toFixed(2)}</span>
      </div>

      <div class="pub-badges">${pubBadges(pub)}</div>

      <div>
        <canvas class="spark" id="spark-${pub.id}"></canvas>
      </div>

    </div>
  `).join("");

  list.forEach(pub => drawSpark(pub.id));
}

function pubBadges(pub) {
  let b = [];
  if (pub.avgPrice < 5) b.push("⭐ Cheap");
  if (pub.trendPercent24 < -3) b.push("📉 Dropping");
  if (pub.trendPercent24 > 3) b.push("📈 Rising");
  return b.join(" • ") || "—";
}

/* ---------------------------------------------------
   SPARKLINES
--------------------------------------------------- */
function drawSpark(pubId) {
  const canvas = document.getElementById(`spark-${pubId}`);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let pts = prices
    .filter(p => p.pubId === pubId)
    .sort((a,b)=>a.timestamp - b.timestamp)
    .slice(-20);

  if (pts.length < 2) return;

  const values = pts.map(p => p.price);
  const max = Math.max(...values);
  const min = Math.min(...values);

  const rising = values.at(-1) >= values[0];
  ctx.strokeStyle = rising ? "var(--green)" : "var(--red)";

  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.beginPath();

  values.forEach((v,i)=>{
    const x = (i/(values.length-1)) * canvas.width;
    const y = canvas.height - ((v - min)/(max - min)) * canvas.height;
    i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  });

  ctx.stroke();
}

/* ---------------------------------------------------
   RECENT FEED
--------------------------------------------------- */
function renderRecentFeed() {
  const div = document.getElementById("recentFeedContent");

  let recent = [...prices]
    .sort((a,b)=>b.timestamp - a.timestamp)
    .slice(0,8);

  div.innerHTML = recent.map(r => {
    const pub = pubs.find(p => p.id === r.pubId)?.name || "Unknown Pub";
    return `
      <div class="feed-entry">
        ${r.pintName} @ ${pub} (£${r.price.toFixed(2)})
      </div>
    `;
  }).join("");
}

/* ---------------------------------------------------
   GOOD INVESTMENTS
--------------------------------------------------- */
function renderGoodInvestments() {
  const div = document.getElementById("goodInvestments");

  const good = pubs.filter(p =>
    p.avgPrice > 0 &&
    p.trendPercent24 < -2
  );

  if (!good.length) {
    div.innerHTML = "No good opportunities right now.";
    return;
  }

  div.innerHTML = good.map(p =>
    `💡 <b>${p.name}</b> — £${p.avgPrice.toFixed(2)} (↓ ${Math.abs(p.trendPercent24).toFixed(1)}%)`
  ).join("<br>");
}

/* ---------------------------------------------------
   ADMIN PANEL
--------------------------------------------------- */
function renderAdmin() {
  if (!admin) return;

  document.getElementById("adminContent").innerHTML =
    `<pre>${JSON.stringify({ pubs, prices }, null, 2)}</pre>`;
}
