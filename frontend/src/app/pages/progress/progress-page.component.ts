import { Component } from "@angular/core";
import { SidebarComponent } from "../../shared/components/sidebar/sidebar.component";

@Component({
  selector: "app-progress-page",
  standalone: true,
  imports: [SidebarComponent],
  templateUrl: "./progress-page.component.html",
  styleUrls: ["./progress-page.component.css"],
})
export class ProgressPageComponent {}
