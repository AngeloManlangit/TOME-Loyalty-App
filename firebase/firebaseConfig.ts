// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getReactNativePersistence, initializeAuth } from "@firebase/auth"
import { getAnalytics } from "firebase/analytics";
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage'
import { getFirestore } from "firebase/firestore"
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDOBfwueQt7FZqJrHhUoIvVjlZJ25mTXfc",
  authDomain: "tome-loyalty-app.firebaseapp.com",
  projectId: "tome-loyalty-app",
  storageBucket: "tome-loyalty-app.firebasestorage.app",
  messagingSenderId: "56322668496",
  appId: "1:56322668496:web:9fc67f2ba02f2b3fcc6bd5",
  measurementId: "G-CRHWCVFMLD"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});
// export const analytics = getAnalytics(app);
export const db = getFirestore(app);