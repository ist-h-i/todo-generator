import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';

import { PageLayout } from '@shared/ui/page-layout/page-layout';
import { LocalDateTimePipe } from '@shared/pipes/local-date-time';
import { AiMark } from '@shared/ui/ai-mark/ai-mark';
import { HttpErrorResponse } from '@angular/common/http';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';

import { AdminApi } from '@core/api/admin-api';
import { CompetencyApi } from '@core/api/competency-api';
import { Auth } from '@core/auth/auth';
import {
  CompetencyEvaluation,
  CompetencySummary,
  EvaluationQuotaStatus,
  SelfEvaluationBatchRequest,
  SelfEvaluationRequest,
} from '@core/models';

type NextActionCategory = 'attitude' | 'behavior';

interface NextActionCard {
  id: string;
  category: NextActionCategory;
  categoryLabel: string;
  description: string;
  text: string;
}

interface EvaluationGroup {
  id: string;
  jobId: string | null;
  evaluations: CompetencyEvaluation[];
  createdAt: string;
  periodStart: string;
  periodEnd: string;
}

const NEXT_ACTION_META: Record<NextActionCategory, { label: string; description: string }> = {
  attitude: {
    label: '姿勢・意識',
    description: 'モチベーションやコミュニケーションの観点で意識したいポイントです。',
  },
  behavior: {
    label: '行動プラン',
    description: 'すぐに実行できるタスクや振り返りポイントをまとめています。',
  },
};

const DEFAULT_HISTORY_LIMIT = 12;
const JUMP_HISTORY_LIMIT = 50;

/**
 * Page allowing end users to review their competency evaluation results.
 */
