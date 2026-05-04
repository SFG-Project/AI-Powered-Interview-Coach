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

interface AuthErrorDetails {
  code?: string;
  message?: string;
  status?: number;
}

@Injectable({ providedIn: "root" })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokenKey = "authToken";

  async signIn(email: string, password: string): Promise<void> {
    const signInUrl = `${environment.apiBaseUrl}/api/auth/signin`;
    this.logSignInRequestUrl(signInUrl);

    try {
      const response = await firstValueFrom(
        this.http.post<{ idToken: string }>(signInUrl, { email, password }, { observe: "response" })
      );
      this.logSignInResponseStatus(signInUrl, response.status);

      const idToken =
        typeof response.body?.idToken === "string" ? response.body.idToken.trim() : "";

      if (!idToken) {
        throw new Error("Authentication token missing in sign-in response.");
      }

      sessionStorage.setItem(this.tokenKey, idToken);
    } catch (error) {
      this.logSignInErrorForDevelopment(signInUrl, this.getErrorDetails(error));
      throw error;
    }

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
    const details = this.getErrorDetails(error);

    if (details.status === 0) {
      return "Could not reach the backend API. Check CORS, API URL, or backend port.";
    }

    if (details.status === 404) {
      return "Sign-in endpoint was not found. Check the frontend API path and backend route.";
    }

    if (details.status === 401) {
      return "Invalid email or password.";
    }

    if (details.status === 400) {
      return details.message || "Please check your sign-in details and try again.";
    }

    if (details.status === 500 || details.status === 502 || details.status === 503) {
      return "Backend error during sign-in. Check backend logs.";
    }

    if (details.code === "auth/user-not-found") {
      return "No account found with this email.";
    }

    if (details.code === "auth/wrong-password") {
      return "Incorrect password.";
    }

    if (details.code === "auth/invalid-credential") {
      return "Invalid email or password.";
    }

    if (details.code === "auth/invalid-email") {
      return "Please enter a valid email address.";
    }

    if (details.code === "auth/too-many-requests") {
      return "Too many attempts. Please try again later.";
    }

    if (details.code === "auth/user-disabled") {
      return "This account has been disabled.";
    }

    return "Unable to sign in right now. Please try again.";
  }

  getSignUpErrorMessage(error: unknown): string {
    const code = this.getErrorDetails(error).code;

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

  private getErrorDetails(error: unknown): AuthErrorDetails {
    if (error instanceof HttpErrorResponse) {
      const status = error.status;

      if (
        error.error &&
        typeof error.error === "object" &&
        typeof (error.error as { errorCode?: unknown }).errorCode === "string"
      ) {
        return {
          code: (error.error as { errorCode: string }).errorCode,
          message:
            typeof (error.error as { message?: unknown }).message === "string"
              ? (error.error as { message: string }).message
              : undefined,
          status,
        };
      }

      if (typeof error.error === "string" && error.error) {
        return {
          message: error.error,
          status,
        };
      }

      if (typeof error.message === "string" && error.message) {
        return {
          message: error.message,
          status,
        };
      }

      return { status };
    }

    if (error instanceof Error) {
      return {
        message: error.message,
      };
    }

    return {};
  }

  private logSignInRequestUrl(url: string): void {
    if (environment.production) {
      return;
    }

    console.info(`[auth/signin] POST ${url}`);
  }

  private logSignInResponseStatus(url: string, status: number): void {
    if (environment.production) {
      return;
    }

    console.info(`[auth/signin] Response from ${url} returned status ${status}.`);
  }

  private logSignInErrorForDevelopment(url: string, details: AuthErrorDetails): void {
    if (environment.production) {
      return;
    }

    console.error("[auth/signin] Request failed.", {
      requestUrl: url,
      httpStatus: details.status ?? null,
      errorCode: details.code ?? null,
      errorMessage: details.message ?? null,
    });
  }
}
