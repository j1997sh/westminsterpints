/* ---------------------------------------------------
   FIREBASE SETUP
--------------------------------------------------- */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
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
   GLOBAL STATE
--------------------------------------------------- */
let pubs = [];
let pintNames = [];
let prices = [];

/* ---------------------------------------------------
   LISTENERS
--------------------------------------------------- */
onSnapshot(collection(db, "pubs"), snap => {
  pubs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  refreshUI();
});

onSnapshot(collection(db, "pintNames"), snap => {
  pintNames = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  refreshUI();
});

onSnapshot(collection(db, "prices"), snap => {
  prices = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  refreshUI();
});

/* ---------------------------------------------------
   REFRESH UI
--------------------------------------------------- */
function refreshUI() {
  populateSelectors();
  renderCheapestBanner();
  renderCheapestByName();
  renderPintTypeFinder();
  renderBudgetResults();
  renderLeagueTable();
}

/* ---------------------------------------------------
   SELECT DROPDOWNS
--------------------------------------------------- */
function populateSelectors() {
  const pubSel = document.getElementById("addPintPubSelect");
  const typeSel = document.getElementById("addPintTypeSelect");
  const cheapestSel = document.getElementById("cheapestPintNameSelect");
  const finderSel = document.getElementById("pintTypeFinderSelect");

  if (pubSel) pubSel.innerHTML = pubs
    .map(p => `<option value="${p.id}">${p.name}</option>`).join("");

  if (typeSel) typeSel.innerHTML = pintNames
    .map(p => `<option value="${p.name}">${p.name}</option>`).join("");

  if (cheapestSel) cheapestSel.innerHTML = pintNames
    .map(p => `<option value="${p.name}">${p.name}</option>`).join("");

  if (finderSel) finderSel.innerHTML = pintNames
    .map(p => `<option value="${p.name}">${p.name}</option>`).join("");
}

/* ---------------------------------------------------
   ADD PUB
--------------------------------------------------- */
document.getElementById("addPubBtn").onclick = async () => {
  const name = document.getElementById("newPubNameInput").value.trim();
  if (!name) return showToast("Enter a pub name");

  await addDoc(collection(db, "pubs"), { name });
  document.getElementById("newPubNameInput").value = "";
  showToast("Pub added");
};

/* ---------------------------------------------------
   ADD PINT NAME
--------------------------------------------------- */
document.getElementById("addPintNameBtn").onclick = async () => {
  const name = document.getElementById("newPintNameInput").value.trim();
  if (!name) return showToast("Enter a pint name");

  await addDoc(collection(db, "pintNames"), { name });
  document.getElementById("newPintNameInput").value = "";
  showToast("Pint name added");
};

/* ---------------------------------------------------
   ADD PINT PRICE
--------------------------------------------------- */
document.getElementById("addPintPriceBtn").onclick = async () => {
  const pubId = document.getElementById("addPintPubSelect").value;
  const pintName = document.getElementById("addPintTypeSelect").value;
  const price = Number(document.getElementById("addPintPriceInput").value);

  if (!pubId || !pintName || !price || price <= 0)
    return showToast("Enter all pint details");

  await addDoc(collection(db, "prices"), {
    pubId,
    pintName,
    pintType: "Lager",
    price,
    timestamp: Date.now()
  });

  document.getElementById("addPintPriceInput").value = "";
  showToast("Pint price added");
};

/* ---------------------------------------------------
   CHEAPEST PINT RIGHT NOW
--------------------------------------------------- */
function renderCheapestBanner() {
  const el = document.getElementById("cheapestBannerText");
  if (!prices.length) return el.textContent = "No data yet";

  const cheapest = [...prices].sort((a,b) => a.price - b.price)[0];
  const pub = pubs.find(p => p.id === cheapest.pubId)?.name || "Unknown Pub";

  el.textContent = `£${cheapest.price.toFixed(2)} — ${cheapest.pintName} at ${pub}`;
}

/* ---------------------------------------------------
   CHEAPEST BY PINT NAME
--------------------------------------------------- */
document.getElementById("findCheapestByNameBtn").onclick = renderCheapestByName;

