// ==========================================
// FIREBASE SETUP
// ==========================================
import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBHUGgt8F4OQJjdx11qOMPC0irjGFZmU8E",
    authDomain: "westminsterpints.firebaseapp.com",
    projectId: "westminsterpints",
    storageBucket: "westminsterpints.appspot.com",
    messagingSenderId: "913960848966",
    appId: "1:913960848966:web:df6355a6b5b25dbdc5c447",
    measurementId: "G-E9SNYKYEBN"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


// ==========================================
// 1. ADD PINT NAME
// ==========================================
async function addPintName() {
    const pintInput = document.getElementById("newPintName").value.trim();

    if (!pintInput) {
        alert("Enter a name for the pint.");
        return;
    }

    await addDoc(collection(db, "pintNames"), {
        name: pintInput
    });

    alert("Pint added.");
    document.getElementById("newPintName").value = "";
    loadPintNames();
}


// ==========================================
// 2. ADD PUB NAME
// ==========================================
async function addPub() {
    const name = document.getElementById("newPubName").value.trim();
    const category = document.getElementById("newPubCategory").value;

    if (!name) {
        alert("Enter a pub name.");
        return;
    }

    await addDoc(collection(db, "pubs"), {
        name,
        category
    });

    alert("Pub added.");
    document.getElementById("newPubName").value = "";
    loadPubs();
}


// ==========================================
// 3. ADD PINT PRICE
// ==========================================
async function addPintPrice() {
    const pubId = document.getElementById("addPintPricePub").value;
    const pintName = document.getElementById("addPintPriceName").value;
    const price = parseFloat(document.getElementById("addPintPriceValue").value);

    if (!pubId || !pintName || !price) {
        alert("Fill all fields.");
        return;
    }

    await addDoc(collection(db, "prices"), {
        pintName,
        pintType: "Lager",
        price,
        pubId,
        timestamp: Date.now()
    });

    alert("Price added.");
    document.getElementById("addPintPriceValue").value = "";

    refreshEverything();
}


// ==========================================
// LOAD OPTIONS
// ==========================================
async function loadPintNames() {
    const snap = await getDocs(collection(db, "pintNames"));
    const select = document.getElementById("addPintPriceName");
    const finder = document.getElementById("pintTypeFinderSelect");

    select.innerHTML = "";
    finder.innerHTML = "";

    snap.forEach(doc => {
        const name = doc.data().name;
        const option = `<option value="${name}">${name}</option>`;
        select.innerHTML += option;
        finder.innerHTML += option;
    });
}

async function loadPubs() {
    const snap = await getDocs(collection(db, "pubs"));
    const select = document.getElementById("addPintPricePub");

    select.innerHTML = "";

    snap.forEach(doc => {
        select.innerHTML += `<option value="${doc.id}">${doc.data().name}</option>`;
    });
}


// ==========================================
// 4. CHEAPEST PINT RIGHT NOW
// ==========================================
async function renderCheapestPint() {
    const snap = await getDocs(collection(db, "prices"));
    const pubs = await getDocs(collection(db, "pubs"));

    const pubNames = {};
    pubs.forEach(doc => pubNames[doc.id] = doc.data().name);

    let cheapest = null;

    snap.forEach(doc => {
        const data = doc.data();
        if (!cheapest || data.price < cheapest.price)
            cheapest = data;
    });

    const box = document.getElementById("cheapestPintText");

    if (!cheapest) {
        box.textContent = "No prices available.";
        return;
    }

    box.textContent = `${cheapest.pintName} is £${cheapest.price.toFixed(2)} at ${pubNames[cheapest.pubId]}`;
}


// ==========================================
// 5. PINT TYPE FINDER (“Cheapest Peroni”)
// ==========================================
async function findCheapestPintType() {
    const pintName = document.getElementById("pintTypeFinderSelect").value;
    const snap = await getDocs(collection(db, "prices"));
    const pubs = await getDocs(collection(db, "pubs"));

    const pubLookup = {};
    pubs.forEach(doc => pubLookup[doc.id] = doc.data().name);

    let cheapest = null;

    snap.forEach(doc => {
        const data = doc.data();
        if (data.pintName === pintName) {
            if (!cheapest || data.price < cheapest.price)
                cheapest = data;
        }
    });

    const out = document.getElementById("pintTypeFinderResult");

    if (!cheapest) {
        out.textContent = "No prices found for that pint.";
        return;
    }

    out.textContent = `Cheapest ${pintName} is £${cheapest.price.toFixed(2)} at ${pubLookup[cheapest.pubId]}`;
}


