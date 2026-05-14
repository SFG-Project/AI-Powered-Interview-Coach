import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { SidebarComponent } from "../../shared/components/sidebar/sidebar.component";
import { AppLoaderComponent } from "../../shared/components/app-loader/app-loader.component";
import {
  InterviewFeedback,
  InterviewQuestion,
  InterviewService,
  InterviewSetupPayload,
} from "../../core/services/interview.service";
import { environment } from "../../../environments/environment";

type InterviewState =
  | "setup"
  | "loading"
  | "active"
  | "submitting"
  | "aiTyping"
  | "completed"
  | "error";

interface ChatMessage {
  sender: "ai" | "user";
  content: string;
}

const PLACEHOLDER_FEEDBACK: InterviewFeedback = {
  score: 0,
  summary: "",
  clarity: "",
  technicalAccuracy: "",
  confidence: "",
  communication: "",
  quickTip: "",
  sessionNotes: "",
  strengths: [],
  improvements: [],
  suggestedAnswer: "",
};

@Component({
  selector: "app-interview-session-page",
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent, AppLoaderComponent],
  templateUrl: "./interview-session-page.component.html",
  styleUrls: ["./interview-session-page.component.css"],
})
export class InterviewSessionPageComponent implements OnInit, OnDestroy {
  private readonly interviewService = inject(InterviewService);
  private timerHandle: ReturnType<typeof setInterval> | null = null;
  private isAutoSkipping = false;

  readonly careerFieldOptions = [
    "Software Development",
    "Finance",
    "Healthcare",
    "Education",
    "Marketing",
    "Engineering",
    "Human Resources",
    "Sales",
    "Customer Support",
    "Other",
  ];

  readonly interviewTypeOptions = ["Technical", "Behavioural", "HR", "Mixed"];
  readonly difficultyOptions = ["Easy", "Medium", "Hard"];
  readonly questionCountOptions = [3, 5, 10];

  state: InterviewState = "setup";
  errorMessage = "";
  completionSummary = "";

  setupModel: InterviewSetupPayload = {
    careerField: "Software Developer",
    interviewType: "Technical",
    difficulty: "Medium",
    questionCount: 5,
  };

  sessionId = "";
  currentQuestion: InterviewQuestion | null = null;
  sessionQuestionCount = 0;
  questionPointer = 0;
  messages: ChatMessage[] = [];
  userAnswer = "";
  isPaused = false;
  timeLeft = 80;
  evaluation = { ...PLACEHOLDER_FEEDBACK };

  userName = "Rorisang";
  userInitial = "R";

  ngOnInit(): void {
    this.syncUserIdentity();
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  get hasSession(): boolean {
    return Boolean(this.sessionId);
  }

  get currentQuestionNumber(): number {
    return this.questionPointer;
  }

  get totalQuestions(): number {
    if (this.currentQuestion?.total) {
      return this.currentQuestion.total;
    }

    if (this.sessionQuestionCount > 0) {
      return this.sessionQuestionCount;
    }

    return this.setupModel.questionCount;
  }

  get progressPercentage(): number {
    if (!this.currentQuestion || !this.currentQuestion.total) {
      return 0;
    }

    return (
      ((this.currentQuestion.number - 1) / this.currentQuestion.total) * 100
    );
  }

  get timerLabel(): string {
    const minutes = Math.floor(this.timeLeft / 60);
    const seconds = this.timeLeft % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")} Left`;
  }

  get scoreLabel(): string {
    return this.evaluation.score.toFixed(1);
  }

  get scoreRingStyle() {
    const percentage = Math.max(0, Math.min(100, (this.evaluation.score / 10) * 100));
    return {
      background: `conic-gradient(#2d69f6 ${percentage}%, #d4dbea ${percentage}% 100%)`,
    };
  }

  get isBusy(): boolean {
    return this.state === "loading" || this.state === "submitting" || this.state === "aiTyping";
  }

  onSetupChange(field: keyof InterviewSetupPayload, event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    if (!target) {
      return;
    }

    if (field === "questionCount") {
      this.setupModel.questionCount = Number(target.value) || 5;
      return;
    }

    if (field === "careerField" || field === "interviewType" || field === "difficulty") {
      this.setupModel[field] = target.value;
    }
  }

  async startInterview(): Promise<void> {
    this.state = "loading";
    this.errorMessage = "";
    this.completionSummary = "";
    const startPayload: InterviewSetupPayload = {
      careerField: this.setupModel.careerField,
      interviewType: this.setupModel.interviewType,
      difficulty: this.setupModel.difficulty,
      questionCount: Number(this.setupModel.questionCount),
    };

    if (!environment.production) {
      console.info("[interview/start] setup payload:", startPayload);
    }

    try {
      const response = await this.interviewService.startInterview(startPayload);
      this.sessionId = response.sessionId;
      this.currentQuestion = response.question;
      this.sessionQuestionCount = response.question.total;
      this.questionPointer = response.question.number;
      this.logQuestionSource(response.question.source);
      this.evaluation = { ...PLACEHOLDER_FEEDBACK };
      this.messages = [
        {
          sender: "ai",
          content: `Hello ${this.userName}. Welcome to your mock interview.`,
        },
        {
          sender: "ai",
          content: response.question.text,
        },
      ];
      this.userAnswer = "";
      this.isPaused = false;
      this.timeLeft = 80;
      this.startTimer();
      this.state = "active";
    } catch (error) {
      this.errorMessage = this.toErrorMessage(error);
      this.state = "error";
    }
  }

  onAnswerInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (!target) {
      return;
    }
    this.userAnswer = target.value;
  }

