import { Injectable } from "@angular/core";
import { CanActivate, Router, UrlTree } from "@angular/router";
import { AuthService } from "../services/auth.service";
import { environment } from "../../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class AdminGuard implements CanActivate {
  constructor(private readonly authService: AuthService, private readonly router: Router) {}

  canActivate(): Promise<boolean | UrlTree> | boolean | UrlTree {
    return this.evaluateAccess();
  }

  private async evaluateAccess(): Promise<boolean | UrlTree> {
    if (!this.authService.isAuthenticated()) {
      this.logGuardDecision("blocked", "missing-token", "user");
      return this.router.createUrlTree(["/signin"]);
    }

    const resolvedRole = await this.authService.ensureRoleFromSession();
    if (resolvedRole !== "admin") {
      this.logGuardDecision("blocked", "non-admin-role", resolvedRole);
      return this.router.createUrlTree(["/dashboard"]);
    }

    this.logGuardDecision("allowed", "admin-role", resolvedRole);
    return true;
  }

  private logGuardDecision(
    decision: "allowed" | "blocked",
    reason: "missing-token" | "non-admin-role" | "admin-role",
    role: "admin" | "user"
  ): void {
    if (environment.production) {
      return;
    }

    console.info("[admin/guard] Access decision.", { decision, reason, role });
  }
}
