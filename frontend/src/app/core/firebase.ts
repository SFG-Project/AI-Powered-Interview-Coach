import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { collection, getFirestore } from "firebase/firestore";
import { environment } from "../../environments/environment";

export const firebaseApp = getApps().length
  ? getApp()
  : initializeApp(environment.firebase);

export const firebaseAuth = getAuth(firebaseApp);
export const firestoreDb = getFirestore(firebaseApp);

export const firestoreCollections = {
  users: "users",
  interviews: "interviews",
  responses: "responses",
  feedback: "feedback",
} as const;

export type FirestoreCollectionKey = keyof typeof firestoreCollections;

export function getCollectionRef(collectionKey: FirestoreCollectionKey) {
  return collection(firestoreDb, firestoreCollections[collectionKey]);
}
