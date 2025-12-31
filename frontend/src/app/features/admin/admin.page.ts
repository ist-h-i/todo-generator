import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';

import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { PageLayout } from '@shared/ui/page-layout/page-layout';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AdminApi } from '@core/api/admin-api';
import { Auth } from '@core/auth/auth';
import {
  AdminUser,
  AdminUserUpdate,
  ApiCredential,
  ApiCredentialUpdate,
  Competency,
  CompetencyCriterionInput,
  CompetencyLevelDefinition,
  CompetencyLevelInput,
  CompetencyEvaluation,
  CompetencyInput,
  QuotaDefaults,
} from '@core/models';
import { LocalDateTimePipe } from '@shared/pipes/local-date-time';
import { UiSelect } from '@shared/ui/select/ui-select';
import { AiMark } from '@shared/ui/ai-mark/ai-mark';

type AdminTab = 'competencies' | 'evaluations' | 'users' | 'settings';
type CriterionFormGroup = FormGroup<{
  title: FormControl<string>;
  description: FormControl<string>;
}>;
type UserQuotaForm = FormGroup<{
  cardDailyLimit: FormControl<number | null>;
  evaluationDailyLimit: FormControl<number | null>;
  analysisDailyLimit: FormControl<number | null>;
  statusReportDailyLimit: FormControl<number | null>;
  immunityMapDailyLimit: FormControl<number | null>;
  immunityMapCandidateDailyLimit: FormControl<number | null>;
  appealDailyLimit: FormControl<number | null>;
  autoCardDailyLimit: FormControl<number | null>;
}>;
type CompetencyFormControls = {
  name: FormControl<string>;
  level: FormControl<CompetencyInput['level']>;
  description: FormControl<string>;
  is_active: FormControl<boolean>;
  criteria: FormArray<CriterionFormGroup>;
};
type CompetencyLevelFormControls = {
  value: FormControl<string>;
  label: FormControl<string>;
  scale: FormControl<number>;
  description: FormControl<string>;
  sort_order: FormControl<number | null>;
};

