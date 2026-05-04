import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { environment } from "../../../environments/environment";

export interface ProgressOverview {
  totalInterviews: number;
  completedInterviews: number;
  averageScore: number;
  bestScore: number;
  latestScore: number;
}

export interface ProgressSkill {
  name: string;
  percentage: number;
}

export interface InterviewScoreItem {
  label: string;
  score: number;
  maxScore: number;
  sessionId: string;
  completedAt: string | null;
}

export interface ProgressResponse {
  overview: ProgressOverview;
  skills: ProgressSkill[];
  interviewScores: InterviewScoreItem[];
}

@Injectable({ providedIn: "root" })
export class ProgressService {
  private readonly http = inject(HttpClient);
  private readonly apiBase = environment.apiBaseUrl
    ? `${environment.apiBaseUrl}/api/progress`
    : "/api/progress";

  getMyProgress(): Promise<ProgressResponse> {
    return firstValueFrom(this.http.get<ProgressResponse>(`${this.apiBase}/me`));
  }
}
