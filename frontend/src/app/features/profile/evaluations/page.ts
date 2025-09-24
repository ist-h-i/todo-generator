import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { CompetencyApiService } from '@core/api/competency-api.service';
import { CompetencyEvaluation } from '@core/models';

const DEFAULT_HISTORY_LIMIT = 12;

/**
 * Page allowing end users to review their competency evaluation results.
 */
@Component({
  selector: 'app-profile-evaluations-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './page.html',
  styleUrl: './page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileEvaluationsPage {
  private readonly api = inject(CompetencyApiService);
  private readonly destroyRef = inject(DestroyRef);

  public readonly evaluations = signal<CompetencyEvaluation[]>([]);
  public readonly loading = signal<boolean>(false);
  public readonly error = signal<string | null>(null);

  public readonly latestEvaluation = computed<CompetencyEvaluation | null>(() => {
    const [latest] = this.evaluations();
    return latest ?? null;
  });

  public readonly history = computed<CompetencyEvaluation[]>(() => {
    const [, ...history] = this.evaluations();
    return history;
  });

  public readonly hasEvaluations = computed(() => this.evaluations().length > 0);

  public constructor() {
    this.loadEvaluations();
  }

  public refresh(): void {
    this.loadEvaluations();
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
}
