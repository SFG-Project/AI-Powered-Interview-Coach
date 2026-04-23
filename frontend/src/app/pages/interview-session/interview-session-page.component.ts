import { Component } from "@angular/core";
import { SidebarComponent } from "../../shared/components/sidebar/sidebar.component";

@Component({
  selector: "app-interview-session-page",
  standalone: true,
  imports: [SidebarComponent],
  templateUrl: "./interview-session-page.component.html",
  styleUrls: ["./interview-session-page.component.css"],
})
export class InterviewSessionPageComponent {}
