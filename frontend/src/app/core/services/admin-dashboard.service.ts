import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { environment } from "../../../environments/environment";

export interface AdminSummaryCard {
  label: string;
  value: string;
}

export interface AdminRecentUserRow {
  userId?: string;
  name: string;
  email: string;
  role: string;
  status: string;
  action: string;
}

export interface AdminSystemSummaryRow {
  label: string;
  value: string;
  tone: "active" | "pending" | "blocked";
}

export interface AdminPerformanceRow {
  label: string;
  percentage: number;
}

export interface AdminReportRow {
  sessionId?: string;
  date: string;
  user: string;
  interviewType: string;
  score: string;
  report: string;
}

export interface AdminActionItem {
  label: string;
  action: string;
  tone: "primary" | "warning" | "danger";
  enabled?: boolean;
  hint?: string;
}

export type AdminUserRole = "admin" | "user";
export type AdminUserStatus = "active" | "pending" | "blocked";

export interface AdminCreateUserPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  careerField: string;
  role: AdminUserRole;
  status: AdminUserStatus;
}

export interface AdminCreateUserResponse {
  id: string;
  user: {
    userId: string;
    name: string;
    email: string;
    role: string;
    status: string;
  };
}

export interface AdminClearLogsResponse {
  cleared: boolean;
  logsAvailable: boolean;
  message: string;
}

export interface AdminReportDetailQuestion {
  number: number;
  question: string;
  answer: string;
  score: number;
  feedbackSummary: string;
}

export interface AdminReportDetailResponse {
  sessionId: string;
  user: {
    userId: string;
    name: string;
    email: string;
  };
  interviewType: string;
  difficulty: string;
  careerField: string;
  status: string;
  score: number;
  maxScore: number;
  completedAt: string | null;
  summary: string;
  questions: AdminReportDetailQuestion[];
}

export interface AdminDashboardResponse {
  summaryCards: AdminSummaryCard[];
  recentUsers: AdminRecentUserRow[];
  systemSummary: AdminSystemSummaryRow[];
  performanceOverview: AdminPerformanceRow[];
  recentInterviewReports: AdminReportRow[];
  adminActions: AdminActionItem[];
  adminUser: {
    name: string;
    avatarText: string;
  };
}

@Injectable({ providedIn: "root" })
export class AdminDashboardService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiBaseUrl}/api/admin/dashboard`;
  private readonly adminApiBase = `${environment.apiBaseUrl}/api/admin`;

  async getDashboard(): Promise<AdminDashboardResponse> {
    return await firstValueFrom(this.http.get<AdminDashboardResponse>(this.endpoint));
  }

  async createUser(payload: AdminCreateUserPayload): Promise<AdminCreateUserResponse> {
    return await firstValueFrom(
      this.http.post<AdminCreateUserResponse>(`${this.adminApiBase}/users`, payload)
    );
  }

  async exportReportsCsv(): Promise<Blob> {
    return await firstValueFrom(
      this.http.get(`${this.adminApiBase}/reports/export`, {
        responseType: "blob",
      })
    );
  }

  async getReportDetail(sessionId: string): Promise<AdminReportDetailResponse> {
    return await firstValueFrom(
      this.http.get<AdminReportDetailResponse>(
        `${this.adminApiBase}/reports/${encodeURIComponent(sessionId)}`
      )
    );
  }

  async clearLogs(): Promise<AdminClearLogsResponse> {
    return await firstValueFrom(
      this.http.post<AdminClearLogsResponse>(`${this.adminApiBase}/logs/clear`, {})
    );
  }
}
