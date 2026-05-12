import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";

@Component({
  selector: "app-loader",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./app-loader.component.html",
  styleUrls: ["./app-loader.component.css"],
})
export class AppLoaderComponent {
  @Input() label = "Loading...";
  @Input() centered = true;
}
