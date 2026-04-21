import { Injectable } from "@angular/core";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { firestoreCollections, firestoreDb } from "../firebase";

export interface UserProfile {
  id: string;
  displayName?: string;
  email?: string;
}

@Injectable({ providedIn: "root" })
export class UserProfileService {
  async getProfile(userId: string): Promise<UserProfile | null> {
    const profileDoc = await getDoc(
      doc(firestoreDb, firestoreCollections.users, userId)
    );

    if (!profileDoc.exists()) {
      return null;
    }

    const data = profileDoc.data() as Omit<UserProfile, "id">;
    return { id: profileDoc.id, ...data };
  }

  async saveProfile(userId: string, profile: Omit<UserProfile, "id">) {
    await setDoc(
      doc(firestoreDb, firestoreCollections.users, userId),
      {
        ...profile,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }
}
