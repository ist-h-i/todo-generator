import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { FeedbackSeverity } from '@core/models';
import { ContinuousImprovementStore } from '@core/state/continuous-improvement-store';
import { WorkspaceStore } from '@core/state/workspace-store';
import { PageHeaderComponent } from '@shared/ui/page-header/page-header';

/**
 * Analytics dashboard summarizing board metrics for the workspace.
 */
@Component({
  selector: 'app-analytics-page',
  standalone: true,
  imports: [CommonModule, RouterLink, PageHeaderComponent],
  templateUrl: './page.html',
  styleUrl: './page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsPage {
  private readonly workspace = inject(WorkspaceStore);
  private readonly improvement = inject(ContinuousImprovementStore);

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

  public readonly convertAction = (actionId: string): void => {
    this.improvement.convertSuggestedAction(actionId);
  };

  public readonly updateReportInstruction = (value: string): void => {
    this.improvement.updateReportInstruction(value);
  };

  public readonly generateReport = (): void => {
    this.improvement.generateReportPreview();
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
}
