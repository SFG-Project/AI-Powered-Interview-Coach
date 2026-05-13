import { CommonModule } from "@angular/common";
import { Component, OnInit, inject } from "@angular/core";
import { AuthenticatedShellComponent } from "../../shared/components/authenticated-shell/authenticated-shell.component";
import { AppLoaderComponent } from "../../shared/components/app-loader/app-loader.component";
import {
  FeedbackReport,
  FeedbackReportQuestion,
  FeedbackReportsResponse,
  FeedbackReportsService,
} from "../../core/services/feedback-reports.service";
import { environment } from "../../../environments/environment";

type FeedbackReportsState = "loading" | "ready" | "empty" | "error";

@Component({
  selector: "app-feedback-reports-page",
  standalone: true,
  imports: [CommonModule, AuthenticatedShellComponent, AppLoaderComponent],
  templateUrl: "./feedback-reports-page.component.html",
  styleUrls: ["./feedback-reports-page.component.css"],
})
export class FeedbackReportsPageComponent implements OnInit {
  private readonly feedbackReportsService = inject(FeedbackReportsService);

  state: FeedbackReportsState = "loading";
  reports: FeedbackReport[] = [];

  ngOnInit(): void {
    void this.loadReports();
  }

  async loadReports(): Promise<void> {
    this.state = "loading";

    try {
      const payload = await this.feedbackReportsService.getMyFeedbackReports();
      this.reports = this.normalizeReports(payload);
      this.state = this.reports.length > 0 ? "ready" : "empty";
    } catch (error) {
      this.state = "error";
      if (!environment.production) {
        console.error("[feedback-reports] Failed to load reports", error);
      }
    }
  }

  formatList(values: string[]): string {
    return values.join("; ");
  }

  private normalizeReports(payload: FeedbackReportsResponse): FeedbackReport[] {
    if (!Array.isArray(payload?.reports)) {
      return [];
    }

    return payload.reports.map((report, index) => ({
      sessionId:
        typeof report.sessionId === "string" && report.sessionId.trim()
          ? report.sessionId
          : `session-${index + 1}`,
      title:
        typeof report.title === "string" && report.title.trim()
          ? report.title
          : `Report ${index + 1} - Interview`,
      careerField:
        typeof report.careerField === "string" && report.careerField.trim()
          ? report.careerField
          : "General",
      interviewType:
        typeof report.interviewType === "string" && report.interviewType.trim()
          ? report.interviewType
          : "Interview",
      difficulty:
        typeof report.difficulty === "string" && report.difficulty.trim()
          ? report.difficulty
          : "Medium",
      score: this.toScore(report.score),
      maxScore: this.toMaxScore(report.maxScore),
      completedAt:
        typeof report.completedAt === "string" && report.completedAt.trim()
          ? report.completedAt
          : null,
      strengths: this.normalizeStringList(report.strengths, [
        "You completed the interview and attempted the questions.",
      ]),
      weaknesses: this.normalizeStringList(report.weaknesses, [
        "No major weaknesses recorded yet.",
      ]),
      suggestions: this.normalizeStringList(report.suggestions, [
        "Continue practising and include clear examples in your answers.",
      ]),
      summary:
        typeof report.summary === "string" && report.summary.trim()
          ? report.summary
          : "Overall summary not available.",
      questions: this.normalizeQuestions(report.questions),
    }));
  }

  private normalizeQuestions(value: unknown): FeedbackReportQuestion[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.map((item, index) => {
      const question = item as Partial<FeedbackReportQuestion>;
      return {
        number: this.toQuestionNumber(question.number, index),
        question:
          typeof question.question === "string" && question.question.trim()
            ? question.question
            : "Question text unavailable.",
        answer:
          typeof question.answer === "string" && question.answer.trim()
            ? question.answer
            : "No answer recorded.",
        score: this.toScore(question.score),
        feedbackSummary:
          typeof question.feedbackSummary === "string" && question.feedbackSummary.trim()
            ? question.feedbackSummary
            : "Feedback summary not available.",
        suggestedAnswer:
          typeof question.suggestedAnswer === "string" && question.suggestedAnswer.trim()
            ? question.suggestedAnswer
            : "Suggested answer not available.",
      };
    });
  }

  private normalizeStringList(value: unknown, fallback: string[]): string[] {
    if (!Array.isArray(value)) {
      return fallback;
    }

    const cleaned = value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => Boolean(item));

    return cleaned.length > 0 ? cleaned : fallback;
  }

  private toQuestionNumber(value: unknown, index: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return index + 1;
    }

    return Math.round(parsed);
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
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 10;
    }

    return Math.max(1, Math.min(10, Math.round(parsed)));
  }
}
