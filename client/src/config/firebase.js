import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/**
 * Firebase Web Configuration
 * Connected to Shared Project: bachat-gat-app-9e38e (Used by Flutter Android & React Web)
 */
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAfSLqG3mqeWxnhk_gBUPkDK9Y4Y17GeFU',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'bachat-gat-app-9e38e.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'bachat-gat-app-9e38e',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'bachat-gat-app-9e38e.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1038306626235',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1038306626235:web:eb1da740ae33c09ad3b79e',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-DJ20C3JZH8',
};

// Initialize Firebase App singleton
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// Log active connection for development verification
if (typeof window !== 'undefined') {
  console.log('Connected Firebase Project: bachat-gat-app-9e38e');
}

export default app;
