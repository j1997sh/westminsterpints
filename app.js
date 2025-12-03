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
  appId: "1:913960848966:web:df6355a6b5b25dbdc5c447"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ---------------------------------------------------
   GLOBAL STATE
--------------------------------------------------- */
let pubs = [];
let prices = [];
let admin = false;
let filterType = "all";

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
   ADD PUB
--------------------------------------------------- */
document.getElementById("addPubBtn").onclick = async () => {
  const name = document.getElementById("pubNameInput").value;
  const category = document.getElementById("pubCategoryInput").value;

  if (!name) return alert("Enter pub name");

  await addDoc(collection(db, "pubs"), {
    name,
    category,
    avgPrice: 0,
    trendPercent24: 0,
    volatility: 0
  });

  document.getElementById("pubNameInput").value = "";
};

/* ---------------------------------------------------
   ADD PINT PRICE
--------------------------------------------------- */
document.getElementById("addPintBtn").onclick = async () => {
  const pubId = document.getElementById("pintPubSelect").value;
  const pintName = document.getElementById("pintNameInput").value;
  const type = document.getElementById("pintTypeSelect").value;
  const price = parseFloat(document.getElementById("pintPriceInput").value);

  if (!pubId || !price || !pintName)
    return alert("Enter pint name and price");

  await addDoc(collection(db, "prices"), {
    pubId, pintName, type, price,
    timestamp: Date.now()
  });

  document.getElementById("pintNameInput").value = "";
  document.getElementById("pintPriceInput").value = "";
};

/* ---------------------------------------------------
   FILTER
--------------------------------------------------- */
document.getElementById("filterType").onchange = e => {
  filterType = e.target.value;
  refreshUI();
};

/* ---------------------------------------------------
   ADMIN MODE
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
   UI UPDATE
--------------------------------------------------- */
function refreshUI() {
  populatePubSelect();
  computePubStats();
  renderPINX();
  renderCheapestTop();
  renderGoodInvestments();
  renderPubTiles();
  renderAdmin();
}

/* ---------------------------------------------------
   POPULATE SELECT
--------------------------------------------------- */
function populatePubSelect() {
  document.getElementById("pintPubSelect").innerHTML =
    pubs.map(p => `<option value="${p.id}">${p.name}</option>`).join("");
}

/* ---------------------------------------------------
   COMPUTE PUB STATS (avg, trend, vol)
--------------------------------------------------- */
function computePubStats() {
  pubs.forEach(pub => {

    let entries = prices.filter(p => p.pubId === pub.id);

    if (filterType !== "all")
      entries = entries.filter(e => e.type === filterType);

    if (entries.length === 0) {
      pub.avgPrice = 0;
      pub.trendPercent24 = 0;
      pub.volatility = 0;
      return;
    }

    pub.avgPrice =
      entries.reduce((a,b)=>a+b.price,0) / entries.length;

    const now = Date.now();
    const lastDay = entries.filter(
      e => now - e.timestamp < 86400000
    );

    if (lastDay.length > 1) {
      const first = lastDay[0].price;
      const last = lastDay[lastDay.length - 1].price;
      pub.trendPercent24 = ((last - first) / first) * 100;
    }

    const last10 = entries.slice(-10).map(e => e.price);
    if (last10.length > 1) {
      const avg = last10.reduce((a,b)=>a+b,0) / last10.length;
      const variance = last10.reduce((a,b)=>a + (b-avg)**2, 0) / last10.length;
      pub.volatility = Math.sqrt(variance);
    }
  });
}

/* ---------------------------------------------------
   PINX
--------------------------------------------------- */
function renderPINX() {
  if (!pubs.length) return;
  const avg = pubs.reduce((a,b)=>a+b.avgPrice,0) / pubs.length;
  document.getElementById("pinxValue").textContent = Math.round(avg*100);
}

/* ---------------------------------------------------
   CHEAPEST PINT AT TOP
--------------------------------------------------- */
function renderCheapestTop() {
  const valid = pubs.filter(p => p.avgPrice > 0);
  if (!valid.length) return;
  const cheapest = valid.sort((a,b)=>a.avgPrice - b.avgPrice)[0];
  document.getElementById("cheapestTop").innerHTML =
    `£${cheapest.avgPrice.toFixed(2)} at ${cheapest.name}`;
}

