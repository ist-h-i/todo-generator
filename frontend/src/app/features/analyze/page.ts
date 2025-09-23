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
    autoObjective: true,
  });

  private readonly requestSignal = signal<AnalysisRequest | null>(null);

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
    this.resolveAutoObjective(this.analyzeForm.controls.notes.value().trim()),
  );

  private readonly dispatchAnalyze = this.analyzeForm.submit((value) => {
    const trimmedNotes = value.notes.trim();
    if (trimmedNotes.length === 0) {
      return;
    }

    const manualObjective = value.objective.trim();
    if (!value.autoObjective && manualObjective.length === 0) {
      return;
    }

    this.requestSignal.set({
      autoObjective: value.autoObjective,
      notes: trimmedNotes,
      objective: value.autoObjective ? this.resolveAutoObjective(trimmedNotes) : manualObjective,
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
    this.analyzeForm.reset({ notes: '', objective: '', autoObjective: true });
    this.requestSignal.set(null);
  };

  /**
   * Clears the current proposals and resets form values.
   */
  public readonly resetForm = (): void => {
    this.analyzeForm.reset({ notes: '', objective: '', autoObjective: true });
    this.requestSignal.set(null);
  };

  /**
   * Creates an automatic objective phrase based on the user's notes.
   *
   * @param notes - Notes entered by the user.
   * @returns A synthesized objective string.
   */
  private readonly resolveAutoObjective = (notes: string): string => {
    const firstMeaningfulLine = notes
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0);

    if (!firstMeaningfulLine) {
      return '貼り付けた内容から優先的に取り組むべきゴールを特定する';
    }

    return `「${firstMeaningfulLine}」への対応方針を整理する`;
  };
}
