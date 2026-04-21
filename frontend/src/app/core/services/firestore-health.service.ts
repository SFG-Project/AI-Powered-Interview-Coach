import { Injectable } from "@angular/core";
import { doc, getDoc } from "firebase/firestore";
import { firestoreDb } from "../firebase";

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

const CONNECTIVITY_TEST_COLLECTION = "healthChecks";
const CONNECTIVITY_TEST_DOCUMENT_ID = "landingPageConnectivityProbe";

@Injectable({ providedIn: "root" })
export class FirestoreHealthService {
  async checkConnection(): Promise<FirestoreConnectionResult> {
    try {
      await getDoc(
        doc(
          firestoreDb,
          CONNECTIVITY_TEST_COLLECTION,
          CONNECTIVITY_TEST_DOCUMENT_ID
        )
      );
      return { status: "connected" };
    } catch (error: unknown) {
      const firebaseError = this.toFirebaseError(error);
      const status = this.mapErrorCodeToStatus(firebaseError.code);

      console.error("[firebase] Firestore connectivity check failed.", {
        status,
        code: firebaseError.code ?? "unknown",
        message: firebaseError.message,
      });

      return {
        status,
        errorCode: firebaseError.code,
        errorMessage: firebaseError.message,
      };
    }
  }

  private mapErrorCodeToStatus(
    code: string | undefined
  ): FirestoreConnectionStatus {
    if (code === "permission-denied" || code === "unauthenticated") {
      return "read-blocked";
    }

    if (
      code === "invalid-argument" ||
      code === "invalid-api-key" ||
      code === "failed-precondition"
    ) {
      return "config-error";
    }

    return "request-failed";
  }

  private toFirebaseError(error: unknown): {
    code: string | undefined;
    message: string;
  } {
    if (error instanceof Error) {
      const code =
        typeof (error as { code?: unknown }).code === "string"
          ? ((error as { code?: string }).code as string)
          : undefined;

      return {
        code,
        message: error.message,
      };
    }

    return {
      code: undefined,
      message: "Unknown Firestore error.",
    };
  }
}
