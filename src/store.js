import {
  collection, doc, addDoc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, orderBy, onSnapshot, serverTimestamp, limit
} from "firebase/firestore";
import { db } from "./firebase.js";

const requireDb = () => { if (!db) throw new Error("Firebase is not configured. Complete the setup in README.md."); };
export async function ensureUserProfile(user) {
  requireDb();
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) await setDoc(ref, {
    uid: user.uid, displayName: user.displayName || "Orbit Explorer",
    email: user.email || "", photoURL: user.photoURL || "",
    theme: "dark", createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });
}
export async function getPreferences(uid) {
  requireDb(); const s = await getDoc(doc(db, "users", uid));
  return s.exists() ? s.data() : {};
}
export async function savePreferences(uid, data) {
  requireDb(); await setDoc(doc(db, "users", uid), {...data, updatedAt: serverTimestamp()}, {merge:true});
}
export async function createConversation(uid, title = "New conversation") {
  requireDb();
  return addDoc(collection(db, "users", uid, "conversations"), {
    title, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), messages: []
  });
}
export function watchConversations(uid, callback, onError) {
  requireDb();
  return onSnapshot(query(collection(db, "users", uid, "conversations"), orderBy("updatedAt", "desc"), limit(100)),
    snap => callback(snap.docs.map(d => ({id:d.id, ...d.data()}))), onError);
}
export async function getConversation(uid, id) {
  requireDb(); const s = await getDoc(doc(db, "users", uid, "conversations", id));
  return s.exists() ? {id:s.id, ...s.data()} : null;
}
export async function saveMessages(uid, id, messages, title) {
  requireDb();
  const ref = doc(db, "users", uid, "conversations", id);
  await updateDoc(ref, {messages, title, updatedAt: serverTimestamp()});
}
export async function renameConversation(uid, id, title) {
  requireDb(); await updateDoc(doc(db, "users", uid, "conversations", id), {title, updatedAt:serverTimestamp()});
}
export async function removeConversation(uid, id) {
  requireDb(); await deleteDoc(doc(db, "users", uid, "conversations", id));
}