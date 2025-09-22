import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AnalysisGateway } from '@core/api/analysis-gateway';
import { WorkspaceStore } from '@core/state/workspace-store';
import { AnalysisProposal, AnalysisRequest } from '@core/models';
import { createSignalForm } from '@lib/forms/signal-forms';

/**
 * Analyzer page allowing users to submit notes and review ChatGPT-style proposals.
 */
@Component({
  selector: 'app-analyze-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './page.html',
  styleUrl: './page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyzePage {
  private readonly analysisGateway = inject(AnalysisGateway);
  private readonly workspace = inject(WorkspaceStore);

  public readonly analyzeForm = createSignalForm<AnalysisRequest>({
    notes: '',
    objective: '',
    tone: 'formal',
  });

  private readonly requestSignal = signal<AnalysisRequest | null>(null);

  public readonly analysisResource = this.analysisGateway.createAnalysisResource(
    this.requestSignal,
  );

  public readonly hasResult = computed(() => this.analysisResource.value() !== null);

  private readonly dispatchAnalyze = this.analyzeForm.submit((value) => {
    if (value.notes.trim().length === 0) {
      return;
    }
    this.requestSignal.set({
      ...value,
      notes: value.notes.trim(),
    });
  });

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
    this.analyzeForm.reset({ notes: '', objective: '', tone: 'formal' });
    this.requestSignal.set(null);
  };

  /**
   * Clears the current proposals and resets form values.
   */
  public readonly resetForm = (): void => {
    this.analyzeForm.reset({ notes: '', objective: '', tone: 'formal' });
    this.requestSignal.set(null);
  };
}
