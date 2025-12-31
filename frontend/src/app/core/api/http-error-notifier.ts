import { Injectable, computed, signal } from '@angular/core';

type ErrorState = {
  readonly id: number;
  readonly message: string;
};

/**
 * Stores the latest HTTP error message for global display.
 */
@Injectable({ providedIn: 'root' })
export class HttpErrorNotifier {
  private readonly errorState = signal<ErrorState | null>(null);
  private sequence = 0;

  /** Signal exposing the current error message, if any. */
  public readonly message = computed(() => this.errorState()?.message ?? null);

  /**
   * Publishes a new error message, replacing any existing message.
   *
   * @param message - Human readable error description to display.
   */
  public notify(message: string): void {
    this.errorState.set({
      id: ++this.sequence,
      message,
    });
  }

  /** Clears the current error message. */
  public clear(): void {
    this.errorState.set(null);
  }
}
