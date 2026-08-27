import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAfSLqG3mqeWxnhk_gBUPkDK9Y4Y17GeFU",
  authDomain: "bachat-gat-app-9e38e.firebaseapp.com",
  projectId: "bachat-gat-app-9e38e",
  storageBucket: "bachat-gat-app-9e38e.firebasestorage.app",
  messagingSenderId: "1038306626235",
  appId: "1:1038306626235:web:eb1da740ae33c09ad3b79e",
  measurementId: "G-DJ20C3JZH8"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;