  async sendAnswer(): Promise<void> {
    if (!this.currentQuestion || !this.sessionId || !this.userAnswer.trim()) {
      return;
    }

    const answer = this.userAnswer.trim();
    this.messages.push({ sender: "user", content: answer });
    this.userAnswer = "";

    await this.handleQuestionProgress(async () =>
      this.interviewService.submitAnswer(this.sessionId, {
        questionId: this.currentQuestion!.id,
        answer,
        skipped: false,
      })
    );
  }

  async nextQuestion(): Promise<void> {
    if (!this.currentQuestion || !this.sessionId) {
      return;
    }

    this.messages.push({
      sender: "user",
      content: "Skipped this question. Moving to next one.",
    });

    await this.handleQuestionProgress(async () =>
      this.interviewService.skipQuestion(this.sessionId, {
        questionId: this.currentQuestion!.id,
      })
    );
  }

  async endInterview(): Promise<void> {
    if (!this.sessionId || this.isBusy || this.state === "completed") {
      return;
    }

    this.state = "loading";
    this.errorMessage = "";

    try {
      const result = await this.interviewService.endInterview(this.sessionId);
      this.completionSummary = result.summary;
      this.messages.push({
        sender: "ai",
        content:
          "Interview session ended. You can review your progress in Feedback Reports.",
      });
      this.stopTimer();
      this.state = "completed";
    } catch (error) {
      this.errorMessage = this.toErrorMessage(error);
      this.state = "error";
    }
  }

  togglePause(): void {
    if (this.state !== "active") {
      return;
    }

    this.isPaused = !this.isPaused;
  }

  async resetToSetup(): Promise<void> {
    this.stopTimer();
    this.sessionId = "";
    this.currentQuestion = null;
    this.sessionQuestionCount = 0;
    this.questionPointer = 0;
    this.messages = [];
    this.userAnswer = "";
    this.errorMessage = "";
    this.completionSummary = "";
    this.evaluation = { ...PLACEHOLDER_FEEDBACK };
    this.timeLeft = 80;
    this.isPaused = false;
    this.state = "setup";
  }

  private async handleQuestionProgress(
    submitAction: () => Promise<{
      feedback: InterviewFeedback;
      nextQuestion: InterviewQuestion | null;
      isComplete: boolean;
    }>
  ): Promise<void> {
    if (!this.currentQuestion) {
      return;
    }

    this.errorMessage = "";
    this.state = "submitting";
    await Promise.resolve();
    this.state = "aiTyping";

    try {
      const response = await submitAction();
      this.evaluation = response.feedback;

      if (response.feedback.summary) {
        this.messages.push({
          sender: "ai",
          content: response.feedback.summary,
        });
      }

      if (response.isComplete || !response.nextQuestion) {
        this.questionPointer = this.totalQuestions;
        this.currentQuestion = null;
        this.messages.push({
          sender: "ai",
          content: "Interview completed. Great effort today.",
        });
        this.stopTimer();
        this.state = "completed";
        return;
      }

      this.currentQuestion = response.nextQuestion;
      this.sessionQuestionCount = response.nextQuestion.total;
      this.questionPointer = response.nextQuestion.number;
      this.logQuestionSource(response.nextQuestion.source);
      this.messages.push({
        sender: "ai",
        content: response.nextQuestion.text,
      });
      this.timeLeft = 80;
      this.isPaused = false;
      this.state = "active";
    } catch (error) {
      this.errorMessage = this.toErrorMessage(error);
      this.state = "error";
    }
  }

  private startTimer(): void {
    this.stopTimer();

    this.timerHandle = setInterval(() => {
      if (this.state !== "active" || this.isPaused) {
        return;
      }

      if (this.timeLeft > 0) {
        this.timeLeft -= 1;
      }

      if (this.timeLeft === 0 && !this.isAutoSkipping) {
        this.isAutoSkipping = true;
        this.nextQuestion().finally(() => {
          this.isAutoSkipping = false;
        });
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
  }

  private syncUserIdentity(): void {
    const authName = "";
    const authEmail = "";
    let tokenName = "";
    let tokenEmail = "";

    try {
      const rawToken = sessionStorage.getItem("authToken");
      if (rawToken) {
        const payloadSegment = rawToken.split(".")[1];
        if (payloadSegment) {
          const normalized = payloadSegment
            .replace(/-/g, "+")
            .replace(/_/g, "/");
          const padded = normalized.padEnd(
            Math.ceil(normalized.length / 4) * 4,
            "="
          );
          const decoded = JSON.parse(
            atob(padded)
          ) as { name?: string; email?: string };
          tokenName = typeof decoded.name === "string" ? decoded.name.trim() : "";
          tokenEmail = typeof decoded.email === "string" ? decoded.email.trim() : "";
        }
      }
    } catch {
      // Ignore token parsing failures and keep defaults.
    }

    const fallbackFromEmail = (authEmail || tokenEmail).includes("@")
      ? (authEmail || tokenEmail).split("@")[0]
      : "";
    const resolvedName = authName || tokenName || fallbackFromEmail || "Rorisang";

    this.userName = resolvedName;
    this.userInitial = resolvedName.charAt(0).toUpperCase() || "R";
  }

  private toErrorMessage(error: unknown): string {
    if (
      typeof error === "object" &&
      error !== null &&
      "error" in error &&
      typeof (error as { error?: unknown }).error === "object"
    ) {
      const nested = (error as { error?: { message?: unknown } }).error;
      if (nested && typeof nested.message === "string" && nested.message.trim()) {
        return nested.message.trim();
      }
    }

    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    return "Something went wrong while processing the interview request.";
  }

  private logQuestionSource(source: string | undefined): void {
    if (environment.production) {
      return;
    }

    const normalizedSource =
      typeof source === "string" && source.trim() ? source.trim() : "unknown";
    console.info(`[interview] Question source: ${normalizedSource}`);
  }
}
