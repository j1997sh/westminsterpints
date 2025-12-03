/* ---------------------------------------------------
   FIREBASE IMPORTS
--------------------------------------------------- */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ---------------------------------------------------
   FIREBASE CONFIG
--------------------------------------------------- */
const firebaseConfig = {
  apiKey: "AIzaSyBHUGgt8F4OQJjdx11qOMPC0iRJGFZmU8E",
  authDomain: "westminsterpints.firebaseapp.com",
  projectId: "westminsterpints",
  storageBucket: "westminsterpints.appspot.com",
  messagingSenderId: "913960848966",
  appId: "1:913960848966:web:df6355a6b5b25dbdc5c447",
  measurementId: "G-E9SNYKYEBN"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ---------------------------------------------------
   GLOBAL STATE
--------------------------------------------------- */
let pubs = [];
let prices = [];
let admin = false;
let filterType = "all"; // Pint type filter: all / Lager / Ale / IPA / Guinness / Cider

/* ---------------------------------------------------
   FIRESTORE LIVE LISTENERS
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
   EVENT HANDLERS
--------------------------------------------------- */

// Add pub
document.getElementById("addPubBtn").onclick = async () => {
  const name = document.getElementById("pubNameInput").value;
  const category = document.getElementById("pubCategoryInput").value;

  if (!name) return alert("Enter a pub name");

  await addDoc(collection(db, "pubs"), {
    name,
    category,
    avgPrice: 0,
    trendPercent24: 0,
    volatility: 0
  });

  document.getElementById("pubNameInput").value = "";
};

// Add pint
document.getElementById("addPintBtn").onclick = async () => {
  const pubId = document.getElementById("pintPubSelect").value;
  const type = document.getElementById("pintTypeSelect").value;
  const price = parseFloat(document.getElementById("pintPriceInput").value);

  if (!pubId || !price) return alert("Select a pub and enter a price");

  await addDoc(collection(db, "prices"), {
    pubId,
    type,
    price,
    timestamp: Date.now()
  });

  document.getElementById("pintPriceInput").value = "";
};

// Pint type filter
document.getElementById("filterType").onchange = (e) => {
  filterType = e.target.value;
  refreshUI();
};

// Admin toggle
document.getElementById("adminToggle").onclick = () => {
  admin = !admin;
  document.getElementById("adminToggle").innerText = admin ? "⚙️ Admin: ON" : "⚙️ Admin: OFF";
  document.getElementById("adminPanel").style.display = admin ? "block" : "none";
  refreshUI();
};

/* ---------------------------------------------------
   UI REFRESH
--------------------------------------------------- */
function refreshUI() {
  populatePubSelect();
  computePubStats();
  renderPINX();
  renderCheapest();
  renderLeague();
  renderGoodInvestments();
  renderPubList();
  renderAdmin();
}

/* ---------------------------------------------------
   POPULATE PUB SELECT DROPDOWN
--------------------------------------------------- */
function populatePubSelect() {
  const sel = document.getElementById("pintPubSelect");
  sel.innerHTML = pubs.map(p => `<option value="${p.id}">${p.name}</option>`).join("");
}

/* ---------------------------------------------------
   COMPUTE PUB STATS
   - avgPrice
   - trendPercent24
   - volatility
   - applies pint type filters
--------------------------------------------------- */
function computePubStats() {

  pubs.forEach(pub => {

    let entries = prices.filter(p => p.pubId === pub.id);

    // Apply pint-type filtering
    if (filterType !== "all") {
      entries = entries.filter(e => e.type === filterType);
    }

    if (entries.length === 0) {
      pub.avgPrice = 0;
      pub.trendPercent24 = 0;
      pub.volatility = 0;
      return;
    }

    /* ---- AVG PRICE ---- */
    pub.avgPrice = entries.reduce((a,b)=>a+b.price,0) / entries.length;

    /* ---- TREND (24h) ---- */
    const now = Date.now();
    const lastDay = entries.filter(e => now - e.timestamp < 86400000);

    if (lastDay.length > 1) {
      const first = lastDay[0].price;
      const last = lastDay[lastDay.length - 1].price;
      pub.trendPercent24 = ((last - first) / first) * 100;
    } else {
      pub.trendPercent24 = 0;
    }

    /* ---- VOLATILITY ---- */
    const values = entries.slice(-10).map(e => e.price);
    if (values.length > 1) {
      const avg = values.reduce((a,b)=>a+b,0) / values.length;
      const variance = values.reduce((a,b)=>a + (b - avg) ** 2, 0) / values.length;
      pub.volatility = Math.sqrt(variance);
    } else {
      pub.volatility = 0;
    }
  });
}

/* ---------------------------------------------------
   PINX INDEX
--------------------------------------------------- */
function renderPINX() {
  if (pubs.length === 0) return;
  const avg = pubs.reduce((a,b)=>a+b.avgPrice,0) / pubs.length;
  document.getElementById("pinxValue").innerText = Math.round(avg * 100);
}

/* ---------------------------------------------------
   CHEAPEST PINT
--------------------------------------------------- */
function renderCheapest() {
  const valid = pubs.filter(p => p.avgPrice > 0);
  if (valid.length === 0) return;
  const p = valid.sort((a,b)=>a.avgPrice - b.avgPrice)[0];
  document.getElementById("cheapestValue").innerHTML =
    `£${p.avgPrice.toFixed(2)} at ${p.name}`;
}

/* ---------------------------------------------------
   LEAGUE TABLE
--------------------------------------------------- */
function renderLeague() {
  const mode = document.getElementById("leagueMode").value;
  let arr = pubs.filter(p => p.avgPrice > 0);

  if (mode === "cheapest") arr.sort((a,b)=>a.avgPrice - b.avgPrice);
  if (mode === "drops") arr.sort((a,b)=>a.trendPercent24 - b.trendPercent24);
  if (mode === "rises") arr.sort((a,b)=>b.trendPercent24 - a.trendPercent24);
  if (mode === "volatile") arr.sort((a,b)=>b.volatility - a.volatility);

  const tbody = document.querySelector("#leagueTable tbody");
  tbody.innerHTML = arr.map(pub => `
    <tr>
      <td>${pub.name}</td>
      <td>£${pub.avgPrice.toFixed(2)}</td>
      <td>${trendCell(pub.trendPercent24)}</td>
      <td><canvas class="spark" id="spark-${pub.id}"></canvas></td>
    </tr>
  `).join("");

  arr.forEach(pub => drawSpark(pub.id));
}

/* Helper: trend display with arrows + colors */
function trendCell(value) {
  if (value > 0) return `<span style="color:red;">▲ ${value.toFixed(1)}%</span>`;
  if (value < 0) return `<span style="color:green;">▼ ${Math.abs(value).toFixed(1)}%</span>`;
  return `<span style="color:grey;">→ 0%</span>`;
}

/* ---------------------------------------------------
   SPARKLINE DRAWING (with rising/falling colour)
--------------------------------------------------- */
function drawSpark(pubId) {

  const canvas = document.getElementById(`spark-${pubId}`);
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let arr = prices
    .filter(p => p.pubId === pubId)
    .sort((a,b)=>a.timestamp - b.timestamp)
    .slice(-10);

  // Apply pint-type filtering
  if (filterType !== "all") {
    arr = arr.filter(p => p.type === filterType);
  }

  if (arr.length < 2) return;

  const values = arr.map(p => p.price);
  const max = Math.max(...values);
  const min = Math.min(...values);

  const rising = values[values.length - 1] >= values[0];
  ctx.strokeStyle = rising ? "#0a0" : "#c00";

  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0,0,w,h);
  ctx.beginPath();

  values.forEach((v,i)=>{
    const x = (i/(values.length-1)) * w;
    const y = h - ((v-min) / (max-min)) * h;
    if (i === 0) ctx.moveTo(x,y);
    else ctx.lineTo(x,y);
  });

  ctx.stroke();
}