// ==========================================
// 6. PINTS PLANNER (SMART UPGRADED VERSION)
// ==========================================
async function calculateBudgetHelper() {
    const budget = parseFloat(document.getElementById("budgetInput").value);
    const resultBox = document.getElementById("budgetResult");

    if (!budget || budget <= 0) {
        resultBox.textContent = "Enter a valid budget.";
        return;
    }

    const pricesSnapshot = await getDocs(collection(db, "prices"));
    const pubsSnapshot = await getDocs(collection(db, "pubs"));

    const pubs = {};
    pubsSnapshot.forEach(doc => pubs[doc.id] = doc.data().name);

    let options = [];

    pricesSnapshot.forEach(doc => {
        const d = doc.data();
        if (!d.price || !pubs[d.pubId]) return;

        const pints = Math.floor(budget / d.price);

        if (pints > 0) {
            options.push({
                pintName: d.pintName,
                pubName: pubs[d.pubId],
                price: d.price,
                pints,
                leftover: budget - pints * d.price
            });
        }
    });

    if (options.length === 0) {
        resultBox.textContent = "You cannot afford any pint.";
        return;
    }

    options.sort((a, b) => {
        if (b.pints !== a.pints) return b.pints - a.pints;
        return a.leftover - b.leftover;
    });

    const best = options[0];

    let html = `
        You can get <strong>${best.pints}× ${best.pintName}</strong>
        at <strong>${best.pubName}</strong>.<br>
        Money left over: <strong>£${best.leftover.toFixed(2)}</strong><br><br>
        <strong>Other options:</strong><br>
    `;

    options.slice(1, 4).forEach(o => {
        html += `• ${o.pints}× ${o.pintName} at ${o.pubName} (leftover £${o.leftover.toFixed(2)})<br>`;
    });

    resultBox.innerHTML = html;
}


// ==========================================
// 7. PUB LEAGUE TABLE
// ==========================================
async function renderLeagueTable() {
    const prices = await getDocs(collection(db, "prices"));
    const pubs = await getDocs(collection(db, "pubs"));

    const pubNames = {};
    pubs.forEach(doc => pubNames[doc.id] = doc.data().name);

    let map = {};

    prices.forEach(doc => {
        const d = doc.data();
        if (!map[d.pubId]) map[d.pubId] = [];
        map[d.pubId].push(d.price);
    });

    let entries = [];

    Object.keys(map).forEach(pubId => {
        const avg = map[pubId].reduce((a, b) => a + b) / map[pubId].length;
        entries.push({ pubName: pubNames[pubId], avg });
    });

    entries.sort((a, b) => a.avg - b.avg);

    const cheapestDiv = document.getElementById("leagueCheapest");
    const expensiveDiv = document.getElementById("leagueExpensive");
    const fullDiv = document.getElementById("fullLeague");

    cheapestDiv.innerHTML = "";
    expensiveDiv.innerHTML = "";
    fullDiv.innerHTML = "";

    entries.slice(0, 5).forEach(e => {
        cheapestDiv.innerHTML += `<p>${e.pubName}: £${e.avg.toFixed(2)}</p>`;
    });

    entries.slice(-5).reverse().forEach(e => {
        expensiveDiv.innerHTML += `<p>${e.pubName}: £${e.avg.toFixed(2)}</p>`;
    });

    entries.forEach(e => {
        fullDiv.innerHTML += `<p>${e.pubName}: £${e.avg.toFixed(2)}</p>`;
    });
}

function toggleLeague() {
    const full = document.getElementById("fullLeague");
    const btn = document.getElementById("showFullLeagueBtn");

    if (full.style.display === "none") {
        full.style.display = "block";
        btn.textContent = "Hide Full League ▲";
    } else {
        full.style.display = "none";
        btn.textContent = "Show Full League ▼";
    }
}


// ==========================================
// REFRESH EVERYTHING
// ==========================================
async function refreshEverything() {
    await loadPintNames();
    await loadPubs();
    await renderCheapestPint();
    await renderLeagueTable();
}

refreshEverything();

console.log("Westminster Pint Index initialised.");
