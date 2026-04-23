import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";

@Component({
  selector: "app-landing-page",
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: "./landing-page.component.html",
  styleUrls: ["./landing-page.component.css"],
})
export class LandingPageComponent {
  readonly stats = [
    { value: "10,000+", label: "Interview Conducted" },
    { value: "4.8/5", label: "Average User Rating" },
    { value: "92%", label: "User Reported Improved Confidence" },
    { value: "35+", label: "Industries Covered" },
  ];
}
