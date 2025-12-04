// ------------------------------------------------------
// FIREBASE INITIALISATION
// ------------------------------------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getFirestore, collection, getDocs, addDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAvYyMtp3loqVH4-eGNP54u13OOYKh-lKQ",
    authDomain: "pintpriceapp.firebaseapp.com",
    projectId: "pintpriceapp",
    storageBucket: "pintpriceapp.appspot.com",
    messagingSenderId: "527288189402",
    appId: "1:527288189402:web:82152e4d95878811fd2e8f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log("Westminster Pint Index initialised.");


// ------------------------------------------------------
// DOM ELEMENT SHORTCUT
// ------------------------------------------------------
const $ = id => document.getElementById(id);


// ------------------------------------------------------
// LOAD DATA
// ------------------------------------------------------
async function loadPubs() {
    const snap = await getDocs(collection(db, "pubs"));
    const pubs = [];
    snap.forEach(doc => pubs.push({ id: doc.id, ...doc.data() }));

    // Populate dropdowns
    const pubSelect = $("pricePubSelect");
    pubSelect.innerHTML = pubs.map(p => `<option value="${p.id}">${p.name}</option>`).join("");

    return pubs;
}

async function loadPintNames() {
    const snap = await getDocs(collection(db, "pintNames"));
    const pints = [];
    snap.forEach(doc => pints.push(doc.data().name));

    // Populate dropdowns
    $("pricePintSelect").innerHTML =
        pints.map(p => `<option>${p}</option>`).join("");

    $("findPintSelect").innerHTML =
        pints.map(p => `<option>${p}</option>`).join("");

    return pints;
}

async function loadPrices() {
    const snap = await getDocs(collection(db, "prices"));
    const prices = [];
    snap.forEach(doc => prices.push({ id: doc.id, ...doc.data() }));
    return prices;
}


// ------------------------------------------------------
// ADD FUNCTIONS
// ------------------------------------------------------
async function addPintName() {
    const name = $("newPintName").value.trim();
    if (!name) return;

    await addDoc(collection(db, "pintNames"), { name });
    $("newPintName").value = "";
    refreshEverything();
}

async function addPub() {
    const name = $("newPubName").value.trim();
    const area = $("newPubArea").value.trim();
    if (!name || !area) return;

    await addDoc(collection(db, "pubs"), { name, area });
    $("newPubName").value = "";
    $("newPubArea").value = "";
    refreshEverything();
}

async function addPintPrice() {
    const pubId = $("pricePubSelect").value;
    const pintName = $("pricePintSelect").value;
    const price = parseFloat($("priceInput").value);

    if (!pubId || !pintName || !price) return;

    await addDoc(collection(db, "prices"), {
        pubId,
        pintName,
        price,
        timestamp: Date.now()
    });

    $("priceInput").value = "";
    refreshEverything();
}


// ------------------------------------------------------
// CHEAPEST PINT OVERALL
// ------------------------------------------------------
async function calculateCheapestOverall(prices, pubs) {
    if (!prices.length) return;

    const cheapest = prices.reduce((a, b) => (a.price < b.price ? a : b));

    const pub = pubs.find(p => p.id === cheapest.pubId)?.name || "Unknown pub";
    $("cheapestPint").textContent =
        `${cheapest.pintName} is £${cheapest.price.toFixed(2)} at ${pub}`;
}


// ------------------------------------------------------
// FIND CHEAPEST BY PINT NAME
// ------------------------------------------------------
async function findCheapestPintType() {
    const selected = $("findPintSelect").value;
    const prices = await loadPrices();
    const pubs = await loadPubs();

    const filtered = prices.filter(p => p.pintName === selected);
    if (!filtered.length) {
        $("findPintOutput").textContent = "No data available.";
        return;
    }

    const cheapest = filtered.reduce((a, b) => a.price < b.price ? a : b);
    const pub = pubs.find(p => p.id === cheapest.pubId)?.name || "Unknown pub";

    $("findPintOutput").textContent =
        `Cheapest ${selected} is £${cheapest.price.toFixed(2)} at ${pub}`;
}


// ------------------------------------------------------
// PINTS PLANNER
// ------------------------------------------------------
async function calculateBudget() {
    const budget = parseFloat($("budgetInput").value);
    if (!budget) return;

    const prices = await loadPrices();
    const pubs = await loadPubs();

    const cheapest = prices.reduce((a, b) => a.price < b.price ? a : b);
    const pub = pubs.find(p => p.id === cheapest.pubId)?.name;

    const count = Math.floor(budget / cheapest.price);
    const leftover = (budget - count * cheapest.price).toFixed(2);

    $("budgetOutput").textContent =
        `You can get ${count}x ${cheapest.pintName} at ${pub}. You will have £${leftover} left.`;
}


// ------------------------------------------------------
// PUB LEAGUE TABLE
// ------------------------------------------------------
async function renderLeague() {
    const prices = await loadPrices();
    const pubs = await loadPubs();

    // Compute average price per pub
    const pubTotals = {};
    prices.forEach(p => {
        if (!pubTotals[p.pubId]) pubTotals[p.pubId] = [];
        pubTotals[p.pubId].push(p.price);
    });

    const league = Object.entries(pubTotals).map(([pubId, arr]) => {
        const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
        return {
            pub: pubs.find(p => p.id === pubId)?.name || "Unknown",
            avg
        };
    });

    league.sort((a, b) => a.avg - b.avg);

    $("topCheapest").innerHTML =
        league.slice(0, 5).map(l => `${l.pub}: £${l.avg.toFixed(2)}`).join("<br>");

    $("topExpensive").innerHTML =
        league.slice(-5).map(l => `${l.pub}: £${l.avg.toFixed(2)}`).join("<br>");

    $("fullLeague").innerHTML =
        league.map(l => `${l.pub}: £${l.avg.toFixed(2)}`).join("<br>");
}

window.toggleFullLeague = function () {
    const div = $("fullLeague");
    div.style.display = div.style.display === "none" ? "block" : "none";
};


// ------------------------------------------------------
// REFRESH EVERYTHING
// ------------------------------------------------------
async function refreshEverything() {
    const pubs = await loadPubs();
    const prices = await loadPrices();

    loadPintNames();
    calculateCheapestOverall(prices, pubs);
    renderLeague();
}

// Run on startup
refreshEverything();


// ------------------------------------------------------
// EXPOSE FUNCTIONS TO WINDOW
// ------------------------------------------------------
window.addPintName = addPintName;
window.addPub = addPub;
window.addPintPrice = addPintPrice;
window.calculateBudget = calculateBudget;
window.findCheapestPintType = findCheapestPintType;
