import { HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { finalize } from "rxjs";
import { LoadingService } from "../services/loading.service";

export const loadingInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.includes("/api/")) {
    return next(request);
  }

  const loadingService = inject(LoadingService);
  loadingService.beginRequest();

  return next(request).pipe(
    finalize(() => {
      loadingService.endRequest();
    })
  );
};
