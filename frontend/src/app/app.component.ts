import { CommonModule } from "@angular/common";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Component, DestroyRef, inject } from "@angular/core";
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterOutlet,
} from "@angular/router";
import { LoadingService } from "./core/services/loading.service";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  template: `
    <div class="top-loader" [class.top-loader-visible]="loadingService.isLoading()">
      <span class="top-loader-bar"></span>
    </div>

    <router-outlet></router-outlet>
  `,
  styles: [
    `
      .top-loader {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 3px;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.15s ease;
        z-index: 2100;
      }

      .top-loader-visible {
        opacity: 1;
      }

      .top-loader-bar {
        display: block;
        height: 100%;
        width: 35%;
        background: linear-gradient(90deg, #2d69f6, #4f86ff);
        animation: route-loader-slide 1s ease-in-out infinite;
      }

      @keyframes route-loader-slide {
        0% {
          transform: translateX(-100%);
        }

        100% {
          transform: translateX(320%);
        }
      }
    `,
  ],
})
export class AppComponent {
  readonly loadingService = inject(LoadingService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  constructor() {
    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.loadingService.beginRouteNavigation(event.id);
      }

      if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        this.loadingService.endRouteNavigation(event.id);
      }
    });
  }
}
