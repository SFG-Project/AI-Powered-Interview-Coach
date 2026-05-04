import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { environment } from "../../../environments/environment";

export interface FeedbackReportQuestion {
  number: number;
  question: string;
  answer: string;
  score: number;
  feedbackSummary: string;
  suggestedAnswer: string;
}

export interface FeedbackReport {
  sessionId: string;
  title: string;
  careerField: string;
  interviewType: string;
  difficulty: string;
  score: number;
  maxScore: number;
  completedAt: string | null;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  summary: string;
  questions: FeedbackReportQuestion[];
}

export interface FeedbackReportsResponse {
  reports: FeedbackReport[];
}

@Injectable({ providedIn: "root" })
export class FeedbackReportsService {
  private readonly http = inject(HttpClient);
  private readonly apiBase = environment.apiBaseUrl
    ? `${environment.apiBaseUrl}/api/feedback-reports`
    : "/api/feedback-reports";

  getMyFeedbackReports(): Promise<FeedbackReportsResponse> {
    return firstValueFrom(this.http.get<FeedbackReportsResponse>(`${this.apiBase}/me`));
  }
}
