import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ImmunityMapGateway } from '@core/api/immunity-map-gateway';
import { ImmunityMapAItem, ImmunityMapAItemKind, ImmunityMapResponse } from '@core/models';
import { WorkspaceStore } from '@core/state/workspace-store';
import { PageLayoutComponent } from '@shared/ui/page-layout/page-layout';

/**
 * Analytics dashboard summarizing board metrics for the workspace.
 */
@Component({
  selector: 'app-analytics-page',
  standalone: true,
  imports: [CommonModule, RouterLink, PageLayoutComponent],
  templateUrl: './analytics-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsPageComponent {
  private readonly workspace = inject(WorkspaceStore);
  private readonly immunityMapGateway = inject(ImmunityMapGateway);

  public constructor() {
    void this.workspace.refreshWorkspaceData();
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

  public readonly shouldText = signal('');
  public readonly cannotText = signal('');
  public readonly wantText = signal('');
  public readonly contextText = signal('');

  public readonly isGenerating = signal(false);
  public readonly generationError = signal<string | null>(null);
  public readonly generatedMap = signal<ImmunityMapResponse | null>(null);
  public readonly copyStatus = signal<'idle' | 'copied' | 'failed'>('idle');

  public readonly updateShouldText = (value: string): void => this.shouldText.set(value);
  public readonly updateCannotText = (value: string): void => this.cannotText.set(value);
  public readonly updateWantText = (value: string): void => this.wantText.set(value);
  public readonly updateContextText = (value: string): void => this.contextText.set(value);

  public readonly generateImmunityMap = async (): Promise<void> => {
    if (this.isGenerating()) {
      return;
    }

    const aItems = [
      ...this.parseLines(this.shouldText()).map((text) => this.toAItem('should', text)),
      ...this.parseLines(this.cannotText()).map((text) => this.toAItem('cannot', text)),
      ...this.parseLines(this.wantText()).map((text) => this.toAItem('want', text)),
    ];

    if (aItems.length === 0) {
      this.generationError.set('A（やるべき/やれない/やりたい）を 1 件以上入力してください。');
      this.generatedMap.set(null);
      return;
    }

    this.isGenerating.set(true);
    this.generationError.set(null);
    this.copyStatus.set('idle');

    try {
      const context = this.contextText().trim();
      const response = await firstValueFrom(
        this.immunityMapGateway.generate({
          a_items: aItems,
          context: context.length > 0 ? context : null,
        }),
      );
      this.generatedMap.set(response);
    } catch {
      this.generationError.set('免疫マップの生成に失敗しました。時間をおいて再実行してください。');
      this.generatedMap.set(null);
    } finally {
      this.isGenerating.set(false);
    }
  };

  public readonly copyMermaid = async (): Promise<void> => {
    const mermaid = this.generatedMap()?.mermaid;
    if (!mermaid) {
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(mermaid);
        this.copyStatus.set('copied');
        return;
      }
    } catch {
      // fall through
    }

    try {
      const element = document.createElement('textarea');
      element.value = mermaid;
      element.setAttribute('readonly', 'true');
      element.style.position = 'fixed';
      element.style.left = '-9999px';
      document.body.appendChild(element);
      element.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(element);
      this.copyStatus.set(ok ? 'copied' : 'failed');
    } catch {
      this.copyStatus.set('failed');
    }
  };

  private readonly parseLines = (value: string): string[] =>
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

  private readonly toAItem = (kind: ImmunityMapAItemKind, text: string): ImmunityMapAItem => ({
    kind,
    text,
  });
}
