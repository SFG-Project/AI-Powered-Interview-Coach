import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { RouterLink } from "@angular/router";

type SidebarItemKey =
  | "interview-session"
  | "dashboard"
  | "progress"
  | "feedback-reports"
  | "settings";

interface SidebarNavItem {
  key: SidebarItemKey;
  label: string;
  route: string;
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
  ];
}
