import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { AuthService } from "../../core/services/auth.service";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: "app-signin-page",
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: "./signin-page.component.html",
  styleUrls: ["./signin-page.component.css"],
})
export class SignInPageComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  email = "";
  password = "";
  acceptedTerms = false;

  validationErrors: string[] = [];
  authError = "";
  successMessage = "";
  isSubmitting = false;

  constructor() {
    if (this.route.snapshot.queryParamMap.get("registered") === "1") {
      this.successMessage =
        "Account created successfully. Sign in with your email and password.";
    }
  }

  onFieldInput(field: "email" | "password", event: Event): void {
    const input = event.target as HTMLInputElement | null;
    if (!input) {
      return;
    }

    this[field] = input.value;
  }

  onTermsChange(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    if (!input) {
      return;
    }

    this.acceptedTerms = input.checked;
  }

  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.validationErrors = this.validateForm();
    this.authError = "";

    if (this.validationErrors.length > 0) {
      return;
    }

    this.isSubmitting = true;

    try {
      await this.authService.signIn(this.email.trim().toLowerCase(), this.password);
      await this.router.navigateByUrl("/dashboard");
    } catch (error) {
      this.authError = this.authService.getSignInErrorMessage(error);
    } finally {
      this.isSubmitting = false;
    }
  }

  private validateForm(): string[] {
    const errors: string[] = [];
    const trimmedEmail = this.email.trim();

    if (!trimmedEmail) {
      errors.push("Email is required.");
    } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
      errors.push("Please provide a valid email address.");
    }

    if (!this.password) {
      errors.push("Password is required.");
    }

    if (!this.acceptedTerms) {
      errors.push("You must accept the terms to continue.");
    }

    return errors;
  }
}
