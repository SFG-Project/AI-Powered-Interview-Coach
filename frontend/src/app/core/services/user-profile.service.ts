import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { environment } from "../../../environments/environment";
import { firstValueFrom } from "rxjs";

export interface UserProfile {
  id: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email?: string;
  industry?: string;
}

@Injectable({ providedIn: "root" })
export class UserProfileService {
  private readonly http = inject(HttpClient);

  async getProfile(userId: string): Promise<UserProfile | null> {
    try {
      return await firstValueFrom(
        this.http.get<UserProfile>(
          `${environment.apiBaseUrl}/api/users/${encodeURIComponent(userId)}`
        )
      );
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        return null;
      }

      throw new Error(this.extractErrorMessage(error));
    }
  }

  async saveProfile(userId: string, profile: Omit<UserProfile, "id">) {
    try {
      await firstValueFrom(
        this.http.put<{ id: string }>(
          `${environment.apiBaseUrl}/api/users/${encodeURIComponent(userId)}`,
          profile
        )
      );
    } catch (error) {
      throw new Error(this.extractErrorMessage(error));
    }
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (
        error.error &&
        typeof error.error === "object" &&
        typeof (error.error as { message?: unknown }).message === "string"
      ) {
        return (error.error as { message: string }).message;
      }

      if (
        error.error &&
        typeof error.error === "object" &&
        typeof (error.error as { errorMessage?: unknown }).errorMessage === "string"
      ) {
        return (error.error as { errorMessage: string }).errorMessage;
      }

      if (typeof error.message === "string" && error.message) {
        return error.message;
      }
    }

    if (error instanceof Error) {
      return error.message;
    }

    return "Request failed.";
  }
}
