import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  ViewChild,
  ChangeDetectorRef,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { SidebarComponent } from "../../shared/components/sidebar/sidebar.component";
import { DomSanitizer, SafeUrl } from "@angular/platform-browser";

interface Message {
  type: 'ai' | 'user';
  content: string;
  isQuestion?: boolean;
  questionNumber?: number;
  difficulty?: string;
  isAudio?: boolean;
  duration?: number;
  audioUrl?: SafeUrl;
}

@Component({
  selector: "app-interview-session-page",
  standalone: true,
  imports: [CommonModule, SidebarComponent],
  templateUrl: "./interview-session-page.component.html",
  styleUrls: ["./interview-session-page.component.css"],
})
export class InterviewSessionPageComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild("chatMessages") chatMessagesRef!: ElementRef;

  currentQuestionIndex = 1;
  totalQuestions = 5;
  timeLeft = 80;
  isPaused = false;
  isInterviewActive = true;
  isTyping = false;

  // Voice recording
  isRecording = false;
  recognition: any;
  isVoiceSupported = false;
  mediaRecorder: any;
  audioChunks: Blob[] = [];
  startTime: number = 0;
  audioUrl: SafeUrl | null = null;
  audioDuration: number = 0;
  private recordedAudioBlob: Blob | null = null;

  messages: Message[] = [];
  userAnswer = "";

  evaluationAreas = [
    { name: "Clarity", status: "Good" },
    { name: "Technical Accuracy", status: "Strong" },
    { name: "Confidence", status: "Moderate" },
    { name: "Communication", status: "Improving" },
  ];

  sessionNotes = 'Keep answers direct. Add practical examples. Avoid being too short.';

  private timerInterval: any;

  private questions = [
    { text: "Explain polymorphism in object-oriented programming and give one practical example.", difficulty: "Medium" },
    { text: "What are the differences between REST and GraphQL APIs?", difficulty: "Hard" },
    { text: "How would you optimize a slow database query?", difficulty: "Hard" },
    { text: "Explain the concept of closures in JavaScript.", difficulty: "Medium" },
    { text: "Describe a time you had to resolve a technical conflict with a team member.", difficulty: "Easy" },
  ];

  constructor(private cdr: ChangeDetectorRef, private sanitizer: DomSanitizer) {}

  ngOnInit(): void {
    this.initializeChat();
    this.startTimer();
    this.checkVoiceSupport();
  }

  ngAfterViewInit(): void {
    this.scrollToBottom();
  }

  ngOnDestroy(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.recognition) this.recognition.abort();
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stream?.getTracks().forEach((track: any) => track.stop());
    }
  }

  checkVoiceSupport(): void {
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      this.isVoiceSupported = true;
      this.initSpeechRecognition();
    }
  }

  initSpeechRecognition(): void {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.interimResults = true;
    this.recognition.lang = "en-US";
    this.recognition.continuous = false;

    this.recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        this.userAnswer = finalTranscript;
        this.cdr.detectChanges();
      }
    };

    this.recognition.onerror = () => {
      this.isRecording = false;
      this.cdr.detectChanges();
    };

    this.recognition.onend = () => {
      this.cdr.detectChanges();
    };
  }

  async startVoiceInput() {
    if (this.isRecording) {
      this.stopRecordingAndSend();
      return;
    }

    this.userAnswer = '';
    this.audioUrl = null;
    this.recordedAudioBlob = null;
    this.isRecording = true;
    this.cdr.detectChanges();

    if (this.recognition) {
      try { this.recognition.start(); } catch {}
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event: any) => {
        if (event.data.size > 0) this.audioChunks.push(event.data);
      };

      this.mediaRecorder.onstop = () => {
        this.recordedAudioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const audioObjectUrl = URL.createObjectURL(this.recordedAudioBlob);
        this.audioUrl = this.sanitizer.bypassSecurityTrustUrl(audioObjectUrl);
        this.audioDuration = Math.floor((Date.now() - this.startTime) / 1000);
        stream.getTracks().forEach(track => track.stop());
        this.cdr.detectChanges();
        this.dispatchMessage();
      };

      this.startTime = Date.now();
      this.mediaRecorder.start();
    } catch {
      alert('Could not access microphone. Please check permissions.');
      this.isRecording = false;
      this.cdr.detectChanges();
    }
  }

  stopRecordingAndSend(): void {
    if (this.recognition) {
      try { this.recognition.stop(); } catch {}
    }

    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    } else {
      this.isRecording = false;
      this.cdr.detectChanges();
      this.dispatchMessage();
    }

    this.isRecording = false;
    this.cdr.detectChanges();
  }

  dispatchMessage(): void {
    const hasText = this.userAnswer.trim().length > 0;
    const hasAudio = !!this.recordedAudioBlob && !!this.audioUrl;

    if (!hasText && !hasAudio) return;

    if (this.messages.length > 0 && this.messages[this.messages.length - 1].isQuestion) {
      this.messages.pop();
    }

    if (hasText) {
      this.messages.push({ type: "user", content: this.userAnswer });
    }

    if (hasAudio) {
      this.messages.push({
        type: "user",
        content: "Audio recording",
        isAudio: true,
        duration: this.audioDuration,
        audioUrl: this.audioUrl!,
      });
    }

    this.userAnswer = "";
    this.audioUrl = null;
    this.recordedAudioBlob = null;
    this.audioDuration = 0;

    this.scrollToBottom();
    this.queueNextQuestion();
    this.cdr.detectChanges();
  }

  sendMessage(): void {
    if (!this.userAnswer.trim()) return;
    this.dispatchMessage();
  }

  initializeChat(): void {
    this.messages = [
      { type: "ai", content: "Hello Rorisang. Welcome to your AI mock interview." },
      {
        type: "ai",
        content: this.questions[0].text,
        isQuestion: true,
        questionNumber: 1,
        difficulty: this.questions[0].difficulty,
      },
    ];
    this.currentQuestionIndex = 1;
  }

  queueNextQuestion(): void {
    this.isTyping = true;
    this.scrollToBottom();

    setTimeout(() => {
      this.isTyping = false;

      if (this.currentQuestionIndex < this.totalQuestions) {
        const next = this.questions[this.currentQuestionIndex];
        this.messages.push({
          type: "ai",
          content: next.text,
          isQuestion: true,
          questionNumber: this.currentQuestionIndex + 1,
          difficulty: next.difficulty,
        });
        this.currentQuestionIndex++;
        this.timeLeft = 80;
      } else if (this.currentQuestionIndex === this.totalQuestions) {
        this.messages.push({
          type: "ai",
          content: "🎉 Congratulations! You've completed all questions!",
        });
        this.isInterviewActive = false;
        if (this.timerInterval) clearInterval(this.timerInterval);
      }
      this.scrollToBottom();
    }, 1000);
  }

  updateUserAnswer(event: Event): void {
    this.userAnswer = (event.target as HTMLInputElement).value;
  }

  startTimer(): void {
    this.timerInterval = setInterval(() => {
      if (!this.isPaused && this.isInterviewActive && this.timeLeft > 0) {
        this.timeLeft--;
        if (this.timeLeft === 0) this.autoNextQuestion();
      }
    }, 1000);
  }

  autoNextQuestion(): void {
    if (this.isInterviewActive && this.currentQuestionIndex < this.totalQuestions) {
      if (this.messages.length > 0 && this.messages[this.messages.length - 1].isQuestion) {
        this.messages.pop();
      }
      this.messages.push({ type: "user", content: "Time's up! Moving to next question." });
      this.queueNextQuestion();
    }
  }

  formatTime(): string {
    const minutes = Math.floor(this.timeLeft / 60);
    const seconds = this.timeLeft % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  togglePause(): void {
    this.isPaused = !this.isPaused;
  }

  skipQuestion(): void {
    if (this.currentQuestionIndex < this.totalQuestions) {
      if (this.messages.length > 0 && this.messages[this.messages.length - 1].isQuestion) {
        this.messages.pop();
      }
      const nextQuestion = this.questions[this.currentQuestionIndex];
      this.messages.push({
        type: 'ai',
        content: nextQuestion.text,
        isQuestion: true,
        questionNumber: this.currentQuestionIndex + 1,
        difficulty: nextQuestion.difficulty
      });
      this.currentQuestionIndex++;
      this.timeLeft = 80;
      this.scrollToBottom();
    }
  }

  endInterview(): void {
    if (confirm('Are you sure you want to end this interview session?')) {
      this.isInterviewActive = false;
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
      }
      this.messages.push({
        type: 'ai',
        content: "Interview session ended. You can review your answers in the Reports section."
      });
    }
  }

  scrollToBottom(): void {
    setTimeout(() => {
      if (this.chatMessagesRef) {
        this.chatMessagesRef.nativeElement.scrollTop = this.chatMessagesRef.nativeElement.scrollHeight;
      }
    }, 100);
  }

  getProgressPercentage(): number {
    return (this.currentQuestionIndex / this.totalQuestions) * 100;
  }

  playAudio(audioUrl: SafeUrl): void {
    const audio = new Audio(audioUrl.toString());
    audio.play();
  }
}