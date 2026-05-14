import { CommonModule } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import { Component, OnInit, inject } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { environment } from "../../../environments/environment";
import {
  AdminActionItem,
  AdminCreateUserPayload,
  AdminDashboardResponse,
  AdminDashboardService,
  AdminPerformanceRow,
  AdminRecentUserRow,
  AdminReportDetailResponse,
  AdminReportRow,
  AdminSystemSummaryRow,
  AdminUserRole,
  AdminUserStatus,
} from "../../core/services/admin-dashboard.service";
import { SidebarComponent } from "../../shared/components/sidebar/sidebar.component";

type AdminDashboardState = "loading" | "ready" | "error";

const DEFAULT_SUMMARY_CARDS = [
  { label: "Total Users", value: "0" },
  { label: "Total Interviews", value: "0" },
  { label: "Average Score", value: "0.0 / 10" },
  { label: "Active Today", value: "0" },
];

const DEFAULT_SYSTEM_SUMMARY = [
  { label: "Active Users", value: "0", tone: "active" as const },
  { label: "Pending Users", value: "0", tone: "pending" as const },
  { label: "Blocked Users", value: "0", tone: "blocked" as const },
];

const DEFAULT_PERFORMANCE_OVERVIEW = [
  { label: "Technical Interviews", percentage: 0 },
  { label: "Behavioral Interviews", percentage: 0 },
  { label: "Mixed Interviews", percentage: 0 },
];

const DEFAULT_ADMIN_ACTIONS: AdminActionItem[] = [
  { label: "Add User", action: "add-user", tone: "primary", enabled: true },
  {
    label: "Export Reports",
    action: "export-reports",
    tone: "warning",
    enabled: true,
  },
  {
    label: "Clear Logs",
    action: "clear-logs",
    tone: "danger",
    enabled: false,
    hint: "Log storage is not configured yet in this project.",
  },
];

const CAREER_FIELD_OPTIONS = [
  "Software Developer",
  "Data Analyst",
  "Business Analyst",
  "Project Manager",
  "Cybersecurity Analyst",
  "Other",
];

function buildEmptyAdminDashboard(): AdminDashboardResponse {
  return {
    summaryCards: DEFAULT_SUMMARY_CARDS,
    recentUsers: [],
    systemSummary: DEFAULT_SYSTEM_SUMMARY,
    performanceOverview: DEFAULT_PERFORMANCE_OVERVIEW,
    recentInterviewReports: [],
    adminActions: DEFAULT_ADMIN_ACTIONS,
    adminUser: {
      name: "Admin",
      avatarText: "A",
    },
  };
}

@Component({
  selector: "app-admin-dashboard-page",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SidebarComponent],
  templateUrl: "./admin-dashboard-page.component.html",
  styleUrls: ["./admin-dashboard-page.component.css"],
})
export class AdminDashboardPageComponent implements OnInit {
  private readonly adminDashboardService = inject(AdminDashboardService);
  private readonly formBuilder = inject(FormBuilder);

  state: AdminDashboardState = "loading";
  dashboard: AdminDashboardResponse = buildEmptyAdminDashboard();

  actionErrorMessage = "";
  actionSuccessMessage = "";

  isSubmittingAddUser = false;
  isExportingReports = false;
  isClearingLogs = false;

  isAddUserDialogOpen = false;
  isUserDetailDialogOpen = false;
  isReportDetailDialogOpen = false;
  isLoadingReportDetail = false;

  selectedUser: AdminRecentUserRow | null = null;
  selectedReport: AdminReportDetailResponse | null = null;
  reportDetailErrorMessage = "";

  readonly careerFieldOptions = CAREER_FIELD_OPTIONS;
  readonly roleOptions: { label: string; value: AdminUserRole }[] = [
    { label: "User", value: "user" },
    { label: "Admin", value: "admin" },
  ];
  readonly statusOptions: { label: string; value: AdminUserStatus }[] = [
    { label: "Active", value: "active" },
    { label: "Pending", value: "pending" },
    { label: "Blocked", value: "blocked" },
  ];

  readonly addUserForm = this.formBuilder.nonNullable.group({
    firstName: ["", [Validators.required]],
    lastName: ["", [Validators.required]],
    email: ["", [Validators.required, Validators.email]],
    password: [
      "",
      [Validators.required, Validators.minLength(8), Validators.pattern(/^(?=.*[A-Za-z])(?=.*\d).+$/)],
    ],
    careerField: ["Software Developer", [Validators.required]],
    role: ["user" as AdminUserRole, [Validators.required]],
    status: ["active" as AdminUserStatus, [Validators.required]],
  });

  get isActionBusy(): boolean {
    return this.isSubmittingAddUser || this.isExportingReports || this.isClearingLogs;
  }

  ngOnInit(): void {
    void this.loadDashboard();
  }

