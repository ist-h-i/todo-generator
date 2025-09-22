import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AnalysisGateway } from '@core/api/analysis-gateway';
import { WorkspaceStore } from '@core/state/workspace-store';
import { AnalysisProposal, AnalysisRequest } from '@core/models';
import { createSignalForm } from '@lib/forms/signal-forms';

interface ToneConfig {
  readonly label: string;
  readonly description: string;
  readonly previewLead: string;
  readonly previewExample: string;
}

/**
 * Analyzer page allowing users to submit notes and review Gemini-style proposals.
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

  private readonly toneDictionary: Record<AnalysisRequest['tone'], ToneConfig> = {
    formal: {
      label: 'フォーマル',
      description: '役員報告や公式文書向けに、落ち着いた丁寧な文体で提案をまとめます。',
      previewLead: '敬語を使いながら事実を端的に伝え、落ち着いた印象を与える文章になります。',
      previewExample: '本件については現状の課題を整理し、次回会議までに論点とアクションを共有いたします。',
    },
    casual: {
      label: 'カジュアル',
      description: 'チーム内の共有やチャット投稿に合う、親しみやすい語り口でまとめます。',
      previewLead: '柔らかい語尾や共感の言葉を交え、フラットに読み進められる文章になります。',
      previewExample: '今回のタスクはこのステップで進めるのが良さそうです。気になる点があればいつでも教えてください。',
    },
  };

  public readonly toneOptions = (
    Object.keys(this.toneDictionary) as AnalysisRequest['tone'][]
  ).map((value) => ({
    value,
    label: this.toneDictionary[value].label,
    description: this.toneDictionary[value].description,
  }));

  public readonly analyzeForm = createSignalForm<AnalysisRequest>({
    notes: '',
    objective: '',
    autoObjective: true,
    tone: 'formal',
  });

  private readonly requestSignal = signal<AnalysisRequest | null>(null);

  public readonly analysisResource = this.analysisGateway.createAnalysisResource(
    this.requestSignal,
  );

  public readonly hasResult = computed(() => this.analysisResource.value() !== null);

  public readonly isAutoObjectiveEnabled = computed(() =>
    this.analyzeForm.controls.autoObjective.value(),
  );

  public readonly autoObjectivePreview = computed(() =>
    this.resolveAutoObjective(this.analyzeForm.controls.notes.value().trim()),
  );

  public readonly tonePreview = computed(
    () => this.toneDictionary[this.analyzeForm.controls.tone.value()],
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
      objective: value.autoObjective
        ? this.resolveAutoObjective(trimmedNotes)
        : manualObjective,
      tone: value.tone,
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
    this.analyzeForm.reset({
      notes: '',
      objective: '',
      autoObjective: true,
      tone: 'formal',
    });
    this.requestSignal.set(null);
  };

  /**
   * Clears the current proposals and resets form values.
   */
  public readonly resetForm = (): void => {
    this.analyzeForm.reset({
      notes: '',
      objective: '',
      autoObjective: true,
      tone: 'formal',
    });
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
