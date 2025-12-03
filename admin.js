/* ---------------------------------------------------
   FIREBASE SETUP
--------------------------------------------------- */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  getDocs
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
   PASSWORD GATE
--------------------------------------------------- */
const ADMIN_PASSWORD = "westminster2025";

document.getElementById("loginBtn").onclick = () => {
  const input = document.getElementById("adminPasswordInput").value;

  if (input === ADMIN_PASSWORD) {
    document.getElementById("loginSection").style.display = "none";
    document.getElementById("adminContent").style.display = "block";
    loadData();
  } else {
    document.getElementById("loginError").innerText =
      "Incorrect password.";
  }
};

/* ---------------------------------------------------
   LOAD ADMIN DATA
--------------------------------------------------- */
async function loadData() {
  loadPints();
  loadPubs();
  loadPrices();
}

/* ---------------------------------------------------
   DISPLAY LISTS
--------------------------------------------------- */
function loadPints() {
  onSnapshot(collection(db, "pints"), snap => {
    const list = document.getElementById("pintsList");
    list.innerHTML = snap.docs.map(docSnap => {
      const d = docSnap.data();
      return `
        <div class="list-item">
          <span>${d.name} (${d.type})</span>
          <button class="danger" onclick="deletePint('${docSnap.id}')">Delete</button>
        </div>
      `;
    }).join("");
  });
}

function loadPubs() {
  onSnapshot(collection(db, "pubs"), snap => {
    const list = document.getElementById("pubsList");
    list.innerHTML = snap.docs.map(docSnap => {
      const d = docSnap.data();
      return `
        <div class="list-item">
          <span>${d.name}</span>
          <button class="danger" onclick="deletePub('${docSnap.id}')">Delete</button>
        </div>
      `;
    }).join("");
  });
}

function loadPrices() {
  onSnapshot(collection(db, "prices"), snap => {
    const list = document.getElementById("pricesList");
    list.innerHTML = snap.docs.slice(0,100).map(docSnap => {
      const d = docSnap.data();
      return `
        <div class="list-item">
          <span>${d.pintName} @ ${d.price} (${d.type})</span>
          <button class="danger" onclick="deletePrice('${docSnap.id}')">Delete</button>
        </div>
      `;
    }).join("");
  });
}

/* ---------------------------------------------------
   DELETE FUNCTIONS
--------------------------------------------------- */
window.deletePint = async (id) => {
  await deleteDoc(doc(db, "pints", id));
};

window.deletePub = async (id) => {
  await deleteDoc(doc(db, "pubs", id));
};

window.deletePrice = async (id) => {
  await deleteDoc(doc(db, "prices", id));
};

/* ---------------------------------------------------
   BULK WIPE BUTTONS
--------------------------------------------------- */
document.getElementById("wipePubs").onclick = async () => {
  if (!confirm("Delete ALL pubs?")) return;
  const snap = await getDocs(collection(db, "pubs"));
  snap.forEach(docSnap => deleteDoc(doc(db, "pubs", docSnap.id)));
};

document.getElementById("wipePints").onclick = async () => {
  if (!confirm("Delete ALL pints?")) return;
  const snap = await getDocs(collection(db, "pints"));
  snap.forEach(docSnap => deleteDoc(doc(db, "pints", docSnap.id)));
};

document.getElementById("wipePrices").onclick = async () => {
  if (!confirm("Delete ALL prices?")) return;
  const snap = await getDocs(collection(db, "prices"));
  snap.forEach(docSnap => deleteDoc(doc(db, "prices", docSnap.id)));
};

/* ---------------------------------------------------
   ADD NEW PINT TYPE
--------------------------------------------------- */
document.getElementById("addPintTypeBtn").onclick = async () => {
  const name = document.getElementById("newPintName").value.trim();
  const type = document.getElementById("newPintType").value;

  if (!name) {
    alert("Enter pint name.");
    return;
  }

  await addDoc(collection(db, "pints"), { name, type });

  document.getElementById("newPintName").value = "";

  alert("Pint added!");
};
