import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDbtwV8JVqqiC7fTRaHmOoCEjWn2sYYUP8",
  authDomain: "ozkon-celik-takip.firebaseapp.com",
  projectId: "ozkon-celik-takip",
  storageBucket: "ozkon-celik-takip.firebasestorage.app",
  messagingSenderId: "351331034390",
  appId: "1:351331034390:web:5651cab58d7e3b87329c37"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function inspectLogs() {
  console.log("=== INSPECTING FIRESTORE LOGS ===");
  try {
    await signInWithEmailAndPassword(auth, "admin@takip.com", "admin123");
    const q = query(collection(db, "logs"), orderBy("createdAt", "desc"), limit(50));
    const snap = await getDocs(q);
    console.log(`Total logs fetched: ${snap.docs.length}`);
    for (const d of snap.docs) {
      const data = d.data();
      console.log(`[${data.createdAt}] User: "${data.userName}" (${data.userId} / ${data.userRole}) | Action: ${data.action} | Details: ${data.details}`);
    }
  } catch (err) {
    console.error("Error fetching logs:", err.message);
  }
  process.exit(0);
}

inspectLogs();
