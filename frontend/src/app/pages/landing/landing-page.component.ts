import { CommonModule } from "@angular/common";
import { Component, OnInit, inject } from "@angular/core";
import { RouterLink } from "@angular/router";
import { environment } from "../../../environments/environment";
import {
  FirestoreConnectionResult,
  FirestoreConnectionStatus,
  FirestoreHealthService,
} from "../../core/services/firestore-health.service";

@Component({
  selector: "app-landing-page",
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: "./landing-page.component.html",
  styleUrls: ["./landing-page.component.css"],
})
export class LandingPageComponent implements OnInit {
  private readonly firestoreHealthService = inject(FirestoreHealthService);

  readonly stats = [
    { value: "10,000+", label: "Interview Conducted" },
    { value: "4.8/5", label: "Average User Rating" },
    { value: "92%", label: "User Reported Improved Confidence" },
    { value: "35+", label: "Industries Covered" },
  ];
  readonly backendApiConfigured = Boolean(environment.apiBaseUrl);

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
