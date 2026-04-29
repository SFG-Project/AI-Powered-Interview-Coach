import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { AuthService } from '../../../core/services/auth.service';

type SidebarItemKey =
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
}

@Component({
  selector: "app-sidebar",
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: "./sidebar.component.html",
  styleUrls: ["./sidebar.component.css"],
})
export class SidebarComponent {
  @Input() activeItem: SidebarItemKey = "dashboard";

  constructor(private authService: AuthService, private router: Router) {}

  readonly interviewSessionRoute = "/interview-session";

  readonly navItems: SidebarNavItem[] = [
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

  onNavItemClick(item: SidebarNavItem): void {
    if (item.key === "sign-out") {
      this.authService.logout();
      this.router.navigate(["/signin"]);
    } else if (item.route) {
      this.router.navigate([item.route]);
    }
  }
}
