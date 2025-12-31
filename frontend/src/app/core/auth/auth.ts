import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { buildApiUrl } from '@core/api/api.config';
import {
  AdminContactResponse,
  AuthenticatedUser,
  RegistrationResponse,
  TokenResponse,
} from '@core/models';

const STORAGE_KEY = 'verbalize-yourself/auth-token';
const LEGACY_STORAGE_KEY = 'todo-generator/auth-token';

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly http = inject(HttpClient);

  private readonly userStore = signal<AuthenticatedUser | null>(null);
  private readonly tokenStore = signal<string | null>(null);
  private readonly errorStore = signal<string | null>(null);
  private readonly pendingStore = signal(false);
  private readonly initializedStore = signal(false);
  private readonly storage = this.resolveStorage();
  private readonly bootstrap: Promise<void>;

  public constructor() {
    this.bootstrap = Promise.resolve().then(() => this.restoreSession());
  }

  public readonly user = computed(() => this.userStore());
  public readonly token = computed(() => this.tokenStore());
  public readonly error = computed(() => this.errorStore());
  public readonly pending = computed(() => this.pendingStore());
  public readonly isAuthenticated = computed(() => this.userStore() !== null);
  public readonly isAdmin = computed(() => this.userStore()?.is_admin === true);
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
      this.errorStore.set(this.extractErrorMessage(error, 'login'));
      return false;
    } finally {
      this.pendingStore.set(false);
    }
  }

  public async register(
    email: string,
    password: string,
    nickname: string,
  ): Promise<RegistrationResponse | null> {
    this.pendingStore.set(true);
    this.errorStore.set(null);

    try {
      const response = await firstValueFrom(
        this.http.post<RegistrationResponse>(buildApiUrl('/auth/register'), {
          email,
          password,
          nickname,
        }),
      );
      return response;
    } catch (error) {
      this.errorStore.set(this.extractErrorMessage(error, 'register'));
      return null;
    } finally {
      this.pendingStore.set(false);
    }
  }

  public async getAdminContact(): Promise<AdminContactResponse | null> {
    try {
      return await firstValueFrom(
        this.http.get<AdminContactResponse>(buildApiUrl('/auth/admin-contact')),
      );
    } catch {
      return null;
    }
  }

  private async restoreSession(): Promise<void> {
    let storedToken = this.storage?.getItem(STORAGE_KEY);
    if (!storedToken) {
      storedToken = this.migrateLegacyToken();
    }

    if (!storedToken) {
      this.initializedStore.set(true);
      return;
    }

    this.tokenStore.set(storedToken);
    try {
      const user = await firstValueFrom(this.http.get<AuthenticatedUser>(buildApiUrl('/auth/me')));
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

  private migrateLegacyToken(): string | null {
    if (!this.storage) {
      return null;
    }

    try {
      const legacyToken = this.storage.getItem(LEGACY_STORAGE_KEY);
      if (!legacyToken) {
        return null;
      }

      try {
        this.storage.setItem(STORAGE_KEY, legacyToken);
      } catch {
        // Ignore storage quota issues when copying the legacy token.
      }

      try {
        this.storage.removeItem(LEGACY_STORAGE_KEY);
      } catch {
        // Removing the legacy key is best-effort only.
      }

      return legacyToken;
    } catch {
      return null;
    }
  }

  private setSession(token: string, user: AuthenticatedUser): void {
    this.tokenStore.set(token);
    this.userStore.set(user);
    this.persistToken(token);
  }

  public applyUserProfile(user: AuthenticatedUser): void {
    this.userStore.set(user);
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

    try {
      if (token) {
        this.storage.setItem(STORAGE_KEY, token);
      } else {
        this.storage.removeItem(STORAGE_KEY);
      }

      this.storage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // Silently ignore storage quota or availability issues.
    }
  }

  private extractErrorMessage(
    error: unknown,
    context: 'login' | 'register' | 'general' = 'general',
  ): string {
    if (!(error instanceof HttpErrorResponse)) {
      return this.getFallbackMessage(context);
    }

    const status = error.status;
    const detailMessage = this.extractDetailMessage(error.error);

    if (status === 0) {
      return 'サーバーに接続できません。ネットワーク環境を確認してから再度お試しください。';
    }

    if (status === 408) {
      return '通信がタイムアウトしました。ネットワーク環境を確認してから再度お試しください。';
    }

    if (status === 429) {
      return '短時間にアクセスが集中しています。しばらく時間をおいてから再度お試しください。';
    }

    if (status >= 500) {
      return 'サーバーで問題が発生しました。しばらく待ってから再度お試しください。';
    }

    if (context === 'login') {
      if (status === 401) {
        return 'メールアドレスまたはパスワードが正しくありません。入力内容を確認して再度お試しください。';
      }

      if (status === 403) {
        if (detailMessage) {
          const normalized = detailMessage.toLowerCase();
          if (
            normalized.includes('pending') ||
            normalized.includes('approval') ||
            normalized.includes('inactive')
          ) {
            return 'アカウントは承認待ちです。管理者に承認依頼メールを送信し、承認後にログインしてください。';
          }
          return detailMessage;
        }

        return 'アカウントにアクセスできません。権限を確認のうえ管理者にお問い合わせください。';
      }

      if (status === 404) {
        return 'ログインサービスに接続できません。時間をおいてから再度お試しください。';
      }

      if (status === 400 || status === 422) {
        const validationMessage = this.buildLoginValidationMessage(error.error);
        if (validationMessage) {
          return validationMessage;
        }

        if (detailMessage) {
          return detailMessage;
        }

        return '入力内容に誤りがあります。メールアドレスとパスワードを確認してください。';
      }
    }

    if (context === 'register' && (status === 400 || status === 422)) {
      if (detailMessage?.toLowerCase().includes('already exists')) {
        return 'このメールアドレスはすでに登録されています。ログインするか別のメールアドレスをお試しください。';
      }

      if (detailMessage) {
        return detailMessage;
      }

      return '入力内容に誤りがあります。内容を確認して再度お試しください。';
    }

    if (detailMessage) {
      return detailMessage;
    }

    return this.getFallbackMessage(context);
  }

  private extractDetailMessage(errorBody: unknown): string | null {
    if (typeof errorBody === 'string') {
      const trimmed = errorBody.trim();
      return trimmed.length > 0 ? trimmed : null;
    }

    if (errorBody && typeof errorBody === 'object') {
      const detail = (errorBody as { detail?: unknown }).detail;
      if (typeof detail === 'string') {
        const trimmed = detail.trim();
        return trimmed.length > 0 ? trimmed : null;
      }

      if (Array.isArray(detail)) {
        for (const entry of detail) {
          if (entry && typeof entry === 'object') {
            const message = (entry as Record<string, unknown>)['msg'];
            if (typeof message === 'string' && message.trim().length > 0) {
              return message;
            }
          }
        }
      }
    }

    return null;
  }

  private buildLoginValidationMessage(errorBody: unknown): string | null {
    if (!errorBody || typeof errorBody !== 'object') {
      return null;
    }

    const detail = (errorBody as { detail?: unknown }).detail;
    if (!Array.isArray(detail)) {
      return null;
    }

    const entries = detail.filter(
      (entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object',
    );

    const emailError = entries.find((entry) => this.detailIncludesField(entry['loc'], 'email'));
    if (emailError) {
      const message = typeof emailError['msg'] === 'string' ? emailError['msg'] : null;
      if (message) {
        if (message.includes('valid email')) {
          return 'メールアドレスの形式が正しくありません。正しいメールアドレスを入力してください。';
        }

        if (message.includes('field required')) {
          return 'メールアドレスが入力されていません。メールアドレスを入力してください。';
        }

        return `メールアドレスの入力内容に誤りがあります（${message}）。確認してください。`;
      }
    }

    const passwordError = entries.find((entry) =>
      this.detailIncludesField(entry['loc'], 'password'),
    );
    if (passwordError) {
      const message = typeof passwordError['msg'] === 'string' ? passwordError['msg'] : null;
      if (message) {
        if (message.includes('field required')) {
          return 'パスワードが入力されていません。パスワードを入力してください。';
        }

        return `パスワードの入力内容に誤りがあります（${message}）。確認してください。`;
      }
    }

    const genericMessage = entries
      .map((entry) => (typeof entry['msg'] === 'string' ? entry['msg'] : null))
      .find((msg): msg is string => !!msg && msg.trim().length > 0);

    if (genericMessage) {
      return `入力内容に誤りがあります（${genericMessage}）。内容を確認して再度お試しください。`;
    }

    return null;
  }

  private detailIncludesField(loc: unknown, field: string): boolean {
    if (!Array.isArray(loc)) {
      return false;
    }

    return loc.some(
      (part) => typeof part === 'string' && part.toLowerCase() === field.toLowerCase(),
    );
  }

  private getFallbackMessage(context: 'login' | 'register' | 'general'): string {
    switch (context) {
      case 'login':
        return 'ログインに失敗しました。時間をおいて再度お試しください。';
      case 'register':
        return 'アカウントの作成に失敗しました。時間をおいて再度お試しください。';
      default:
        return '予期しないエラーが発生しました。もう一度お試しください。';
    }
  }
}
