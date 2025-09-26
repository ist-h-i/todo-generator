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

  public readonly analyzeForm = createSignalForm<AnalysisRequest>({
    notes: '',
    objective: '',
    autoObjective: true,
  });

  private readonly requestSignal = signal<AnalysisRequest | null>(null);

  private readonly toastState = signal<'loading' | 'success' | null>(null);
  private readonly highlightResults = signal(false);
  private toastTimer: number | null = null;
  private highlightTimer: number | null = null;
  private previousStatus: string | null = null;

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

  public readonly isAnalyzing = computed(() => {
    const status = this.analysisResource.status();

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

  public readonly generationToastMessage = computed(() => {
    const state = this.toastState();
    if (!state) {
      return null;
    }

    if (state === 'loading') {
      return 'AI がカード案を生成中です…';
    }

    return this.hasEligibleProposals()
      ? '提案が更新されました！'
      : '提案の準備が完了しました。設定を見直してください。';
  });

  private readonly dispatchAnalyze = this.analyzeForm.submit((value) => {
    const payload = this.createRequestPayload(value);
    if (!payload) {
      return;
    }

    this.requestSignal.set(payload);
  });

  private readonly monitorAnalysisLifecycle = effect(() => {
    const status = this.analysisResource.status();
    const previous = this.previousStatus;
    this.previousStatus = status;

    if (status === 'loading' || status === 'reloading') {
      this.showLoadingToast();
      this.highlightResults.set(false);
      this.clearHighlightTimer();

      return;
    }

    if (status === 'resolved') {
      if (previous !== 'resolved') {
        this.handleAnalysisSuccess();
      }

      return;
    }

    if (status === 'error' || status === 'idle' || status === 'local') {
      this.toastState.set(null);
      this.highlightResults.set(false);
      this.clearVisualTimers();
    }
  });

  public constructor() {
    this.destroyRef.onDestroy(() => {
      this.clearVisualTimers();
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
    this.workspace.importProposals(proposals);
    this.resetAnalyzeForm();
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

  private readonly resetAnalyzeForm = (): void => {
    this.analyzeForm.reset({ notes: '', objective: '', autoObjective: true });
    this.requestSignal.set(null);
    this.toastState.set(null);
    this.highlightResults.set(false);
    this.clearVisualTimers();
    this.previousStatus = null;
  };

  private showLoadingToast(): void {
    this.toastState.set('loading');
    this.clearToastTimer();
  }

  private handleAnalysisSuccess(): void {
    const result = this.analysisResource.value();
    if (!result) {
      this.toastState.set(null);

      return;
    }

    this.toastState.set('success');
    this.startToastTimer();

    if (this.hasEligibleProposals()) {
      this.highlightResults.set(true);
      this.startHighlightTimer();
    } else {
      this.highlightResults.set(false);
      this.clearHighlightTimer();
    }
  }

  private startToastTimer(): void {
    this.clearToastTimer();

    if (typeof window === 'undefined') {
      return;
    }

    this.toastTimer = window.setTimeout(() => {
      this.toastState.set(null);
      this.toastTimer = null;
    }, 3800);
  }

  private startHighlightTimer(): void {
    this.clearHighlightTimer();

    if (typeof window === 'undefined') {
      return;
    }

    this.highlightTimer = window.setTimeout(() => {
      this.highlightResults.set(false);
      this.highlightTimer = null;
    }, 1200);
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
}
