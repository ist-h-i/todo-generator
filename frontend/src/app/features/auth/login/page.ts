import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';
import { createSignalForm } from '@lib/forms/signal-forms';

const MIN_PASSWORD_LENGTH = 8;
const HOME_ROUTE = '/';

interface LoginSubmission {
  readonly email: string;
  readonly password: string;
}

interface RegistrationSubmission {
  readonly email: string;
  readonly password: string;
}

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './page.html',
  styleUrl: './page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  public readonly loginForm = createSignalForm({ email: '', password: '' });
  public readonly registerForm = createSignalForm({
    email: '',
    password: '',
    confirmPassword: '',
  });
  public readonly loginNotice = signal<string | null>(null);
  public readonly registerNotice = signal<string | null>(null);

  public readonly pending = this.auth.pending;
  private readonly lastLoginSubmission = signal<LoginSubmission | null>(null);
  private readonly lastRegisterSubmission = signal<RegistrationSubmission | null>(null);
  public readonly isLoginFormValid = computed(() => {
    const value = this.loginForm.value();
    return value.email.trim().length > 0 && value.password.length > 0;
  });
  public readonly isRegisterFormValid = computed(() => {
    const value = this.registerForm.value();
    const email = this.sanitizeEmail(value.email);
    const password = value.password;
    const confirmPassword = value.confirmPassword;

    return (
      email.length > 0 &&
      password.length >= MIN_PASSWORD_LENGTH &&
      confirmPassword.length >= MIN_PASSWORD_LENGTH &&
      password === confirmPassword
    );
  });
  public readonly loginFormChangedSinceLastSubmit = computed(() => {
    const lastSubmission = this.lastLoginSubmission();
    if (!lastSubmission) {
      return true;
    }

    const value = this.loginForm.value();
    return (
      lastSubmission.email !== this.sanitizeEmail(value.email) ||
      lastSubmission.password !== value.password
    );
  });
  public readonly registerFormChangedSinceLastSubmit = computed(() => {
    const lastSubmission = this.lastRegisterSubmission();
    if (!lastSubmission) {
      return true;
    }

    const value = this.registerForm.value();
    return (
      lastSubmission.email !== this.sanitizeEmail(value.email) ||
      lastSubmission.password !== value.password
    );
  });
  public readonly canSubmitLogin = computed(
    () => this.isLoginFormValid() && (!this.pending() || this.loginFormChangedSinceLastSubmit()),
  );
  public readonly canSubmitRegistration = computed(
    () =>
      this.isRegisterFormValid() &&
      (!this.pending() || this.registerFormChangedSinceLastSubmit()),
  );

  public constructor() {
    effect(() => {
      if (!this.auth.initialized()) {
        return;
      }

      if (this.auth.isAuthenticated()) {
        void this.router.navigateByUrl(HOME_ROUTE);
      }
    });

    void this.auth.ensureInitialized();
  }

  public async onLoginSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.resetNotices();

    if (!this.isLoginFormValid()) {
      this.loginNotice.set('メールアドレスとパスワードを入力してください。');
      return;
    }

    const credentials = this.loginForm.value();
    const email = this.sanitizeEmail(credentials.email);
    const password = credentials.password;

    if (this.pending() && !this.loginFormChangedSinceLastSubmit()) {
      return;
    }

    this.lastLoginSubmission.set({ email, password });

    const success = await this.auth.login(email, password);
    if (success) {
      this.loginForm.reset();
      this.clearLastLoginSubmission();
      await this.router.navigateByUrl(HOME_ROUTE);
      return;
    }

    const errorMessage = this.auth.error() ?? 'メールアドレスまたはパスワードが正しくありません。';
    this.loginNotice.set(errorMessage);
  }

  public onLoginEmailInput(event: Event): void {
    const value = (event.target as HTMLInputElement | null)?.value ?? '';
    this.loginForm.controls.email.setValue(value);
  }

  public onLoginPasswordInput(event: Event): void {
    const value = (event.target as HTMLInputElement | null)?.value ?? '';
    this.loginForm.controls.password.setValue(value);
  }

  public async onRegisterSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.resetNotices();

    const value = this.registerForm.value();
    const email = this.sanitizeEmail(value.email);
    const password = value.password;
    const confirmPassword = value.confirmPassword;

    if (!email) {
      this.registerNotice.set('メールアドレスを入力してください。');
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      this.registerNotice.set(`パスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください。`);
      return;
    }

    if (password !== confirmPassword) {
      this.registerNotice.set('確認用パスワードが一致しません。');
      return;
    }

    if (this.pending() && !this.registerFormChangedSinceLastSubmit()) {
      return;
    }

    this.lastRegisterSubmission.set({ email, password });

    const success = await this.auth.register(email, password);
    if (success) {
      this.registerForm.reset();
      this.clearLastRegisterSubmission();
      await this.router.navigateByUrl(HOME_ROUTE);
      return;
    }

    const errorMessage = this.auth.error() ?? 'アカウントの作成に失敗しました。';
    this.registerNotice.set(errorMessage);
  }

  public onRegisterEmailInput(event: Event): void {
    const value = (event.target as HTMLInputElement | null)?.value ?? '';
    this.registerForm.controls.email.setValue(value);
  }

  public onRegisterPasswordInput(event: Event): void {
    const value = (event.target as HTMLInputElement | null)?.value ?? '';
    this.registerForm.controls.password.setValue(value);
  }

  public onRegisterConfirmInput(event: Event): void {
    const value = (event.target as HTMLInputElement | null)?.value ?? '';
    this.registerForm.controls.confirmPassword.setValue(value);
  }

  private resetNotices(): void {
    this.loginNotice.set(null);
    this.registerNotice.set(null);
  }

  private clearLastLoginSubmission(): void {
    this.lastLoginSubmission.set(null);
  }

  private clearLastRegisterSubmission(): void {
    this.lastRegisterSubmission.set(null);
  }

  private sanitizeEmail(value: string): string {
    return value.normalize('NFKC').trim().toLowerCase();
  }
}
