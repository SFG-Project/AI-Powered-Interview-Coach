import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { environment } from "../../../environments/environment";
import { firstValueFrom } from "rxjs";

export type FirestoreConnectionStatus =
  | "idle"
  | "connected"
  | "read-blocked"
  | "config-error"
  | "request-failed";

export interface FirestoreConnectionResult {
  status: FirestoreConnectionStatus;
  errorCode?: string;
  errorMessage?: string;
}

@Injectable({ providedIn: "root" })
export class FirestoreHealthService {
  private readonly http = inject(HttpClient);

  async checkConnection(): Promise<FirestoreConnectionResult> {
    try {
      const response = await firstValueFrom(
        this.http.get<Record<string, unknown>>(
          `${environment.apiBaseUrl}/api/firestore/health`
        )
      );
      const status = this.extractStatus(response["status"]);
      return { status };
    } catch (error: unknown) {
      const requestError = this.toRequestError(error);
      const status = this.extractStatus(requestError.status);
      const errorCode = requestError.errorCode;
      const errorMessage = requestError.errorMessage;

      console.error("[backend-api] Firestore connectivity check failed.", {
        status,
        code: errorCode ?? "unknown",
        message: errorMessage,
      });

      return {
        status,
        errorCode,
        errorMessage,
      };
    }
  }

  private extractStatus(value: unknown): FirestoreConnectionStatus {
    if (
      value === "connected" ||
      value === "read-blocked" ||
      value === "config-error" ||
      value === "request-failed" ||
      value === "idle"
    ) {
      return value;
    }

    return "request-failed";
  }

  private toRequestError(error: unknown): {
    status: unknown;
    errorCode: string | undefined;
    errorMessage: string;
  } {
    if (
      typeof error === "object" &&
      error !== null &&
      "error" in error &&
      typeof (error as { error?: unknown }).error === "object" &&
      (error as { error?: unknown }).error !== null
    ) {
      const payload = (error as { error: Record<string, unknown> }).error;
      const status =
        typeof payload["status"] === "string" ? payload["status"] : undefined;
      const errorCode =
        typeof payload["errorCode"] === "string"
          ? payload["errorCode"]
          : undefined;
      const errorMessage =
        typeof payload["errorMessage"] === "string"
          ? payload["errorMessage"]
          : "Backend health request failed.";

      return {
        status,
        errorCode,
        errorMessage,
      };
    }

    return {
      status: "request-failed",
      errorCode: undefined,
      errorMessage: error instanceof Error ? error.message : "Unknown backend API error.",
    };
  }
}
