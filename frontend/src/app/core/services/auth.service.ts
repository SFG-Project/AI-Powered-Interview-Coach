import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { environment } from "../../../environments/environment";

export type UserRole = "admin" | "user";

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

interface SignInResponsePayload {
  idToken: string;
  localId?: string;
  role?: UserRole | string;
  isAdmin?: boolean;
  email?: string;
}

export interface StoredAuthUser {
  uid: string;
  email: string;
  role: UserRole;
  isAdmin: boolean;
}

@Injectable({ providedIn: "root" })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokenKey = "authToken";
  private readonly roleKey = "authRole";
  private readonly userIdKey = "authUserId";
  private readonly currentUserKey = "authCurrentUser";
  private readonly authApiBaseUrl = this.buildAuthApiBaseUrl();

  async signIn(identifier: string, password: string): Promise<void> {
    const signInUrl = `${this.authApiBaseUrl}/signin`;
    this.logSignInRequestUrl(signInUrl);

    try {
      const response = await firstValueFrom(
        this.http.post<SignInResponsePayload>(
          signInUrl,
          { email: identifier, password },
          { observe: "response" }
        )
      );
      this.logSignInResponseStatus(signInUrl, response.status);
      this.logSignInResponseRolePayloadForDevelopment(response.body);

      const idToken =
        typeof response.body?.idToken === "string" ? response.body.idToken.trim() : "";
      const localId =
        typeof response.body?.localId === "string" ? response.body.localId.trim() : "";

      if (!idToken) {
        throw new Error("Authentication token missing in sign-in response.");
      }

      sessionStorage.setItem(this.tokenKey, idToken);
      if (localId) {
        sessionStorage.setItem(this.userIdKey, localId);
      } else {
        sessionStorage.removeItem(this.userIdKey);
      }

      const role = await this.resolveRoleAfterSignIn(response.body);
      this.persistRole(role);
      this.persistCurrentUser({
        uid: localId,
        email: this.normalizeEmail(response.body?.email),
        role,
        isAdmin: role === "admin",
      });
      this.logStoredAuthStateForDevelopment(role, localId);
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
    sessionStorage.removeItem(this.roleKey);
    sessionStorage.removeItem(this.userIdKey);
    sessionStorage.removeItem(this.currentUserKey);
  }

  isAuthenticated(): boolean {
    return !!sessionStorage.getItem(this.tokenKey);
  }

  isAdmin(): boolean {
    return this.getRole() === "admin";
  }

  getRole(): UserRole {
    const storedRole = sessionStorage.getItem(this.roleKey);
    if (typeof storedRole === "string" && storedRole.trim()) {
      return this.normalizeRole(storedRole);
    }

    const currentUser = this.getCurrentUser();
    return this.normalizeRole(currentUser?.role);
  }

  getCurrentUser(): StoredAuthUser | null {
    const serializedCurrentUser = sessionStorage.getItem(this.currentUserKey);
    if (!serializedCurrentUser) {
      return null;
    }

    try {
      const parsed = JSON.parse(serializedCurrentUser) as Partial<StoredAuthUser> | null;
      const uid = typeof parsed?.uid === "string" ? parsed.uid.trim() : "";
      const email = this.normalizeEmail(parsed?.email);
      const role = this.normalizeRole(parsed?.role);

      if (!uid) {
        return null;
      }

      return {
        uid,
        email,
        role,
        isAdmin: role === "admin",
      };
    } catch {
      return null;
    }
  }

  async ensureRoleFromSession(): Promise<UserRole> {
    if (!this.isAuthenticated()) {
      return "user";
    }

    const storedRole = sessionStorage.getItem(this.roleKey);
    if (typeof storedRole === "string" && storedRole.trim()) {
      return this.normalizeRole(storedRole);
    }

    const roleFromSession = await this.fetchRoleFromSession();
    if (roleFromSession) {
      this.persistRole(roleFromSession);
      const existingUser = this.getCurrentUser();
      const storedUserId = sessionStorage.getItem(this.userIdKey);
      const fallbackUid = typeof storedUserId === "string" ? storedUserId.trim() : "";
      this.persistCurrentUser({
        uid: existingUser?.uid || fallbackUid,
        email: existingUser?.email || "",
        role: roleFromSession,
        isAdmin: roleFromSession === "admin",
      });
      return roleFromSession;
    }

    return this.getRole();
  }

  async signUp(payload: SignUpPayload): Promise<void> {
    await firstValueFrom(this.http.post<{ id: string }>(`${this.authApiBaseUrl}/signup`, payload));
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

  private buildAuthApiBaseUrl(): string {
    const trimmedBaseUrl = environment.apiBaseUrl.trim().replace(/\/+$/, "");
    return trimmedBaseUrl ? `${trimmedBaseUrl}/api/auth` : "/api/auth";
  }

  private normalizeRole(value: unknown): UserRole {
    if (typeof value !== "string") {
      return "user";
    }

    return value.trim().toLowerCase() === "admin" ? "admin" : "user";
  }

  private async resolveRoleAfterSignIn(
    payload: SignInResponsePayload | null | undefined
  ): Promise<UserRole> {
    const roleFromPayload = this.resolveRoleFromPayload(payload);
    const hasExplicitRole =
      typeof payload?.role === "string" || typeof payload?.isAdmin === "boolean";

    if (hasExplicitRole) {
      return roleFromPayload;
    }

    const roleFromSession = await this.fetchRoleFromSession();
    return roleFromSession || roleFromPayload;
  }

  private resolveRoleFromPayload(payload: SignInResponsePayload | null | undefined): UserRole {
    if (payload?.isAdmin === true) {
      return "admin";
    }

    return this.normalizeRole(payload?.role);
  }

  private async fetchRoleFromSession(): Promise<UserRole | null> {
    try {
      const session = await firstValueFrom(
        this.http.get<{ role?: unknown; isAdmin?: unknown }>(`${this.authApiBaseUrl}/session`)
      );

      if (session?.isAdmin === true) {
        if (!environment.production) {
          console.info("[auth/session] Resolved role from session endpoint: admin");
        }
        return "admin";
      }

      const normalizedRole = this.normalizeRole(session?.role);
      if (!environment.production) {
        console.info(
          `[auth/session] Resolved role from session endpoint: ${normalizedRole}`
        );
      }

      return normalizedRole;
    } catch (error) {
      if (!environment.production) {
        const details = this.getErrorDetails(error);
        console.warn("[auth/session] Failed to resolve role from session endpoint.", {
          httpStatus: details.status ?? null,
          errorCode: details.code ?? null,
          errorMessage: details.message ?? null,
        });
      }

      return null;
    }
  }

  private logSignInResponseRolePayloadForDevelopment(
    payload: SignInResponsePayload | null | undefined
  ): void {
    if (environment.production) {
      return;
    }

    console.info("[auth/signin] Response role payload.", {
      role: typeof payload?.role === "string" ? payload.role : null,
      isAdmin: typeof payload?.isAdmin === "boolean" ? payload.isAdmin : null,
      localIdFound:
        typeof payload?.localId === "string" && Boolean(payload.localId.trim()),
    });
  }

  private logStoredAuthStateForDevelopment(role: UserRole, localId: string): void {
    if (environment.production) {
      return;
    }

    const currentUser = this.getCurrentUser();
    console.info("[auth/signin] Stored auth state.", {
      role,
      localIdFound: Boolean(localId),
      tokenFound: Boolean(this.getToken()),
      currentUser,
    });
  }

  private persistRole(role: UserRole): void {
    sessionStorage.setItem(this.roleKey, role);
  }

  private persistCurrentUser(currentUser: StoredAuthUser): void {
    const uid = typeof currentUser.uid === "string" ? currentUser.uid.trim() : "";
    if (!uid) {
      sessionStorage.removeItem(this.currentUserKey);
      return;
    }

    const normalizedCurrentUser: StoredAuthUser = {
      uid,
      email: this.normalizeEmail(currentUser.email),
      role: this.normalizeRole(currentUser.role),
      isAdmin: this.normalizeRole(currentUser.role) === "admin",
    };

    sessionStorage.setItem(this.currentUserKey, JSON.stringify(normalizedCurrentUser));
  }

  private normalizeEmail(value: unknown): string {
    if (typeof value !== "string") {
      return "";
    }

    return value.trim().toLowerCase();
  }
}
