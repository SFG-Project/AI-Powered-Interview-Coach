import { Component } from "@angular/core";
import { SidebarComponent } from "../../shared/components/sidebar/sidebar.component";

@Component({
  selector: "app-settings-page",
  standalone: true,
  imports: [SidebarComponent],
  templateUrl: "./settings-page.component.html",
  styleUrls: ["./settings-page.component.css"],
})
export class SettingsPageComponent {}
