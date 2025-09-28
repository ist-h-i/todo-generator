import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PageLayoutComponent } from '@shared/ui/page-layout/page-layout';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AdminApiService } from '@core/api/admin-api.service';
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

type AdminTab = 'competencies' | 'evaluations' | 'users' | 'settings';

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [CommonModule, FormsModule, PageLayoutComponent],
  templateUrl: './page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPage {
  private readonly api = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);

  public readonly activeTab = signal<AdminTab>('competencies');
  public readonly competencies = signal<Competency[]>([]);
  public readonly users = signal<AdminUser[]>([]);
  public readonly evaluations = signal<CompetencyEvaluation[]>([]);
  public readonly quotaDefaults = signal<QuotaDefaults | null>(null);
  public readonly apiCredential = signal<ApiCredential | null>(null);
  public readonly loading = signal(false);
  public readonly feedback = signal<string | null>(null);
  public readonly error = signal<string | null>(null);

  private readonly defaultChatModel = 'gpt-4o-mini';
  public readonly chatModelOptions: ReadonlyArray<{ value: string; label: string }> = [
    { value: 'gpt-4o-mini', label: 'GPT-4o mini (推奨)' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
    { value: 'gpt-4.1', label: 'GPT-4.1' },
  ];
  private readonly knownChatModelValues = new Set(
    this.chatModelOptions.map((option) => option.value),
  );

  public readonly newCompetency = signal<CompetencyInput>({
    name: '',
    level: 'junior',
    description: '',
    is_active: true,
    criteria: [{ title: '', description: '' }],
  });

  public evaluationUserId = '';
  public evaluationCompetencyId = '';
  public evaluationPeriodStart = '';
  public evaluationPeriodEnd = '';
  public apiSecret = '';
  public apiModel = this.defaultChatModel;
  public defaultCardLimit: number | null = null;
  public defaultEvaluationLimit: number | null = null;

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

  public updateNewCompetencyField<K extends keyof CompetencyInput>(
    field: K,
    value: CompetencyInput[K],
  ): void {
    this.newCompetency.update((current) => ({
      ...current,
      [field]: value,
    }));
  }

  public updateCriterionField(
    index: number,
    field: keyof CompetencyCriterionInput,
    value: unknown,
  ): void {
    this.newCompetency.update((current) => {
      const next = current.criteria.map((criterion, idx) =>
        idx === index ? { ...criterion, [field]: value } : criterion,
      );
      return {
        ...current,
        criteria: next,
      };
    });
  }

  public addCriterion(): void {
    this.newCompetency.update((current) => ({
      ...current,
      criteria: [...current.criteria, { title: '', description: '' }],
    }));
  }

  public removeCriterion(index: number): void {
    this.newCompetency.update((current) => ({
      ...current,
      criteria: current.criteria.filter((_, idx) => idx !== index),
    }));
  }

  public createCompetency(event: SubmitEvent): void {
    event.preventDefault();
    this.clearError();

    const value = this.newCompetency();
    const name = value.name.trim();
    if (name.length === 0) {
      this.error.set('コンピテンシー名を入力してください。');
      return;
    }

    const payload: CompetencyInput = {
      name,
      level: value.level,
      description: value.description?.trim() ?? '',
      sort_order: value.sort_order ?? 0,
      is_active: value.is_active ?? true,
      rubric: value.rubric ?? {},
      criteria: value.criteria
        .map((criterion, index) => ({
          title: (criterion.title ?? '').trim(),
          description: criterion.description?.toString().trim() ?? undefined,
          is_active: criterion.is_active ?? true,
          order_index: criterion.order_index ?? index,
          weight: criterion.weight ?? undefined,
          intentionality_prompt: criterion.intentionality_prompt?.toString().trim() || undefined,
          behavior_prompt: criterion.behavior_prompt?.toString().trim() || undefined,
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
    this.newCompetency.set({
      name: '',
      level: 'junior',
      description: '',
      is_active: true,
      criteria: [{ title: '', description: '' }],
    });
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

  public triggerEvaluation(event: SubmitEvent): void {
    event.preventDefault();
    this.clearError();

    if (!this.evaluationUserId || !this.evaluationCompetencyId) {
      this.error.set('ユーザとコンピテンシーを選択してください。');
      return;
    }

    const payload = {
      user_id: this.evaluationUserId,
      period_start: this.evaluationPeriodStart || undefined,
      period_end: this.evaluationPeriodEnd || undefined,
      triggered_by: 'manual' as const,
    };

    this.loading.set(true);
    this.api
      .triggerEvaluation(this.evaluationCompetencyId, payload)
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
    this.updateUser(user, {
      card_daily_limit: user.card_daily_limit ?? null,
      evaluation_daily_limit: user.evaluation_daily_limit ?? null,
    });
  }

  public deleteUser(user: AdminUser): void {
    this.clearError();

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
          this.notify('ユーザを削除しました。');
        },
        error: (err) => this.handleError(err, 'ユーザの削除に失敗しました。'),
      });
  }

  public updateApiCredential(event: SubmitEvent): void {
    event.preventDefault();
    this.clearError();

    const secret = this.apiSecret.trim();
    const hasCredential = this.apiCredential() !== null;
    if (!secret && !hasCredential) {
      this.error.set('API トークンを入力してください。');
      return;
    }

    const payload: ApiCredentialUpdate = {
      model: this.apiModel,
    };
    if (secret) {
      payload.secret = secret;
    }

    this.loading.set(true);
    this.api
      .upsertApiCredential('openai', payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (credential) => {
          this.loading.set(false);
          this.apiCredential.set(credential);
          this.apiSecret = '';
          this.apiModel = this.resolveChatModel(credential.model);
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

  public onCardLimitChange(user: AdminUser, value: string | number | null): void {
    if (value === null || value === '') {
      user.card_daily_limit = null;
      return;
    }
    user.card_daily_limit = Number(value);
  }

  public onEvaluationLimitChange(user: AdminUser, value: string | number | null): void {
    if (value === null || value === '') {
      user.evaluation_daily_limit = null;
      return;
    }
    user.evaluation_daily_limit = Number(value);
  }

  public updateQuotaDefaults(event: SubmitEvent): void {
    event.preventDefault();
    this.clearError();

    if (this.defaultCardLimit === null || this.defaultEvaluationLimit === null) {
      this.error.set('日次上限を入力してください。');
      return;
    }

    const payload = {
      card_daily_limit: this.defaultCardLimit,
      evaluation_daily_limit: this.defaultEvaluationLimit,
    };

    this.loading.set(true);
    this.api
      .updateQuotaDefaults(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (defaults) => {
          this.loading.set(false);
          this.quotaDefaults.set(defaults);
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
        next: (users) => this.users.set(users),
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
          this.defaultCardLimit = defaults.card_daily_limit;
          this.defaultEvaluationLimit = defaults.evaluation_daily_limit;
        },
        error: (err) => this.handleError(err, '日次上限の取得に失敗しました。'),
      });
  }

  private loadCredential(): void {
    this.api
      .getApiCredential('openai')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (credential) => {
          this.apiCredential.set(credential);
          this.apiModel = this.resolveChatModel(credential.model);
        },
        error: (err: unknown) => {
          if (err instanceof HttpErrorResponse && err.status === 404) {
            this.apiCredential.set(null);
            this.apiModel = this.defaultChatModel;
            return;
          }
          this.handleError(err, 'API トークンの取得に失敗しました。');
        },
      });
  }

  public isKnownModel(value: string): boolean {
    return this.knownChatModelValues.has(value);
  }

  private resolveChatModel(model: string | null | undefined): string {
    if (!model) {
      return this.defaultChatModel;
    }
    const trimmed = model.trim();
    if (!trimmed) {
      return this.defaultChatModel;
    }
    if (this.knownChatModelValues.has(trimmed)) {
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
