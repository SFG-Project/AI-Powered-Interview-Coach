import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";

@Component({
  selector: "app-dashboard-skeleton",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./dashboard-skeleton.component.html",
  styleUrls: ["./dashboard-skeleton.component.css"],
})
export class DashboardSkeletonComponent {
  readonly summaryPlaceholders = [1, 2, 3];
  readonly rowPlaceholders = [1, 2, 3, 4];
}
