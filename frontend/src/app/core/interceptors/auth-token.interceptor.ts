import { HttpInterceptorFn } from "@angular/common/http";
import { environment } from "../../../environments/environment";

const AUTH_TOKEN_KEY = "authToken";

function getApiPrefix(): string {
  const trimmedBaseUrl = environment.apiBaseUrl.trim();

  if (!trimmedBaseUrl) {
    return "/api/";
  }

  return `${trimmedBaseUrl}/api/`;
}

export const authTokenInterceptor: HttpInterceptorFn = (request, next) => {
  const token = sessionStorage.getItem(AUTH_TOKEN_KEY);

  if (!token || !request.url.startsWith(getApiPrefix())) {
    return next(request);
  }

  return next(
    request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    })
  );
};
