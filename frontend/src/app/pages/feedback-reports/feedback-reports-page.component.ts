import { Component } from "@angular/core";
import { SidebarComponent } from "../../shared/components/sidebar/sidebar.component";

@Component({
  selector: "app-feedback-reports-page",
  standalone: true,
  imports: [SidebarComponent],
  templateUrl: "./feedback-reports-page.component.html",
  styleUrls: ["./feedback-reports-page.component.css"],
})
export class FeedbackReportsPageComponent {}