function renderCheapestByName() {
  const name = document.getElementById("cheapestPintNameSelect").value;
  const el = document.getElementById("cheapestByNameResult");

  const list = prices.filter(p => p.pintName === name);
  if (!list.length) return el.textContent = "No data yet";

  const cheapest = list.sort((a,b) => a.price - b.price)[0];
  const pub = pubs.find(p => p.id === cheapest.pubId)?.name || "Unknown Pub";

  el.textContent = `£${cheapest.price.toFixed(2)} at ${pub}`;
}

/* ---------------------------------------------------
   PINT TYPE FINDER (“I want to get the cheapest…”)
--------------------------------------------------- */
document.getElementById("findPintTypeBtn").onclick = renderPintTypeFinder;

function renderPintTypeFinder() {
  const name = document.getElementById("pintTypeFinderSelect").value;
  const el = document.getElementById("pintTypeFinderResult");

  const list = prices.filter(p => p.pintName === name);
  if (!list.length) return el.textContent = "No data yet";

  const cheapest = list.sort((a,b) => a.price - b.price)[0];
  const pub = pubs.find(p => p.id === cheapest.pubId)?.name || "Unknown Pub";

  el.textContent = `Cheapest ${name}: £${cheapest.price.toFixed(2)} at ${pub}`;
}

/* ---------------------------------------------------
   BUDGET HELPER — TOP 3 COMPACT RESULTS
--------------------------------------------------- */
document.getElementById("runBudgetBtn").onclick = renderBudgetResults;

function renderBudgetResults() {
  const budget = Number(document.getElementById("budgetInput").value);
  const box = document.getElementById("budgetResults");

  if (!budget || budget <= 0)
    return box.innerHTML = "Enter a valid budget";

  if (!prices.length) 
    return box.innerHTML = "No data available";

  const deals = prices.map(p => {
    const pub = pubs.find(x => x.id === p.pubId)?.name || "Unknown Pub";
    return {
      pints: Math.floor(budget / p.price),
      price: p.price,
      pub,
      pintName: p.pintName,
      total: Math.floor(budget / p.price) * p.price
    };
  }).filter(x => x.pints > 0);

  if (!deals.length)
    return box.innerHTML = "Budget too low for any pint";

  deals.sort((a,b) => {
    if (b.pints !== a.pints) return b.pints - a.pints;
    return a.total - b.total;
  });

  const top = deals.slice(0,3);

  box.innerHTML = top.map((d,i) => `
    <div class="budget-item">
      <span class="icon">${i===0?"🥇":i===1?"🥈":"🥉"}</span>
      ${d.pints} pints of ${d.pintName} — £${d.total.toFixed(2)}
    </div>
  `).join("");
}

/* ---------------------------------------------------
   LEAGUE TABLE — SORTED CHEAPEST FIRST
--------------------------------------------------- */
function renderLeagueTable() {
  const tbody = document.getElementById("leagueTableBody");
  tbody.innerHTML = "";

  if (!pubs.length || !prices.length) return;

  const pubStats = pubs.map(pub => {
    const ps = prices.filter(p => p.pubId === pub.id);
    if (!ps.length) return null;

    const avg = ps.reduce((a,b)=>a+b.price,0) / ps.length;
    const cheapest = ps.sort((a,b)=>a.price-b.price)[0];

    return {
      pub: pub.name,
      avg,
      cheapest: `${cheapest.pintName} (£${cheapest.price.toFixed(2)})`
    };
  }).filter(x => x !== null);

  pubStats.sort((a,b)=>a.avg - b.avg);

  pubStats.forEach(row => {
    tbody.innerHTML += `
      <tr>
        <td>${row.pub}</td>
        <td>£${row.avg.toFixed(2)}</td>
        <td>${row.cheapest}</td>
      </tr>
    `;
  });
}

/* ---------------------------------------------------
   TOAST MESSAGE
--------------------------------------------------- */
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"), 2000);
}

/* ---------------------------------------------------
   MOBILE NAVIGATION
--------------------------------------------------- */
document.querySelectorAll(".bottom-nav button").forEach(btn => {
  btn.onclick = () => {
    const target = btn.dataset.target;
    document.getElementById(target).scrollIntoView({ behavior: "smooth" });
  };
});