/* ---------------------------------------------------
   PUB BADGES LOGIC
--------------------------------------------------- */
function pubBadges(pub) {
  let badges = [];

  if (pub.avgPrice && pub.avgPrice < 5) badges.push("⭐ Cheap");

  if (pub.trendPercent24 < -3) badges.push("📉 Dropping");
  if (pub.trendPercent24 > 3)  badges.push("📈 Rising");

  if (pub.volatility > 0.3) badges.push("🔔 Volatile");

  return badges.join(" • ") || "—";
}

/* ---------------------------------------------------
   RENDER PUB TILES (COLLAPSIBLE)
--------------------------------------------------- */
function renderPubTiles() {
  const mode = document.getElementById("leagueMode").value;
  let list = pubs.filter(p => p.avgPrice > 0);

  if (mode === "cheapest") list.sort((a,b)=>a.avgPrice - b.avgPrice);
  if (mode === "drops")    list.sort((a,b)=>a.trendPercent24 - b.trendPercent24);
  if (mode === "rises")    list.sort((a,b)=>b.trendPercent24 - a.trendPercent24);
  if (mode === "volatile") list.sort((a,b)=>b.volatility - a.volatility);

  document.getElementById("pubTiles").innerHTML = list.map(pub => `
    <div class="pub-tile" onclick="toggleTile('${pub.id}')">
      <div class="pub-header">
        <span>${pub.name}</span>
        <span>£${pub.avgPrice.toFixed(2)}</span>
      </div>
      <div class="pub-badges">${pubBadges(pub)}</div>

      <div id="tile-${pub.id}" style="display:none;">
        <div><strong>24h:</strong> ${trendFormat(pub.trendPercent24)}</div>
        <canvas class="spark" id="spark-${pub.id}"></canvas>
      </div>
    </div>
  `).join("");

  list.forEach(pub => drawSpark(pub.id));
}

/* ---------------------------------------------------
   COLLAPSE HANDLER
--------------------------------------------------- */
window.toggleTile = (id) => {
  const el = document.getElementById("tile-" + id);
  el.style.display = el.style.display === "none" ? "block" : "none";
};

/* ---------------------------------------------------
   TREND FORMAT
--------------------------------------------------- */
function trendFormat(v) {
  if (v > 0) return `<span style="color:red;">▲ ${v.toFixed(1)}%</span>`;
  if (v < 0) return `<span style="color:green;">▼ ${Math.abs(v).toFixed(1)}%</span>`;
  return `<span style="color:grey;">→ 0%</span>`;
}

/* ---------------------------------------------------
   SPARKLINES
--------------------------------------------------- */
function drawSpark(pubId) {
  const canvas = document.getElementById(`spark-${pubId}`);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let arr = prices
    .filter(p => p.pubId === pubId)
    .sort((a,b)=>a.timestamp - b.timestamp)
    .slice(-20);

  if (filterType !== "all")
    arr = arr.filter(e => e.type === filterType);

  if (arr.length < 2) return;

  const values = arr.map(p => p.price);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const rise = values.at(-1) >= values[0];

  ctx.strokeStyle = rise ? "#0a0" : "#c00";
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.beginPath();
  values.forEach((v,i)=>{
    const x = (i/(values.length-1)) * canvas.width;
    const y = canvas.height - ((v-min)/(max-min)) * canvas.height;
    if (i===0) ctx.moveTo(x,y);
    else ctx.lineTo(x,y);
  });
  ctx.stroke();
}

/* ---------------------------------------------------
   GOOD INVESTMENTS
--------------------------------------------------- */
function renderGoodInvestments() {
  if (!pubs.length) return;

  const globalAvg =
    pubs.reduce((a,b)=>a+b.avgPrice,0) / pubs.length;

  const good = pubs.filter(p =>
    p.avgPrice < globalAvg &&
    p.trendPercent24 < -2
  );

  const div = document.getElementById("goodInvestments");

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
  document.getElementById("adminContent").innerHTML = `
    <pre>${JSON.stringify({ pubs, prices }, null, 2)}</pre>
  `;
}
