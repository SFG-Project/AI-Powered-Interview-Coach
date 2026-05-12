import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { AuthService } from "../../core/services/auth.service";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ADMIN_IDENTIFIER = "admin";

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

  identifier = "";
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

  onFieldInput(field: "identifier" | "password", event: Event): void {
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
      await this.authService.signIn(this.identifier.trim().toLowerCase(), this.password);
      await this.router.navigateByUrl(this.authService.isAdmin() ? "/admin" : "/dashboard");
    } catch (error) {
      this.authError = this.authService.getSignInErrorMessage(error);
    } finally {
      this.isSubmitting = false;
    }
  }

  private validateForm(): string[] {
    const errors: string[] = [];
    const trimmedIdentifier = this.identifier.trim();

    if (!trimmedIdentifier) {
      errors.push("Email or Admin is required.");
    } else if (
      !EMAIL_PATTERN.test(trimmedIdentifier) &&
      trimmedIdentifier.toLowerCase() !== ADMIN_IDENTIFIER
    ) {
      errors.push("Please provide a valid email address or use Admin.");
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