  async loadDashboard(): Promise<void> {
    this.state = "loading";

    try {
      const payload = await this.adminDashboardService.getDashboard();
      this.dashboard = this.normalizeDashboardPayload(payload);
      this.state = "ready";
    } catch (error) {
      this.dashboard = buildEmptyAdminDashboard();
      this.state = "error";
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

  isActionEnabled(action: AdminActionItem): boolean {
    if (action.enabled === false) {
      return false;
    }

    return !this.isActionBusy;
  }

  async onAdminAction(action: AdminActionItem): Promise<void> {
    this.actionErrorMessage = "";
    this.actionSuccessMessage = "";

    if (action.enabled === false) {
      this.actionErrorMessage = action.hint || "This action is not available yet.";
      return;
    }

    if (action.action === "add-user") {
      this.openAddUserDialog();
      return;
    }

    if (action.action === "export-reports") {
      await this.exportReports();
      return;
    }

    if (action.action === "clear-logs") {
      await this.clearLogs();
      return;
    }

    if (!environment.production) {
      console.info(`[admin/actions] Unknown action: ${action.action}`);
    }
  }

  openAddUserDialog(): void {
    this.addUserForm.reset({
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      careerField: "Software Developer",
      role: "user",
      status: "active",
    });
    this.isAddUserDialogOpen = true;
  }

  closeAddUserDialog(): void {
    if (this.isSubmittingAddUser) {
      return;
    }

    this.isAddUserDialogOpen = false;
  }

  async submitAddUser(): Promise<void> {
    this.actionErrorMessage = "";
    this.actionSuccessMessage = "";

    if (this.addUserForm.invalid) {
      this.addUserForm.markAllAsTouched();
      return;
    }

    this.isSubmittingAddUser = true;

    try {
      const form = this.addUserForm.getRawValue();
      const payload: AdminCreateUserPayload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        careerField: form.careerField,
        role: form.role,
        status: form.status,
      };

      const response = await this.adminDashboardService.createUser(payload);
      this.isAddUserDialogOpen = false;
      this.actionSuccessMessage = `User ${response.user.name} created successfully.`;
      await this.loadDashboard();
    } catch (error) {
      this.actionErrorMessage = this.toErrorMessage(error, "Failed to create user.");
    } finally {
      this.isSubmittingAddUser = false;
    }
  }

  onViewUser(row: AdminRecentUserRow): void {
    this.selectedUser = row;
    this.isUserDetailDialogOpen = true;
  }

  closeUserDetailDialog(): void {
    this.selectedUser = null;
    this.isUserDetailDialogOpen = false;
  }

  async onOpenReport(row: AdminReportRow): Promise<void> {
    this.reportDetailErrorMessage = "";
    this.selectedReport = null;
    this.isReportDetailDialogOpen = true;
    this.isLoadingReportDetail = true;

    try {
      if (!row.sessionId) {
        this.reportDetailErrorMessage =
          "Report detail endpoint requires a session id. This row cannot be opened yet.";
        return;
      }

      this.selectedReport = await this.adminDashboardService.getReportDetail(row.sessionId);
    } catch (error) {
      this.reportDetailErrorMessage = this.toErrorMessage(
        error,
        "Failed to load report details."
      );
    } finally {
      this.isLoadingReportDetail = false;
    }
  }

  closeReportDetailDialog(): void {
    this.isReportDetailDialogOpen = false;
    this.isLoadingReportDetail = false;
    this.selectedReport = null;
    this.reportDetailErrorMessage = "";
  }

  async exportReports(): Promise<void> {
    this.isExportingReports = true;

    try {
      const blob = await this.adminDashboardService.exportReportsCsv();
      const dateLabel = new Date().toISOString().slice(0, 10);
      this.downloadBlob(blob, `admin-reports-${dateLabel}.csv`);
      this.actionSuccessMessage = "Reports exported successfully.";
    } catch (error) {
      this.actionErrorMessage = this.toErrorMessage(error, "Failed to export reports.");
    } finally {
      this.isExportingReports = false;
    }
  }

  async clearLogs(): Promise<void> {
    this.isClearingLogs = true;

    try {
      const response = await this.adminDashboardService.clearLogs();
      if (response.cleared) {
        this.actionSuccessMessage = response.message;
      } else {
        this.actionErrorMessage = response.message;
      }
    } catch (error) {
      this.actionErrorMessage = this.toErrorMessage(error, "Failed to clear logs.");
    } finally {
      this.isClearingLogs = false;
    }
  }

  formatCompletedAt(value: string | null | undefined): string {
    if (!value) {
      return "N/A";
    }

    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) {
      return "N/A";
    }

    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(new Date(parsed));
  }

  private normalizeDashboardPayload(payload: AdminDashboardResponse): AdminDashboardResponse {
    return {
      summaryCards:
        Array.isArray(payload?.summaryCards) && payload.summaryCards.length
          ? payload.summaryCards
          : DEFAULT_SUMMARY_CARDS,
      recentUsers: Array.isArray(payload?.recentUsers) ? payload.recentUsers : [],
      systemSummary:
        Array.isArray(payload?.systemSummary) && payload.systemSummary.length
          ? payload.systemSummary
          : DEFAULT_SYSTEM_SUMMARY,
      performanceOverview:
        Array.isArray(payload?.performanceOverview) && payload.performanceOverview.length
          ? payload.performanceOverview
          : DEFAULT_PERFORMANCE_OVERVIEW,
      recentInterviewReports: Array.isArray(payload?.recentInterviewReports)
        ? payload.recentInterviewReports
        : [],
      adminActions:
        Array.isArray(payload?.adminActions) && payload.adminActions.length
          ? payload.adminActions
          : DEFAULT_ADMIN_ACTIONS,
      adminUser: {
        name:
          typeof payload?.adminUser?.name === "string" && payload.adminUser.name.trim()
            ? payload.adminUser.name.trim()
            : "Admin",
        avatarText:
          typeof payload?.adminUser?.avatarText === "string" &&
          payload.adminUser.avatarText.trim()
            ? payload.adminUser.avatarText.trim()
            : "A",
      },
    };
  }

  private toErrorMessage(error: unknown, fallbackMessage: string): string {
    if (error instanceof HttpErrorResponse) {
      if (
        error.error &&
        typeof error.error === "object" &&
        typeof (error.error as { message?: unknown }).message === "string"
      ) {
        return (error.error as { message: string }).message;
      }

      if (typeof error.message === "string" && error.message.trim()) {
        return error.message;
      }
    }

    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    return fallbackMessage;
  }

  private downloadBlob(blob: Blob, fileName: string): void {
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  }
}
