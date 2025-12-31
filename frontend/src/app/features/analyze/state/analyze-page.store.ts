import {
  DestroyRef,
  Injectable,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';

import { AnalysisGateway } from '@core/api/analysis-gateway';
import { AnalysisProposal, AnalysisRequest } from '@core/models';
import { WorkspaceStore } from '@core/state/workspace-store';
import { createId } from '@core/utils/create-id';
import { createSignalForm } from '@shared/forms/signal-forms';

type AnalyzerToastState = 'loading' | 'success' | 'notice' | 'error';

interface EditableSubtaskDraft {
  readonly id: string;
  title: string;
}

interface EditableProposalDraft {
  readonly id: string;
  readonly templateId: string | null | undefined;
  readonly confidence: number;
  title: string;
  summary: string;
  statusId: string;
  labelIds: string[];
  subtasks: EditableSubtaskDraft[];
}

const TOAST_DISMISS_MS = 3800;
const HIGHLIGHT_RESET_MS = 2400;
const PUBLISH_FEEDBACK_RESET_MS = 4200;
/**
 * 分析ページの状態とアクションをまとめたストア。
 */
@Injectable()
export class AnalyzePageStore {
  private readonly analysisGateway = inject(AnalysisGateway);
  private readonly workspace = inject(WorkspaceStore);
  private readonly destroyRef = inject(DestroyRef);

  public readonly analyzeForm = createSignalForm<AnalysisRequest>({
    notes: '',
    objective: '',
    autoObjective: true,
  });

  private readonly requestSignal = signal<AnalysisRequest | null>(null);

  private readonly toastState = signal<AnalyzerToastState | null>(null);
  private readonly toastMessageSignal = signal<string | null>(null);
  private readonly publishFeedback = signal<{
    status: 'success' | 'error';
    message: string;
  } | null>(null);
  private readonly highlightResults = signal(false);
  private readonly editableProposalsSignal = signal<EditableProposalDraft[]>([]);
  private readonly proposalLookup = computed(
    () => new Map(this.eligibleProposals().map((proposal) => [proposal.id, proposal])),
  );
  public readonly editableProposals = computed(() => this.editableProposalsSignal());
  public readonly hasEditableProposals = computed(() => this.editableProposalsSignal().length > 0);
  public readonly workspaceStatuses = computed(() => this.workspace.settings().statuses);
  public readonly statusSelectOptions = computed(() =>
    this.workspaceStatuses().map((status) => ({ value: status.id, label: status.name })),
  );
  public readonly workspaceLabels = computed(() => this.workspace.settings().labels);
  public readonly canPublishAll = computed(
    () =>
      this.editableProposalsSignal().length > 0 &&
      this.editableProposalsSignal().every((proposal) => this.isProposalPublishable(proposal)),
  );

  private toastTimer: number | null = null;
  private highlightTimer: number | null = null;
  private publishFeedbackTimer: number | null = null;
  private lastTrackedRequest: AnalysisRequest | null | undefined = undefined;
  private requestVersion = 0;
  private lastResultFingerprint: string | null = null;
  private lastEditableFingerprint: string | null = null;

  public readonly analysisResource = this.analysisGateway.createAnalysisResource(
    this.requestSignal,
  );

  public readonly eligibleProposals = computed<readonly AnalysisProposal[]>(() => {
    const result = this.analysisResource.value();
    if (!result) {
      return [];
    }

    return result.proposals.filter((proposal) => this.workspace.isProposalEligible(proposal));
  });

  public readonly analysisWarnings = computed(() => this.analysisResource.value()?.warnings ?? []);

  public readonly isAutoObjectiveEnabled = computed(() =>
    this.analyzeForm.controls.autoObjective.value(),
  );

  public readonly autoObjectivePreview = computed(() =>
    this.generateAutoObjective(this.analyzeForm.controls.notes.value().trim()),
  );

  public readonly isAnalyzing = computed(() => {
    const status = this.analysisResource.status();
    const error = this.analysisResource.error();

    if (error !== null && error !== undefined) {
      return false;
    }

    return status === 'loading' || status === 'reloading';
  });

  public readonly canSubmit = computed(() => {
    const value = this.analyzeForm.value();
    const notes = value.notes.trim();
    if (notes.length === 0) {
      return false;
    }

    if (!value.autoObjective && value.objective.trim().length === 0) {
      return false;
    }

    return true;
  });

  public readonly isSubmitDisabled = computed(() => this.isAnalyzing() || !this.canSubmit());

  public readonly generationToast = computed(() => this.toastState());

  public readonly shouldHighlightResults = computed(() => this.highlightResults());

  public readonly generationToastMessage = computed(() => this.toastMessageSignal());

  public readonly proposalPublishFeedback = computed(() => this.publishFeedback());

  public readonly isProposalPublishable = (proposal: EditableProposalDraft): boolean =>
    proposal.title.trim().length > 0;

  public readonly isLabelSelected = (proposal: EditableProposalDraft, labelId: string): boolean =>
    proposal.labelIds.includes(labelId);

  private readonly analyzerLifecycle = effect(() => {
    const request = this.requestSignal();
    const status = this.analysisResource.status();
    const error = this.analysisResource.error();
    const result = this.analysisResource.value();
    const proposals = this.eligibleProposals();

    const isNewRequest = request !== this.lastTrackedRequest;
    if (isNewRequest) {
      this.lastTrackedRequest = request;
      this.requestVersion += 1;
      this.lastResultFingerprint = null;
      this.lastEditableFingerprint = null;
      this.editableProposalsSignal.set([]);
      this.dismissToast();
      this.disableResultsHighlight();
    }

    if (!request) {
      return;
    }

    if (status === 'loading' || status === 'reloading') {
      this.showLoadingToast();
      this.disableResultsHighlight();
      this.clearPublishFeedback();
      return;
    }

    if (error) {
      this.emitAnalyzerToastOnce(
        'error',
        'タスク案の生成に失敗しました。内容を確認してからもう一度お試しください。',
        'error',
      );
      this.disableResultsHighlight();
      this.editableProposalsSignal.set([]);
      this.lastEditableFingerprint = null;
      return;
    }

    if (!result) {
      this.lastResultFingerprint = null;
      this.lastEditableFingerprint = null;
      this.dismissToast();
      this.disableResultsHighlight();
      this.editableProposalsSignal.set([]);
      return;
    }

    if (proposals.length === 0) {
      this.emitAnalyzerToastOnce(
        'notice',
        '条件に一致する提案が見つかりませんでした。設定を調整して再度お試しください。',
        'empty',
      );
      this.disableResultsHighlight();
      this.editableProposalsSignal.set([]);
      this.lastEditableFingerprint = null;
      return;
    }

    const fingerprint = this.computeProposalsFingerprint(proposals);
    if (this.lastEditableFingerprint !== fingerprint) {
      this.editableProposalsSignal.set(this.createEditableProposals(proposals));
      this.lastEditableFingerprint = fingerprint;
    }
    if (
      this.emitSuccessToast(
        `AI が ${proposals.length} 件のおすすめタスク案を生成しました。`,
        fingerprint,
      )
    ) {
      this.triggerResultsHighlight();
    }
  });

  private readonly dispatchAnalyze = this.analyzeForm.submit((value) => {
    const payload = this.createRequestPayload(value);
    if (!payload) {
      return;
    }

    this.requestSignal.set(payload);
  });

  public constructor() {
    void this.workspace.refreshWorkspaceData();
    this.destroyRef.onDestroy(() => {
      this.clearVisualTimers();
      this.clearPublishFeedbackTimer();
    });
  }

  /**
   * Handles form submission and prevents the default browser behavior.
   *
   * @param event - Submit event triggered by the form.
   */
  public readonly handleSubmit = (event: SubmitEvent): void => {
    event.preventDefault();
    this.dispatchAnalyze();
  };

  /**
   * Publishes the proposals to the board store.
   *
   * @param proposals - Proposals confirmed by the user.
   */
  public readonly publishProposals = async (
    proposals: readonly EditableProposalDraft[],
  ): Promise<void> => {
    if (proposals.length === 0) {
      return;
    }
    try {
      const normalized = proposals.map((proposal) => this.normalizeProposal(proposal));
      await this.workspace.importProposals(normalized);
      this.showPublishFeedback({
        status: 'success',
        message: this.formatPublishSuccessMessage(normalized),
      });
      this.resetAnalyzeForm({ preserveFeedback: true });
    } catch (error) {
      console.error('Failed to import proposals', error);
      this.showPublishFeedback({
        status: 'error',
        message: 'カード案の追加に失敗しました。時間をおいて再度お試しください。',
      });
    }
  };

  /**
   * Clears the current proposals and resets form values.
   */
  public readonly resetForm = (): void => {
    this.resetAnalyzeForm();
  };

  /**
   * Creates an automatic objective phrase based on the user's notes.
   *
   * @param notes - Notes entered by the user.
   * @returns A synthesized objective string.
   */
  private readonly generateAutoObjective = (notes: string): string => {
    const firstMeaningfulLine = notes
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0);

    if (!firstMeaningfulLine) {
      return '貼り付けた内容から優先的に取り組むべきゴールを特定する';
    }

    return `「${firstMeaningfulLine}」への対応方針を整理する`;
  };

  private readonly createRequestPayload = (value: AnalysisRequest): AnalysisRequest | null => {
    const notes = value.notes.trim();
    if (notes.length === 0) {
      return null;
    }

    const manualObjective = value.objective.trim();
    if (!value.autoObjective && manualObjective.length === 0) {
      return null;
    }

    return {
      autoObjective: value.autoObjective,
      notes,
      objective: value.autoObjective ? this.generateAutoObjective(notes) : manualObjective,
    } satisfies AnalysisRequest;
  };

  private readonly resetAnalyzeForm = (options?: { preserveFeedback?: boolean }): void => {
    this.analyzeForm.reset({ notes: '', objective: '', autoObjective: true });
    this.requestSignal.set(null);
    this.dismissToast();
    this.disableResultsHighlight();
    this.clearVisualTimers();
    this.lastTrackedRequest = null;
    this.requestVersion = 0;
    this.lastResultFingerprint = null;
    this.lastEditableFingerprint = null;
    this.editableProposalsSignal.set([]);
    if (!options?.preserveFeedback) {
      this.clearPublishFeedback();
    }
  };

  private createEditableProposals(proposals: readonly AnalysisProposal[]): EditableProposalDraft[] {
    return proposals.map((proposal) => ({
      id: proposal.id,
      templateId: proposal.templateId,
      confidence: proposal.confidence,
      title: proposal.title,
      summary: proposal.summary,
      statusId: this.resolveStatusId(proposal.suggestedStatusId),
      labelIds: [...proposal.suggestedLabelIds],
      subtasks: proposal.subtasks.map((task) => this.createEditableSubtask(task)),
    }));
  }

  private createEditableSubtask(title: string): EditableSubtaskDraft {
    return {
      id: createId(),
      title,
    };
  }

  public readonly updateProposalTitle = (proposalId: string, value: string): void => {
    this.updateEditableProposal(proposalId, (proposal) => ({ ...proposal, title: value }));
  };

  public readonly updateProposalSummary = (proposalId: string, value: string): void => {
    this.updateEditableProposal(proposalId, (proposal) => ({ ...proposal, summary: value }));
  };

  public readonly updateProposalStatus = (
    proposalId: string,
    statusId: string | string[] | null,
  ): void => {
    if (typeof statusId !== 'string') {
      return;
    }
    const resolvedStatusId = this.resolveStatusId(statusId);
    this.updateEditableProposal(proposalId, (proposal) => ({
      ...proposal,
      statusId: resolvedStatusId,
    }));
  };

  public readonly toggleProposalLabel = (proposalId: string, labelId: string): void => {
    this.updateEditableProposal(proposalId, (proposal) => {
      const exists = proposal.labelIds.includes(labelId);
      const labelIds = exists
        ? proposal.labelIds.filter((id) => id !== labelId)
        : [...proposal.labelIds, labelId];

      return { ...proposal, labelIds };
    });
  };

  public readonly addSubtask = (proposalId: string): void => {
    this.updateEditableProposal(proposalId, (proposal) => ({
      ...proposal,
      subtasks: [...proposal.subtasks, this.createEditableSubtask('')],
    }));
  };

  public readonly updateSubtaskTitle = (
    proposalId: string,
    subtaskId: string,
    value: string,
  ): void => {
    this.updateEditableProposal(proposalId, (proposal) => ({
      ...proposal,
      subtasks: proposal.subtasks.map((subtask) =>
        subtask.id === subtaskId ? { ...subtask, title: value } : subtask,
      ),
    }));
  };

  public readonly removeSubtask = (proposalId: string, subtaskId: string): void => {
    this.updateEditableProposal(proposalId, (proposal) => ({
      ...proposal,
      subtasks: proposal.subtasks.filter((subtask) => subtask.id !== subtaskId),
    }));
  };

  private updateEditableProposal(
    proposalId: string,
    updater: (proposal: EditableProposalDraft) => EditableProposalDraft,
  ): void {
    this.editableProposalsSignal.update((proposals) =>
      proposals.map((proposal) => (proposal.id === proposalId ? updater(proposal) : proposal)),
    );
  }

  private normalizeProposal(proposal: EditableProposalDraft): AnalysisProposal {
    const original = this.proposalLookup().get(proposal.id);
    const normalizedTitle = this.normalizeTitle(proposal, original);
    const normalizedSummary = this.normalizeSummary(proposal, original);
    const normalizedStatusId = this.normalizeStatus(proposal, original);
    const normalizedLabels = this.normalizeLabels(proposal);
    const normalizedSubtasks = this.normalizeSubtasks(proposal, original);

    return {
      id: proposal.id,
      title: normalizedTitle,
      summary: normalizedSummary,
      suggestedStatusId: normalizedStatusId,
      suggestedLabelIds: normalizedLabels,
      subtasks: normalizedSubtasks,
      confidence: proposal.confidence,
      templateId: proposal.templateId ?? undefined,
    } satisfies AnalysisProposal;
  }

  private normalizeTitle(
    proposal: EditableProposalDraft,
    original: AnalysisProposal | undefined,
  ): string {
    const trimmed = proposal.title.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }

    if (original) {
      return original.title;
    }

    return '無題のカード';
  }

  private normalizeSummary(
    proposal: EditableProposalDraft,
    original: AnalysisProposal | undefined,
  ): string {
    const trimmed = proposal.summary.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }

    return original?.summary ?? '';
  }

  private normalizeStatus(
    proposal: EditableProposalDraft,
    original: AnalysisProposal | undefined,
  ): string {
    const trimmed = proposal.statusId?.trim() ?? '';
    if (trimmed.length > 0) {
      return trimmed;
    }

    return this.resolveStatusId(original?.suggestedStatusId);
  }

  private resolveStatusId(statusId: string | null | undefined): string {
    const normalized = statusId?.trim() ?? '';
    const settings = this.workspace.settings();
    const statuses = settings.statuses;

    if (normalized.length > 0) {
      if (statuses.length === 0) {
        return normalized;
      }

      if (statuses.some((status) => status.id === normalized)) {
        return normalized;
      }
    }

    const defaultStatusId = settings.defaultStatusId?.trim() ?? '';
    if (defaultStatusId.length > 0) {
      if (statuses.length === 0) {
        return defaultStatusId;
      }

      if (statuses.some((status) => status.id === defaultStatusId)) {
        return defaultStatusId;
      }
    }

    if (statuses.length > 0) {
      return statuses[0]?.id ?? defaultStatusId;
    }

    return normalized || defaultStatusId;
  }

  private normalizeLabels(proposal: EditableProposalDraft): readonly string[] {
    const sanitized = proposal.labelIds
      .map((labelId) => labelId.trim())
      .filter((labelId) => labelId.length > 0);

    return Array.from(new Set(sanitized));
  }

  private normalizeSubtasks(
    proposal: EditableProposalDraft,
    original: AnalysisProposal | undefined,
  ): readonly string[] {
    const sanitized = proposal.subtasks
      .map((subtask) => subtask.title.trim())
      .filter((title) => title.length > 0);

    if (sanitized.length === 0) {
      return original?.subtasks ?? [];
    }

    return sanitized;
  }

  private showLoadingToast(): void {
    this.setToast('loading', 'AI がカード案を生成中です…', { autoDismiss: false });
  }

  private emitAnalyzerToastOnce(
    type: Exclude<AnalyzerToastState, 'loading' | 'success'>,
    message: string,
    detail?: string,
  ): boolean {
    const fingerprint = this.buildResultFingerprint(type, detail);
    if (this.lastResultFingerprint === fingerprint) {
      return false;
    }

    this.lastResultFingerprint = fingerprint;
    this.setToast(type, message, { autoDismiss: type === 'notice' });
    return true;
  }

  private emitSuccessToast(message: string, proposalsFingerprint: string): boolean {
    const fingerprint = this.buildResultFingerprint('success', proposalsFingerprint);
    if (this.lastResultFingerprint === fingerprint) {
      return false;
    }

    this.lastResultFingerprint = fingerprint;
    this.setToast('success', message, { autoDismiss: true });
    return true;
  }

  private buildResultFingerprint(type: AnalyzerToastState, detail?: string): string {
    return `${type}:${this.requestVersion}:${detail ?? 'none'}`;
  }

  private computeProposalsFingerprint(proposals: readonly AnalysisProposal[]): string {
    return proposals.map((proposal) => proposal.id).join('|');
  }

  private dismissToast(): void {
    this.toastState.set(null);
    this.toastMessageSignal.set(null);
    this.clearToastTimer();
  }

  private setToast(
    state: AnalyzerToastState,
    message: string,
    options: { autoDismiss: boolean },
  ): void {
    this.toastState.set(state);
    this.toastMessageSignal.set(message);
    if (options.autoDismiss) {
      this.startToastTimer();
    } else {
      this.clearToastTimer();
    }
  }

  private startToastTimer(): void {
    this.clearToastTimer();

    if (typeof window === 'undefined') {
      return;
    }

    this.toastTimer = window.setTimeout(() => {
      this.toastState.set(null);
      this.toastMessageSignal.set(null);
      this.toastTimer = null;
    }, TOAST_DISMISS_MS);
  }

  private triggerResultsHighlight(): void {
    this.disableResultsHighlight();
    this.highlightResults.set(true);

    if (typeof window === 'undefined') {
      queueMicrotask(() => {
        this.highlightResults.set(false);
      });
      return;
    }

    this.highlightTimer = window.setTimeout(() => {
      this.highlightResults.set(false);
      this.highlightTimer = null;
    }, HIGHLIGHT_RESET_MS);
  }

  private disableResultsHighlight(): void {
    this.clearHighlightTimer();
    this.highlightResults.set(false);
  }

  private clearVisualTimers(): void {
    this.clearToastTimer();
    this.clearHighlightTimer();
  }

  private clearToastTimer(): void {
    if (typeof window === 'undefined') {
      return;
    }

    if (this.toastTimer !== null) {
      window.clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
  }

  private clearHighlightTimer(): void {
    if (typeof window === 'undefined') {
      return;
    }

    if (this.highlightTimer !== null) {
      window.clearTimeout(this.highlightTimer);
      this.highlightTimer = null;
    }
  }

  private showPublishFeedback(feedback: { status: 'success' | 'error'; message: string }): void {
    this.publishFeedback.set(feedback);
    this.startPublishFeedbackTimer();
  }

  private formatPublishSuccessMessage(proposals: readonly AnalysisProposal[]): string {
    if (proposals.length === 1) {
      return `カード「${proposals[0]?.title ?? ''}」をボードに追加しました。`;
    }

    const [firstProposal] = proposals;
    return `${proposals.length}件のカード案をボードに追加しました（最初の案: 「${firstProposal?.title ?? ''}」）。`;
  }

  private startPublishFeedbackTimer(): void {
    this.clearPublishFeedbackTimer();

    if (typeof window === 'undefined') {
      return;
    }

    this.publishFeedbackTimer = window.setTimeout(() => {
      this.publishFeedback.set(null);
      this.publishFeedbackTimer = null;
    }, PUBLISH_FEEDBACK_RESET_MS);
  }

  private clearPublishFeedbackTimer(): void {
    if (typeof window === 'undefined') {
      return;
    }

    if (this.publishFeedbackTimer !== null) {
      window.clearTimeout(this.publishFeedbackTimer);
      this.publishFeedbackTimer = null;
    }
  }

  private clearPublishFeedback(): void {
    this.publishFeedback.set(null);
    this.clearPublishFeedbackTimer();
  }
}

