import { Injectable } from "@angular/core";
import { CanActivate, Router } from "@angular/router";
import { AuthService } from "../services/auth.service";

@Injectable({
  providedIn: "root",
})
export class AdminGuard implements CanActivate {
  constructor(private readonly authService: AuthService, private readonly router: Router) {}

  canActivate(): boolean {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(["/signin"]);
      return false;
    }

    if (!this.authService.isAdmin()) {
      this.router.navigate(["/dashboard"]);
      return false;
    }

    return true;
  }
}
