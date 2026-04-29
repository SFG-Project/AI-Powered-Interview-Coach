import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { environment } from "../../../environments/environment";

export interface SignUpPayload {
  firstName: string;
  lastName: string;
  email: string;
  industry: string;
  password: string;
}

@Injectable({ providedIn: "root" })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokenKey = "authToken";

  async signIn(email: string, password: string): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<{ idToken: string }>(
        `${environment.apiBaseUrl}/api/auth/signin`,
        { email, password }
      )
    );

    sessionStorage.setItem(this.tokenKey, response.idToken);
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
    await firstValueFrom(
      this.http.post<{ id: string }>(`${environment.apiBaseUrl}/api/auth/signup`, payload)
    );
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
    if (error instanceof HttpErrorResponse) {
      if (
        error.error &&
        typeof error.error === "object" &&
        typeof (error.error as { errorCode?: unknown }).errorCode === "string"
      ) {
        return (error.error as { errorCode: string }).errorCode;
      }

      if (typeof error.message === "string" && error.message) {
        return error.message;
      }
    }

    return undefined;
  }
}