@Component({
  selector: 'app-admin-page',
  imports: [ReactiveFormsModule, PageLayout, LocalDateTimePipe, UiSelect, AiMark],
  templateUrl: './admin.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPage {
  private readonly api = inject(AdminApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(Auth);
  private readonly formBuilder = inject(FormBuilder);

  public readonly activeTab = signal<AdminTab>('competencies');
  public readonly competencies = signal<Competency[]>([]);
  public readonly editingCompetencyId = signal<string | null>(null);
  public readonly editingCompetency = computed(() => {
    const id = this.editingCompetencyId();
    if (!id) {
      return null;
    }
    return this.competencies().find((competency) => competency.id === id) ?? null;
  });
  public readonly competencyLevels = signal<CompetencyLevelDefinition[]>([]);
  public readonly users = signal<AdminUser[]>([]);
  public readonly evaluations = signal<CompetencyEvaluation[]>([]);
  public readonly quotaDefaults = signal<QuotaDefaults | null>(null);
  public readonly apiCredential = signal<ApiCredential | null>(null);
  public readonly loading = signal(false);
  public readonly feedback = signal<string | null>(null);
  public readonly error = signal<string | null>(null);

  private readonly defaultCompetencyLevels: CompetencyLevelDefinition[] = [
    {
      id: 'default-junior',
      value: 'junior',
      label: '初級',
      scale: 3,
      description: null,
      sort_order: 0,
      created_at: '1970-01-01T00:00:00.000Z',
      updated_at: '1970-01-01T00:00:00.000Z',
    },
    {
      id: 'default-intermediate',
      value: 'intermediate',
      label: '中級',
      scale: 5,
      description: null,
      sort_order: 1,
      created_at: '1970-01-01T00:00:00.000Z',
      updated_at: '1970-01-01T00:00:00.000Z',
    },
  ];
  private readonly defaultGeminiModel = 'models/gemini-2.5-flash';
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

  public readonly competencyLevelSelectOptions = computed(() =>
    this.competencyLevels().map((level) => ({
      value: level.value,
      label: this.formatLevelLabel(level),
    })),
  );

  public readonly competencyLevelForm: FormGroup<CompetencyLevelFormControls> = new FormGroup({
    value: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^[a-z0-9_-]+$/i)],
    }),
    label: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    scale: new FormControl(5, { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true }),
    sort_order: new FormControl<number | null>(null),
  });

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

  public readonly evaluationUserSelectOptions = computed(() => {
    const users = this.users().map((user) => ({ value: user.id, label: user.email }));
    return [{ value: '', label: '選択してください' }, ...users];
  });

  public readonly evaluationCompetencySelectOptions = computed(() => {
    const competencies = this.competencies().map((competency) => ({
      value: competency.id,
      label: competency.name,
    }));
    return [{ value: '', label: '選択してください' }, ...competencies];
  });

  public readonly apiForm: FormGroup<{
    model: FormControl<string>;
    secret: FormControl<string>;
  }> = new FormGroup({
    model: new FormControl(this.defaultGeminiModel, { nonNullable: true }),
    secret: new FormControl('', { nonNullable: true }),
  });

  public readonly quotaDefaultsForm: FormGroup<{
    cardDailyLimit: FormControl<number | null>;
    evaluationDailyLimit: FormControl<number | null>;
    analysisDailyLimit: FormControl<number | null>;
    statusReportDailyLimit: FormControl<number | null>;
    immunityMapDailyLimit: FormControl<number | null>;
    immunityMapCandidateDailyLimit: FormControl<number | null>;
    appealDailyLimit: FormControl<number | null>;
    autoCardDailyLimit: FormControl<number | null>;
  }> = new FormGroup({
    cardDailyLimit: new FormControl<number | null>(null, {
      validators: [Validators.required],
    }),
    evaluationDailyLimit: new FormControl<number | null>(null, {
      validators: [Validators.required],
    }),
    analysisDailyLimit: new FormControl<number | null>(null, {
      validators: [Validators.required],
    }),
    statusReportDailyLimit: new FormControl<number | null>(null, {
      validators: [Validators.required],
    }),
    immunityMapDailyLimit: new FormControl<number | null>(null, {
      validators: [Validators.required],
    }),
    immunityMapCandidateDailyLimit: new FormControl<number | null>(null, {
      validators: [Validators.required],
    }),
    appealDailyLimit: new FormControl<number | null>(null, {
      validators: [Validators.required],
    }),
    autoCardDailyLimit: new FormControl<number | null>(null, {
      validators: [Validators.required],
    }),
  });

  public readonly competencyLevelScaleOptions: ReadonlyArray<{ value: string; label: string }> = [
    { value: '3', label: '3 段階 (基本評価)' },
    { value: '5', label: '5 段階 (詳細評価)' },
  ];

  private readonly userQuotaForms = signal(new Map<string, UserQuotaForm>());
  private readonly geminiModelCatalog = signal<string[]>([]);
  public readonly geminiModelOptions: ReadonlyArray<{ value: string; label: string }> = [
    { value: 'models/gemini-2.5-flash', label: 'Gemini 2.5 Flash (推奨)' },
    { value: 'models/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
    { value: 'models/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'models/gemini-3-flash', label: 'Gemini 3 Flash' },
    { value: 'models/gemini-3-pro', label: 'Gemini 3 Pro' },
    { value: 'models/gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'models/gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
    { value: 'models/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash 001' },
  ];
  private readonly knownGeminiModelValues = new Set(
    this.geminiModelOptions.map((option) => option.value),
  );

  public apiModelSelectOptions(): Array<{ value: string; label: string }> {
    const rawValue = this.apiForm.controls.model.value ?? '';
    const current = rawValue.trim();

    const knownLabels = new Map(this.geminiModelOptions.map((option) => [option.value, option.label]));
    const catalog = this.geminiModelCatalog();
    const base = (
      catalog.length > 0
        ? catalog.map((value) => ({
            value,
            label: knownLabels.get(value) ?? value,
          }))
        : this.geminiModelOptions.map((option) => ({ ...option }))
    ).filter((option) => option.value);

    const baseValues = new Set(base.map((option) => option.value));
    if (current && !baseValues.has(current)) {
      return [{ value: current, label: `${current} (保存済み)` }, ...base];
    }
    return base;
  }

  public constructor() {
    this.competencyLevels.set(this.sortLevels(this.defaultCompetencyLevels));
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

  public editCompetency(competency: Competency): void {
    this.clearError();
    this.editingCompetencyId.set(competency.id);

    this.competencyForm.patchValue({
      name: competency.name,
      level: competency.level,
      description: competency.description ?? '',
      is_active: competency.is_active,
    });

    while (this.competencyCriteria.length > 0) {
      this.competencyCriteria.removeAt(this.competencyCriteria.length - 1);
    }

    if (competency.criteria.length === 0) {
      this.competencyCriteria.push(this.createCriterionGroup());
    } else {
      for (const criterion of competency.criteria) {
        this.competencyCriteria.push(
          this.createCriterionGroup({
            title: criterion.title,
            description: criterion.description ?? '',
          }),
        );
      }
    }

    this.ensureCompetencyLevelSelection();
  }

  public cancelCompetencyEdit(): void {
    this.clearError();
    this.resetCompetencyForm();
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

    const level = (value.level ?? '').trim();
    if (!level) {
      this.error.set('レベルを選択してください。');
      return;
    }

    const payload: CompetencyInput = {
      name,
      level,
      description: value.description.trim(),
      is_active: value.is_active,
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

    const editingId = this.editingCompetencyId();
    const isEditing = Boolean(editingId);
    const request$ = editingId
      ? this.api.updateCompetency(editingId, payload)
      : this.api.createCompetency(payload);

    this.loading.set(true);
    request$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (competency) => {
          this.loading.set(false);
          if (isEditing) {
            this.replaceCompetency(competency);
          } else {
            this.competencies.update((list) => [...list, competency]);
          }
          this.resetCompetencyForm();
          this.notify(isEditing ? 'コンピテンシーを更新しました。' : 'コンピテンシーを登録しました。');
        },
        error: (err) => {
          this.loading.set(false);
          this.handleError(
            err,
            isEditing
              ? 'コンピテンシーの更新に失敗しました。'
              : 'コンピテンシーの登録に失敗しました。',
          );
        },
      });
  }

  public createCompetencyLevel(): void {
    this.clearError();

    if (this.competencyLevelForm.invalid) {
      this.competencyLevelForm.markAllAsTouched();
      return;
    }

    const formValue = this.competencyLevelForm.getRawValue();
    const payload: CompetencyLevelInput = {
      value: formValue.value.trim(),
      label: formValue.label.trim(),
      scale: Number(formValue.scale),
      description: formValue.description.trim() || undefined,
      sort_order: formValue.sort_order ?? undefined,
    };

    if (!payload.value || !payload.label) {
      this.error.set('レベル識別子と名称を入力してください。');
      return;
    }

    this.loading.set(true);
    this.api
      .createCompetencyLevel(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (level) => {
          this.loading.set(false);
          const merged = this.mergeWithDefaultCompetencyLevels([
            ...this.competencyLevels().filter((item) => item.value !== level.value),
            level,
          ]);
          this.competencyLevels.set(this.sortLevels(merged));
          this.ensureCompetencyLevelSelection();
          this.competencyLevelForm.reset({
            value: '',
            label: '',
            scale: 5,
            description: '',
            sort_order: null,
          });
          this.notify('コンピテンシーレベルを追加しました。');
        },
        error: (err) => {
          this.loading.set(false);
          this.handleError(err, 'コンピテンシーレベルの追加に失敗しました。');
        },
      });
  }

  public resetCompetencyForm(): void {
    this.editingCompetencyId.set(null);
    while (this.competencyCriteria.length > 1) {
      this.competencyCriteria.removeAt(this.competencyCriteria.length - 1);
    }
    this.competencyForm.reset({
      name: '',
      level: this.defaultCompetencyLevelValue(),
      description: '',
      is_active: true,
    });
    const first = this.competencyCriteria.at(0);
    first?.reset({ title: '', description: '' });
    this.ensureCompetencyLevelSelection();
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

  public deleteCompetency(competency: Competency): void {
    this.clearError();

    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(
        `${competency.name} を削除しますか？この操作は取り消せません。`,
      );
      if (!confirmed) {
        return;
      }
    }

    this.api
      .deleteCompetency(competency.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.competencies.update((list) => list.filter((item) => item.id !== competency.id));
          if (this.editingCompetencyId() === competency.id) {
            this.resetCompetencyForm();
          }
          this.notify('コンピテンシーを削除しました。');
        },
        error: (err) => this.handleError(err, 'コンピテンシーの削除に失敗しました。'),
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
    const {
      cardDailyLimit,
      evaluationDailyLimit,
      analysisDailyLimit,
      statusReportDailyLimit,
      immunityMapDailyLimit,
      immunityMapCandidateDailyLimit,
      appealDailyLimit,
      autoCardDailyLimit,
    } = form.getRawValue();
    this.updateUser(user, {
      card_daily_limit: cardDailyLimit ?? null,
      evaluation_daily_limit: evaluationDailyLimit ?? null,
      analysis_daily_limit: analysisDailyLimit ?? null,
      status_report_daily_limit: statusReportDailyLimit ?? null,
      immunity_map_daily_limit: immunityMapDailyLimit ?? null,
      immunity_map_candidate_daily_limit: immunityMapCandidateDailyLimit ?? null,
      appeal_daily_limit: appealDailyLimit ?? null,
      auto_card_daily_limit: autoCardDailyLimit ?? null,
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
          this.loadGeminiModels();
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
    const {
      cardDailyLimit,
      evaluationDailyLimit,
      analysisDailyLimit,
      statusReportDailyLimit,
      immunityMapDailyLimit,
      immunityMapCandidateDailyLimit,
      appealDailyLimit,
      autoCardDailyLimit,
    } = formValue;
    if (
      cardDailyLimit === null ||
      evaluationDailyLimit === null ||
      analysisDailyLimit === null ||
      statusReportDailyLimit === null ||
      immunityMapDailyLimit === null ||
      immunityMapCandidateDailyLimit === null ||
      appealDailyLimit === null ||
      autoCardDailyLimit === null
    ) {
      this.error.set('日次上限を入力してください。');
      return;
    }

    const payload = {
      card_daily_limit: cardDailyLimit,
      evaluation_daily_limit: evaluationDailyLimit,
      analysis_daily_limit: analysisDailyLimit,
      status_report_daily_limit: statusReportDailyLimit,
      immunity_map_daily_limit: immunityMapDailyLimit,
      immunity_map_candidate_daily_limit: immunityMapCandidateDailyLimit,
      appeal_daily_limit: appealDailyLimit,
      auto_card_daily_limit: autoCardDailyLimit,
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
            analysisDailyLimit: defaults.analysis_daily_limit,
            statusReportDailyLimit: defaults.status_report_daily_limit,
            immunityMapDailyLimit: defaults.immunity_map_daily_limit,
            immunityMapCandidateDailyLimit: defaults.immunity_map_candidate_daily_limit,
            appealDailyLimit: defaults.appeal_daily_limit,
            autoCardDailyLimit: defaults.auto_card_daily_limit,
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
    this.loadCompetencyLevels();
    this.loadCompetencies();
    this.loadUsers();
    this.loadEvaluations();
    this.loadDefaults();
    this.loadGeminiModels();
    this.loadCredential();
  }

  private loadCompetencyLevels(): void {
    this.api
      .listCompetencyLevels()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (levels) => {
          const resolved = this.mergeWithDefaultCompetencyLevels(levels);
          this.competencyLevels.set(this.sortLevels(resolved));
          this.ensureCompetencyLevelSelection();
        },
        error: (err: unknown) => {
          if (err instanceof HttpErrorResponse && err.status === 404) {
            this.competencyLevels.set(this.sortLevels(this.defaultCompetencyLevels));
            this.ensureCompetencyLevelSelection();
            return;
          }
          this.handleError(err, 'コンピテンシーレベルの取得に失敗しました。');
          this.competencyLevels.set(this.sortLevels(this.defaultCompetencyLevels));
          this.ensureCompetencyLevelSelection();
        },
      });
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
            analysisDailyLimit: defaults.analysis_daily_limit,
            statusReportDailyLimit: defaults.status_report_daily_limit,
            immunityMapDailyLimit: defaults.immunity_map_daily_limit,
            immunityMapCandidateDailyLimit: defaults.immunity_map_candidate_daily_limit,
            appealDailyLimit: defaults.appeal_daily_limit,
            autoCardDailyLimit: defaults.auto_card_daily_limit,
          });
        },
        error: (err) => this.handleError(err, '日次上限の取得に失敗しました。'),
      });
  }

  private loadGeminiModels(): void {
    this.api
      .listApiCredentialModels('gemini')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (models) => {
          const resolved = (models ?? []).map((value) => value.trim()).filter((value) => value);
          this.geminiModelCatalog.set(resolved);
        },
        error: () => {
          this.geminiModelCatalog.set([]);
        },
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
      analysisDailyLimit: this.formBuilder.control<number | null>(user.analysis_daily_limit ?? null),
      statusReportDailyLimit: this.formBuilder.control<number | null>(
        user.status_report_daily_limit ?? null,
      ),
      immunityMapDailyLimit: this.formBuilder.control<number | null>(
        user.immunity_map_daily_limit ?? null,
      ),
      immunityMapCandidateDailyLimit: this.formBuilder.control<number | null>(
        user.immunity_map_candidate_daily_limit ?? null,
      ),
      appealDailyLimit: this.formBuilder.control<number | null>(user.appeal_daily_limit ?? null),
      autoCardDailyLimit: this.formBuilder.control<number | null>(user.auto_card_daily_limit ?? null),
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
          analysisDailyLimit: user.analysis_daily_limit ?? null,
          statusReportDailyLimit: user.status_report_daily_limit ?? null,
          immunityMapDailyLimit: user.immunity_map_daily_limit ?? null,
          immunityMapCandidateDailyLimit: user.immunity_map_candidate_daily_limit ?? null,
          appealDailyLimit: user.appeal_daily_limit ?? null,
          autoCardDailyLimit: user.auto_card_daily_limit ?? null,
        },
        { emitEvent: false },
      );
      next.set(user.id, existing);
    }
    this.userQuotaForms.set(next);
  }

  public competencyLevelBadge(competency: Competency): string {
    const definition = competency.level_definition ?? this.findCompetencyLevel(competency.level);
    if (definition) {
      return `${definition.label} (${definition.scale}段階)`;
    }
    return competency.level;
  }

  public formatLevelLabel(level: CompetencyLevelDefinition): string {
    return `${level.label} (${level.scale}段階)`;
  }

  private defaultCompetencyLevelValue(): string {
    const levels = this.competencyLevels();
    return levels[0]?.value ?? 'junior';
  }

  private findCompetencyLevel(value: string): CompetencyLevelDefinition | undefined {
    return this.competencyLevels().find((level) => level.value === value);
  }

  private sortLevels(
    levels: ReadonlyArray<CompetencyLevelDefinition>,
  ): CompetencyLevelDefinition[] {
    return [...levels].sort((a, b) => {
      const orderA = a.sort_order ?? 0;
      const orderB = b.sort_order ?? 0;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a.label.localeCompare(b.label, 'ja');
    });
  }

  private mergeWithDefaultCompetencyLevels(
    levels: ReadonlyArray<CompetencyLevelDefinition>,
  ): CompetencyLevelDefinition[] {
    const byValue = new Map(levels.map((level) => [level.value, level]));
    for (const defaultLevel of this.defaultCompetencyLevels) {
      if (!byValue.has(defaultLevel.value)) {
        byValue.set(defaultLevel.value, defaultLevel);
      }
    }
    return [...byValue.values()];
  }

  private ensureCompetencyLevelSelection(): void {
    const available = this.competencyLevels();
    if (available.length === 0) {
      return;
    }
    const current = this.competencyForm.controls.level.value;
    if (!available.some((level) => level.value === current)) {
      this.competencyForm.controls.level.setValue(available[0].value);
    }
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
