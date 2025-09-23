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
  public readonly requestForm = createSignalForm({ email: '' });
  public readonly infoMessage = signal<string | null>(null);
  public readonly loginNotice = signal<string | null>(null);

  public readonly pending = computed(() => this.auth.pending());
  public readonly error = computed(() => this.auth.error());

  public constructor() {
    effect(() => {
      if (!this.auth.initialized()) {
        return;
      }

      if (this.auth.isAuthenticated()) {
        void this.router.navigateByUrl('/board');
      }
    });

    void this.auth.ensureInitialized();
  }

  public async onLoginSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.infoMessage.set(null);
    this.loginNotice.set(null);

    const credentials = this.loginForm.value();
    const email = credentials.email.trim();
    const password = credentials.password;

    if (!email || !password) {
      this.loginNotice.set('メールアドレスとパスワードを入力してください。');
      return;
    }

    const success = await this.auth.login(email, password);
    if (success) {
      await this.router.navigateByUrl('/board');
    }
  }

  public onLoginEmailInput(event: Event): void {
    const value = (event.target as HTMLInputElement | null)?.value ?? '';
    this.loginForm.controls.email.setValue(value);
  }

  public onLoginPasswordInput(event: Event): void {
    const value = (event.target as HTMLInputElement | null)?.value ?? '';
    this.loginForm.controls.password.setValue(value);
  }

  public async onRequestRegistration(): Promise<void> {
    this.infoMessage.set(null);
    this.loginNotice.set(null);

    const email = this.requestForm.value().email.trim();
    if (!email) {
      this.infoMessage.set('メールアドレスを入力してください。');
      return;
    }

    const message = await this.auth.requestRegistration(email);
    if (message) {
      this.infoMessage.set(message);
      this.requestForm.reset({ email: '' });
    }
  }

  public async onRequestPasswordReset(): Promise<void> {
    this.infoMessage.set(null);
    this.loginNotice.set(null);

    const email = this.requestForm.value().email.trim();
    if (!email) {
      this.infoMessage.set('メールアドレスを入力してください。');
      return;
    }

    const message = await this.auth.requestPasswordReset(email);
    if (message) {
      this.infoMessage.set(message);
      this.requestForm.reset({ email: '' });
    }
  }

  public onRequestEmailInput(event: Event): void {
    const value = (event.target as HTMLInputElement | null)?.value ?? '';
    this.requestForm.controls.email.setValue(value);
  }
}
