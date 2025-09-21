import { Injectable } from '@angular/core';

/**
 * Minimal logger centralizing console access so it can be replaced later.
 */
@Injectable({ providedIn: 'root' })
export class Logger {
  /**
   * Logs an error with module context.
   *
   * @param context - Namespace describing where the error originated.
   * @param error - Raised exception or rejection.
   */
  public readonly error = (context: string, error: unknown): void => {
    console.error(`[${context}]`, error);
  };
}
