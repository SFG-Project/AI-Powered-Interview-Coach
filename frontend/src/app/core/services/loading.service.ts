import { Injectable, computed, signal } from "@angular/core";

@Injectable({ providedIn: "root" })
export class LoadingService {
  private readonly activeRequestCount = signal(0);
  private readonly activeNavigationIds = signal<Set<number>>(new Set<number>());

  readonly isRequestLoading = computed(() => this.activeRequestCount() > 0);
  readonly isRouteLoading = computed(() => this.activeNavigationIds().size > 0);
  readonly isLoading = computed(
    () => this.isRouteLoading() || this.isRequestLoading()
  );

  beginRequest(): void {
    this.activeRequestCount.update((count) => count + 1);
  }

  endRequest(): void {
    this.activeRequestCount.update((count) => Math.max(0, count - 1));
  }

  beginRouteNavigation(navigationId: number): void {
    this.activeNavigationIds.update((current) => {
      const next = new Set(current);
      next.add(navigationId);
      return next;
    });
  }

  endRouteNavigation(navigationId: number): void {
    this.activeNavigationIds.update((current) => {
      if (!current.has(navigationId)) {
        return current;
      }

      const next = new Set(current);
      next.delete(navigationId);
      return next;
    });
  }
}
