import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';

import { PageLayout } from '@shared/ui/page-layout/page-layout';
import { Router } from '@angular/router';

import { Auth } from '@core/auth/auth';
import { createSignalForm } from '@shared/forms/signal-forms';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 320;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const HOME_ROUTE = '/';

interface LoginSubmission {
  readonly email: string;
  readonly password: string;
}

interface RegistrationSubmission {
  readonly email: string;
  readonly password: string;
  readonly nickname: string;
}

@Component({
  selector: 'app-login-page',
  imports: [PageLayout],
  templateUrl: './login.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  public readonly loginForm = createSignalForm({ email: '', password: '' });
  public readonly registerForm = createSignalForm({
    nickname: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  public readonly loginNotice = signal<string | null>(null);
  public readonly registerNotice = signal<string | null>(null);
  private readonly activeView = signal<'login' | 'register'>('login');

  public readonly pending = this.auth.pending;
  private readonly lastLoginSubmission = signal<LoginSubmission | null>(null);
  private readonly lastRegisterSubmission = signal<RegistrationSubmission | null>(null);
  private readonly loginEmailTouched = signal(false);
  private readonly loginPasswordTouched = signal(false);
  private readonly registerEmailTouched = signal(false);
  private readonly registerNicknameTouched = signal(false);
  private readonly registerPasswordTouched = signal(false);
  private readonly registerConfirmTouched = signal(false);
  public readonly loginEmailError = computed(() => {
    if (!this.loginEmailTouched()) {
      return null;
    }

    const value = this.loginForm.controls.email.value();
    return this.getEmailError(value);
  });
  public readonly loginPasswordError = computed(() => {
    if (!this.loginPasswordTouched()) {
      return null;
    }

    const value = this.loginForm.controls.password.value();
    return this.getPasswordError(value);
  });
  public readonly isLoginFormValid = computed(() => {
    const email = this.loginForm.controls.email.value();
    const password = this.loginForm.controls.password.value();

    return !this.getEmailError(email) && !this.getPasswordError(password);
  });
  public readonly isRegisterFormValid = computed(() => {
    const email = this.registerForm.controls.email.value();
    const nickname = this.registerForm.controls.nickname.value();
    const password = this.registerForm.controls.password.value();
    const confirmPassword = this.registerForm.controls.confirmPassword.value();

    return (
      !this.getEmailError(email) &&
      !this.getNicknameError(nickname) &&
      !this.getPasswordError(password) &&
      !this.getRegisterConfirmError(password, confirmPassword)
    );
  });
  public readonly registerEmailError = computed(() => {
    if (!this.registerEmailTouched()) {
      return null;
    }

    const value = this.registerForm.controls.email.value();
    return this.getEmailError(value);
  });
  public readonly registerPasswordError = computed(() => {
    if (!this.registerPasswordTouched()) {
      return null;
    }

    const value = this.registerForm.controls.password.value();
    return this.getPasswordError(value);
  });
  public readonly registerConfirmError = computed(() => {
    if (!this.registerConfirmTouched()) {
      return null;
    }

    const password = this.registerForm.controls.password.value();
    const confirmPassword = this.registerForm.controls.confirmPassword.value();

    return this.getRegisterConfirmError(password, confirmPassword);
  });
  public readonly registerNicknameError = computed(() => {
    if (!this.registerNicknameTouched()) {
      return null;
    }
    const value = this.registerForm.controls.nickname.value();
    return this.getNicknameError(value);
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
      lastSubmission.password !== value.password ||
      lastSubmission.nickname !== value.nickname
    );
  });
  public readonly canSubmitLogin = computed(
    () => this.isLoginFormValid() && (!this.pending() || this.loginFormChangedSinceLastSubmit()),
  );
  public readonly canSubmitRegistration = computed(
    () =>
      this.isRegisterFormValid() && (!this.pending() || this.registerFormChangedSinceLastSubmit()),
  );
  public readonly isLoginView = computed(() => this.activeView() === 'login');

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
    this.loginEmailTouched.set(true);
    this.loginPasswordTouched.set(true);

    const credentials = this.loginForm.value();
    const validationError = this.resolveLoginErrorMessage(credentials);
    if (validationError) {
      this.loginNotice.set(validationError);
      return;
    }

    const email = this.sanitizeEmail(credentials.email);
    const password = credentials.password;

    if (this.pending() && !this.loginFormChangedSinceLastSubmit()) {
      return;
    }

    this.lastLoginSubmission.set({ email, password });

    const success = await this.auth.login(email, password);
    if (success) {
      this.loginForm.reset();
      this.resetLoginInteractions();
      this.clearLastLoginSubmission();
      await this.router.navigateByUrl(HOME_ROUTE);
      return;
    }

    const errorMessage = this.auth.error() ?? 'メールアドレスまたはパスワードが正しくありません。';
    this.loginNotice.set(errorMessage);
  }

  public onLoginEmailInput(event: Event): void {
    const value = (event.target as HTMLInputElement | null)?.value ?? '';
    this.loginEmailTouched.set(true);
    this.loginForm.controls.email.setValue(value);
  }

  public onLoginPasswordInput(event: Event): void {
    const value = (event.target as HTMLInputElement | null)?.value ?? '';
    this.loginPasswordTouched.set(true);
    this.loginForm.controls.password.setValue(value);
  }

  public async onRegisterSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.resetNotices();
    this.registerEmailTouched.set(true);
    this.registerNicknameTouched.set(true);
    this.registerPasswordTouched.set(true);
    this.registerConfirmTouched.set(true);

    const value = this.registerForm.value();
    const email = this.sanitizeEmail(value.email);
    const nickname = value.nickname.trim();
    const password = value.password;

    const validationError = this.resolveRegisterErrorMessage(value);
    if (validationError) {
      this.registerNotice.set(validationError);
      return;
    }

    if (this.pending() && !this.registerFormChangedSinceLastSubmit()) {
      return;
    }

    this.lastRegisterSubmission.set({ email, password, nickname });

    const success = await this.auth.register(email, password, nickname);
    if (success) {
      this.registerForm.reset();
      this.resetRegisterInteractions();
      this.clearLastRegisterSubmission();
      await this.router.navigateByUrl(HOME_ROUTE);
      return;
    }

    const errorMessage = this.auth.error() ?? 'アカウントの作成に失敗しました。';
    this.registerNotice.set(errorMessage);
  }

  public onRegisterEmailInput(event: Event): void {
    const value = (event.target as HTMLInputElement | null)?.value ?? '';
    this.registerEmailTouched.set(true);
    this.registerForm.controls.email.setValue(value);
  }

  public onRegisterNicknameInput(event: Event): void {
    const value = (event.target as HTMLInputElement | null)?.value ?? '';
    this.registerNicknameTouched.set(true);
    this.registerForm.controls.nickname.setValue(value);
  }

  public onRegisterPasswordInput(event: Event): void {
    const value = (event.target as HTMLInputElement | null)?.value ?? '';
    this.registerPasswordTouched.set(true);
    this.registerForm.controls.password.setValue(value);
  }

  public onRegisterConfirmInput(event: Event): void {
    const value = (event.target as HTMLInputElement | null)?.value ?? '';
    this.registerConfirmTouched.set(true);
    this.registerForm.controls.confirmPassword.setValue(value);
  }

  public showLoginView(): void {
    if (this.activeView() === 'login') {
      return;
    }

    this.activeView.set('login');
    this.resetNotices();
    this.resetRegisterInteractions();
  }

  public showRegisterView(): void {
    if (this.activeView() === 'register') {
      return;
    }

    this.activeView.set('register');
    this.resetNotices();
    this.resetLoginInteractions();
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

  private resetLoginInteractions(): void {
    this.loginEmailTouched.set(false);
    this.loginPasswordTouched.set(false);
  }

  private resetRegisterInteractions(): void {
    this.registerEmailTouched.set(false);
    this.registerNicknameTouched.set(false);
    this.registerPasswordTouched.set(false);
    this.registerConfirmTouched.set(false);
  }

  private sanitizeEmail(value: string): string {
    return value.normalize('NFKC').trim().toLowerCase();
  }

  private getEmailError(value: string): string | null {
    const sanitized = this.sanitizeEmail(value);

    if (sanitized.length === 0) {
      return 'メールアドレスを入力してください。';
    }

    if (sanitized.length > MAX_EMAIL_LENGTH) {
      return `メールアドレスは${MAX_EMAIL_LENGTH}文字以内で入力してください。`;
    }

    if (!EMAIL_PATTERN.test(sanitized)) {
      return 'メールアドレスの形式が正しくありません。';
    }

    return null;
  }

  private getPasswordError(value: string): string | null {
    if (value.trim().length === 0) {
      return 'パスワードを入力してください。';
    }

    if (value.length < MIN_PASSWORD_LENGTH) {
      return `パスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください。`;
    }

    if (value.length > MAX_PASSWORD_LENGTH) {
      return `パスワードは${MAX_PASSWORD_LENGTH}文字以内で入力してください。`;
    }

    return null;
  }

  private getRegisterConfirmError(password: string, confirmPassword: string): string | null {
    if (confirmPassword.trim().length === 0) {
      return '確認用パスワードを入力してください。';
    }

    if (this.getPasswordError(password)) {
      return null;
    }

    if (password !== confirmPassword) {
      return '確認用パスワードが一致しません。';
    }

    return null;
  }

  private resolveLoginErrorMessage(value: { email: string; password: string }): string | null {
    const emailError = this.getEmailError(value.email);
    if (emailError) {
      return emailError;
    }

    const passwordError = this.getPasswordError(value.password);
    if (passwordError) {
      return passwordError;
    }

    return null;
  }

  private resolveRegisterErrorMessage(value: {
    nickname: string;
    email: string;
    password: string;
    confirmPassword: string;
  }): string | null {
    const nicknameError = this.getNicknameError(value.nickname);
    if (nicknameError) {
      return nicknameError;
    }
    const emailError = this.getEmailError(value.email);
    if (emailError) {
      return emailError;
    }

    const passwordError = this.getPasswordError(value.password);
    if (passwordError) {
      return passwordError;
    }

    const confirmError = this.getRegisterConfirmError(value.password, value.confirmPassword);
    if (confirmError) {
      return confirmError;
    }

    return null;
  }

  private getNicknameError(value: string): string | null {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return 'ニックネームを入力してください。';
    }
    const MAX_NICKNAME_LENGTH = 64;
    if (trimmed.length > MAX_NICKNAME_LENGTH) {
      return `ニックネームは${MAX_NICKNAME_LENGTH}文字以内で入力してください。`;
    }
    return null;
  }
}
