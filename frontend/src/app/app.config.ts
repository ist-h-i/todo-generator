import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

import { appRoutes } from './app.routes';
import { authInterceptor } from '@core/auth/auth.interceptor';
import { loadingInterceptor } from '@core/api/loading.interceptor';
import { timeoutInterceptor } from '@core/api/timeout.interceptor';
import { errorInterceptor } from '@core/api/error.interceptor';

/**
 * Configures the providers required to bootstrap the Angular 20 application.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({
      eventCoalescing: true,
      runCoalescing: true,
    }),
    provideRouter(
      appRoutes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }),
    ),
    provideAnimations(),
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor, loadingInterceptor, errorInterceptor, timeoutInterceptor]),
    ),
  ],
};