@Component({
  selector: 'app-profile-evaluations-page',
  imports: [PageLayout, LocalDateTimePipe, AiMark],
  templateUrl: './profile-evaluations.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileEvaluationsPage {
  private readonly api = inject(CompetencyApi);
  private readonly adminApi = inject(AdminApi);
  private readonly auth = inject(Auth);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private feedbackTimeoutId: number | null = null;

  private readonly evaluationsRequestId = signal(0);
  private readonly quotaRequestId = signal(0);
  private readonly competenciesRequestId = signal(0);
  private readonly viewerUserId = signal<string | null>(null);
  private readonly focusedEvaluationId = signal<string | null>(null);
  private readonly historyLimit = computed(() =>
    this.focusedEvaluationId() ? JUMP_HISTORY_LIMIT : DEFAULT_HISTORY_LIMIT,
  );

  private readonly evaluationsParams = computed(() => ({
    requestId: this.evaluationsRequestId(),
    userId: this.auth.isAdmin() ? this.viewerUserId() : null,
    limit: this.historyLimit(),
  }));

  private readonly evaluationsResource = rxResource<
    CompetencyEvaluation[],
    { requestId: number; userId: string | null; limit: number }
  >({
    defaultValue: [],
    params: this.evaluationsParams,
    stream: ({ params }) => {
      if (params?.userId) {
        return this.adminApi.listEvaluations({ userId: params.userId });
      }
      return this.api.getMyEvaluations(params?.limit ?? DEFAULT_HISTORY_LIMIT);
    },
  });
  private readonly quotaResource = rxResource<EvaluationQuotaStatus | null, number>({
    defaultValue: null,
    params: this.quotaRequestId,
    stream: () => this.api.getMyEvaluationQuota(),
  });
  private readonly competenciesResource = rxResource<CompetencySummary[], number>({
    defaultValue: [],
    params: this.competenciesRequestId,
    stream: () => this.api.getMyCompetencies(),
  });

  public readonly evaluations = computed(() => {
    if (this.evaluationsResource.status() === 'error') {
      return [];
    }

    return this.evaluationsResource.value();
  });
  public readonly loading = computed(() => this.evaluationsResource.isLoading());
  public readonly error = computed(() => {
    if (this.evaluationsResource.status() !== 'error') {
      return null;
    }

    return this.resolveHttpErrorMessage(
      this.evaluationsResource.error(),
      'コンピテンシー評価の取得に失敗しました。時間をおいて再度お試しください。',
    );
  });
  public readonly quota = computed(() => {
    if (this.quotaResource.status() === 'error') {
      return null;
    }

    return this.quotaResource.value();
  });
  public readonly quotaLoading = computed(() => this.quotaResource.isLoading());
  public readonly quotaError = computed(() => {
    if (this.quotaResource.status() !== 'error') {
      return null;
    }

    return this.resolveHttpErrorMessage(
      this.quotaResource.error(),
      '評価上限の情報を取得できませんでした。',
    );
  });
  public readonly runningEvaluation = signal<boolean>(false);
  public readonly actionError = signal<string | null>(null);
  public readonly feedback = signal<string | null>(null);
  public readonly competencies = computed(() => {
    if (this.competenciesResource.status() === 'error') {
      return [];
    }

    return this.competenciesResource.value();
  });
  public readonly competenciesLoading = computed(() => this.competenciesResource.isLoading());
  public readonly competenciesError = computed(() => {
    if (this.competenciesResource.status() !== 'error') {
      return null;
    }

    return this.resolveHttpErrorMessage(
      this.competenciesResource.error(),
      'コンピテンシー一覧の取得に失敗しました。時間をおいて再度お試しください。',
    );
  });
  public readonly selectedCompetencyIds = signal<string[]>([]);
  public readonly isAdminViewer = computed(
    () => this.auth.isAdmin() && Boolean(this.viewerUserId()),
  );
  public readonly hasJumpTarget = computed(() => {
    const focusedId = this.focusedEvaluationId();
    if (!focusedId) {
      return false;
    }

    const status = this.evaluationsResource.status();
    if (status !== 'resolved' && status !== 'local') {
      return false;
    }

    return this.evaluations().some((evaluation) => evaluation.id === focusedId);
  });
  public readonly jumpTargetMessage = computed(() => {
    const focusedId = this.focusedEvaluationId();
    if (!focusedId) {
      return null;
    }

    const status = this.evaluationsResource.status();
    if (status !== 'resolved' && status !== 'local') {
      return null;
    }

    return this.hasJumpTarget()
      ? null
      : '指定された評価が見つからなかったため、最新の評価を表示しています。';
  });

  public readonly readInputChecked = (event: Event): boolean => {
    const target = event.target as HTMLInputElement | null;
    return target?.checked ?? false;
  };

  private readonly syncCompetencySelection = effect(() => {
    const status = this.competenciesResource.status();
    if (status !== 'resolved' && status !== 'local') {
      return;
    }

    const allowed = new Set(this.competencies().map((competency) => competency.id));
    this.selectedCompetencyIds.update((selected) => {
      const filtered = selected.filter((competencyId) => allowed.has(competencyId));
      return filtered.length === selected.length ? selected : filtered;
    });
  });

  public constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const userId = params.get('userId');
      const evaluationId = params.get('evaluationId');
      this.viewerUserId.set(userId ? userId.trim() : null);
      this.focusedEvaluationId.set(evaluationId ? evaluationId.trim() : null);
    });
  }

  public readonly latestEvaluation = computed<CompetencyEvaluation | null>(() => {
    const [latest] = this.evaluations();
    return latest ?? null;
  });

  private readonly evaluationGroups = computed<EvaluationGroup[]>(() => {
    const evaluations = this.evaluations();
    if (evaluations.length === 0) {
      return [];
    }

    const grouped = new Map<string, EvaluationGroup>();
    evaluations.forEach((evaluation) => {
      const jobId = evaluation.job_id ?? null;
      const groupId = jobId ?? evaluation.id;
      let group = grouped.get(groupId);
      if (!group) {
        group = {
          id: groupId,
          jobId,
          evaluations: [],
          createdAt: evaluation.created_at,
          periodStart: evaluation.period_start,
          periodEnd: evaluation.period_end,
        };
        grouped.set(groupId, group);
      }
      group.evaluations.push(evaluation);
      if (evaluation.created_at.localeCompare(group.createdAt) > 0) {
        group.createdAt = evaluation.created_at;
        group.periodStart = evaluation.period_start;
        group.periodEnd = evaluation.period_end;
      }
    });

    return Array.from(grouped.values())
      .map((group) => ({
        ...group,
        evaluations: [...group.evaluations].sort((a, b) =>
          b.created_at.localeCompare(a.created_at),
        ),
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });

  public readonly displayGroup = computed<EvaluationGroup | null>(() => {
    const groups = this.evaluationGroups();
    if (groups.length === 0) {
      return null;
    }

    const focusedId = this.focusedEvaluationId();
    if (focusedId) {
      const focused = groups.find((group) =>
        group.evaluations.some((evaluation) => evaluation.id === focusedId),
      );
      if (focused) {
        return focused;
      }
    }

    const selected = this.selectedCompetencyIds();
    if (selected.length === 0) {
      return groups[0];
    }

    const hasAllSelected = (group: EvaluationGroup): boolean => {
      return selected.every((competencyId) =>
        group.evaluations.some((evaluation) => evaluation.competency_id === competencyId),
      );
    };
    const hasAnySelected = (group: EvaluationGroup): boolean => {
      return group.evaluations.some((evaluation) => selected.includes(evaluation.competency_id));
    };

    return groups.find(hasAllSelected) ?? groups.find(hasAnySelected) ?? groups[0];
  });

  public readonly displayEvaluations = computed<CompetencyEvaluation[]>(() => {
    const group = this.displayGroup();
    if (!group) {
      return [];
    }

    return this.orderEvaluationsBySelection(group.evaluations, this.selectedCompetencyIds());
  });

  public readonly historyGroups = computed<EvaluationGroup[]>(() => {
    const groups = this.evaluationGroups();
    const displayId = this.displayGroup()?.id;
    if (!displayId) {
      return groups;
    }
    return groups.filter((group) => group.id !== displayId);
  });

  public readonly hasEvaluations = computed(() => this.evaluations().length > 0);
  public readonly limitReached = computed<boolean>(() => {
    const quota = this.quota();
    if (!quota || quota.daily_limit <= 0) {
      return false;
    }

    const remaining = quota.remaining ?? Math.max(quota.daily_limit - quota.used, 0);
    return remaining <= 0;
  });

  public readonly remainingCount = computed<number | null>(() => {
    const quota = this.quota();
    if (!quota || quota.daily_limit <= 0) {
      return null;
    }

    return quota.remaining ?? Math.max(quota.daily_limit - quota.used, 0);
  });

  public readonly canRunEvaluation = computed<boolean>(() => {
    if (this.isAdminViewer()) {
      return false;
    }

    if (this.quotaLoading()) {
      return false;
    }

    return !this.limitReached();
  });

  public readonly canRunBatchEvaluation = computed<boolean>(() => {
    if (this.isAdminViewer()) {
      return false;
    }

    if (this.quotaLoading()) {
      return false;
    }

    if (this.limitReached()) {
      return false;
    }

    if (this.selectedCompetencyIds().length === 0) {
      return false;
    }

    return true;
  });

  public refresh(): void {
    this.loadEvaluations();
    if (!this.isAdminViewer()) {
      this.loadQuota();
      this.loadCompetencies();
    }
  }

  public scorePercent(evaluation: CompetencyEvaluation | null): number {
    if (!evaluation || evaluation.scale <= 0) {
      return 0;
    }

    return Math.round((evaluation.score_value / evaluation.scale) * 100);
  }

  public triggeredLabel(triggeredBy: string): string {
    switch (triggeredBy) {
      case 'auto':
        return '自動判定';
      case 'manual':
        return '手動実行';
      default:
        return '不明な実行方法';
    }
  }

  public hasActions(actions: readonly string[] | undefined | null): boolean {
    return Array.isArray(actions) && actions.length > 0;
  }

  public isSelectedCompetency(competencyId: string | null | undefined): boolean {
    if (!competencyId) {
      return false;
    }

    return this.selectedCompetencyIds().includes(competencyId);
  }

  public groupCompetencyLabel(group: EvaluationGroup): string {
    const names = group.evaluations
      .map((evaluation) => evaluation.competency?.name)
      .filter((name): name is string => typeof name === 'string' && name.trim().length > 0);

    if (names.length === 0) {
      return `${group.evaluations.length} 件の評価`;
    }

    const uniqueNames = Array.from(new Set(names));
    if (uniqueNames.length <= 3) {
      return uniqueNames.join(' / ');
    }

    return `${uniqueNames.slice(0, 3).join(' / ')} ほか${uniqueNames.length - 3}件`;
  }

  public groupTriggeredLabel(group: EvaluationGroup): string {
    const uniqueTriggeredBy = Array.from(
      new Set(group.evaluations.map((evaluation) => evaluation.triggered_by).filter(Boolean)),
    );
    if (uniqueTriggeredBy.length === 1) {
      return this.triggeredLabel(uniqueTriggeredBy[0]);
    }
    if (uniqueTriggeredBy.length === 0) {
      return '不明な実行方法';
    }
    return '混在';
  }

  public groupAiModelLabel(group: EvaluationGroup): string {
    const uniqueModels = Array.from(
      new Set(
        group.evaluations
          .map((evaluation) => evaluation.ai_model?.trim() || '未設定')
          .filter(Boolean),
      ),
    );
    if (uniqueModels.length === 1) {
      return uniqueModels[0];
    }
    return '複数';
  }

  public nextActionsFor(evaluation: CompetencyEvaluation | null): NextActionCard[] {
    if (!evaluation) {
      return [];
    }

    const cards: NextActionCard[] = [];

    const appendActions = (
      items: readonly string[] | undefined | null,
      category: NextActionCategory,
    ): void => {
      if (!Array.isArray(items)) {
        return;
      }

      items.forEach((value, index) => {
        const text = typeof value === 'string' ? value.trim() : '';
        if (!text) {
          return;
        }

        const meta = NEXT_ACTION_META[category];
        cards.push({
          id: `${evaluation.id}-${category}-${index}`,
          category,
          categoryLabel: meta.label,
          description: meta.description,
          text,
        });
      });
    };

    appendActions(evaluation.attitude_actions, 'attitude');
    appendActions(evaluation.behavior_actions, 'behavior');

    return cards;
  }

  public limitLabel(quota: EvaluationQuotaStatus | null): string {
    if (!quota) {
      return '-';
    }

    return quota.daily_limit <= 0 ? '無制限' : `${quota.daily_limit} 回`;
  }

  public remainingLabel(quota: EvaluationQuotaStatus | null): string {
    if (!quota) {
      return '-';
    }

    if (quota.daily_limit <= 0 || quota.remaining === null || quota.remaining === undefined) {
      return '無制限';
    }

    return `${quota.remaining} 回`;
  }

  public runEvaluation(): void {
    if (this.isAdminViewer()) {
      return;
    }

    if (this.runningEvaluation() || !this.canRunEvaluation()) {
      return;
    }

    this.runningEvaluation.set(true);
    this.actionError.set(null);
    this.feedback.set(null);

    const payload: SelfEvaluationRequest = {};
    const latest = this.latestEvaluation();
    if (latest?.competency_id) {
      payload.competency_id = latest.competency_id;
    }

    this.api
      .runMyEvaluation(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (evaluation) => {
          this.runningEvaluation.set(false);
          this.evaluationsResource.update((list) => {
            const filtered = list.filter((item) => item.id !== evaluation.id);
            return [evaluation, ...filtered].slice(0, DEFAULT_HISTORY_LIMIT);
          });
          this.showFeedback('評価を実行しました。最新の結果が反映されています。');
          this.loadQuota();
        },
        error: (error: HttpErrorResponse) => {
          this.runningEvaluation.set(false);
          const message = this.resolveHttpErrorMessage(
            error,
            '評価の実行に失敗しました。時間をおいて再度お試しください。',
          );
          this.actionError.set(message);
          if (error.status === 429 || error.status === 401) {
            this.loadQuota();
          }
        },
      });
  }

  public runBatchEvaluation(): void {
    if (this.isAdminViewer()) {
      return;
    }

    if (this.runningEvaluation() || !this.canRunBatchEvaluation()) {
      return;
    }

    this.runningEvaluation.set(true);
    this.actionError.set(null);
    this.feedback.set(null);

    const payload: SelfEvaluationBatchRequest = {
      competency_ids: this.selectedCompetencyIds(),
    };

    this.api
      .runMyEvaluationsBatch(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (evaluations) => {
          this.runningEvaluation.set(false);
          this.evaluationsResource.update((list) => {
            const byId = new Map<string, CompetencyEvaluation>();
            [...evaluations, ...list].forEach((item) => byId.set(item.id, item));
            const merged = Array.from(byId.values()).sort((a, b) =>
              b.created_at.localeCompare(a.created_at),
            );
            return merged.slice(0, DEFAULT_HISTORY_LIMIT);
          });
          const count = evaluations.length;
          this.showFeedback(
            count === 1 ? '評価を実行しました。' : `評価を実行しました。（${count} 件）`,
          );
          this.loadQuota();
        },
        error: (error: HttpErrorResponse) => {
          this.runningEvaluation.set(false);
          const message = this.resolveHttpErrorMessage(
            error,
            '評価の実行に失敗しました。時間をおいて再度お試しください。',
          );
          this.actionError.set(message);
          if (error.status === 429 || error.status === 401) {
            this.loadQuota();
          }
        },
      });
  }

  public toggleCompetencySelection(competencyId: string, checked: boolean): void {
    this.selectedCompetencyIds.update((selected) => {
      const next = new Set(selected);
      if (checked) {
        next.add(competencyId);
      } else {
        next.delete(competencyId);
      }
      return Array.from(next);
    });
  }

  public selectAllCompetencies(): void {
    this.selectedCompetencyIds.set(this.competencies().map((competency) => competency.id));
  }

  public clearCompetencySelection(): void {
    this.selectedCompetencyIds.set([]);
  }

  public exportLatestAsJson(): void {
    const evaluation = this.latestEvaluation();
    if (!evaluation || typeof document === 'undefined') {
      return;
    }

    const sanitizedName = this.sanitizeFileName(
      evaluation.competency?.name || 'competency-evaluation',
    );
    const period = (evaluation.period_end || evaluation.period_start || 'latest')
      .toString()
      .replaceAll('/', '-')
      .replaceAll('.', '-')
      .replaceAll(' ', '_');
    const fileName = `competency-evaluation-${sanitizedName}-${period}.json`;
    const json = JSON.stringify(evaluation, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    this.showFeedback('評価結果を JSON 形式で出力しました。');
  }

  private loadEvaluations(): void {
    this.evaluationsRequestId.update((value) => value + 1);
  }

  private loadQuota(): void {
    this.quotaRequestId.update((value) => value + 1);
  }

  private loadCompetencies(): void {
    this.competenciesRequestId.update((value) => value + 1);
  }

  private resolveHttpErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      return this.extractErrorDetail(error) ?? fallback;
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    if (typeof error === 'string' && error.trim().length > 0) {
      return error;
    }

    return fallback;
  }

  private extractErrorDetail(error: HttpErrorResponse): string | null {
    const payload = error.error;
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    if (!('detail' in payload)) {
      return null;
    }

    const detail = (payload as { detail?: unknown }).detail;
    return detail ? String(detail) : null;
  }

  private showFeedback(message: string): void {
    this.feedback.set(message);
    if (typeof window !== 'undefined') {
      if (this.feedbackTimeoutId !== null) {
        window.clearTimeout(this.feedbackTimeoutId);
      }

      this.feedbackTimeoutId = window.setTimeout(() => {
        this.feedback.set(null);
        this.feedbackTimeoutId = null;
      }, 4000);
    }
  }

  private orderEvaluationsBySelection(
    evaluations: CompetencyEvaluation[],
    selected: string[],
  ): CompetencyEvaluation[] {
    if (selected.length === 0) {
      return evaluations;
    }

    const order = new Map(selected.map((competencyId, index) => [competencyId, index]));
    const filtered = evaluations
      .filter((evaluation) => order.has(evaluation.competency_id))
      .sort((a, b) => {
        const aIndex = order.get(a.competency_id) ?? 0;
        const bIndex = order.get(b.competency_id) ?? 0;
        return aIndex - bIndex;
      });

    return filtered.length > 0 ? filtered : evaluations;
  }

  private sanitizeFileName(input: string): string {
    return input
      .trim()
      .toLowerCase()
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, '-');
  }
}
