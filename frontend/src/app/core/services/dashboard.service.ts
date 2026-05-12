import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { environment } from "../../../environments/environment";

export interface DashboardSummary {
  totalInterviews: number;
  averageScore: number;
  confidenceLevel: number;
}

export interface DashboardWelcomeMessage {
  title: string;
  message: string;
}

export interface DashboardRecentInterview {
  sessionId: string;
  date: string;
  careerField: string;
  interviewType: string;
  score: number;
  maxScore: number;
  completedAt: string | null;
}

export interface DashboardResponse {
  summary: DashboardSummary;
  welcomeMessage: DashboardWelcomeMessage;
  recentInterviews: DashboardRecentInterview[];
}

@Injectable({ providedIn: "root" })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly apiBase = environment.apiBaseUrl
    ? `${environment.apiBaseUrl}/api/dashboard`
    : "/api/dashboard";

  getMyDashboard(): Promise<DashboardResponse> {
    return firstValueFrom(this.http.get<DashboardResponse>(`${this.apiBase}/me`));
  }
}
