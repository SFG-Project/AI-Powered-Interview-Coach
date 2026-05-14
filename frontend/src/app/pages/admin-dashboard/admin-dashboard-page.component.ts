import { CommonModule } from "@angular/common";
import { Component, OnInit, inject } from "@angular/core";
import { environment } from "../../../environments/environment";
import {
  AdminActionItem,
  AdminDashboardResponse,
  AdminDashboardService,
  AdminPerformanceRow,
  AdminRecentUserRow,
  AdminSystemSummaryRow,
} from "../../core/services/admin-dashboard.service";
import { SidebarComponent } from "../../shared/components/sidebar/sidebar.component";

type AdminDashboardState = "loading" | "ready" | "error";

const FALLBACK_ADMIN_DASHBOARD: AdminDashboardResponse = {
  summaryCards: [
    { label: "Total Users", value: "148" },
    { label: "Total Interviews", value: "520" },
    { label: "Average Score", value: "7.4 / 10" },
    { label: "Active Today", value: "36" },
  ],
  recentUsers: [
    {
      name: "Rorisang Sekoamane",
      email: "rorisang@example.com",
      role: "Software Developer",
      status: "Active",
      action: "View",
    },
    {
      name: "Thabo Mokoena",
      email: "thabo@example.com",
      role: "IT Support",
      status: "Pending",
      action: "View",
    },
    {
      name: "Lerato Nkosi",
      email: "lerato@example.com",
      role: "Data Analyst",
      status: "Blocked",
      action: "View",
    },
  ],
  systemSummary: [
    { label: "Active Users", value: "112", tone: "active" },
    { label: "Pending Users", value: "24", tone: "pending" },
    { label: "Blocked Users", value: "12", tone: "blocked" },
  ],
  performanceOverview: [
    { label: "Technical Interviews", percentage: 82 },
    { label: "Behavioral Interviews", percentage: 68 },
    { label: "Mixed Interviews", percentage: 74 },
  ],
  recentInterviewReports: [
    {
      date: "06 May 2026",
      user: "Rorisang",
      interviewType: "Technical",
      score: "8/10",
      report: "Open",
    },
    {
      date: "05 May 2026",
      user: "Thabo",
      interviewType: "Behavioral",
      score: "7/10",
      report: "Open",
    },
    {
      date: "04 May 2026",
      user: "Lerato",
      interviewType: "Mixed",
      score: "6/10",
      report: "Open",
    },
  ],
  adminActions: [
    { label: "Add User", action: "add-user", tone: "primary" },
    { label: "Export Reports", action: "export-reports", tone: "warning" },
    { label: "Clear Logs", action: "clear-logs", tone: "danger" },
  ],
  adminUser: {
    name: "Admin",
    avatarText: "A",
  },
};

@Component({
  selector: "app-admin-dashboard-page",
  standalone: true,
  imports: [CommonModule, SidebarComponent],
  templateUrl: "./admin-dashboard-page.component.html",
  styleUrls: ["./admin-dashboard-page.component.css"],
})
export class AdminDashboardPageComponent implements OnInit {
  private readonly adminDashboardService = inject(AdminDashboardService);

  state: AdminDashboardState = "loading";
  dashboard: AdminDashboardResponse = FALLBACK_ADMIN_DASHBOARD;

  ngOnInit(): void {
    void this.loadDashboard();
  }

  async loadDashboard(): Promise<void> {
    this.state = "loading";
    this.logDashboardLoad("start");

    try {
      this.dashboard = await this.adminDashboardService.getDashboard();
      this.state = "ready";
      this.logDashboardLoad("success");
    } catch (error) {
      this.state = "error";
      this.dashboard = FALLBACK_ADMIN_DASHBOARD;
      this.logDashboardLoad("fallback");
      if (!environment.production) {
        console.error("[admin/dashboard] Failed to load admin dashboard data.", error);
      }
    }
  }

  getStatusClass(row: AdminRecentUserRow): string {
    const normalizedStatus = row.status.toLowerCase();
    if (normalizedStatus === "active") {
      return "status-pill status-active";
    }
    if (normalizedStatus === "pending") {
      return "status-pill status-pending";
    }
    return "status-pill status-blocked";
  }

  getSummaryToneClass(row: AdminSystemSummaryRow): string {
    if (row.tone === "active") {
      return "summary-badge summary-active";
    }
    if (row.tone === "pending") {
      return "summary-badge summary-pending";
    }
    return "summary-badge summary-blocked";
  }

  getBarWidth(row: AdminPerformanceRow): string {
    const safeValue = Number.isFinite(row.percentage)
      ? Math.max(0, Math.min(100, row.percentage))
      : 0;
    return `${safeValue}%`;
  }

  getActionClass(action: AdminActionItem): string {
    if (action.tone === "primary") {
      return "action-btn action-primary";
    }
    if (action.tone === "warning") {
      return "action-btn action-warning";
    }
    return "action-btn action-danger";
  }

  onAdminAction(action: AdminActionItem): void {
    if (!environment.production) {
      console.info(`[admin/actions] Triggered action: ${action.action}`);
    }
  }

  private logDashboardLoad(stage: "start" | "success" | "fallback"): void {
    if (environment.production) {
      return;
    }

    console.info("[admin/dashboard] Load state.", {
      stage,
      summaryCards: this.dashboard.summaryCards.length,
      recentUsers: this.dashboard.recentUsers.length,
      recentInterviewReports: this.dashboard.recentInterviewReports.length,
      systemSummary: this.dashboard.systemSummary.length,
      performanceOverview: this.dashboard.performanceOverview.length,
      adminActions: this.dashboard.adminActions.length,
    });
  }
}
