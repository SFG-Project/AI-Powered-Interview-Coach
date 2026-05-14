import { CommonModule } from "@angular/common";
import {
  Component,
  OnDestroy,
  OnInit,
  inject,
  NgZone,
} from "@angular/core";
import { FormsModule } from "@angular/forms";

import { SidebarComponent } from "../../shared/components/sidebar/sidebar.component";
import { AppLoaderComponent } from "../../shared/components/app-loader/app-loader.component";

import {
  InterviewFeedback,
  InterviewQuestion,
  InterviewService,
  InterviewSetupPayload,
} from "../../core/services/interview.service";

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
  imports: [
    CommonModule,
    FormsModule,
    SidebarComponent,
    AppLoaderComponent,
  ],
  templateUrl: "./interview-session-page.component.html",
  styleUrls: ["./interview-session-page.component.css"],
})
export class InterviewSessionPageComponent
  implements OnInit, OnDestroy
{
  private readonly interviewService = inject(InterviewService);
  private readonly ngZone = inject(NgZone);

  private timerHandle: ReturnType<typeof setInterval> | null =
    null;

  private isAutoSkipping = false;
  private finalTranscript = "";

  recognition: any;
  isListening = false;

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

  readonly interviewTypeOptions = [
    "Technical",
    "Behavioural",
    "HR",
    "Mixed",
  ];

  readonly difficultyOptions = [
    "Easy",
    "Medium",
    "Hard",
  ];

  readonly questionCountOptions = [3, 5, 10];

  state: InterviewState = "setup";

  errorMessage = "";
  completionSummary = "";

  setupModel: InterviewSetupPayload = {
    careerField: "Software Development",
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

    if (this.recognition) {
      this.recognition.stop();
    }
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
      ((this.currentQuestion.number - 1) /
        this.currentQuestion.total) *
      100
    );
  }

  get timerLabel(): string {
    const minutes = Math.floor(this.timeLeft / 60);

    const seconds = this.timeLeft % 60;

    return `${minutes
      .toString()
      .padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")} Left`;
  }

  get scoreLabel(): string {
    return this.evaluation.score.toFixed(1);
  }

  get scoreRingStyle() {
    const percentage = Math.max(
      0,
      Math.min(100, (this.evaluation.score / 10) * 100)
    );

    return {
      background: `conic-gradient(#2d69f6 ${percentage}%, #d4dbea ${percentage}% 100%)`,
    };
  }

  get isBusy(): boolean {
    return (
      this.state === "loading" ||
      this.state === "submitting" ||
      this.state === "aiTyping"
    );
  }

