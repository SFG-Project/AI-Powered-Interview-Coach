import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { AuthService } from "../../core/services/auth.service";
import { AppLoaderComponent } from "../../shared/components/app-loader/app-loader.component";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SignUpField =
  | "firstName"
  | "lastName"
  | "email"
  | "industry"
  | "password"
  | "confirmPassword";

@Component({
  selector: "app-signup-page",
  standalone: true,
  imports: [CommonModule, RouterLink, AppLoaderComponent],
  templateUrl: "./signup-page.component.html",
  styleUrls: ["./signup-page.component.css"],
})
export class SignUpPageComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly industries = [
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

  firstName = "";
  lastName = "";
  email = "";
  industry = "";
  password = "";
  confirmPassword = "";
  acceptedTerms = false;

  validationErrors: string[] = [];
  authError = "";
  isSubmitting = false;

  onFieldInput(field: SignUpField, event: Event): void {
    const input = event.target as HTMLInputElement | HTMLSelectElement | null;
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
      await this.authService.signUp({
        firstName: this.firstName.trim(),
        lastName: this.lastName.trim(),
        email: this.email.trim(),
        industry: this.industry,
        password: this.password,
      });

      await this.router.navigate(["/signin"], {
        queryParams: { registered: "1" },
      });
    } catch (error) {
      this.authError = this.authService.getSignUpErrorMessage(error);
    } finally {
      this.isSubmitting = false;
    }
  }

  private validateForm(): string[] {
    const errors: string[] = [];
    const trimmedFirstName = this.firstName.trim();
    const trimmedLastName = this.lastName.trim();
    const trimmedEmail = this.email.trim();

    if (!trimmedFirstName) {
      errors.push("First name is required.");
    }

    if (!trimmedLastName) {
      errors.push("Last name is required.");
    }

    if (!trimmedEmail) {
      errors.push("Email is required.");
    } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
      errors.push("Please provide a valid email address.");
    }

    if (!this.industry) {
      errors.push("Please select your industry.");
    }

    if (!this.password) {
      errors.push("Password is required.");
    } else if (!this.isStrongPassword(this.password)) {
      errors.push(
        "Password must be at least 8 characters and include letters and numbers."
      );
    }

    if (!this.confirmPassword) {
      errors.push("Confirm password is required.");
    } else if (this.password !== this.confirmPassword) {
      errors.push("Password and confirm password must match.");
    }

    if (!this.acceptedTerms) {
      errors.push("You must accept the terms to continue.");
    }

    return errors;
  }

  private isStrongPassword(value: string): boolean {
    return value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value);
  }
}
