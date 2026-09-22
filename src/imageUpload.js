// Uploads image files to Firebase Storage and returns a short download URL
// to store in Firestore, instead of embedding the entire image as base64
// text. This matters because Firestore documents have a hard 1MB size
// limit — a single photo (especially straight from a phone camera) can
// easily exceed that on its own, and previously every image was being
// crammed into the same document as all your other menu/settings data.
// Storage is built specifically for files like this and has no such limit.

import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { app } from "./firebaseConfig.js";

const storage = getStorage(app);

// `pathHint` is just used to keep uploaded files organized/named sensibly
// in the Storage console (e.g., "products", "folder-icons", "folder-banners").
export async function uploadImage(file, pathHint = "uploads") {
  const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const storageRef = ref(storage, `${pathHint}/${safeName}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}
