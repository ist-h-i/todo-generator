import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageLayout } from '@shared/ui/page-layout/page-layout';
import { LocalDateTimePipe } from '@shared/pipes/local-date-time';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { CompetencyApi } from '@core/api/competency-api';
import { CompetencyEvaluation, EvaluationQuotaStatus, SelfEvaluationRequest } from '@core/models';

type NextActionCategory = 'attitude' | 'behavior';

interface NextActionCard {
  id: string;
  category: NextActionCategory;
  categoryLabel: string;
  description: string;
  text: string;
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

/**
 * Page allowing end users to review their competency evaluation results.
 */
@Component({
  selector: 'app-profile-evaluations-page',
  imports: [CommonModule, PageLayout, LocalDateTimePipe],
  templateUrl: './profile-evaluations.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileEvaluationsPage {
  private readonly api = inject(CompetencyApi);
  private readonly destroyRef = inject(DestroyRef);
  private feedbackTimeoutId: number | null = null;

  public readonly evaluations = signal<CompetencyEvaluation[]>([]);
  public readonly loading = signal<boolean>(false);
  public readonly error = signal<string | null>(null);
  public readonly quota = signal<EvaluationQuotaStatus | null>(null);
  public readonly quotaLoading = signal<boolean>(false);
  public readonly quotaError = signal<string | null>(null);
  public readonly runningEvaluation = signal<boolean>(false);
  public readonly actionError = signal<string | null>(null);
  public readonly feedback = signal<string | null>(null);

  public readonly latestEvaluation = computed<CompetencyEvaluation | null>(() => {
    const [latest] = this.evaluations();
    return latest ?? null;
  });

  public readonly history = computed<CompetencyEvaluation[]>(() => {
    const [, ...history] = this.evaluations();
    return history;
  });

  public readonly hasEvaluations = computed(() => this.evaluations().length > 0);
  public readonly latestNextActions = computed<NextActionCard[]>(() => {
    const evaluation = this.latestEvaluation();
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
          id: `${category}-${index}`,
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
  });
  public readonly limitReached = computed<boolean>(() => {
    const quota = this.quota();
    if (!quota || quota.daily_limit <= 0) {
      return false;
    }

    const remaining = quota.remaining ?? Math.max(quota.daily_limit - quota.used, 0);
    return remaining <= 0;
  });

  public readonly canRunEvaluation = computed<boolean>(() => {
    if (this.quotaLoading()) {
      return false;
    }

    return !this.limitReached();
  });

  public constructor() {
    this.loadEvaluations();
    this.loadQuota();
  }

  public refresh(): void {
    this.loadEvaluations();
    this.loadQuota();
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
          this.error.set(null);
          this.evaluations.update((list) => {
            const filtered = list.filter((item) => item.id !== evaluation.id);
            return [evaluation, ...filtered].slice(0, DEFAULT_HISTORY_LIMIT);
          });
          this.showFeedback('評価を実行しました。最新の結果が反映されています。');
          this.loadQuota();
        },
        error: (error: HttpErrorResponse) => {
          this.runningEvaluation.set(false);
          const message =
            typeof error.error === 'object' && error.error?.detail
              ? String(error.error.detail)
              : '評価の実行に失敗しました。時間をおいて再度お試しください。';
          this.actionError.set(message);
          if (error.status === 429 || error.status === 401) {
            this.loadQuota();
          }
        },
      });
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
    this.loading.set(true);
    this.error.set(null);

    this.api
      .getMyEvaluations(DEFAULT_HISTORY_LIMIT)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (evaluations) => {
          this.evaluations.set(evaluations);
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.loading.set(false);
          const message =
            typeof error.error === 'object' && error.error?.detail
              ? String(error.error.detail)
              : 'コンピテンシー評価の取得に失敗しました。時間をおいて再度お試しください。';
          this.error.set(message);
        },
      });
  }

  private loadQuota(): void {
    this.quotaLoading.set(true);
    this.quotaError.set(null);

    this.api
      .getMyEvaluationQuota()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (quota) => {
          this.quota.set(quota);
          this.quotaLoading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.quotaLoading.set(false);
          this.quota.set(null);
          const message =
            typeof error.error === 'object' && error.error?.detail
              ? String(error.error.detail)
              : '評価上限の情報を取得できませんでした。';
          this.quotaError.set(message);
        },
      });
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

  private sanitizeFileName(input: string): string {
    return input
      .trim()
      .toLowerCase()
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, '-');
  }
}
