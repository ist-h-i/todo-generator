import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { WorkspaceStore } from '@core/state/workspace-store';

/**
 * Analytics dashboard summarizing board metrics for the workspace.
 */
@Component({
  selector: 'app-analytics-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './page.html',
  styleUrl: './page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsPage {
  private readonly workspace = inject(WorkspaceStore);

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
}
