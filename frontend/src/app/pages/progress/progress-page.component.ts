import { CommonModule } from "@angular/common";
import { Component, OnInit, inject } from "@angular/core";
import { AuthenticatedShellComponent } from "../../shared/components/authenticated-shell/authenticated-shell.component";
import { AppLoaderComponent } from "../../shared/components/app-loader/app-loader.component";
import {
  InterviewScoreItem,
  ProgressResponse,
  ProgressService,
  ProgressSkill,
} from "../../core/services/progress.service";
import { environment } from "../../../environments/environment";

type ProgressViewState = "loading" | "ready" | "empty" | "error";

interface SkillRow {
  name: string;
  percentage: number;
}

const SKILL_ORDER = [
  "Technical Accuracy",
  "Communication",
  "Confidence",
  "Problem Solving",
];

const ZERO_OVERVIEW = {
  totalInterviews: 0,
  completedInterviews: 0,
  averageScore: 0,
  bestScore: 0,
  latestScore: 0,
};

@Component({
  selector: "app-progress-page",
  standalone: true,
  imports: [CommonModule, AuthenticatedShellComponent, AppLoaderComponent],
  templateUrl: "./progress-page.component.html",
  styleUrls: ["./progress-page.component.css"],
})
export class ProgressPageComponent implements OnInit {
  private readonly progressService = inject(ProgressService);

  state: ProgressViewState = "loading";
  overview = { ...ZERO_OVERVIEW };
  skills: SkillRow[] = SKILL_ORDER.map((name) => ({ name, percentage: 0 }));
  interviewScores: InterviewScoreItem[] = [];

  ngOnInit(): void {
    void this.loadProgress();
  }

  get visibleInterviewScores(): InterviewScoreItem[] {
    return this.interviewScores.slice(-4);
  }

  async loadProgress(): Promise<void> {
    this.state = "loading";

    try {
      const payload = await this.progressService.getMyProgress();
      this.applyPayload(payload);
      this.state = this.overview.completedInterviews > 0 ? "ready" : "empty";
    } catch (error) {
      this.state = "error";
      if (!environment.production) {
        console.error("[progress] Failed to load progress", error);
      }
    }
  }

  private applyPayload(payload: ProgressResponse): void {
    const safeOverview = payload?.overview || ZERO_OVERVIEW;
    this.overview = {
      totalInterviews: this.toCount(safeOverview.totalInterviews),
      completedInterviews: this.toCount(safeOverview.completedInterviews),
      averageScore: this.toScore(safeOverview.averageScore),
      bestScore: this.toScore(safeOverview.bestScore),
      latestScore: this.toScore(safeOverview.latestScore),
    };

    const skillByName = new Map<string, ProgressSkill>();
    (payload?.skills || []).forEach((skill) => {
      if (skill && typeof skill.name === "string") {
        skillByName.set(skill.name, skill);
      }
    });

    this.skills = SKILL_ORDER.map((name) => {
      const value = skillByName.get(name)?.percentage;
      return {
        name,
        percentage: this.toPercentage(value),
      };
    });

    this.interviewScores = Array.isArray(payload?.interviewScores)
      ? payload.interviewScores.map((item) => ({
          label: typeof item.label === "string" && item.label.trim() ? item.label : "Interview",
          score: this.toScore(item.score),
          maxScore: this.toScore(item.maxScore || 10),
          sessionId: typeof item.sessionId === "string" ? item.sessionId : "",
          completedAt:
            typeof item.completedAt === "string" && item.completedAt.trim()
              ? item.completedAt
              : null,
        }))
      : [];
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

  private toPercentage(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return 0;
    }

    return Math.max(0, Math.min(100, Math.round(parsed)));
  }
}
