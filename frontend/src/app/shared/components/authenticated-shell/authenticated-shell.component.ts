import { CommonModule } from "@angular/common";
import { Component, Input, OnInit, inject } from "@angular/core";
import { AuthService } from "../../../core/services/auth.service";
import { SidebarComponent, SidebarItemKey } from "../sidebar/sidebar.component";

@Component({
  selector: "app-authenticated-shell",
  standalone: true,
  imports: [CommonModule, SidebarComponent],
  templateUrl: "./authenticated-shell.component.html",
  styleUrls: ["./authenticated-shell.component.css"],
})
export class AuthenticatedShellComponent implements OnInit {
  private readonly authService = inject(AuthService);

  @Input() activeItem: SidebarItemKey = "dashboard";
  @Input() pageClass = "authenticated-page";
  @Input() brandLabel = "AI Coach";
  @Input() footerLabel = "Practice smarter, interview better.";

  userDisplayName = "User";
  userInitial = "U";

  async ngOnInit(): Promise<void> {
    await this.authService.ensureRoleFromSession();
    this.syncUserBadge();
  }

  private syncUserBadge(): void {
    const currentUser = this.authService.getCurrentUser();
    const rawEmail =
      typeof currentUser?.email === "string" ? currentUser.email.trim().toLowerCase() : "";
    const localPart = rawEmail.includes("@") ? rawEmail.split("@")[0] : rawEmail;
    const readableName = this.toReadableName(localPart);
    const roleFallback = this.authService.getRole() === "admin" ? "Admin" : "User";
    const resolvedName = readableName || roleFallback;

    this.userDisplayName = resolvedName;
    this.userInitial = resolvedName.charAt(0).toUpperCase() || roleFallback.charAt(0);
  }

  private toReadableName(value: string): string {
    const normalized = value.replace(/[._-]+/g, " ").trim();
    if (!normalized) {
      return "";
    }

    return normalized
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }
}
