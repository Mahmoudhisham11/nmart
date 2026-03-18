import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration (from your message)
const firebaseConfig = {
  apiKey: "AIzaSyBxt7HwkDz7t9lkTWqpAsMn3wVjLIq_Zn0",
  authDomain: "devoria-57dd4.firebaseapp.com",
  projectId: "devoria-57dd4",
  storageBucket: "devoria-57dd4.firebasestorage.app",
  messagingSenderId: "169178705677",
  appId: "1:169178705677:web:60c60c84123fc95117ca44",
};

// Initialize Firebase once (important for Next.js hot reload)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const firebaseApp = app;
export const firebaseAuth = getAuth(app);
export const firestore = getFirestore(app);


