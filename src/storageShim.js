// Polyfills `window.storage` (Claude artifact sandbox API) using Firebase
// Firestore. `shop-config` is stored as a single document (menu/settings —
// needs to be publicly readable so the storefront works for everyone).
//
// `orders` is different: it's stored as ONE DOCUMENT PER ORDER in an
// `orders` collection, not one big blob. This is required for real
// security — Firestore rules can only restrict access at the
// document/collection level, so a single "all orders in one blob" document
// can't be "publicly writable to add a new order" without also being
// "publicly readable/overwritable," which would defeat the point of
// locking the dashboard down. Splitting into one doc per order lets the
// rules allow customers to CREATE a new order document, while only letting
// logged-in family members READ, UPDATE, or DELETE any of them.
//
// The rest of the app still just calls window.storage.get/set("orders", ...)
// with a plain JS array, exactly as before — this file translates that
// into the right Firestore calls underneath.

import {
  getFirestore, doc, getDoc, setDoc, deleteDoc,
  collection, getDocs,
} from "firebase/firestore";
import { app } from "./firebaseConfig.js";

const db = getFirestore(app);
const KV_COLLECTION = "kv";
const ORDERS_COLLECTION = "orders";

function makeResult(key, value) {
  return { key, value };
}

async function getOrders() {
  const snap = await getDocs(collection(db, ORDERS_COLLECTION));
  const orders = [];
  snap.forEach((d) => orders.push({ ...d.data(), id: d.id }));
  return makeResult("orders", JSON.stringify(orders));
}

async function setOrders(value) {
  // Upsert-only: writes/updates every order in the array, but never
  // deletes a Firestore document just because it's missing from the
  // array. This matters because a customer's browser only ever sees
  // orders it's allowed to read (which, under the locked-down rules
  // below, may be none) — if `set` deleted anything absent from that
  // customer's array, submitting a new order could wipe out every other
  // order in the database. Explicit removal (the family dashboard's
  // "Remove Order" button) goes through storage.removeOrder(id) instead.
  const orders = JSON.parse(value);
  await Promise.all(
    orders.map((o) => {
      const { id, ...rest } = o;
      // Keep phoneKey (a normalized, queryable copy of the phone number)
      // in sync in case the family edits a customer's phone number —
      // the submitOrder Cloud Function relies on this field being
      // accurate to look up a household's existing order count.
      const phoneKey = String(o.phone || "").replace(/\D/g, "");
      return setDoc(doc(db, ORDERS_COLLECTION, id), { ...rest, phoneKey });
    })
  );
  return makeResult("orders", value);
}

const storage = {
  async get(key /*, shared */) {
    if (key === "orders") return getOrders();
    const snap = await getDoc(doc(db, KV_COLLECTION, key));
    if (!snap.exists()) {
      throw new Error(`Key not found: ${key}`);
    }
    return makeResult(key, snap.data().value);
  },

  async set(key, value /*, shared */) {
    if (key === "orders") return setOrders(value);
    await setDoc(doc(db, KV_COLLECTION, key), { value });
    return makeResult(key, value);
  },

  async delete(key /*, shared */) {
    const ref = doc(db, KV_COLLECTION, key);
    const snap = await getDoc(ref);
    const existed = snap.exists();
    await deleteDoc(ref);
    return { key, deleted: existed };
  },

  async list(prefix = "" /*, shared */) {
    const snap = await getDocs(collection(db, KV_COLLECTION));
    const keys = [];
    snap.forEach((d) => {
      if (d.id.startsWith(prefix)) keys.push(d.id);
    });
    return { keys, prefix };
  },

  // Explicit single-order deletion, used by the family dashboard's
  // "Remove Order" button. Not part of Claude's original window.storage
  // shape — added because the upsert-only behavior above can't express
  // "delete this one order" on its own.
  async removeOrder(id) {
    await deleteDoc(doc(db, ORDERS_COLLECTION, id));
  },
};

window.storage = storage;