/* ---------------------------------------------------
   GOOD INVESTMENTS: avg below global + trending down
--------------------------------------------------- */
function renderGoodInvestments() {
  if (pubs.length === 0) return;

  const globalAvg = pubs.reduce((a,b)=>a+b.avgPrice,0) / pubs.length;
  const list = pubs.filter(p =>
    p.avgPrice > 0 &&
    p.avgPrice < globalAvg &&
    p.trendPercent24 < -2
  );

  const div = document.getElementById("goodInvestments");

  if (list.length === 0) {
    div.innerHTML = "No good opportunities right now.";
    return;
  }

  div.innerHTML = list.map(p =>
    `💡 <strong>${p.name}</strong> — £${p.avgPrice.toFixed(2)} (↓ ${Math.abs(p.trendPercent24).toFixed(1)}%)`
  ).join("<br>");
}

/* ---------------------------------------------------
   FULL PUB LIST
--------------------------------------------------- */
function renderPubList() {
  const div = document.getElementById("pubList");
  div.innerHTML = pubs
    .map(p => `${p.name} — £${p.avgPrice.toFixed(2)}`)
    .join("<br>");
}

/* ---------------------------------------------------
   ADMIN PANEL
--------------------------------------------------- */
function renderAdmin() {
  if (!admin) return;
  const box = document.getElementById("adminContent");
  box.innerHTML = `
    <h3>Pubs</h3>
    <pre>${JSON.stringify(pubs, null, 2)}</pre>
    <h3>Prices</h3>
    <pre>${JSON.stringify(prices, null, 2)}</pre>
  `;
}
