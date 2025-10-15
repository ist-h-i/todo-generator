import { Injectable, computed, signal } from '@angular/core';

import { HoverMessageSeverity, HoverMessageView } from './hover-message.types';

const HOVER_MESSAGE_EXIT_DURATION_MS = 220;

const HOVER_MESSAGE_DURATIONS: Record<HoverMessageSeverity, number | null> = {
  error: null,
  warning: 10_000,
  notification: 5_000,
  system: 3_000,
  loading: null,
};

/**
 * Global manager for hover/toast messages.
 * - Newest appears at the top (unshift)
 * - Auto-dismiss per severity (error/loading are sticky)
 * - Exit animates to the right before removal
 */
@Injectable({ providedIn: 'root' })
export class HoverMessageService {
  private readonly store = signal<readonly HoverMessageView[]>([]);
  public readonly messages = computed(() => this.store());

  private readonly timers = new Map<number, { autoClose: number | null; removal: number | null }>();
  private seq = 0;

  /** Show a message with the given severity. Returns the created id. */
  public show(text: string, severity: HoverMessageSeverity = 'system'): number {
    const entry: HoverMessageView = {
      id: ++this.seq,
      text,
      severity,
      dismissing: false,
    };

    // Newest first
    this.store.update((messages) => [entry, ...messages]);

    if (typeof window === 'undefined') {
      return entry.id;
    }

    const timers = { autoClose: null as number | null, removal: null as number | null };
    const duration = HOVER_MESSAGE_DURATIONS[severity] ?? null;

    if (duration !== null) {
      timers.autoClose = window.setTimeout(() => this.dismiss(entry.id), duration);
    }

    this.timers.set(entry.id, timers);
    return entry.id;
  }

  /** Convenience helpers */
  public notify(text: string): number {
    return this.show(text, 'notification');
  }

  public warn(text: string): number {
    return this.show(text, 'warning');
  }

  public error(text: string): number {
    return this.show(text, 'error');
  }

  /** Loading/system messages persist until dismissed programmatically. */
  public loading(text: string): number {
    return this.show(text, 'loading');
  }

  /** Begin a generic system-level message. */
  public system(text: string): number {
    return this.show(text, 'system');
  }

  /** Mark a message as dismissing, then remove after exit animation. */
  public dismiss(id: number): void {
    if (typeof window === 'undefined') {
      this.finalizeRemoval(id);
      return;
    }

    const timers = this.timers.get(id);
    if (!timers || timers.removal !== null) return;

    if (timers.autoClose !== null) {
      window.clearTimeout(timers.autoClose);
      timers.autoClose = null;
    }

    this.store.update((messages) =>
      messages.map((m) => (m.id === id ? { ...m, dismissing: true } : m)),
    );

    timers.removal = window.setTimeout(() => this.finalizeRemoval(id), HOVER_MESSAGE_EXIT_DURATION_MS);
  }

  /** Immediately remove a message and clear any timers. */
  private finalizeRemoval(id: number): void {
    this.store.update((messages) => messages.filter((m) => m.id !== id));

    if (typeof window === 'undefined') {
      this.timers.delete(id);
      return;
    }

    const timers = this.timers.get(id);
    if (timers) {
      if (timers.autoClose !== null) window.clearTimeout(timers.autoClose);
      if (timers.removal !== null) window.clearTimeout(timers.removal);
    }
    this.timers.delete(id);
  }

  /** Clear all messages and associated timers. */
  public clearAll(): void {
    if (typeof window !== 'undefined') {
      for (const t of this.timers.values()) {
        if (t.autoClose !== null) window.clearTimeout(t.autoClose);
        if (t.removal !== null) window.clearTimeout(t.removal);
      }
    }
    this.timers.clear();
    this.store.set([]);
  }
}

