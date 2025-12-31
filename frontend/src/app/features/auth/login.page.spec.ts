import { TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { Router } from '@angular/router';

import { Auth } from '@core/auth/auth';

import { LoginPage } from './login.page';

type Resolve<T> = (value: T | PromiseLike<T>) => void;

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: Resolve<T>;
  readonly reject: (reason?: unknown) => void;
}

const createDeferred = <T>(): Deferred<T> => {
  let resolve!: Resolve<T>;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

class MockRouter {
  public readonly navigateByUrl = jasmine.createSpy('navigateByUrl').and.callFake(async () => true);
}

interface LoginCall {
  readonly email: string;
  readonly password: string;
  readonly deferred: Deferred<boolean>;
}

interface RegisterCall {
  readonly email: string;
  readonly password: string;
  readonly nickname: string;
  readonly deferred: Deferred<{
    message: string;
    requires_approval: boolean;
    admin_email: string | null;
  } | null>;
}

class MockAuthService {
  private readonly pendingStore = signal(false);
  private readonly initializedStore = signal(true);
  private readonly authenticatedStore = signal(false);
  private readonly errorStore = signal<string | null>(null);

  public readonly pending = computed(() => this.pendingStore());
  public readonly initialized = computed(() => this.initializedStore());
  public readonly isAuthenticated = computed(() => this.authenticatedStore());
  public readonly error = computed(() => this.errorStore());

  public readonly loginCalls: LoginCall[] = [];
  public readonly registerCalls: RegisterCall[] = [];

  public readonly ensureInitialized = jasmine
    .createSpy('ensureInitialized')
    .and.callFake(async () => undefined);

  public readonly getAdminContact = jasmine
    .createSpy('getAdminContact')
    .and.callFake(async () => ({ email: 'admin@example.com' }));

  public readonly login: jasmine.Spy<(email: string, password: string) => Promise<boolean>> =
    jasmine.createSpy('login').and.callFake((email: string, password: string) => {
      this.pendingStore.set(true);
      const deferred = createDeferred<boolean>();
      this.loginCalls.push({ email, password, deferred });
      deferred.promise.finally(() => {
        this.pendingStore.set(false);
      });
      return deferred.promise;
    });

  public readonly register: jasmine.Spy<
    (
      email: string,
      password: string,
      nickname: string,
    ) => Promise<{ message: string; requires_approval: boolean; admin_email: string | null } | null>
  > = jasmine
    .createSpy('register')
    .and.callFake((email: string, password: string, nickname: string) => {
      this.pendingStore.set(true);
      const deferred = createDeferred<{
        message: string;
        requires_approval: boolean;
        admin_email: string | null;
      } | null>();
      this.registerCalls.push({ email, password, nickname, deferred });
      deferred.promise.finally(() => {
        this.pendingStore.set(false);
      });
      return deferred.promise;
    });

  public setError(message: string | null): void {
    this.errorStore.set(message);
  }
}

describe('LoginPage', () => {
  let auth: MockAuthService;
  let router: MockRouter;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        { provide: Auth, useClass: MockAuthService },
        { provide: Router, useClass: MockRouter },
      ],
    }).compileComponents();

    auth = TestBed.inject(Auth) as unknown as MockAuthService;
    router = TestBed.inject(Router) as unknown as MockRouter;
  });

  it('allows retrying login after correcting credentials while a request is pending', async () => {
    const fixture = TestBed.createComponent(LoginPage);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.loginForm.controls.email.setValue('user@example.com');
    component.loginForm.controls.password.setValue('wrong-password');

    const firstSubmission = component.onLoginSubmit(new Event('submit'));
    expect(auth.login.calls.count()).toBe(1);
    expect(auth.loginCalls[0]).toEqual(
      jasmine.objectContaining({ email: 'user@example.com', password: 'wrong-password' }),
    );

    component.loginForm.controls.password.setValue('correct-password');

    expect(component.canSubmitLogin()).toBeTrue();

    const secondSubmission = component.onLoginSubmit(new Event('submit'));
    expect(auth.login.calls.count()).toBe(2);
    expect(auth.loginCalls[1]).toEqual(
      jasmine.objectContaining({ email: 'user@example.com', password: 'correct-password' }),
    );

    auth.setError('Invalid credentials');
    auth.loginCalls[0].deferred.resolve(false);
    await firstSubmission;
    expect(component.loginNotice()).toBe('Invalid credentials');

    auth.loginCalls[1].deferred.resolve(true);
    await secondSubmission;

    expect(router.navigateByUrl).toHaveBeenCalledWith('/');
    expect(component.loginForm.value()).toEqual({ email: '', password: '' });
    expect(component.loginFormChangedSinceLastSubmit()).toBeTrue();
  });

  it('prevents duplicate login submissions while the request is pending', async () => {
    const fixture = TestBed.createComponent(LoginPage);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.loginForm.controls.email.setValue('user@example.com');
    component.loginForm.controls.password.setValue('secret-password');

    const submission = component.onLoginSubmit(new Event('submit'));
    expect(auth.login.calls.count()).toBe(1);
    expect(component.canSubmitLogin()).toBeFalse();

    const duplicateSubmission = component.onLoginSubmit(new Event('submit'));
    expect(auth.login.calls.count()).toBe(1);

    auth.loginCalls[0].deferred.resolve(false);
    await submission;
    await duplicateSubmission;
  });

  it('validates login form inputs and exposes error messages', async () => {
    const fixture = TestBed.createComponent(LoginPage);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.loginEmailError()).toBeNull();
    expect(component.loginPasswordError()).toBeNull();

    await component.onLoginSubmit(new Event('submit'));

    expect(component.loginNotice()).toBe('メールアドレスを入力してください。');
    expect(component.loginEmailError()).toBe('メールアドレスを入力してください。');
    expect(component.loginPasswordError()).toBe('パスワードを入力してください。');
    expect(auth.login.calls.count()).toBe(0);

    component.loginForm.controls.email.setValue('invalid-address');
    component.loginForm.controls.password.setValue('short');

    await component.onLoginSubmit(new Event('submit'));

    expect(component.loginNotice()).toBe('メールアドレスの形式が正しくありません。');
    expect(component.loginEmailError()).toBe('メールアドレスの形式が正しくありません。');
    expect(auth.login.calls.count()).toBe(0);

    component.loginForm.controls.email.setValue('user@example.com');

    await component.onLoginSubmit(new Event('submit'));

    expect(component.loginNotice()).toBe('パスワードは8文字以上で入力してください。');
    expect(component.loginEmailError()).toBeNull();
    expect(component.loginPasswordError()).toBe('パスワードは8文字以上で入力してください。');
    expect(auth.login.calls.count()).toBe(0);

    component.loginForm.controls.password.setValue('validpass');

    expect(component.loginEmailError()).toBeNull();
    expect(component.loginPasswordError()).toBeNull();
    expect(component.canSubmitLogin()).toBeTrue();
  });

  it('validates registration form inputs before calling the API', async () => {
    const fixture = TestBed.createComponent(LoginPage);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.registerEmailError()).toBeNull();
    expect(component.registerNicknameError()).toBeNull();
    expect(component.registerPasswordError()).toBeNull();
    expect(component.registerConfirmError()).toBeNull();

    await component.onRegisterSubmit(new Event('submit'));

    expect(component.registerNotice()).toBe('ニックネームを入力してください。');
    expect(component.registerEmailError()).toBe('メールアドレスを入力してください。');
    expect(component.registerNicknameError()).toBe('ニックネームを入力してください。');
    expect(component.registerPasswordError()).toBe('パスワードを入力してください。');
    expect(component.registerConfirmError()).toBe('確認用パスワードを入力してください。');
    expect(auth.register.calls.count()).toBe(0);

    component.registerForm.controls.nickname.setValue('Valid Nickname');
    component.registerForm.controls.email.setValue('invalid-address');
    component.registerForm.controls.password.setValue('short');
    component.registerForm.controls.confirmPassword.setValue('short');

    await component.onRegisterSubmit(new Event('submit'));

    expect(component.registerNotice()).toBe('メールアドレスの形式が正しくありません。');
    expect(component.registerEmailError()).toBe('メールアドレスの形式が正しくありません。');
    expect(component.registerNicknameError()).toBeNull();

    component.registerForm.controls.email.setValue('user@example.com');

    await component.onRegisterSubmit(new Event('submit'));

    expect(component.registerNotice()).toBe('パスワードは8文字以上で入力してください。');
    expect(component.registerPasswordError()).toBe('パスワードは8文字以上で入力してください。');

    component.registerForm.controls.password.setValue('validpass');
    component.registerForm.controls.confirmPassword.setValue('mismatch');

    await component.onRegisterSubmit(new Event('submit'));

    expect(component.registerNotice()).toBe('確認用パスワードが一致しません。');
    expect(component.registerConfirmError()).toBe('確認用パスワードが一致しません。');

    component.registerForm.controls.confirmPassword.setValue('validpass');

    expect(component.registerConfirmError()).toBeNull();
    expect(component.registerNicknameError()).toBeNull();
    expect(component.isRegisterFormValid()).toBeTrue();
  });

  it('toggles between login and registration views', () => {
    const fixture = TestBed.createComponent(LoginPage);
    const component = fixture.componentInstance;

    expect(component.isLoginView()).toBeTrue();
    expect(component.isRegisterView()).toBeFalse();

    component.showRegisterView();

    expect(component.isLoginView()).toBeFalse();
    expect(component.isRegisterView()).toBeTrue();

    component.showLoginView();

    expect(component.isLoginView()).toBeTrue();
    expect(component.isRegisterView()).toBeFalse();
  });
});
