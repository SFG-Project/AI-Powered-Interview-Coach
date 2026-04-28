import { Injectable, inject } from "@angular/core";
import { FirebaseError } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { firebaseAuth } from "../firebase";
import { UserProfileService } from "./user-profile.service";

export interface SignUpPayload {
  firstName: string;
  lastName: string;
  email: string;
  industry: string;
  password: string;
}

@Injectable({ providedIn: "root" })
export class AuthService {
  private readonly userProfileService = inject(UserProfileService);
  private tokenKey = 'authToken';

  async signIn(email: string, password: string): Promise<void> {
    const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
    const idToken = await userCredential.user.getIdToken();

    // Save Firebase ID token locally
    sessionStorage.setItem(this.tokenKey, idToken);
  }

  getToken(): string | null {
    return sessionStorage.getItem(this.tokenKey);
  }

  logout(): void {
    sessionStorage.removeItem(this.tokenKey);
  }

  isAuthenticated(): boolean {
    return !!sessionStorage.getItem(this.tokenKey);
  }

  async signUp(payload: SignUpPayload): Promise<void> {
    const credential = await createUserWithEmailAndPassword(
      firebaseAuth,
      payload.email,
      payload.password
    );

    const displayName = `${payload.firstName} ${payload.lastName}`.trim();

    try {
      await updateProfile(credential.user, { displayName });

      await this.userProfileService.saveProfile(credential.user.uid, {
        firstName: payload.firstName,
        lastName: payload.lastName,
        displayName,
        email: payload.email,
        industry: payload.industry,
      });
    } catch (error) {
      await signOut(firebaseAuth);
      throw error;
    }

    await signOut(firebaseAuth);
  }

  getSignInErrorMessage(error: unknown): string {
    const code = this.getErrorCode(error);

    if (
      code === "auth/invalid-credential" ||
      code === "auth/user-not-found" ||
      code === "auth/wrong-password"
    ) {
      return "Invalid email or password.";
    }

    if (code === "auth/invalid-email") {
      return "Please enter a valid email address.";
    }

    if (code === "auth/user-disabled") {
      return "This account has been disabled.";
    }

    return "Unable to sign in right now. Please try again.";
  }

  getSignUpErrorMessage(error: unknown): string {
    const code = this.getErrorCode(error);

    if (code === "auth/email-already-in-use") {
      return "An account with this email already exists.";
    }

    if (code === "auth/invalid-email") {
      return "Please enter a valid email address.";
    }

    if (code === "auth/weak-password") {
      return "Password is too weak. Use at least 8 characters.";
    }

    if (code === "permission-denied") {
      return "Account was created, but profile storage is blocked by Firestore rules.";
    }

    return "Unable to create your account right now. Please try again.";
  }

  private getErrorCode(error: unknown): string | undefined {
    if (error instanceof FirebaseError) {
      return error.code;
    }

    if (
      error instanceof Error &&
      typeof (error as { code?: unknown }).code === "string"
    ) {
      return (error as { code?: string }).code;
    }

    return undefined;
  }

}
