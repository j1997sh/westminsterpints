/* -------------------------------------------
   FIREBASE INITIALISATION
------------------------------------------- */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getFirestore, collection, addDoc, getDocs, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBHUGg8f4OQJdx11qOMPCOirjGFZmU8E",
    authDomain: "westminsterpints.firebaseapp.com",
    projectId: "westminsterpints",
    storageBucket: "westminsterpints.appspot.com",
    messagingSenderId: "913960848966",
    appId: "1:913960848966:web:df6355a6b5b25dbdc5c447"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* -------------------------------------------
   DOM HELPERS
------------------------------------------- */
const $ = id => document.getElementById(id);

/* -------------------------------------------
   LOAD DATA INTO SELECT ELEMENTS
------------------------------------------- */
async function loadPintNames() {
    const snap = await getDocs(collection(db, "pintNames"));
    const names = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const selects = ["pricePintSelect", "findPintSelect"];

    selects.forEach(sel => {
        const el = $(sel);
        el.innerHTML = "";
        names.forEach(n => {
            const opt = document.createElement("option");
            opt.value = n.name;
            opt.textContent = n.name;
            el.appendChild(opt);
        });
    });
}

async function loadPubs() {
    const snap = await getDocs(collection(db, "pubs"));
    const pubs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const pubSelect = $("pricePubSelect");
    pubSelect.innerHTML = "";

    pubs.forEach(pub => {
        const opt = document.createElement("option");
        opt.value = pub.id;
        opt.textContent = `${pub.name} (${pub.area})`;
        pubSelect.appendChild(opt);
    });
}

/* -------------------------------------------
   ADD FUNCTIONS
------------------------------------------- */
async function addPintName() {
    const name = $("newPintName").value.trim();
    if (!name) return alert("Enter a pint name.");

    await addDoc(collection(db, "pintNames"), { name });
    $("newPintName").value = "";

    await loadPintNames();
    alert("Pint added.");
}

async function addPub() {
    const name = $("newPubName").value.trim();
    const area = $("newPubArea").value.trim();
    if (!name || !area) return alert("Enter pub name & area.");

    await addDoc(collection(db, "pubs"), { name, area });
    $("newPubName").value = "";
    $("newPubArea").value = "";

    await loadPubs();
    alert("Pub added.");
}

async function addPintPrice() {
    const pubId = $("pricePubSelect").value;
    const pintName = $("pricePintSelect").value;
    const price = parseFloat($("priceInput").value);

    if (!pubId || !pintName || !price) return alert("Complete all fields.");

    await addDoc(collection(db, "prices"), {
        pubId,
        pintName,
        price,
        timestamp: Date.now()
    });

    $("priceInput").value = "";
    alert("Price added.");

    await refreshEverything();
}

/* -------------------------------------------
   CHEAPEST PINT RIGHT NOW
------------------------------------------- */
async function computeCheapestPint() {
    const priceSnap = await getDocs(collection(db, "prices"));
    const pubSnap = await getDocs(collection(db, "pubs"));

    if (priceSnap.empty) {
        $("cheapestPint").textContent = "No data yet.";
        return;
    }

    const pubs = Object.fromEntries(pubSnap.docs.map(d => [d.id, d.data()]));
    const prices = priceSnap.docs.map(d => d.data());

    const best = prices.reduce((a, b) => a.price < b.price ? a : b);

    $("cheapestPint").textContent =
        `${best.pintName} is £${best.price.toFixed(2)} at ${pubs[best.pubId].name}`;
}

/* -------------------------------------------
   PINTS PLANNER (budget)
------------------------------------------- */
async function calculateBudget() {
    const budget = parseFloat($("budgetInput").value);
    if (!budget) return;

    const snap = await getDocs(collection(db, "prices"));
    if (snap.empty) {
        $("budgetOutput").textContent = "No price data available.";
        return;
    }

    const allPrices = snap.docs.map(d => d.data());
    const cheapest = allPrices.reduce((a, b) => a.price < b.price ? a : b);
    const pintCount = Math.floor(budget / cheapest.price);
    const remaining = (budget - pintCount * cheapest.price).toFixed(2);

    $("budgetOutput").textContent =
        `You can get ${pintCount}x ${cheapest.pintName}. £${remaining} left over.`;
}

/* -------------------------------------------
   FIND CHEAPEST FOR SELECTED PINT
------------------------------------------- */
async function findCheapestPintType() {
    const target = $("findPintSelect").value;

    const priceSnap = await getDocs(collection(db, "prices"));
    const pubSnap = await getDocs(collection(db, "pubs"));

    const pubs = Object.fromEntries(pubSnap.docs.map(d => [d.id, d.data()]));
    const candidates = priceSnap.docs
        .map(d => d.data())
        .filter(p => p.pintName === target);

    if (candidates.length === 0) {
        $("findPintOutput").textContent = "No prices recorded yet.";
        return;
    }

    const best = candidates.reduce((a, b) => a.price < b.price ? a : b);

    $("findPintOutput").textContent =
        `Cheapest ${target} is £${best.price.toFixed(2)} at ${pubs[best.pubId].name}.`;
}

/* -------------------------------------------
   PUB LEAGUE TABLE
------------------------------------------- */
async function updateLeagueTable() {
    const priceSnap = await getDocs(collection(db, "prices"));
    const pubSnap = await getDocs(collection(db, "pubs"));

    const pubs = Object.fromEntries(pubSnap.docs.map(d => [d.id, d.data()]));
    const prices = priceSnap.docs.map(d => d.data());

    if (prices.length === 0) {
        $("topCheapest").textContent = "No data yet.";
        $("topExpensive").textContent = "";
        return;
    }

    const sorted = prices
        .map(p => ({
            ...p,
            pubName: pubs[p.pubId]?.name || "Unknown Pub"
        }))
        .sort((a, b) => a.price - b.price);

    const cheapest5 = sorted.slice(0, 5);
    const expensive5 = sorted.slice(-5).reverse();

    $("topCheapest").innerHTML =
        cheapest5.map(p => `£${p.price.toFixed(2)} - ${p.pintName} at ${p.pubName}`).join("<br>");

    $("topExpensive").innerHTML =
        expensive5.map(p => `£${p.price.toFixed(2)} - ${p.pintName} at ${p.pubName}`).join("<br>");

    $("fullLeague").innerHTML =
        sorted.map(p => `£${p.price.toFixed(2)} - ${p.pintName} at ${p.pubName}`).join("<br>");
}

window.toggleFullLeague = function () {
    const box = $("fullLeague");
    box.style.display = box.style.display === "none" ? "block" : "none";
};

/* -------------------------------------------
   REFRESH EVERYTHING
------------------------------------------- */
async function refreshEverything() {
    await loadPintNames();
    await loadPubs();
    await computeCheapestPint();
    await updateLeagueTable();
}

refreshEverything();
console.log("Westminster Pint Index initialised.");
