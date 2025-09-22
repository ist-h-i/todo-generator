import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { buildApiUrl } from '@core/api/api.config';
import { AuthenticatedUser, MessageResponse, TokenResponse } from '@core/models';


const STORAGE_KEY = 'todo-generator/auth-token';


@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly userStore = signal<AuthenticatedUser | null>(null);
  private readonly tokenStore = signal<string | null>(null);
  private readonly errorStore = signal<string | null>(null);
  private readonly pendingStore = signal(false);
  private readonly initializedStore = signal(false);
  private readonly storage = this.resolveStorage();
  private readonly bootstrap: Promise<void>;

  public constructor() {
    this.bootstrap = this.restoreSession();
  }

  public readonly user = computed(() => this.userStore());
  public readonly token = computed(() => this.tokenStore());
  public readonly error = computed(() => this.errorStore());
  public readonly pending = computed(() => this.pendingStore());
  public readonly isAuthenticated = computed(() => this.userStore() !== null);
  public readonly initialized = computed(() => this.initializedStore());

  public async ensureInitialized(): Promise<void> {
    await this.bootstrap;
  }

  public clearError(): void {
    this.errorStore.set(null);
  }

  public logout(): void {
    this.clearSession();
    this.errorStore.set(null);
  }

  public async login(email: string, password: string): Promise<boolean> {
    this.pendingStore.set(true);
    this.errorStore.set(null);

    try {
      const response = await firstValueFrom(
        this.http.post<TokenResponse>(buildApiUrl('/auth/login'), {
          email,
          password,
        }),
      );
      this.setSession(response.access_token, response.user);
      return true;
    } catch (error) {
      this.errorStore.set(this.extractErrorMessage(error));
      return false;
    } finally {
      this.pendingStore.set(false);
    }
  }

  public async requestRegistration(email: string): Promise<string | null> {
    this.pendingStore.set(true);
    this.errorStore.set(null);

    try {
      const response = await firstValueFrom(
        this.http.post<MessageResponse>(buildApiUrl('/auth/register'), { email }),
      );
      return response.message;
    } catch (error) {
      this.errorStore.set(this.extractErrorMessage(error));
      return null;
    } finally {
      this.pendingStore.set(false);
    }
  }

  public async requestPasswordReset(email: string): Promise<string | null> {
    this.pendingStore.set(true);
    this.errorStore.set(null);

    try {
      const response = await firstValueFrom(
        this.http.post<MessageResponse>(buildApiUrl('/auth/password-reset'), { email }),
      );
      return response.message;
    } catch (error) {
      this.errorStore.set(this.extractErrorMessage(error));
      return null;
    } finally {
      this.pendingStore.set(false);
    }
  }

  private async restoreSession(): Promise<void> {
    const storedToken = this.storage?.getItem(STORAGE_KEY);
    if (!storedToken) {
      this.initializedStore.set(true);
      return;
    }

    this.tokenStore.set(storedToken);
    try {
      const user = await firstValueFrom(
        this.http.get<AuthenticatedUser>(buildApiUrl('/auth/me')),
      );
      this.userStore.set(user);
    } catch {
      this.clearSession();
    } finally {
      this.initializedStore.set(true);
    }
  }

  private resolveStorage(): Storage | null {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }

  private setSession(token: string, user: AuthenticatedUser): void {
    this.tokenStore.set(token);
    this.userStore.set(user);
    this.persistToken(token);
  }

  private clearSession(): void {
    this.tokenStore.set(null);
    this.userStore.set(null);
    this.persistToken(null);
  }

  private persistToken(token: string | null): void {
    if (!this.storage) {
      return;
    }

    if (token) {
      this.storage.setItem(STORAGE_KEY, token);
    } else {
      this.storage.removeItem(STORAGE_KEY);
    }
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (typeof error.error === 'string' && error.error.trim().length > 0) {
        return error.error;
      }

      if (error.error && typeof error.error.detail === 'string') {
        return error.error.detail;
      }
    }

    return '予期しないエラーが発生しました。もう一度お試しください。';
  }
}
