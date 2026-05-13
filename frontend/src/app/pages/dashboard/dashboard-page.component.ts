import { CommonModule } from "@angular/common";
import { Component, OnInit, inject } from "@angular/core";
import { RouterLink } from "@angular/router";
import { environment } from "../../../environments/environment";
import {
  DashboardRecentInterview,
  DashboardResponse,
  DashboardService,
} from "../../core/services/dashboard.service";
import { AuthenticatedShellComponent } from "../../shared/components/authenticated-shell/authenticated-shell.component";
import { DashboardSkeletonComponent } from "../../shared/components/dashboard-skeleton/dashboard-skeleton.component";

interface SummaryCard {
  label: string;
  value: string;
}

interface InterviewRow {
  date: string;
  role: string;
  type: string;
  score: string;
}

type DashboardState = "loading" | "ready" | "empty" | "error";

@Component({
  selector: "app-dashboard-page",
  standalone: true,
  imports: [CommonModule, AuthenticatedShellComponent, RouterLink, DashboardSkeletonComponent],
  templateUrl: "./dashboard-page.component.html",
  styleUrls: ["./dashboard-page.component.css"],
})
export class DashboardPageComponent implements OnInit {
  private readonly dashboardService = inject(DashboardService);

  state: DashboardState = "loading";
  summaryCards: SummaryCard[] = this.buildSummaryCards(0, 0, 0);
  welcomeTitle = "Welcome Back";
  welcomeMessage = "Start your first interview to begin tracking your progress.";
  recentInterviews: InterviewRow[] = [];

  ngOnInit(): void {
    void this.loadDashboard();
  }

  async loadDashboard(): Promise<void> {
    this.state = "loading";

    try {
      const payload = await this.dashboardService.getMyDashboard();
      this.applyPayload(payload);
      this.state = this.toCount(payload?.summary?.totalInterviews) > 0 ? "ready" : "empty";
    } catch (error) {
      this.state = "error";
      this.summaryCards = this.buildSummaryCards(0, 0, 0);
      this.recentInterviews = [];
      this.welcomeTitle = "Welcome Back";
      this.welcomeMessage = "Start your first interview to begin tracking your progress.";

      if (!environment.production) {
        console.error("[dashboard] Failed to load dashboard", error);
      }
    }
  }

  private applyPayload(payload: DashboardResponse): void {
    const totalInterviews = this.toCount(payload?.summary?.totalInterviews);
    const averageScore = this.toScore(payload?.summary?.averageScore);
    const confidenceLevel = this.toPercentage(payload?.summary?.confidenceLevel);

    this.summaryCards = this.buildSummaryCards(totalInterviews, averageScore, confidenceLevel);
    this.welcomeTitle =
      typeof payload?.welcomeMessage?.title === "string" && payload.welcomeMessage.title.trim()
        ? payload.welcomeMessage.title.trim()
        : "Welcome Back";
    this.welcomeMessage =
      typeof payload?.welcomeMessage?.message === "string" &&
      payload.welcomeMessage.message.trim()
        ? payload.welcomeMessage.message.trim()
        : "Start your first interview to begin tracking your progress.";

    this.recentInterviews = Array.isArray(payload?.recentInterviews)
      ? payload.recentInterviews.map((row) => this.toInterviewRow(row))
      : [];
  }

  private toInterviewRow(row: DashboardRecentInterview): InterviewRow {
    const score = this.toScore(row?.score);
    const maxScore = this.toMaxScore(row?.maxScore);
    const date =
      typeof row?.date === "string" && row.date.trim()
        ? row.date.trim()
        : this.formatDate(row?.completedAt);

    return {
      date,
      role:
        typeof row?.careerField === "string" && row.careerField.trim()
          ? row.careerField.trim()
          : "General",
      type:
        typeof row?.interviewType === "string" && row.interviewType.trim()
          ? row.interviewType.trim()
          : "Interview",
      score: `${this.formatScore(score)}/${maxScore}`,
    };
  }

  private buildSummaryCards(
    totalInterviews: number,
    averageScore: number,
    confidenceLevel: number
  ): SummaryCard[] {
    return [
      { label: "Total Interviews", value: String(totalInterviews) },
      { label: "Average Score", value: `${averageScore.toFixed(1)} / 10` },
      { label: "Confidence Level", value: `${confidenceLevel}%` },
    ];
  }

  private toCount(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return 0;
    }

    return Math.max(0, Math.round(parsed));
  }

  private toScore(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return 0;
    }

    return Math.max(0, Math.min(10, Number(parsed.toFixed(1))));
  }

  private toMaxScore(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return 10;
    }

    return Math.max(1, Math.min(10, Math.round(parsed)));
  }

  private toPercentage(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return 0;
    }

    return Math.max(0, Math.min(100, Math.round(parsed)));
  }

  private formatScore(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  private formatDate(value: string | null | undefined): string {
    if (!value) {
      return "";
    }

    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) {
      return "";
    }

    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(new Date(parsed));
  }
}
