import { Injectable, inject } from "@angular/core";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { environment } from "../../../environments/environment";

export interface InterviewSetupPayload {
  careerField: string;
  interviewType: string;
  difficulty: string;
  questionCount: number;
}

export interface InterviewQuestion {
  id: string;
  text: string;
  number: number;
  total: number;
}

export interface InterviewStartResponse {
  sessionId: string;
  question: InterviewQuestion;
}

export interface InterviewAnswerPayload {
  questionId: string;
  answer: string;
  skipped?: boolean;
}

export interface InterviewFeedback {
  score: number;
  summary: string;
  clarity: string;
  technicalAccuracy: string;
  confidence: string;
  communication: string;
  quickTip: string;
  sessionNotes: string;
  strengths: string[];
  improvements: string[];
  suggestedAnswer: string;
}

export interface InterviewAnswerResponse {
  feedback: InterviewFeedback;
  nextQuestion: InterviewQuestion | null;
  isComplete: boolean;
}

export interface InterviewEndResponse {
  sessionId: string;
  status: "active" | "completed" | "cancelled";
  summary: string;
}

export interface InterviewSessionResponse {
  sessionId: string;
  userId: string;
  careerField: string;
  interviewType: string;
  difficulty: string;
  questionCount: number;
  status: "active" | "completed" | "cancelled";
  currentQuestionIndex: number;
  currentQuestion: InterviewQuestion | null;
  isComplete: boolean;
  latestFeedback: InterviewFeedback | null;
  createdAt: string | null;
  updatedAt: string | null;
  completedAt: string | null;
}

export interface InterviewHistoryItem {
  sessionId: string;
  careerField: string;
  interviewType: string;
  difficulty: string;
  questionCount: number;
  status: "active" | "completed" | "cancelled";
  createdAt: string | null;
  completedAt: string | null;
  latestScore: number | null;
}

export interface InterviewHistoryResponse {
  userId: string;
  sessions: InterviewHistoryItem[];
  runtime: {
    firestore: "enabled" | "fallback-memory";
    xai: "configured" | "fallback-local";
  };
}

@Injectable({ providedIn: "root" })
export class InterviewService {
  private readonly http = inject(HttpClient);
  private readonly apiBase = environment.apiBaseUrl
    ? `${environment.apiBaseUrl}/api/interview`
    : "/api/interview";

  startInterview(payload: InterviewSetupPayload) {
    return firstValueFrom(
      this.http.post<InterviewStartResponse>(`${this.apiBase}/start`, payload, {
        headers: this.getUserHeaders(),
      })
    );
  }

  submitAnswer(sessionId: string, payload: InterviewAnswerPayload) {
    return firstValueFrom(
      this.http.post<InterviewAnswerResponse>(
        `${this.apiBase}/${encodeURIComponent(sessionId)}/answer`,
        payload,
        { headers: this.getUserHeaders() }
      )
    );
  }

  skipQuestion(sessionId: string, payload: { questionId: string }) {
    return firstValueFrom(
      this.http.post<InterviewAnswerResponse>(
        `${this.apiBase}/${encodeURIComponent(sessionId)}/skip`,
        payload,
        { headers: this.getUserHeaders() }
      )
    );
  }

  endInterview(sessionId: string) {
    return firstValueFrom(
      this.http.post<InterviewEndResponse>(
        `${this.apiBase}/${encodeURIComponent(sessionId)}/end`,
        {},
        { headers: this.getUserHeaders() }
      )
    );
  }

  getSession(sessionId: string) {
    return firstValueFrom(
      this.http.get<InterviewSessionResponse>(
        `${this.apiBase}/${encodeURIComponent(sessionId)}`,
        {
          headers: this.getUserHeaders(),
        }
      )
    );
  }

  getMyInterviewHistory() {
    return firstValueFrom(
      this.http.get<InterviewHistoryResponse>(`${this.apiBase}/history/me`, {
        headers: this.getUserHeaders(),
      })
    );
  }

  private getUserHeaders() {
    const userId = this.resolveUserId();
    if (!userId) {
      return undefined;
    }

    return new HttpHeaders({
      "x-user-id": userId,
    });
  }

  private resolveUserId() {
    const token = sessionStorage.getItem("authToken");
    if (!token) {
      return undefined;
    }

    try {
      const payloadSegment = token.split(".")[1];
      if (!payloadSegment) {
        return undefined;
      }

      const normalized = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
      const decoded = JSON.parse(atob(padded)) as {
        user_id?: string;
        sub?: string;
        uid?: string;
      };

      return decoded.user_id || decoded.sub || decoded.uid || undefined;
    } catch {
      return undefined;
    }
  }
}
