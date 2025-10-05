import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { FeedbackSeverity } from '@core/models';
import { ContinuousImprovementStore } from '@core/state/continuous-improvement-store';
import { WorkspaceStore } from '@core/state/workspace-store';
import { PageLayoutComponent } from '@shared/ui/page-layout/page-layout';
import { LocalDateTimePipe } from '@shared/pipes/local-date-time.pipe';

type ActionFeedback = { status: 'success' | 'error'; message: string };

/**
 * Analytics dashboard summarizing board metrics for the workspace.
 */
@Component({
  selector: 'app-analytics-page',
  standalone: true,
  imports: [CommonModule, RouterLink, PageLayoutComponent, LocalDateTimePipe],
  templateUrl: './page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsPage {
  private readonly workspace = inject(WorkspaceStore);
  private readonly improvement = inject(ContinuousImprovementStore);
  private readonly destroyRef = inject(DestroyRef);

  private readonly actionPendingSignal = signal<Record<string, boolean>>({});
  private readonly actionStatusSignal = signal<Record<string, ActionFeedback | undefined>>({});
  private readonly statusTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly statusVisibilityMs = 5000;

  public constructor() {
    void this.workspace.refreshWorkspaceData();
    this.destroyRef.onDestroy(() => {
      this.statusTimers.forEach((timer) => clearTimeout(timer));
      this.statusTimers.clear();
    });
  }

  public readonly summarySignal = this.workspace.summary;

  public readonly statusBreakdown = computed(() => {
    const statuses = this.workspace.settings().statuses;
    const cards = this.workspace.cards();
    return statuses.map((status) => ({
      id: status.id,
      name: status.name,
      color: status.color,
      total: cards.filter((card) => card.statusId === status.id).length,
    }));
  });

  public readonly labelBreakdown = computed(() => {
    const labels = this.workspace.settings().labels;
    const cards = this.workspace.cards();
    return labels.map((label) => ({
      id: label.id,
      name: label.name,
      color: label.color,
      total: cards.filter((card) => card.labelIds.includes(label.id)).length,
    }));
  });

  public readonly pointSummary = computed(() => {
    const settings = this.workspace.settings();
    const cards = this.workspace.cards();
    const total = cards.reduce((sum, card) => sum + card.storyPoints, 0);
    const doneIds = new Set(
      settings.statuses.filter((status) => status.category === 'done').map((status) => status.id),
    );
    const done = cards
      .filter((card) => doneIds.has(card.statusId))
      .reduce((sum, card) => sum + card.storyPoints, 0);
    return {
      total,
      done,
      remaining: total - done,
    };
  });

  public readonly snapshots = this.improvement.snapshots;
  public readonly activeSnapshot = this.improvement.activeSnapshot;
  public readonly topIssues = this.improvement.topIssueSummary;
  public readonly causeLayers = this.improvement.causeLayers;
  public readonly actionPlan = this.improvement.actionPlan;
  public readonly improvementOverview = this.improvement.improvementOverview;
  public readonly initiatives = this.improvement.initiatives;
  public readonly reportInstruction = this.improvement.reportInstruction;
  public readonly reportPreview = this.improvement.reportPreview;

  public readonly selectSnapshot = (snapshotId: string): void => {
    this.improvement.selectSnapshot(snapshotId);
  };

  public readonly convertAction = async (actionId: string): Promise<void> => {
    if (this.isActionPending(actionId)) {
      return;
    }

    this.setActionPending(actionId, true);
    this.clearStatusTimer(actionId);
    this.clearActionStatus(actionId);

    try {
      const result = await this.improvement.convertSuggestedAction(actionId);
      if (result.status === 'success') {
        const message = result.card?.id
          ? `カードを作成しました (ID: ${result.card.id})`
          : 'カードを作成しました。';
        this.setActionStatus(actionId, { status: 'success', message });
      } else {
        this.setActionStatus(actionId, {
          status: 'error',
          message: result.message ?? 'カードの作成に失敗しました。',
        });
      }
    } catch {
      this.setActionStatus(actionId, {
        status: 'error',
        message: 'カードの作成に失敗しました。',
      });
    } finally {
      this.setActionPending(actionId, false);
      if (this.actionStatus(actionId)) {
        this.scheduleStatusClear(actionId);
      }
    }
  };

  public readonly updateReportInstruction = (value: string): void => {
    this.improvement.updateReportInstruction(value);
  };

  public readonly generateReport = (): void => {
    this.improvement.generateReportPreview();
  };

  public readonly isActionPending = (actionId: string): boolean => {
    const pending = this.actionPendingSignal();
    return Boolean(pending[actionId]);
  };

  public readonly actionStatus = (actionId: string): ActionFeedback | undefined => {
    const statuses = this.actionStatusSignal();
    return statuses[actionId];
  };

  public readonly severityClass = (severity: FeedbackSeverity): string => {
    switch (severity) {
      case 'critical':
        return 'bg-rose-500/10 text-rose-500';
      case 'high':
        return 'bg-amber-500/10 text-amber-500';
      case 'medium':
        return 'bg-blue-500/10 text-blue-500';
      default:
        return 'bg-slate-500/10 text-slate-500';
    }
  };

  public readonly formatChange = (value: number): string => {
    const percent = Math.round(value * 100);
    if (percent === 0) {
      return '±0%';
    }

    return `${percent > 0 ? '+' : ''}${percent}%`;
  };

  private readonly setActionPending = (actionId: string, value: boolean): void => {
    this.actionPendingSignal.update((pending) => {
      if (value) {
        return { ...pending, [actionId]: true };
      }

      if (!(actionId in pending)) {
        return pending;
      }

      const { [actionId]: _removed, ...rest } = pending;
      return rest;
    });
  };

  private readonly setActionStatus = (actionId: string, value: ActionFeedback): void => {
    this.actionStatusSignal.update((statuses) => ({ ...statuses, [actionId]: value }));
  };

  private readonly clearActionStatus = (actionId: string): void => {
    this.actionStatusSignal.update((statuses) => {
      if (!(actionId in statuses)) {
        return statuses;
      }

      const { [actionId]: _removed, ...rest } = statuses;
      return rest;
    });
  };

  private readonly scheduleStatusClear = (actionId: string): void => {
    this.clearStatusTimer(actionId);
    const timeoutId = setTimeout(() => {
      this.clearStatusTimer(actionId);
      this.clearActionStatus(actionId);
    }, this.statusVisibilityMs);
    this.statusTimers.set(actionId, timeoutId);
  };

  private readonly clearStatusTimer = (actionId: string): void => {
    const existing = this.statusTimers.get(actionId);
    if (existing) {
      clearTimeout(existing);
      this.statusTimers.delete(actionId);
    }
  };
}
