import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { environment } from "../../../environments/environment";

export const CAREER_FIELDS = [
  "Software Developer",
  "Data Analyst",
  "Business Analyst",
  "Project Manager",
  "Cybersecurity Analyst",
  "Other",
] as const;

export const EXPERIENCE_LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;

export const INTERVIEW_TYPES = ["Technical", "Behavioural", "HR", "Mixed"] as const;

export const DIFFICULTY_LEVELS = ["Easy", "Medium", "Hard"] as const;

export type CareerField = (typeof CAREER_FIELDS)[number];
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];
export type InterviewType = (typeof INTERVIEW_TYPES)[number];
export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

export interface UserSettings {
  uid: string;
  email: string;
  fullName: string;
  careerField: CareerField;
  experienceLevel: ExperienceLevel;
  preferredInterviewType: InterviewType;
  defaultDifficulty: DifficultyLevel;
  notes: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ProfileSettingsPayload {
  fullName: string;
  email: string;
  careerField: CareerField;
  experienceLevel: ExperienceLevel;
}

export interface InterviewPreferencesPayload {
  preferredInterviewType: InterviewType;
  defaultDifficulty: DifficultyLevel;
  notes: string;
}

@Injectable({ providedIn: "root" })
export class SettingsService {
  private readonly http = inject(HttpClient);
  private readonly settingsApiUrl = `${environment.apiBaseUrl}/api/settings`;

  async getMySettings(): Promise<UserSettings> {
    try {
      return await firstValueFrom(this.http.get<UserSettings>(`${this.settingsApiUrl}/me`));
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, "Failed to load settings."));
    }
  }

  async updateProfile(payload: ProfileSettingsPayload): Promise<UserSettings> {
    try {
      return await firstValueFrom(
        this.http.put<UserSettings>(`${this.settingsApiUrl}/profile`, payload)
      );
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, "Failed to save profile settings."));
    }
  }

  async updatePreferences(payload: InterviewPreferencesPayload): Promise<UserSettings> {
    try {
      return await firstValueFrom(
        this.http.put<UserSettings>(`${this.settingsApiUrl}/preferences`, payload)
      );
    } catch (error) {
      throw new Error(
        this.extractErrorMessage(error, "Failed to save interview preferences.")
      );
    }
  }

  private extractErrorMessage(error: unknown, fallbackMessage: string): string {
    if (error instanceof HttpErrorResponse) {
      if (
        error.error &&
        typeof error.error === "object" &&
        typeof (error.error as { message?: unknown }).message === "string"
      ) {
        return (error.error as { message: string }).message;
      }

      if (
        error.error &&
        typeof error.error === "object" &&
        typeof (error.error as { errorMessage?: unknown }).errorMessage === "string"
      ) {
        return (error.error as { errorMessage: string }).errorMessage;
      }

      if (error.status === 401) {
        return "Your session has expired. Sign in again to continue.";
      }
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    return fallbackMessage;
  }
}
