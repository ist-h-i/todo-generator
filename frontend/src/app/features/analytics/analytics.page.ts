import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
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
import { MermaidViewer } from '@shared/ui/mermaid-viewer/mermaid-viewer';
import { PageLayout } from '@shared/ui/page-layout/page-layout';
import { UiSelect } from '@shared/ui/select/ui-select';
import { AiMark } from '@shared/ui/ai-mark/ai-mark';

/**
 * Analytics dashboard summarizing board metrics for the workspace.
 */
@Component({
  selector: 'app-analytics-page',
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    MermaidViewer,
    PageLayout,
    UiSelect,
    AiMark,
  ],
  templateUrl: './analytics.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsPage {
  private readonly workspace = inject(WorkspaceStore);
  private readonly immunityMapGateway = inject(ImmunityMapGateway);
  private readonly destroyRef = inject(DestroyRef);

  public readonly windowDaysOptions: ReadonlyArray<{ value: string; label: string }> = [
    { value: '7', label: '直近7日' },
    { value: '14', label: '直近14日' },
    { value: '28', label: '直近28日' },
    { value: '56', label: '直近56日' },
    { value: '84', label: '直近84日' },
  ];

  public constructor() {
    void this.workspace.refreshWorkspaceData();

    this.windowDaysControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.updateWindowDays(value));
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
  public readonly candidatesRequested = computed(() => this.candidateRequest() !== null);
  public readonly candidates = computed(() =>
    this.coerceCandidates(this.candidatesResource.value() as unknown),
  );
  public readonly candidateContextSummary = computed(
    () => this.candidatesResource.value()?.context_summary ?? null,
  );
  public readonly candidateUsedSources = computed(
    () => this.candidatesResource.value()?.used_sources ?? null,
  );
  public readonly candidateSourcesLabel = computed(() =>
    this.formatSourcesLabel(this.candidateUsedSources()),
  );
  public readonly candidateEmptyStateMessage = computed(() => {
    if (!this.candidatesRequested() || this.candidatesLoading() || this.candidatesError()) {
      return null;
    }

    if (this.candidates().length > 0) {
      return null;
    }

    const sources = this.candidateUsedSources();
    const total = sources
      ? Object.values(sources).reduce(
          (sum, value) => sum + (typeof value === 'number' ? value : 0),
          0,
        )
      : 0;

    if (total <= 0) {
      return '参照データが不足しているため候補カードを生成できませんでした。日報・週報を記録するか、未完了のタスクカードを追加して再度お試しください。';
    }

    return '参照データを見る限りは起点の候補が見当たりませんでした（状況が順調な可能性があります）。必要に応じてカスタム入力で起点を追加してください。';
  });
  public readonly candidatesLoading = computed(() => {
    const status = this.candidatesResource.status();
    return status === 'loading' || status === 'reloading';
  });
  public readonly candidatesError = computed(() => this.candidatesResource.error());

  public readonly advancedMode = signal(false);
  public readonly windowDays = signal(28);
  public readonly windowDaysControl = new FormControl<string>(String(this.windowDays()), {
    nonNullable: true,
  });
  public readonly selectedCandidateIds = signal<readonly string[]>([]);
  private readonly candidateDrafts = signal<Record<string, string>>({});

  private readonly syncWindowDaysControlEffect = effect(() => {
    const nextValue = String(this.windowDays());
    if (this.windowDaysControl.value !== nextValue) {
      this.windowDaysControl.setValue(nextValue, { emitEvent: false });
    }
  });

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
        return 'すべき';
      case 'cannot':
        return 'できない';
      case 'want':
        return 'したい';
      default:
        return '起点';
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
      this.generationError.set(
        '起点候補がありません。候補を選択するか、手入力で起点を追加してください。',
      );
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
      this.generationError.set(
        '免疫マップの生成に失敗しました。しばらくしてから再度お試しください。',
      );
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

  public readonly downloadMarkdown = (): void => {
    const generated = this.generatedMap();
    if (!generated || typeof document === 'undefined') {
      return;
    }

    try {
      const markdown = this.buildImmunityMapMarkdown(generated);
      const timestamp = new Date().toISOString().split('.')[0].replaceAll(':', '-');
      const fileName = `immunity-map-${timestamp}.md`;
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  private readonly buildImmunityMapMarkdown = (generated: ImmunityMapResponse): string => {
    const lines: string[] = [];

    lines.push('# 免疫マップ生成結果');
    lines.push('');
    lines.push(`- Generated: ${new Date().toISOString()}`);
    if (generated.model) {
      lines.push(`- Model: ${generated.model}`);
    }
    lines.push('');

    if (generated.summary) {
      lines.push('## サマリー');
      lines.push('');
      lines.push('### 現状分析');
      lines.push('');
      lines.push(generated.summary.current_analysis.trim());
      lines.push('');
      lines.push('### ひとことアドバイス');
      lines.push('');
      lines.push(generated.summary.one_line_advice.trim());
      lines.push('');
    }

    if (generated.readout_cards?.length) {
      lines.push('## 読み解きカード');
      lines.push('');

      for (const [index, card] of generated.readout_cards.entries()) {
        const kindLabel = this.formatReadoutKind(card.kind);
        const title = card.title.trim() || `読み解きカード ${index + 1}`;
        lines.push(`### ${kindLabel}: ${title}`);
        lines.push('');

        const body = card.body.trim();
        if (body) {
          lines.push(body);
          lines.push('');
        }

        if (card.evidence?.length) {
          lines.push('**根拠**');
          lines.push('');
          for (const evidence of card.evidence) {
            const typeLabel = this.formatEvidenceType(evidence.type);
            const timestamp = evidence.timestamp
              ? ` ${this.sanitizeInlineMarkdownText(evidence.timestamp)}`
              : '';
            const snippet = evidence.snippet ?? evidence.id ?? '参照あり';
            lines.push(
              `- ${typeLabel}${timestamp}: ${this.sanitizeInlineMarkdownText(snippet)}`,
            );
          }
          lines.push('');
        }
      }
    }

    lines.push('## Mermaid');
    lines.push('');
    lines.push('```mermaid');
    lines.push(this.normalizeMermaidForMarkdown(generated.mermaid));
    lines.push('```');
    lines.push('');

    return lines.join('\n');
  };

  private readonly normalizeMermaidForMarkdown = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }

    const fenced = trimmed.match(
      /^```(?:mermaid)?\s*(?:\r?\n)([\s\S]*?)(?:\r?\n)```\s*$/i,
    );
    return (fenced?.[1] ?? trimmed).trim();
  };

  private readonly sanitizeInlineMarkdownText = (value: string | null | undefined): string =>
    (value ?? '')
      .toString()
      .replace(/\r?\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

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
      parts.push(`日報・週報 ${statusReports}件`);
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

  private readonly coerceCandidates = (value: unknown): ImmunityMapCandidate[] => {
    const items = this.resolveCandidateItems(value);
    if (!items) {
      return [];
    }
    return this.coerceCandidatesFromArray(items);
  };

  private readonly resolveCandidateItems = (value: unknown): readonly unknown[] | null => {
    if (!value) {
      return null;
    }

    if (Array.isArray(value)) {
      if (value.some((item) => this.looksLikeCandidateItem(item))) {
        return value;
      }
      for (const item of value) {
        const resolved = this.resolveCandidateItems(item);
        if (resolved) {
          return resolved;
        }
      }
      return null;
    }

    if (typeof value === 'string') {
      return this.parseCandidateJson(value);
    }

    if (typeof value !== 'object') {
      return null;
    }

    const container = value as Record<string, unknown>;

    if (this.isCandidatePayload(container)) {
      return [container];
    }

    const embedded = container['card'] ?? container['candidate'];
    if (embedded && typeof embedded === 'object') {
      if (this.isCandidatePayload(embedded as Record<string, unknown>)) {
        return [embedded as Record<string, unknown>];
      }
    }

    return (
      this.resolveCandidateItems(container['candidates']) ??
      this.resolveCandidateItems(container['cards']) ??
      this.resolveCandidateItems(container['candidate_cards']) ??
      this.resolveCandidateItems(container['candidateCards']) ??
      this.resolveCandidateItems(container['data']) ??
      this.resolveCandidateItems(container['items']) ??
      this.resolveCandidateItems(container['results']) ??
      this.resolveCandidateArrayFromRecord(container) ??
      this.resolveCandidateItemsFromRecord(container)
    );
  };

  private readonly looksLikeCandidateItem = (value: unknown): boolean => {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const item = value as Record<string, unknown>;
    if (this.isCandidatePayload(item)) {
      return true;
    }
    const nested =
      item['card'] ??
      item['candidate'] ??
      item['payload'] ??
      item['data'] ??
      item['item'] ??
      item['value'];
    if (!nested || typeof nested !== 'object') {
      return false;
    }
    return this.isCandidatePayload(nested as Record<string, unknown>);
  };

  private readonly isCandidatePayload = (value: Record<string, unknown>): boolean => {
    const rawAItem = value['a_item'];
    if (rawAItem && typeof rawAItem === 'object') {
      const aItem = rawAItem as Record<string, unknown>;
      const kind = aItem['kind'];
      const text = aItem['text'];
      if (
        (kind === 'should' || kind === 'cannot' || kind === 'want') &&
        typeof text === 'string' &&
        text.trim().length > 0
      ) {
        return true;
      }
    }

    return this.extractFallbackTitle(value) !== null;
  };

  private readonly extractFallbackTitle = (value: Record<string, unknown>): string | null => {
    const title = value['title'];
    if (typeof title === 'string') {
      const trimmed = title.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }

    const rawText = value['name'] ?? value['subject'] ?? value['text'];
    if (typeof rawText !== 'string') {
      return null;
    }

    const trimmed = rawText.trim();
    if (!trimmed) {
      return null;
    }

    if (!this.hasCandidateMetadata(value)) {
      return null;
    }

    return trimmed;
  };

  private readonly hasCandidateMetadata = (value: Record<string, unknown>): boolean => {
    const keys = [
      'summary',
      'description',
      'ai_notes',
      'ai_confidence',
      'status_id',
      'label_ids',
      'story_points',
      'assignees',
      'priority',
      'due_date',
      'completed_at',
      'created_at',
    ];

    return keys.some((key) => value[key] !== null && value[key] !== undefined);
  };

  private readonly resolveCandidateItemsFromRecord = (
    value: Record<string, unknown>,
  ): readonly unknown[] | null => {
    for (const nested of Object.values(value)) {
      const resolved = this.resolveCandidateItems(nested);
      if (resolved) {
        return resolved;
      }
    }
    return null;
  };

  private readonly resolveCandidateArrayFromRecord = (
    value: Record<string, unknown>,
  ): readonly unknown[] | null => {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      return null;
    }
    if (!keys.every((key) => /^\d+$/.test(key))) {
      return null;
    }
    const values = Object.values(value);
    if (!values.some((item) => this.looksLikeCandidateItem(item))) {
      return null;
    }
    return values;
  };

  private readonly parseCandidateJson = (value: string): readonly unknown[] | null => {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) {
      return null;
    }
    try {
      return this.resolveCandidateItems(JSON.parse(trimmed));
    } catch {
      return null;
    }
  };

  private readonly coerceCandidatesFromArray = (items: readonly unknown[]): ImmunityMapCandidate[] => {
    const candidates: ImmunityMapCandidate[] = [];

    for (const [index, raw] of items.entries()) {
      const candidate = this.resolveCandidateFromItem(raw, index);
      if (candidate) {
        candidates.push(candidate);
      }
    }

    return candidates;
  };

  private readonly resolveCandidateFromItem = (
    value: unknown,
    index: number,
  ): ImmunityMapCandidate | null => {
    const direct = this.coerceCandidate(value, index);
    if (direct) {
      return direct;
    }
    if (!value || typeof value !== 'object') {
      return null;
    }
    const record = value as Record<string, unknown>;
    const nested =
      record['card'] ??
      record['candidate'] ??
      record['payload'] ??
      record['data'] ??
      record['item'] ??
      record['value'];
    if (!nested) {
      return null;
    }
    return this.coerceCandidate(nested, index);
  };

  private readonly coerceCandidate = (value: unknown, index: number): ImmunityMapCandidate | null => {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const item = value as Record<string, unknown>;

    const resolvedId = (() => {
      const rawId = item['id'];
      if (typeof rawId === 'string') {
        const trimmed = rawId.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
      }
      return `cand_${index + 1}`;
    })();

    const rawAItem = item['a_item'];
    if (rawAItem && typeof rawAItem === 'object') {
      const aItem = rawAItem as Record<string, unknown>;
      const kind = aItem['kind'];
      const text = aItem['text'];
      const rationale = item['rationale'];
      if (
        (kind === 'should' || kind === 'cannot' || kind === 'want') &&
        typeof text === 'string' &&
        text.trim().length > 0 &&
        typeof rationale === 'string' &&
        rationale.trim().length > 0
      ) {
        return {
          id: resolvedId,
          a_item: { kind, text: text.trim() },
          rationale: rationale.trim(),
          confidence: typeof item['confidence'] === 'number' ? item['confidence'] : undefined,
          questions: Array.isArray(item['questions'])
            ? item['questions'].filter(
                (question): question is string => typeof question === 'string' && question.trim().length > 0,
              )
            : undefined,
          evidence: Array.isArray(item['evidence']) ? (item['evidence'] as ImmunityMapCandidate['evidence']) : undefined,
        };
      }
    }
    const title = this.extractFallbackTitle(item);
    if (title) {
      const summary = typeof item['summary'] === 'string' ? item['summary'] : '';
      const aiNotes = typeof item['ai_notes'] === 'string' ? item['ai_notes'] : '';
      const analyticsNotes =
        typeof item['analytics_notes'] === 'string' ? item['analytics_notes'] : '';
      const description = typeof item['description'] === 'string' ? item['description'] : '';
      const rationale =
        (summary || aiNotes || analyticsNotes || description).trim() || '\u5019\u88dc\u30ab\u30fc\u30c9\u304c\u8fd4\u5374\u3055\u308c\u307e\u3057\u305f\u3002';
      const confidence = typeof item['ai_confidence'] === 'number' ? item['ai_confidence'] : undefined;

      return {
        id: resolvedId,
        a_item: { kind: 'should', text: title },
        rationale,
        confidence,
      };
    }
    return null;
  };
}






