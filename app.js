import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCxzyuAS...YOUR KEY...",
  authDomain: "westminsterpints.firebaseapp.com",
  projectId: "westminsterpints",
  storageBucket: "westminsterpints.appspot.com",
  messagingSenderId: "000000000",
  appId: "1:000000000:web:000000000"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let pubs = [];
let prices = [];
let pintNames = [];

// -----------------------------------------------------
// LOAD DATA
// -----------------------------------------------------
async function loadAll() {
  pubs = await loadCollection("pubs");
  prices = await loadCollection("prices");
  pintNames = await loadCollection("pintNames");

  refreshUI();
}

async function loadCollection(name) {
  const snap = await getDocs(collection(db, name));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// -----------------------------------------------------
// REFRESH EVERYTHING
// -----------------------------------------------------
function refreshUI() {
  renderCheapestPint();
  populateAddPintPrice();
  populatePintFinder();
  renderLeague();
}

// -----------------------------------------------------
// CHEAPEST PINT RIGHT NOW
// -----------------------------------------------------
function renderCheapestPint() {
  if (prices.length === 0) {
    document.getElementById("cheapestPintText").textContent =
      "No prices yet.";
    return;
  }

  const cheapest = prices.reduce((a, b) => (a.price < b.price ? a : b));
  const pub = pubs.find(p => p.id === cheapest.pubId);

  document.getElementById("cheapestPintText").textContent =
    `£${cheapest.price.toFixed(2)} (${cheapest.pintName}) at ${pub?.name || "Unknown"}`;
}

// -----------------------------------------------------
// POPULATE SELECT OPTIONS
// -----------------------------------------------------
function populateAddPintPrice() {
  const pubSelect = document.getElementById("addPintPricePub");
  const nameSelect = document.getElementById("addPintPriceName");

  pubSelect.innerHTML = pubs.map(p => `<option value="${p.id}">${p.name}</option>`).join("");
  nameSelect.innerHTML = pintNames.map(n => `<option>${n.name}</option>`).join("");
}

function populatePintFinder() {
  const el = document.getElementById("pintTypeFinder");
  el.innerHTML = pintNames.map(n => `<option>${n.name}</option>`).join("");
}

// -----------------------------------------------------
// ADD FUNCTIONS
// -----------------------------------------------------
window.addPintPrice = async function () {
  const pubId = document.getElementById("addPintPricePub").value;
  const pintName = document.getElementById("addPintPriceName").value;
  const price = Number(document.getElementById("addPintPriceValue").value);

  if (!price) return alert("Enter a valid price");

  await addDoc(collection(db, "prices"), {
    pintName,
    pintType: "Lager",
    price,
    pubId,
    timestamp: Date.now()
  });

  await loadAll();
};

window.addPintName = async function () {
  const name = document.getElementById("newPintName").value.trim();
  if (!name) return;
  await addDoc(collection(db, "pintNames"), { name });
  await loadAll();
};

window.addPub = async function () {
  const name = document.getElementById("newPubName").value.trim();
  if (!name) return;
  await addDoc(collection(db, "pubs"), { name, category: "Westminster" });
  await loadAll();
};

// -----------------------------------------------------
// PINT TYPE FINDER
// -----------------------------------------------------
window.findCheapestPintType = function () {
  const type = document.getElementById("pintTypeFinder").value;
  const matches = prices.filter(p => p.pintName === type);
  if (matches.length === 0) {
    document.getElementById("pintTypeFinderResult").textContent =
      `No prices for ${type}`;
    return;
  }

  const cheapest = matches.reduce((a, b) => (a.price < b.price ? a : b));
  const pub = pubs.find(p => p.id === cheapest.pubId);

  document.getElementById("pintTypeFinderResult").textContent =
    `Cheapest ${type} is £${cheapest.price} at ${pub?.name}`;
};

// -----------------------------------------------------
// BUDGET HELPER
// -----------------------------------------------------
window.calculateBudgetHelper = function () {
  const budget = Number(document.getElementById("budgetInput").value);
  if (!budget) return;

  if (prices.length === 0) {
    document.getElementById("budgetResult").textContent = "No data yet.";
    return;
  }

  const cheapest = prices.reduce((a, b) => (a.price < b.price ? a : b));
  const count = Math.floor(budget / cheapest.price);
  const pub = pubs.find(p => p.id === cheapest.pubId);

  document.getElementById("budgetResult").textContent =
    `You can get ${count}x ${cheapest.pintName} at ${pub?.name}.`;
};

// -----------------------------------------------------
// LEAGUE TABLE
// -----------------------------------------------------
function renderLeague() {
  if (prices.length === 0) return;

  const avgByPub = pubs.map(pub => {
    const pints = prices.filter(pr => pr.pubId === pub.id);
    const avg = pints.length ? pints.reduce((a, b) => a + b.price, 0) / pints.length : null;
    return { pub, avg };
  }).filter(x => x.avg !== null);

  const cheapest = [...avgByPub].sort((a, b) => a.avg - b.avg).slice(0, 5);
  const expensive = [...avgByPub].sort((a, b) => b.avg - a.avg).slice(0, 5);
  const full = [...avgByPub].sort((a, b) => a.avg - b.avg);

  document.getElementById("leagueCheapest").innerHTML =
    cheapest.map(x => `<p>${x.pub.name}: £${x.avg.toFixed(2)}</p>`).join("");

  document.getElementById("leagueExpensive").innerHTML =
    expensive.map(x => `<p>${x.pub.name}: £${x.avg.toFixed(2)}</p>`).join("");

  document.getElementById("fullLeague").innerHTML =
    full.map(x => `<p>${x.pub.name}: £${x.avg.toFixed(2)}</p>`).join("");
}

window.toggleLeague = function () {
  const full = document.getElementById("fullLeague");
  const btn = document.getElementById("showFullLeagueBtn");

  if (full.style.display === "none") {
    full.style.display = "block";
    btn.textContent = "Hide League ▲";
  } else {
    full.style.display = "none";
    btn.textContent = "Show Full League ▼";
  }
};

// -----------------------------------------------------
loadAll();
