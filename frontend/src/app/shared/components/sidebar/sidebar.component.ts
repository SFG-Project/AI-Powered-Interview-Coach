import { CommonModule } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { AuthService } from "../../../core/services/auth.service";
import { environment } from "../../../../environments/environment";

export type SidebarItemKey =
  | "admin-dashboard"
  | "interview-session"
  | "dashboard"
  | "progress"
  | "feedback-reports"
  | "settings"
  | "sign-out";

interface SidebarNavItem {
  key: SidebarItemKey;
  label: string;
  route?: string;
  adminOnly?: boolean;
}

@Component({
  selector: "app-sidebar",
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: "./sidebar.component.html",
  styleUrls: ["./sidebar.component.css"],
})
export class SidebarComponent implements OnInit {
  @Input() activeItem: SidebarItemKey = "dashboard";
  @Input() brandLabel = "AI Coach";
  @Input() footerLabel = "Practice smarter, interview better.";
  isAdminVisible = false;

  constructor(private authService: AuthService, private router: Router) {}

  readonly interviewSessionRoute = "/interview-session";

  readonly navItems: SidebarNavItem[] = [
    { key: "admin-dashboard", label: "Admin Dashboard", route: "/admin", adminOnly: true },
    { key: "dashboard", label: "Dashboard", route: "/dashboard" },
    { key: "progress", label: "Progress", route: "/progress" },
    {
      key: "feedback-reports",
      label: "Feedback Reports",
      route: "/feedback-reports",
    },
    { key: "settings", label: "Settings", route: "/settings" },
    { key: "sign-out", label: "Sign Out" },
  ];

  ngOnInit(): void {
    this.isAdminVisible = this.authService.isAdmin();
    void this.initializeRoleState();
  }

  get visibleNavItems(): SidebarNavItem[] {
    const hasAdminAccess = this.isAdminVisible || this.authService.isAdmin();
    return this.navItems.filter((item) => !item.adminOnly || hasAdminAccess);
  }

  onNavItemClick(item: SidebarNavItem): void {
    if (item.key === "sign-out") {
      this.authService.logout();
      this.router.navigate(["/signin"]);
    } else if (item.route) {
      this.router.navigate([item.route]);
    }
  }

  private async initializeRoleState(): Promise<void> {
    const resolvedRole = await this.authService.ensureRoleFromSession();
    this.isAdminVisible = resolvedRole === "admin";
    this.logSidebarRoleCheck();
  }

  private logSidebarRoleCheck(): void {
    if (environment.production) {
      return;
    }

    console.info("[sidebar] Admin visibility check.", {
      role: this.authService.getRole(),
      isAdmin: this.authService.isAdmin(),
      isAdminVisible: this.isAdminVisible,
      currentUser: this.authService.getCurrentUser(),
    });
  }
}
