import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { AnalysisGateway } from '@core/api/analysis-gateway';
import { WorkspaceStore } from '@core/state/workspace-store';
import { AnalysisProposal, AnalysisRequest } from '@core/models';
import { createSignalForm } from '@lib/forms/signal-forms';
import { PageLayoutComponent } from '@shared/ui/page-layout/page-layout';

type AnalyzerToast = {
  readonly type: 'success' | 'notice' | 'error';
  readonly message: string;
};

/**
 * Analyzer page allowing users to submit notes and review ChatGPT-style proposals.
 */
@Component({
  selector: 'app-analyze-page',
  standalone: true,
  imports: [CommonModule, PageLayoutComponent],
  templateUrl: './page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyzePage {
  private readonly analysisGateway = inject(AnalysisGateway);
  private readonly workspace = inject(WorkspaceStore);
  private readonly destroyRef = inject(DestroyRef);

  private readonly analyzerToastSignal = signal<AnalyzerToast | null>(null);
  private readonly resultsHighlightSignal = signal(false);

  private highlightTimeoutHandle: number | null = null;
  private lastTrackedRequest: AnalysisRequest | null | undefined = undefined;
  private requestVersion = 0;
  private lastResultFingerprint: string | null = null;

  public readonly analyzeForm = createSignalForm<AnalysisRequest>({
    notes: '',
    objective: '',
    autoObjective: true,
  });

  private readonly requestSignal = signal<AnalysisRequest | null>(null);

  private readonly publishFeedback = signal<{
    status: 'success' | 'error';
    message: string;
  } | null>(null);
  private publishFeedbackTimer: number | null = null;

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

  public readonly hasEligibleProposals = computed(() => this.eligibleProposals().length > 0);

  public readonly hasResult = computed(() => this.analysisResource.value() !== null);

  public readonly isAutoObjectiveEnabled = computed(() =>
    this.analyzeForm.controls.autoObjective.value(),
  );

  public readonly autoObjectivePreview = computed(() =>
    this.generateAutoObjective(this.analyzeForm.controls.notes.value().trim()),
  );

  public readonly analyzerToast = computed(() => this.analyzerToastSignal());
  public readonly shouldHighlightResults = computed(() => this.resultsHighlightSignal());
  public readonly isAnalyzing = computed(() => this.analysisResource.status() === 'loading');
  public readonly isSubmitDisabled = computed(() => {
    if (this.isAnalyzing()) {
      return true;
    }

    const notes = this.analyzeForm.controls.notes.value().trim();
    if (notes.length === 0) {
      return true;
    }

    if (!this.isAutoObjectiveEnabled()) {
      const objective = this.analyzeForm.controls.objective.value().trim();
      if (objective.length === 0) {
        return true;
      }
    }

    return false;
  });
  public readonly proposalPublishFeedback = computed(() => this.publishFeedback());

  private readonly analyzerLifecycleEffect = effect(
    () => {
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
        this.dismissToast();
        this.disableResultsHighlight();
      }

      if (!request) {
        return;
      }

      if (status === 'loading' || isNewRequest) {
        return;
      }

      if (error) {
        this.emitAnalyzerToastOnce(
          'error',
          'タスク案の生成に失敗しました。内容を確認してからもう一度お試しください。',
          'error',
        );
        this.disableResultsHighlight();
        return;
      }

      if (!result) {
        this.lastResultFingerprint = null;
        this.dismissToast();
        this.disableResultsHighlight();
        return;
      }

      if (proposals.length === 0) {
        this.emitAnalyzerToastOnce(
          'notice',
          '条件に一致する提案が見つかりませんでした。設定を調整して再度お試しください。',
          'empty',
        );
        this.disableResultsHighlight();
        return;
      }

      const fingerprint = this.computeProposalsFingerprint(proposals);
      if (
        this.emitSuccessToast(
          `AI が ${proposals.length} 件のおすすめタスク案を生成しました。`,
          fingerprint,
        )
      ) {
        this.triggerResultsHighlight();
      }
    },
    { allowSignalWrites: true },
  );

  private readonly dispatchAnalyze = this.analyzeForm.submit((value) => {
    const payload = this.createRequestPayload(value);
    if (!payload) {
      return;
    }

    this.requestSignal.set(payload);
  });

  public constructor() {
    this.destroyRef.onDestroy(() => {
      this.clearHighlightTimer();
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
  public readonly publishProposals = (proposals: readonly AnalysisProposal[]): void => {
    if (proposals.length === 0) {
      return;
    }
    try {
      this.workspace.importProposals(proposals);
      this.showPublishFeedback({
        status: 'success',
        message: this.formatPublishSuccessMessage(proposals),
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

  private emitAnalyzerToastOnce(
    type: Exclude<AnalyzerToast['type'], 'success'>,
    message: string,
    detail?: string,
  ): boolean {
    const fingerprint = this.buildResultFingerprint(type, detail);
    if (this.lastResultFingerprint === fingerprint) {
      return false;
    }

    this.lastResultFingerprint = fingerprint;
    this.analyzerToastSignal.set({ type, message });
    return true;
  }

  private emitSuccessToast(message: string, proposalsFingerprint: string): boolean {
    const fingerprint = this.buildResultFingerprint('success', proposalsFingerprint);
    if (this.lastResultFingerprint === fingerprint) {
      return false;
    }

    this.lastResultFingerprint = fingerprint;
    this.analyzerToastSignal.set({ type: 'success', message });
    return true;
  }

  private buildResultFingerprint(type: AnalyzerToast['type'], detail?: string): string {
    return `${type}:${this.requestVersion}:${detail ?? 'none'}`;
  }

  private computeProposalsFingerprint(proposals: readonly AnalysisProposal[]): string {
    return proposals.map((proposal) => proposal.id).join('|');
  }

  private dismissToast(): void {
    this.analyzerToastSignal.set(null);
  }

  private triggerResultsHighlight(): void {
    this.clearHighlightTimer();
    this.resultsHighlightSignal.set(true);

    if (typeof window === 'undefined') {
      queueMicrotask(() => {
        this.resultsHighlightSignal.set(false);
      });
      return;
    }

    this.highlightTimeoutHandle = window.setTimeout(() => {
      this.resultsHighlightSignal.set(false);
      this.highlightTimeoutHandle = null;
    }, 2400);
  }

  private disableResultsHighlight(): void {
    this.clearHighlightTimer();
    this.resultsHighlightSignal.set(false);
  }

  private clearHighlightTimer(): void {
    if (this.highlightTimeoutHandle !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.highlightTimeoutHandle);
    }
    this.highlightTimeoutHandle = null;
  }

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
    if (!options?.preserveFeedback) {
      this.clearPublishFeedback();
    }
  };

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
    }, 4200);
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
