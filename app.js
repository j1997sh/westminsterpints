// ----------------------
// FIREBASE SETUP
// ----------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDkP7-QREPLACE",
    authDomain: "REPLACE.firebaseapp.com",
    projectId: "REPLACE",
    storageBucket: "REPLACE.appspot.com",
    messagingSenderId: "REPLACE",
    appId: "REPLACE"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log("Westminster Pint Index initialised.");


// ----------------------
// LOAD DROPDOWNS
// ----------------------
async function loadPubs() {
    const snap = await getDocs(collection(db, "pubs"));
    const selects = [document.getElementById("pricePubSelect")];
    selects.forEach(sel => sel.innerHTML = "");

    snap.forEach(doc => {
        const d = doc.data();
        selects.forEach(sel => {
            sel.innerHTML += `<option value="${doc.id}">${d.name}</option>`;
        });
    });
}

async function loadPintNames() {
    const snap = await getDocs(collection(db, "pintNames"));
    const selects = [
        document.getElementById("pricePintSelect"),
        document.getElementById("findPintSelect")
    ];
    selects.forEach(sel => sel.innerHTML = "");

    snap.forEach(doc => {
        const d = doc.data();
        selects.forEach(sel => {
            sel.innerHTML += `<option value="${d.name}">${d.name}</option>`;
        });
    });
}


// ----------------------
// ADD FUNCTIONS
// ----------------------
async function addPintName() {
    const name = document.getElementById("newPintName").value.trim();
    if (!name) return alert("Enter a pint name");

    await addDoc(collection(db, "pintNames"), { name });
    document.getElementById("newPintName").value = "";
    loadPintNames();
}

async function addPub() {
    const name = document.getElementById("newPubName").value.trim();
    const area = document.getElementById("newPubArea").value.trim();
    if (!name) return alert("Enter a pub name");

    await addDoc(collection(db, "pubs"), { name, area });
    document.getElementById("newPubName").value = "";
    document.getElementById("newPubArea").value = "";

    loadPubs();
}

async function addPintPrice() {
    const pubId = document.getElementById("pricePubSelect").value;
    const pintName = document.getElementById("pricePintSelect").value;
    const price = parseFloat(document.getElementById("priceInput").value);

    if (!price) return alert("Enter price");

    await addDoc(collection(db, "prices"), {
        pubId,
        pintName,
        price,
        timestamp: Date.now()
    });

    document.getElementById("priceInput").value = "";
    refreshEverything();
}


// ----------------------
// CHEAPEST PINT RIGHT NOW
// ----------------------
async function updateCheapestPint() {
    const snap = await getDocs(collection(db, "prices"));
    if (snap.empty) {
        document.getElementById("cheapestPint").textContent = "No data yet.";
        return;
    }

    let cheapest = null;

    snap.forEach(doc => {
        const d = doc.data();
        if (!cheapest || d.price < cheapest.price) {
            cheapest = d;
        }
    });

    if (!cheapest) return;

    // Get pub name
    const pubSnap = await getDocs(collection(db, "pubs"));
    let pubName = "Unknown Pub";
    pubSnap.forEach(p => {
        if (p.id === cheapest.pubId) pubName = p.data().name;
    });

    document.getElementById("cheapestPint").textContent =
        `${cheapest.pintName} is £${cheapest.price.toFixed(2)} at ${pubName}.`;
}


// ----------------------
// PINT TYPE FINDER
// ----------------------
async function findCheapestPintType() {
    const type = document.getElementById("findPintSelect").value;

    const snap = await getDocs(collection(db, "prices"));
    let best = null;

    snap.forEach(doc => {
        const d = doc.data();
        if (d.pintName === type) {
            if (!best || d.price < best.price) best = d;
        }
    });

    if (!best) {
        document.getElementById("findPintOutput").textContent = "No data.";
        return;
    }

    const pubSnap = await getDocs(collection(db, "pubs"));
    let pubName = "";
    pubSnap.forEach(p => {
        if (p.id === best.pubId) pubName = p.data().name;
    });

    document.getElementById("findPintOutput").textContent =
        `Cheapest ${type} is £${best.price.toFixed(2)} at ${pubName}`;
}


// ----------------------
// PINTS PLANNER
// ----------------------
async function calculateBudget() {
    const budget = parseFloat(document.getElementById("budgetInput").value);
    if (!budget) return;

    const snap = await getDocs(collection(db, "prices"));
    if (snap.empty) return;

    let best = null;

    snap.forEach(doc => {
        const d = doc.data();
        const count = Math.floor(budget / d.price);
        const leftover = budget - count * d.price;

        if (!best || count > best.count) {
            best = { ...d, count, leftover };
        }
    });

    const pubSnap = await getDocs(collection(db, "pubs"));
    let pubName = "";
    pubSnap.forEach(p => {
        if (p.id === best.pubId) pubName = p.data().name;
    });

    document.getElementById("budgetOutput").textContent =
        `You can get ${best.count}× ${best.pintName} at ${pubName} (leftover £${best.leftover.toFixed(2)}).`;
}


// ----------------------
// PUB LEAGUE TABLE
// ----------------------
async function updateLeagueTable() {
    const priceSnap = await getDocs(collection(db, "prices"));
    const pubSnap = await getDocs(collection(db, "pubs"));

    const pubMap = {};

    pubSnap.forEach(p => pubMap[p.id] = { name: p.data().name, prices: [] });

    priceSnap.forEach(pr => {
        if (pubMap[pr.data().pubId])
            pubMap[pr.data().pubId].prices.push(pr.data().price);
    });

    const pubs = Object.values(pubMap).map(p => ({
        name: p.name,
        avg: p.prices.length ? p.prices.reduce((a,b)=>a+b,0)/p.prices.length : null
    })).filter(p => p.avg !== null);

    pubs.sort((a,b) => a.avg - b.avg);

    document.getElementById("topCheapest").innerHTML =
        pubs.slice(0,5).map(p => `${p.name}: £${p.avg.toFixed(2)}`).join("<br>");

    document.getElementById("topExpensive").innerHTML =
        pubs.slice(-5).reverse().map(p => `${p.name}: £${p.avg.toFixed(2)}`).join("<br>");

    document.getElementById("fullLeague").innerHTML =
        pubs.map(p => `${p.name}: £${p.avg.toFixed(2)}`).join("<br>");
}

window.toggleFullLeague = function() {
    const div = document.getElementById("fullLeague");
    div.style.display = div.style.display === "none" ? "block" : "none";
};


// ----------------------
// REFRESH ALL
// ----------------------
async function refreshEverything() {
    await loadPubs();
    await loadPintNames();
    await updateCheapestPint();
    await updateLeagueTable();
}

refreshEverything();
