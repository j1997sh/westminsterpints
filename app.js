import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, onSnapshot, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ---------------------------------------------------
   FIREBASE INIT
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

let pubs = [];
let prices = [];
let admin = false;

/* ---------------------------------------------------
   LISTENERS
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

  if (!name) return;

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
  const type = document.getElementById("pintTypeSelect").value;
  const price = parseFloat(document.getElementById("pintPriceInput").value);

  if (!pubId || !price) return;

  await addDoc(collection(db, "prices"), {
    pubId,
    type,
    price,
    timestamp: Date.now()
  });

  document.getElementById("pintPriceInput").value = "";
};

/* ---------------------------------------------------
   REFRESH UI
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

/* Fill dropdown */
function populatePubSelect() {
  const sel = document.getElementById("pintPubSelect");
  sel.innerHTML = pubs.map(p => `<option value="${p.id}">${p.name}</option>`).join("");
}

/* COMPUTE avgPrice, trend, volatility */
function computePubStats() {
  pubs.forEach(pub => {
    const entries = prices.filter(p => p.pubId === pub.id);

    if (entries.length === 0) return;

    /* Average */
    pub.avgPrice = entries.reduce((a,b)=>a+b.price,0) / entries.length;

    /* Trend (24h) */
    const now = Date.now();
    const dayOld = entries.filter(e => now - e.timestamp < 86400000);

    if (dayOld.length > 1) {
      const first = dayOld[0].price;
      const last = dayOld[dayOld.length - 1].price;
      pub.trendPercent24 = ((last - first) / first) * 100;
    }

    /* Volatility */
    const values = entries.slice(-10).map(e=>e.price);
    if (values.length > 1) {
      const avg = values.reduce((a,b)=>a+b,0)/values.length;
      const variance = values.reduce((a,b)=>a+(b-avg)**2,0)/values.length;
      pub.volatility = Math.sqrt(variance);
    }
  });
}

/* PINX */
function renderPINX() {
  if (pubs.length === 0) return;
  const avg = pubs.reduce((a,b)=>a+b.avgPrice,0) / pubs.length;
  const pinx = Math.round(avg * 100);
  document.getElementById("pinxValue").innerText = pinx;
}

/* Cheapest Pint */
function renderCheapest() {
  if (pubs.length === 0) return;
  const sorted = [...pubs].sort((a,b)=>a.avgPrice - b.avgPrice);
  const p = sorted[0];
  document.getElementById("cheapestValue").innerHTML =
    `£${p.avgPrice.toFixed(2)} at ${p.name}`;
}

/* League Table */
function renderLeague() {
  const mode = document.getElementById("leagueMode").value;
  let arr = [...pubs];

  if (mode === "cheapest") arr.sort((a,b)=>a.avgPrice - b.avgPrice);
  if (mode === "drops") arr.sort((a,b)=>a.trendPercent24 - b.trendPercent24);
  if (mode === "rises") arr.sort((a,b)=>b.trendPercent24 - a.trendPercent24);
  if (mode === "volatile") arr.sort((a,b)=>b.volatility - a.volatility);

  const tbody = document.querySelector("#leagueTable tbody");
  tbody.innerHTML = arr.map(pub => `
    <tr>
      <td>${pub.name}</td>
      <td>£${pub.avgPrice.toFixed(2)}</td>
      <td>${pub.trendPercent24.toFixed(1)}%</td>
      <td><canvas class="spark" id="spark-${pub.id}"></canvas></td>
    </tr>
  `).join("");

  arr.forEach(pub => drawSpark(pub.id));
}

/* Sparkline */
function drawSpark(pubId) {
  const canvas = document.getElementById(`spark-${pubId}`);
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const arr = prices.filter(p=>p.pubId===pubId)
                    .sort((a,b)=>a.timestamp - b.timestamp)
                    .slice(-10)
                    .map(p=>p.price);

  if (arr.length < 2) return;

  const max = Math.max(...arr);
  const min = Math.min(...arr);
  const w = canvas.width, h = canvas.height;

  ctx.beginPath();
  ctx.strokeStyle = "#0077cc";

  arr.forEach((v,i)=>{
    const x = (i/(arr.length-1)) * w;
    const y = h - ((v-min)/(max-min)) * h;
    if (i===0) ctx.moveTo(x,y);
    else ctx.lineTo(x,y);
  });

  ctx.stroke();
}

/* Good Investments */
function renderGoodInvestments() {
  if (pubs.length === 0) return;

  const globalAvg = pubs.reduce((a,b)=>a+b.avgPrice,0) / pubs.length;
  const list = pubs.filter(p =>
    p.avgPrice < globalAvg && p.trendPercent24 < -2
  );

  const div = document.getElementById("goodInvestments");
  if (list.length === 0) {
    div.innerHTML = "No good opportunities right now.";
    return;
  }

  div.innerHTML = list.map(p =>
    `${p.name} — £${p.avgPrice.toFixed(2)} (↓ ${p.trendPercent24.toFixed(1)}%)`
  ).join("<br>");
}

/* Full Pub List */
function renderPubList() {
  const div = document.getElementById("pubList");
  div.innerHTML = pubs.map(p =>
    `${p.name} — £${p.avgPrice.toFixed(2)}`
  ).join("<br>");
}

/* Admin mode */
document.getElementById("adminToggle").onclick = () => {
  admin = !admin;
  document.getElementById("adminToggle").innerText = admin ? "Admin: ON" : "Admin: OFF";
  document.getElementById("adminPanel").style.display = admin ? "block" : "none";
};

function renderAdmin() {
  if (!admin) return;
  document.getElementById("adminContent").innerText = JSON.stringify(pubs, null, 2);
}
