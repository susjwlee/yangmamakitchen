// Firebase Authentication helpers, used by the family dashboard's login
// screen. This replaces the old shared-PIN system with real per-person
// accounts, managed in the Firebase console (Authentication → Users).

import {
  getAuth, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, sendPasswordResetEmail,
} from "firebase/auth";
import { app } from "./firebaseConfig.js";

export const auth = getAuth(app);

// Calls `callback(isLoggedIn)` immediately, then again any time login
// state changes (including on page reload, since Firebase persists the
// session in the browser). Returns an unsubscribe function.
export function subscribeAuth(callback) {
  return onAuthStateChanged(auth, (user) => callback(!!user));
}

export function logIn(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function logOut() {
  return signOut(auth);
}

export function resetPassword(email) {
  return sendPasswordResetEmail(auth, email);
}
