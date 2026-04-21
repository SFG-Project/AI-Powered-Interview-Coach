import { Component, OnInit, inject } from "@angular/core";
import {
  FirestoreConnectionResult,
  FirestoreConnectionStatus,
  FirestoreHealthService,
} from "../../core/services/firestore-health.service";
import { environment } from "../../../environments/environment";

@Component({
  selector: "app-landing-page",
  standalone: true,
  templateUrl: "./landing-page.component.html",
  styleUrls: ["./landing-page.component.css"],
})
export class LandingPageComponent implements OnInit {
  private readonly firestoreHealthService = inject(FirestoreHealthService);

  readonly title = "AI-Powered Adaptive Interview Coach";
  readonly subtitle =
    "A focused starter app for practicing interviews with adaptive coaching.";
  readonly firebaseConfigured = Boolean(
    environment.firebase.apiKey && environment.firebase.projectId
  );

  firestoreStatus: FirestoreConnectionResult = { status: "idle" };

  get firestoreStatusMessage(): string {
    const statusMessages: Record<FirestoreConnectionStatus, string> = {
      idle: "Checking Firestore connectivity...",
      connected: "Firestore connected.",
      "read-blocked":
        "Firestore read blocked by security rules or authentication.",
      "config-error":
        "Firestore config error. Check Firebase config or probe path.",
      "request-failed": "Firestore request failed. Check console for details.",
    };

    const baseMessage = statusMessages[this.firestoreStatus.status];

    if (
      this.firestoreStatus.status !== "connected" &&
      this.firestoreStatus.errorCode
    ) {
      return `${baseMessage} (code: ${this.firestoreStatus.errorCode})`;
    }

    return baseMessage;
  }

  ngOnInit(): void {
    void this.checkFirestoreConnection();
  }

  private async checkFirestoreConnection(): Promise<void> {
    this.firestoreStatus = await this.firestoreHealthService.checkConnection();
  }
}
