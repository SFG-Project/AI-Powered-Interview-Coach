import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { environment } from "../../../environments/environment";

export interface AdminSummaryCard {
  label: string;
  value: string;
}

export interface AdminRecentUserRow {
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

  async getDashboard(): Promise<AdminDashboardResponse> {
    return await firstValueFrom(this.http.get<AdminDashboardResponse>(this.endpoint));
  }
}
