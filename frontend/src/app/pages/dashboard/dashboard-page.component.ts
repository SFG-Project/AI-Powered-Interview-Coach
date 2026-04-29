import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { SidebarComponent } from "../../shared/components/sidebar/sidebar.component";

interface SummaryCard {
  label: string;
  value: string;
}

interface InterviewRow {
  date: string;
  role: string;
  type: string;
  score: string;
}

@Component({
  selector: "app-dashboard-page",
  standalone: true,
  imports: [CommonModule, SidebarComponent],
  templateUrl: "./dashboard-page.component.html",
  styleUrls: ["./dashboard-page.component.css"],
})
export class DashboardPageComponent {
  readonly summaryCards: SummaryCard[] = [
    { label: "Total Interviews", value: "12" },
    { label: "Average Score", value: "7.8 / 10" },
    { label: "Confidence Level", value: "78%" },
  ];

  readonly recentInterviews: InterviewRow[] = [
    { date: "18 Apr", role: "Software Dev", type: "Technical", score: "8/10" },
    { date: "16 Apr", role: "IT Support", type: "Behavioral", score: "7/10" },
    { date: "14 Apr", role: "Data Analyst", type: "Mixed", score: "6/10" },
  ];
}