toggleVoiceInput(): void {
  const SpeechRecognition =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) {
    this.errorMessage = "Speech Recognition is not supported. Use Google Chrome.";
    return;
  }

  if (this.isListening && this.recognition) {
    this.recognition.stop();
    this.isListening = false;
    return;
  }

  this.finalTranscript = this.userAnswer ? this.userAnswer + " " : "";

  this.recognition = new SpeechRecognition();
  this.recognition.lang = "en-US";
  this.recognition.continuous = true;
  this.recognition.interimResults = true;
  this.recognition.maxAlternatives = 1;

  this.recognition.onstart = () => {
    this.ngZone.run(() => {
      this.isListening = true;
      this.errorMessage = "";
    });
  };

  this.recognition.onresult = (event: any) => {
    let interimTranscript = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;

      if (event.results[i].isFinal) {
        this.finalTranscript += transcript + " ";
      } else {
        interimTranscript += transcript + " ";
      }
    }

    this.ngZone.run(() => {
      this.userAnswer = (this.finalTranscript + interimTranscript).trim();
    });
  };

  this.recognition.onerror = (event: any) => {
    console.error("Speech recognition error:", event);
    this.ngZone.run(() => {
      this.isListening = false;
    });
  };

  this.recognition.onend = () => {
    this.ngZone.run(() => {
      this.isListening = false;
    });
  };

  this.recognition.start();
}
  onAnswerInput(event: Event): void {
    const target =
      event.target as
        | HTMLInputElement
        | HTMLTextAreaElement
        | null;

    if (!target) {
      return;
    }

    this.userAnswer = target.value;
  }

  async startInterview(): Promise<void> {
    this.state = "loading";
    this.errorMessage = "";
    this.completionSummary = "";

    try {
      const response =
        await this.interviewService.startInterview(
          this.setupModel
        );

      this.sessionId = response.sessionId;

      this.currentQuestion = response.question;

      this.sessionQuestionCount =
        response.question.total;

      this.questionPointer =
        response.question.number;

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

      this.timeLeft = 80;

      this.startTimer();

      this.state = "active";
    } catch (error) {
      this.errorMessage =
        this.toErrorMessage(error);

      this.state = "error";
    }
  }

  async sendAnswer(): Promise<void> {
    if (
      !this.currentQuestion ||
      !this.sessionId ||
      !this.userAnswer.trim()
    ) {
      return;
    }

    const answer = this.userAnswer.trim();

    this.messages.push({
      sender: "user",
      content: answer,
    });

    this.userAnswer = "";
    this.finalTranscript = "";

    await this.handleQuestionProgress(async () =>
      this.interviewService.submitAnswer(
        this.sessionId,
        {
          questionId: this.currentQuestion!.id,
          answer,
          skipped: false,
        }
      )
    );
  }
  

  async nextQuestion(): Promise<void> {
    if (!this.currentQuestion || !this.sessionId) {
      return;
    }

    await this.handleQuestionProgress(async () =>
      this.interviewService.skipQuestion(
        this.sessionId,
        {
          questionId: this.currentQuestion!.id,
        }
      )
    );
  }

  async endInterview(): Promise<void> {
    if (
      !this.sessionId ||
      this.isBusy ||
      this.state === "completed"
    ) {
      return;
    }

    this.state = "loading";

    try {
      const result =
        await this.interviewService.endInterview(
          this.sessionId
        );

      this.completionSummary = result.summary;

      this.messages.push({
        sender: "ai",
        content:
          "Interview session ended successfully.",
      });

      this.stopTimer();

      this.state = "completed";
    } catch (error) {
      this.errorMessage =
        this.toErrorMessage(error);

      this.state = "error";
    }
  }

  resetToSetup(): void {
    this.stopTimer();

    if (this.recognition) {
      this.recognition.stop();
    }

    this.sessionId = "";

    this.currentQuestion = null;

    this.sessionQuestionCount = 0;

    this.questionPointer = 0;

    this.messages = [];

    this.userAnswer = "";

    this.errorMessage = "";

    this.completionSummary = "";

    this.evaluation = {
      ...PLACEHOLDER_FEEDBACK,
    };

    this.timeLeft = 80;

    this.isPaused = false;

    this.isListening = false;

    this.state = "setup";
  }

  togglePause(): void {
    if (
      this.state === "completed" ||
      this.state === "loading" ||
      this.state === "submitting" ||
      this.state === "aiTyping"
    ) {
      return;
    }

    this.isPaused = !this.isPaused;

    if (this.isPaused) {
      this.messages.push({
        sender: "ai",
        content: "Interview paused.",
      });

      if (
        this.recognition &&
        this.isListening
      ) {
        this.recognition.stop();

        this.isListening = false;
      }

      this.stopTimer();
    } else {
      this.messages.push({
        sender: "ai",
        content: "Interview resumed.",
      });

      this.startTimer();
    }
  }

  private async handleQuestionProgress(
    submitAction: () => Promise<any>
  ): Promise<void> {
    try {
      this.state = "submitting";

      const response = await submitAction();

      this.evaluation = response.feedback;

      if (response.feedback.summary) {
        this.messages.push({
          sender: "ai",
          content: response.feedback.summary,
        });
      }

      if (
        response.isComplete ||
        !response.nextQuestion
      ) {
        this.currentQuestion = null;

        this.messages.push({
          sender: "ai",
          content:
            "Interview completed. Great effort today.",
        });

        this.stopTimer();

        this.state = "completed";

        return;
      }

      this.currentQuestion =
        response.nextQuestion;

      this.questionPointer =
        response.nextQuestion.number;

      this.timeLeft = 80;

      this.messages.push({
        sender: "ai",
        content:
          response.nextQuestion.text,
      });

      this.state = "active";
    } catch (error) {
      this.errorMessage =
        this.toErrorMessage(error);

      this.state = "error";
    }
  }

  private startTimer(): void {
    this.stopTimer();

    this.timerHandle = setInterval(() => {
      if (
        this.state !== "active" ||
        this.isPaused
      ) {
        return;
      }

      if (this.timeLeft > 0) {
        this.timeLeft -= 1;
      }

      if (
        this.timeLeft === 0 &&
        !this.isAutoSkipping
      ) {
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
    this.userName = "Rorisang";
    this.userInitial = "R";
  }

  private toErrorMessage(error: unknown): string {
    if (
      error instanceof Error &&
      error.message.trim()
    ) {
      return error.message;
    }

    return "Something went wrong.";
  }
}