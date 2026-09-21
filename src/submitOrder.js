// Calls the `submitOrder` Cloud Function instead of writing to Firestore
// directly. The function checks the household order limit server-side
// (where it can actually be trusted) and creates the order itself.

import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "./firebaseConfig.js";

const functions = getFunctions(app);

export function submitOrderRemote(order, folderId) {
  const fn = httpsCallable(functions, "submitOrder");
  return fn({ order, folderId }).then((res) => res.data);
}
