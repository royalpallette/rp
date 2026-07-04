import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// TODO: Replace this with your actual Firebase Project Configuration
// You can get this from Firebase Console -> Project Settings -> General -> Web Apps
const firebaseConfig = {
  apiKey: "AIzaSyD3bpMk5OZs8WqX8EXKS0E_bj1N9DXbTGM",
  authDomain: "royal-pallette.firebaseapp.com",
  projectId: "royal-pallette",
  storageBucket: "royal-pallette.firebasestorage.app",
  messagingSenderId: "793296425959",
  appId: "1:793296425959:web:e2474a1353ca29defb6342",
  measurementId: "G-3NK58FGB93",
  databaseURL: "https://royal-pallette-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const storage = getStorage(app);
