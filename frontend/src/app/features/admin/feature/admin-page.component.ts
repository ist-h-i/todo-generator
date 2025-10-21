import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { PageLayoutComponent } from '@shared/ui/page-layout/page-layout';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AdminApiService } from '@core/api/admin-api.service';
import { AuthService } from '@core/auth/auth.service';
import {
  AdminUser,
  AdminUserUpdate,
  ApiCredential,
  ApiCredentialUpdate,
  Competency,
  CompetencyCriterionInput,
  CompetencyEvaluation,
  CompetencyInput,
  QuotaDefaults,
} from '@core/models';
import { signalForms } from '@shared/utils/signal-forms';
import { LocalDateTimePipe } from '@shared/pipes/local-date-time.pipe';
import { UiSelectComponent } from '@shared/ui/select/ui-select';

type AdminTab = 'competencies' | 'evaluations' | 'users' | 'settings';
type CriterionFormGroup = FormGroup<{
  title: FormControl<string>;
  description: FormControl<string>;
}>;
type UserQuotaForm = FormGroup<{
  cardDailyLimit: FormControl<number | null>;
  evaluationDailyLimit: FormControl<number | null>;
}>;
type CompetencyFormControls = {
  name: FormControl<string>;
  level: FormControl<CompetencyInput['level']>;
  description: FormControl<string>;
  is_active: FormControl<boolean>;
  criteria: FormArray<CriterionFormGroup>;
};

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PageLayoutComponent, LocalDateTimePipe, UiSelectComponent],
  templateUrl: './admin-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPageComponent {
  private readonly api = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder);

  public readonly activeTab = signal<AdminTab>('competencies');
  public readonly competencies = signal<Competency[]>([]);
  public readonly users = signal<AdminUser[]>([]);
  public readonly evaluations = signal<CompetencyEvaluation[]>([]);
  public readonly quotaDefaults = signal<QuotaDefaults | null>(null);
  public readonly apiCredential = signal<ApiCredential | null>(null);
  public readonly loading = signal(false);
  public readonly feedback = signal<string | null>(null);
  public readonly error = signal<string | null>(null);

  private readonly defaultGeminiModel = 'models/gemini-2.0-flash';
  private readonly competencyCriteria = new FormArray<CriterionFormGroup>([
    this.createCriterionGroup(),
  ]);
  public readonly competencyForm: FormGroup<CompetencyFormControls> = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    level: new FormControl<CompetencyInput['level']>('junior', {
      nonNullable: true,
    }),
    description: new FormControl('', {
      nonNullable: true,
    }),
    is_active: new FormControl(true, { nonNullable: true }),
    criteria: this.competencyCriteria,
  });
  private readonly competencyFormState = signalForms(this.competencyForm);

  public readonly evaluationForm: FormGroup<{
    userId: FormControl<string>;
    competencyId: FormControl<string>;
    periodStart: FormControl<string>;
    periodEnd: FormControl<string>;
  }> = new FormGroup({
    userId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    competencyId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    periodStart: new FormControl('', { nonNullable: true }),
    periodEnd: new FormControl('', { nonNullable: true }),
  });
  private readonly evaluationFormState = signalForms(this.evaluationForm);

  public readonly apiForm: FormGroup<{
    model: FormControl<string>;
    secret: FormControl<string>;
  }> = new FormGroup({
    model: new FormControl(this.defaultGeminiModel, { nonNullable: true }),
    secret: new FormControl('', { nonNullable: true }),
  });
  private readonly apiFormState = signalForms(this.apiForm);

  public readonly quotaDefaultsForm: FormGroup<{
    cardDailyLimit: FormControl<number | null>;
    evaluationDailyLimit: FormControl<number | null>;
  }> = new FormGroup({
    cardDailyLimit: new FormControl<number | null>(null, {
      validators: [Validators.required],
    }),
    evaluationDailyLimit: new FormControl<number | null>(null, {
      validators: [Validators.required],
    }),
  });
  private readonly quotaDefaultsFormState = signalForms(this.quotaDefaultsForm);

  private readonly userQuotaForms = signal(new Map<string, UserQuotaForm>());
  public readonly geminiModelOptions: ReadonlyArray<{ value: string; label: string }> = [
    { value: 'models/gemini-2.0-flash', label: 'Gemini 2.0 Flash (推奨)' },
    { value: 'models/gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
    { value: 'models/gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash Experimental' },
    {
      value: 'models/gemini-2.0-flash-exp-image-generation',
      label: 'Gemini 2.0 Flash Experimental (画像生成)',
    },
    { value: 'models/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash 001' },
    { value: 'models/gemini-1.5-flash', label: 'Gemini 1.5 Flash (互換)' },
    { value: 'gemini-1.5-flash-latest', label: 'Gemini 1.5 Flash (-latest エイリアス)' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (互換モード)' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-1.0-pro', label: 'Gemini 1.0 Pro' },
    { value: 'gemini-1.0-pro-vision', label: 'Gemini 1.0 Pro Vision' },
  ];
  private readonly knownGeminiModelValues = new Set(
    this.geminiModelOptions.map((option) => option.value),
  );

  public constructor() {
    this.bootstrap();
  }

  public setActiveTab(tab: AdminTab): void {
    this.activeTab.set(tab);
  }

  public resetFeedback(): void {
    this.feedback.set(null);
  }

  public clearError(): void {
    this.error.set(null);
  }

  public addCriterion(): void {
    this.competencyCriteria.push(this.createCriterionGroup());
  }

  public removeCriterion(index: number): void {
    if (this.competencyCriteria.length === 1) {
      return;
    }
    this.competencyCriteria.removeAt(index);
  }

  public createCompetency(): void {
    this.clearError();

    if (this.competencyForm.invalid) {
      this.competencyForm.markAllAsTouched();
    }

    const value = this.competencyForm.getRawValue();
    const name = value.name.trim();
    if (name.length === 0) {
      this.error.set('コンピテンシー名を入力してください。');
      return;
    }

    const payload: CompetencyInput = {
      name,
      level: value.level,
      description: value.description.trim(),
      is_active: value.is_active,
      rubric: {},
      criteria: value.criteria
        .map((criterion, index) => ({
          title: criterion.title.trim(),
          description: criterion.description.trim() || undefined,
          is_active: true,
          order_index: index,
          weight: undefined,
          intentionality_prompt: undefined,
          behavior_prompt: undefined,
        }))
        .filter((criterion) => criterion.title.length > 0),
    };

    this.loading.set(true);
    this.api
      .createCompetency(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (competency) => {
          this.loading.set(false);
          this.competencies.update((list) => [...list, competency]);
          this.resetCompetencyForm();
          this.notify('コンピテンシーを登録しました。');
        },
        error: (err) => {
          this.loading.set(false);
          this.handleError(err, 'コンピテンシーの登録に失敗しました。');
        },
      });
  }

  public resetCompetencyForm(): void {
    while (this.competencyCriteria.length > 1) {
      this.competencyCriteria.removeAt(this.competencyCriteria.length - 1);
    }
    this.competencyForm.reset({
      name: '',
      level: 'junior',
      description: '',
      is_active: true,
    });
    const first = this.competencyCriteria.at(0);
    first?.reset({ title: '', description: '' });
  }

  public toggleCompetencyActive(competency: Competency, active: boolean): void {
    this.api
      .updateCompetency(competency.id, { is_active: active })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.replaceCompetency(updated);
          this.notify('コンピテンシーの状態を更新しました。');
        },
        error: (err) => this.handleError(err, 'コンピテンシーの更新に失敗しました。'),
      });
  }

  public triggerEvaluation(): void {
    this.clearError();

    if (this.evaluationForm.invalid) {
      this.evaluationForm.markAllAsTouched();
    }

    const evaluation = this.evaluationForm.getRawValue();
    if (!evaluation.userId || !evaluation.competencyId) {
      this.error.set('ユーザとコンピテンシーを選択してください。');
      return;
    }

    const payload = {
      user_id: evaluation.userId,
      period_start: evaluation.periodStart || undefined,
      period_end: evaluation.periodEnd || undefined,
      triggered_by: 'manual' as const,
    };

    this.loading.set(true);
    this.api
      .triggerEvaluation(evaluation.competencyId, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (evaluation) => {
          this.loading.set(false);
          this.evaluations.update((items) => [evaluation, ...items].slice(0, 25));
          this.notify('評価を実行しました。');
        },
        error: (err) => {
          this.loading.set(false);
          this.handleError(err, '評価の実行に失敗しました。');
        },
      });
  }

  public toggleAdmin(user: AdminUser, next: boolean): void {
    this.updateUser(user, { is_admin: next });
  }

  public toggleActive(user: AdminUser, next: boolean): void {
    this.updateUser(user, { is_active: next });
  }

  public saveUserQuota(user: AdminUser): void {
    const form = this.userQuotaForms().get(user.id);
    if (!form) {
      return;
    }
    const { cardDailyLimit, evaluationDailyLimit } = form.getRawValue();
    this.updateUser(user, {
      card_daily_limit: cardDailyLimit ?? null,
      evaluation_daily_limit: evaluationDailyLimit ?? null,
    });
  }

  public deleteUser(user: AdminUser): void {
    this.clearError();

    if (this.isCurrentUser(user)) {
      this.error.set('自分のアカウントは削除できません…');
      return;
    }

    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(`${user.email} を削除しますか？この操作は取り消せません。`);
      if (!confirmed) {
        return;
      }
    }

    this.api
      .deleteUser(user.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.users.update((list) => list.filter((item) => item.id !== user.id));
          this.syncUserQuotaForms(this.users());
          this.notify('ユーザを削除しました。');
        },
        error: (err) => this.handleError(err, 'ユーザの削除に失敗しました。'),
      });
  }

  public isCurrentUser(user: AdminUser): boolean {
    const currentUser = this.auth.user();
    return currentUser?.id === user.id;
  }

  public updateApiCredential(event: SubmitEvent): void {
    event.preventDefault();
    this.clearError();

    const formValue = this.apiForm.getRawValue();
    const secret = formValue.secret.trim();
    const hasCredential = this.apiCredential() !== null;
    if (!secret && !hasCredential) {
      this.error.set('API トークンを入力してください。');
      return;
    }

    const payload: ApiCredentialUpdate = {
      model: formValue.model,
    };
    if (secret) {
      payload.secret = secret;
    }

    this.loading.set(true);
    this.api
      .upsertApiCredential('gemini', payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (credential) => {
          this.loading.set(false);
          this.apiCredential.set(credential);
          this.apiForm.reset({
            model: this.resolveChatModel(credential.model),
            secret: '',
          });
          this.notify('API トークンを更新しました。');
        },
        error: (err) => {
          this.loading.set(false);
          this.handleError(err, 'API トークンの更新に失敗しました。');
        },
      });
  }

  public userEmail(userId: string): string {
    const match = this.users().find((user) => user.id === userId);
    return match?.email ?? userId;
  }

  public updateQuotaDefaults(event: SubmitEvent): void {
    event.preventDefault();
    this.clearError();

    if (this.quotaDefaultsForm.invalid) {
      this.quotaDefaultsForm.markAllAsTouched();
    }

    const formValue = this.quotaDefaultsForm.getRawValue();
    const { cardDailyLimit, evaluationDailyLimit } = formValue;
    if (cardDailyLimit === null || evaluationDailyLimit === null) {
      this.error.set('日次上限を入力してください。');
      return;
    }

    const payload = {
      card_daily_limit: cardDailyLimit,
      evaluation_daily_limit: evaluationDailyLimit,
    };

    this.loading.set(true);
    this.api
      .updateQuotaDefaults(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (defaults) => {
          this.loading.set(false);
          this.quotaDefaults.set(defaults);
          this.quotaDefaultsForm.setValue({
            cardDailyLimit: defaults.card_daily_limit,
            evaluationDailyLimit: defaults.evaluation_daily_limit,
          });
          this.notify('デフォルト日次上限を更新しました。');
        },
        error: (err) => {
          this.loading.set(false);
          this.handleError(err, 'デフォルト日次上限の更新に失敗しました。');
        },
      });
  }

  private bootstrap(): void {
    this.loadCompetencies();
    this.loadUsers();
    this.loadEvaluations();
    this.loadDefaults();
    this.loadCredential();
  }

  private loadCompetencies(): void {
    this.api
      .listCompetencies()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (competencies) => this.competencies.set(competencies),
        error: (err) => this.handleError(err, 'コンピテンシーの取得に失敗しました。'),
      });
  }

  private loadUsers(): void {
    this.api
      .listUsers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (users) => {
          this.users.set(users);
          this.syncUserQuotaForms(users);
        },
        error: (err) => this.handleError(err, 'ユーザ一覧の取得に失敗しました。'),
      });
  }

  private loadEvaluations(): void {
    this.api
      .listEvaluations()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (evaluations) => this.evaluations.set(evaluations),
        error: (err) => this.handleError(err, '評価履歴の取得に失敗しました。'),
      });
  }

  private loadDefaults(): void {
    this.api
      .getQuotaDefaults()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (defaults) => {
          this.quotaDefaults.set(defaults);
          this.quotaDefaultsForm.setValue({
            cardDailyLimit: defaults.card_daily_limit,
            evaluationDailyLimit: defaults.evaluation_daily_limit,
          });
        },
        error: (err) => this.handleError(err, '日次上限の取得に失敗しました。'),
      });
  }

  private loadCredential(): void {
    this.api
      .getApiCredential('gemini')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (credential) => {
          this.apiCredential.set(credential);
          this.apiForm.patchValue({
            model: this.resolveChatModel(credential.model),
            secret: '',
          });
        },
        error: (err: unknown) => {
          if (err instanceof HttpErrorResponse && err.status === 404) {
            this.apiCredential.set(null);
            this.apiForm.setValue({ model: this.defaultGeminiModel, secret: '' });
            return;
          }
          this.handleError(err, 'API トークンの取得に失敗しました。');
        },
      });
  }

  public isKnownModel(value: string): boolean {
    return this.knownGeminiModelValues.has(value);
  }

  private resolveChatModel(model: string | null | undefined): string {
    if (!model) {
      return this.defaultGeminiModel;
    }
    const trimmed = model.trim();
    if (!trimmed) {
      return this.defaultGeminiModel;
    }
    if (this.knownGeminiModelValues.has(trimmed)) {
      return trimmed;
    }
    return trimmed;
  }

  private updateUser(user: AdminUser, payload: AdminUserUpdate): void {
    this.api
      .updateUser(user.id, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.users.update((list) =>
            list.map((item) => (item.id === updated.id ? updated : item)),
          );
          this.syncUserQuotaForms(this.users());
          this.notify('ユーザ情報を更新しました。');
        },
        error: (err) => this.handleError(err, 'ユーザ情報の更新に失敗しました。'),
      });
  }

  private replaceCompetency(updated: Competency): void {
    this.competencies.update((list) =>
      list.map((item) => (item.id === updated.id ? updated : item)),
    );
  }

  public quotaForm(userId: string): UserQuotaForm | undefined {
    return this.userQuotaForms().get(userId);
  }

  private createCriterionGroup(initial?: Partial<CompetencyCriterionInput>): CriterionFormGroup {
    return this.formBuilder.group({
      title: this.formBuilder.control(initial?.title ?? '', { nonNullable: true }),
      description: this.formBuilder.control(initial?.description ?? '', { nonNullable: true }),
    });
  }

  private createUserQuotaForm(user: AdminUser): UserQuotaForm {
    return this.formBuilder.group({
      cardDailyLimit: this.formBuilder.control<number | null>(user.card_daily_limit ?? null),
      evaluationDailyLimit: this.formBuilder.control<number | null>(
        user.evaluation_daily_limit ?? null,
      ),
    });
  }

  private syncUserQuotaForms(users: AdminUser[]): void {
    const next = new Map<string, UserQuotaForm>();
    const current = this.userQuotaForms();
    for (const user of users) {
      const existing = current.get(user.id) ?? this.createUserQuotaForm(user);
      existing.patchValue(
        {
          cardDailyLimit: user.card_daily_limit ?? null,
          evaluationDailyLimit: user.evaluation_daily_limit ?? null,
        },
        { emitEvent: false },
      );
      next.set(user.id, existing);
    }
    this.userQuotaForms.set(next);
  }

  private notify(message: string): void {
    this.feedback.set(message);
    if (typeof window !== 'undefined') {
      window.setTimeout(() => this.feedback.set(null), 4000);
    }
  }

  private handleError(error: unknown, fallback: string): void {
    let message = fallback;
    if (error instanceof HttpErrorResponse) {
      message =
        (typeof error.error === 'object' && error.error?.detail) || error.message || fallback;
    }
    this.error.set(message);
  }
}
