import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ImmunityMapGateway } from '@core/api/immunity-map-gateway';
import {
  ImmunityMapAItem,
  ImmunityMapAItemKind,
  ImmunityMapCandidate,
  ImmunityMapCandidateRequest,
  ImmunityMapContextPolicy,
  ImmunityMapEvidenceType,
  ImmunityMapReadoutKind,
  ImmunityMapResponse,
} from '@core/models';
import { WorkspaceStore } from '@core/state/workspace-store';
import { PageLayout } from '@shared/ui/page-layout/page-layout';

/**
 * Analytics dashboard summarizing board metrics for the workspace.
 */
@Component({
  selector: 'app-analytics-page',
  imports: [CommonModule, RouterLink, PageLayout],
  templateUrl: './analytics.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsPage {
  private readonly workspace = inject(WorkspaceStore);
  private readonly immunityMapGateway = inject(ImmunityMapGateway);

  public constructor() {
    void this.workspace.refreshWorkspaceData();
    this.refreshCandidates();
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

  private readonly candidateRequest = signal<ImmunityMapCandidateRequest | null>(null);
  public readonly candidatesResource = this.immunityMapGateway.createCandidatesResource(
    this.candidateRequest,
  );
  public readonly candidates = computed(() => this.candidatesResource.value()?.candidates ?? []);
  public readonly candidateContextSummary = computed(
    () => this.candidatesResource.value()?.context_summary ?? null,
  );
  public readonly candidateUsedSources = computed(
    () => this.candidatesResource.value()?.used_sources ?? null,
  );
  public readonly candidateSourcesLabel = computed(() =>
    this.formatSourcesLabel(this.candidateUsedSources()),
  );
  public readonly candidatesLoading = computed(() => {
    const status = this.candidatesResource.status();
    return status === 'loading' || status === 'reloading';
  });
  public readonly candidatesError = computed(() => this.candidatesResource.error());

  public readonly advancedMode = signal(false);
  public readonly windowDays = signal(28);
  public readonly selectedCandidateIds = signal<readonly string[]>([]);
  private readonly candidateDrafts = signal<Record<string, string>>({});

  private readonly syncCandidatesEffect = effect(() => {
    const candidates = this.candidates();
    this.updateCandidateDrafts(candidates);
    this.updateCandidateSelection(candidates);
  });

  public readonly selectedCandidates = computed(() => {
    const selected = new Set(this.selectedCandidateIds());
    return this.candidates().filter((candidate) => selected.has(candidate.id));
  });
  public readonly selectedCandidateCount = computed(() => this.selectedCandidateIds().length);

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

  public readonly toggleAdvancedMode = (): void => {
    this.advancedMode.update((value) => !value);
  };

  public readonly refreshCandidates = (): void => {
    this.candidateRequest.set(this.buildCandidateRequest());
  };

  public readonly updateWindowDays = (value: number | string): void => {
    const nextValue = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(nextValue)) {
      return;
    }
    const clamped = Math.min(Math.max(nextValue, 7), 180);
    if (clamped === this.windowDays()) {
      return;
    }
    this.windowDays.set(clamped);
    this.refreshCandidates();
  };

  public readonly toggleCandidateSelection = (candidateId: string): void => {
    this.selectedCandidateIds.update((current) =>
      current.includes(candidateId)
        ? current.filter((id) => id !== candidateId)
        : [...current, candidateId],
    );
  };

  public readonly updateCandidateText = (candidateId: string, value: string): void => {
    this.candidateDrafts.update((drafts) => ({ ...drafts, [candidateId]: value }));
  };

  public readonly candidateText = (candidate: ImmunityMapCandidate): string =>
    this.candidateDrafts()[candidate.id] ?? candidate.a_item.text;

  public readonly formatKindLabel = (kind: ImmunityMapAItemKind): string => {
    switch (kind) {
      case 'should':
        return 'やるべき';
      case 'cannot':
        return 'やれない';
      case 'want':
        return 'やりたい';
      default:
        return 'A';
    }
  };

  public readonly formatReadoutKind = (kind: ImmunityMapReadoutKind): string => {
    switch (kind) {
      case 'observation':
        return '観察';
      case 'hypothesis':
        return '仮説';
      case 'barrier':
        return '障壁';
      case 'need':
        return 'ニーズ';
      case 'assumption':
        return '前提';
      case 'next_step':
        return '次の一歩';
      default:
        return '読み解き';
    }
  };

  public readonly formatEvidenceType = (type: ImmunityMapEvidenceType): string => {
    switch (type) {
      case 'status_report':
        return '日報週報';
      case 'card':
        return 'カード';
      case 'snapshot':
        return 'スナップショット';
      default:
        return 'その他';
    }
  };

  public readonly generateImmunityMap = async (): Promise<void> => {
    if (this.isGenerating()) {
      return;
    }

    const candidateItems = this.buildCandidateAItems();
    const manualItems = this.advancedMode() ? this.buildManualAItems() : [];
    const aItems = [...candidateItems, ...manualItems];

    if (aItems.length === 0) {
      this.generationError.set('A 候補を1件以上選択するか、手入力で追加してください。');
      this.generatedMap.set(null);
      return;
    }

    this.isGenerating.set(true);
    this.generationError.set(null);
    this.copyStatus.set('idle');

    try {
      const context = this.advancedMode() ? this.contextText().trim() : '';
      const response = await firstValueFrom(
        this.immunityMapGateway.generate({
          a_items: aItems,
          context: context.length > 0 ? context : null,
          context_policy: this.resolveContextPolicy(context),
        }),
      );
      this.generatedMap.set(response);
    } catch {
      this.generationError.set('免疫マップの生成に失敗しました。時間をおいて再度お試しください。');
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

  private readonly buildCandidateRequest = (): ImmunityMapCandidateRequest => ({
    window_days: this.windowDays(),
    max_candidates: 10,
    include: {
      status_reports: true,
      cards: true,
      profile: true,
      snapshots: false,
    },
  });

  private readonly updateCandidateDrafts = (candidates: readonly ImmunityMapCandidate[]): void => {
    this.candidateDrafts.update((drafts) => {
      const next: Record<string, string> = {};
      for (const candidate of candidates) {
        next[candidate.id] = drafts[candidate.id] ?? candidate.a_item.text;
      }
      return next;
    });
  };

  private readonly updateCandidateSelection = (
    candidates: readonly ImmunityMapCandidate[],
  ): void => {
    if (candidates.length === 0) {
      if (this.selectedCandidateIds().length > 0) {
        this.selectedCandidateIds.set([]);
      }
      return;
    }

    const allowed = new Set(candidates.map((candidate) => candidate.id));
    const current = this.selectedCandidateIds();
    const filtered = current.filter((id) => allowed.has(id));
    const next = filtered.length > 0 ? filtered : [candidates[0].id];

    if (!this.sameSelection(current, next)) {
      this.selectedCandidateIds.set(next);
    }
  };

  private readonly sameSelection = (left: readonly string[], right: readonly string[]): boolean => {
    if (left.length !== right.length) {
      return false;
    }

    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) {
        return false;
      }
    }

    return true;
  };

  private readonly formatSourcesLabel = (
    sources: Readonly<Record<string, number>> | null | undefined,
  ): string | null => {
    if (!sources) {
      return null;
    }

    const parts: string[] = [];
    const statusReports = sources['status_reports'];
    if (typeof statusReports === 'number') {
      parts.push(`日報週報 ${statusReports}件`);
    }
    const cards = sources['cards'];
    if (typeof cards === 'number') {
      parts.push(`カード ${cards}件`);
    }
    const snapshots = sources['snapshots'];
    if (typeof snapshots === 'number' && snapshots > 0) {
      parts.push(`スナップショット ${snapshots}件`);
    }

    return parts.length > 0 ? parts.join(' / ') : null;
  };

  private readonly buildCandidateAItems = (): ImmunityMapAItem[] => {
    const selected = new Set(this.selectedCandidateIds());
    const drafts = this.candidateDrafts();
    const items: ImmunityMapAItem[] = [];

    for (const candidate of this.candidates()) {
      if (!selected.has(candidate.id)) {
        continue;
      }
      const text = (drafts[candidate.id] ?? candidate.a_item.text).trim();
      if (!text) {
        continue;
      }
      items.push({ kind: candidate.a_item.kind, text });
    }

    return items;
  };

  private readonly buildManualAItems = (): ImmunityMapAItem[] => [
    ...this.parseLines(this.shouldText()).map((text) => this.toAItem('should', text)),
    ...this.parseLines(this.cannotText()).map((text) => this.toAItem('cannot', text)),
    ...this.parseLines(this.wantText()).map((text) => this.toAItem('want', text)),
  ];

  private readonly resolveContextPolicy = (context: string): ImmunityMapContextPolicy =>
    context.length > 0 ? 'auto+manual' : 'auto';

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
