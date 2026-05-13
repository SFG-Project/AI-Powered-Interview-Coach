import { CommonModule } from "@angular/common";
import { Component, OnInit, inject } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { AuthenticatedShellComponent } from "../../shared/components/authenticated-shell/authenticated-shell.component";
import { AppLoaderComponent } from "../../shared/components/app-loader/app-loader.component";
import {
  CAREER_FIELDS,
  CareerField,
  DIFFICULTY_LEVELS,
  DifficultyLevel,
  EXPERIENCE_LEVELS,
  ExperienceLevel,
  INTERVIEW_TYPES,
  InterviewType,
  ProfileSettingsPayload,
  SettingsService,
} from "../../core/services/settings.service";

@Component({
  selector: "app-settings-page",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AuthenticatedShellComponent, AppLoaderComponent],
  templateUrl: "./settings-page.component.html",
  styleUrls: ["./settings-page.component.css"],
})
export class SettingsPageComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly settingsService = inject(SettingsService);

  readonly careerFieldOptions = CAREER_FIELDS;
  readonly experienceLevelOptions = EXPERIENCE_LEVELS;
  readonly interviewTypeOptions = INTERVIEW_TYPES;
  readonly difficultyOptions = DIFFICULTY_LEVELS;

  readonly profileForm = this.formBuilder.nonNullable.group({
    fullName: ["", [Validators.required]],
    email: ["", [Validators.required, Validators.email]],
    careerField: ["Software Developer" as CareerField, [Validators.required]],
    experienceLevel: ["Intermediate" as ExperienceLevel, [Validators.required]],
  });

  readonly preferencesForm = this.formBuilder.nonNullable.group({
    preferredInterviewType: ["Technical" as InterviewType, [Validators.required]],
    defaultDifficulty: ["Medium" as DifficultyLevel, [Validators.required]],
    notes: ["", [Validators.maxLength(1000)]],
  });

  isLoading = true;
  isSavingProfile = false;
  isSavingPreferences = false;

  loadErrorMessage = "";
  profileErrorMessage = "";
  profileSuccessMessage = "";
  preferencesErrorMessage = "";
  preferencesSuccessMessage = "";

  async ngOnInit(): Promise<void> {
    await this.loadSettings();
  }

  async loadSettings(): Promise<void> {
    this.isLoading = true;
    this.loadErrorMessage = "";

    try {
      const settings = await this.settingsService.getMySettings();

      this.profileForm.setValue({
        fullName: settings.fullName,
        email: settings.email,
        careerField: settings.careerField,
        experienceLevel: settings.experienceLevel,
      });

      this.preferencesForm.setValue({
        preferredInterviewType: settings.preferredInterviewType,
        defaultDifficulty: settings.defaultDifficulty,
        notes: settings.notes,
      });
    } catch (error) {
      this.loadErrorMessage =
        error instanceof Error ? error.message : "Failed to load settings.";
    } finally {
      this.isLoading = false;
    }
  }

  async saveProfile(): Promise<void> {
    this.profileErrorMessage = "";
    this.profileSuccessMessage = "";

    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.isSavingProfile = true;

    try {
      const formValue = this.profileForm.getRawValue();
      const payload: ProfileSettingsPayload = {
        fullName: formValue.fullName.trim(),
        email: formValue.email.trim(),
        careerField: formValue.careerField,
        experienceLevel: formValue.experienceLevel,
      };

      const settings = await this.settingsService.updateProfile(payload);
      this.profileForm.patchValue({
        fullName: settings.fullName,
        email: settings.email,
        careerField: settings.careerField,
        experienceLevel: settings.experienceLevel,
      });
      this.profileSuccessMessage = "Profile settings saved successfully.";
    } catch (error) {
      this.profileErrorMessage =
        error instanceof Error ? error.message : "Failed to save profile settings.";
    } finally {
      this.isSavingProfile = false;
    }
  }

  async updatePreferences(): Promise<void> {
    this.preferencesErrorMessage = "";
    this.preferencesSuccessMessage = "";

    if (this.preferencesForm.invalid) {
      this.preferencesForm.markAllAsTouched();
      return;
    }

    this.isSavingPreferences = true;

    try {
      const formValue = this.preferencesForm.getRawValue();
      const settings = await this.settingsService.updatePreferences({
        preferredInterviewType: formValue.preferredInterviewType,
        defaultDifficulty: formValue.defaultDifficulty,
        notes: formValue.notes.trim(),
      });

      this.preferencesForm.patchValue({
        preferredInterviewType: settings.preferredInterviewType,
        defaultDifficulty: settings.defaultDifficulty,
        notes: settings.notes,
      });
      this.preferencesSuccessMessage = "Interview preferences updated successfully.";
    } catch (error) {
      this.preferencesErrorMessage =
        error instanceof Error ? error.message : "Failed to save interview preferences.";
    } finally {
      this.isSavingPreferences = false;
    }
  }
}
