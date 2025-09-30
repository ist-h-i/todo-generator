import { Injectable, computed, signal } from '@angular/core';

const DEFAULT_LOADING_MESSAGE = 'データを読み込み中です…';

/**
 * Tracks active HTTP requests and exposes a global loading message.
 */
@Injectable({ providedIn: 'root' })
export class HttpLoadingStore {
  private readonly requestMessages = signal(new Map<string, string>());

  /** Signal exposing the current number of active requests. */
  public readonly activeRequestCount = computed(() => this.requestMessages().size);

  /** Signal indicating whether at least one API request is in flight. */
  public readonly isLoading = computed(() => this.activeRequestCount() > 0);

  /** Signal with the message of the most recent active request, if any. */
  public readonly message = computed(() => {
    const entries = Array.from(this.requestMessages().values());
    return entries.length > 0 ? (entries[entries.length - 1] ?? null) : null;
  });

  /**
   * Marks the request as active and surfaces a loading message.
   *
   * @param requestId - Unique identifier for the HTTP request.
   * @param message - Message to display while the request is active.
   */
  public beginRequest(requestId: string, message: string = DEFAULT_LOADING_MESSAGE): void {
    this.requestMessages.update((current) => {
      const next = new Map(current);
      next.set(requestId, message);
      return next;
    });
  }

  /**
   * Clears the loading state associated with the request, if present.
   *
   * @param requestId - Identifier for the request to clear.
   */
  public endRequest(requestId: string): void {
    this.requestMessages.update((current) => {
      if (!current.has(requestId)) {
        return current;
      }

      const next = new Map(current);
      next.delete(requestId);
      return next;
    });
  }
}
