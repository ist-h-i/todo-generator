import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';

import { PageLayout } from '@shared/ui/page-layout/page-layout';
import { AiMark } from '@shared/ui/ai-mark/ai-mark';
import { UiSelect } from '@shared/ui/select/ui-select';

import { AnalyzePageStore } from './state/analyze-page.store';
@Component({
  selector: 'app-analyze-page',
  imports: [DecimalPipe, PageLayout, UiSelect, AiMark],
  templateUrl: './analyze.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AnalyzePageStore],
})
export class AnalyzePage {
  private readonly store = inject(AnalyzePageStore);

  public readonly analyzeForm = this.store.analyzeForm;
  public readonly analysisResource = this.store.analysisResource;
  public readonly analysisWarnings = this.store.analysisWarnings;
  public readonly autoObjectivePreview = this.store.autoObjectivePreview;
  public readonly canPublishAll = this.store.canPublishAll;
  public readonly editableProposals = this.store.editableProposals;
  public readonly generationToast = this.store.generationToast;
  public readonly generationToastMessage = this.store.generationToastMessage;
  public readonly hasEditableProposals = this.store.hasEditableProposals;
  public readonly isAnalyzing = this.store.isAnalyzing;
  public readonly isAutoObjectiveEnabled = this.store.isAutoObjectiveEnabled;
  public readonly isLabelSelected = this.store.isLabelSelected;
  public readonly isProposalPublishable = this.store.isProposalPublishable;
  public readonly isSubmitDisabled = this.store.isSubmitDisabled;
  public readonly proposalPublishFeedback = this.store.proposalPublishFeedback;
  public readonly shouldHighlightResults = this.store.shouldHighlightResults;
  public readonly statusSelectOptions = this.store.statusSelectOptions;
  public readonly workspaceLabels = this.store.workspaceLabels;

  public readonly addSubtask = this.store.addSubtask;
  public readonly handleSubmit = this.store.handleSubmit;
  public readonly publishProposals = this.store.publishProposals;
  public readonly removeSubtask = this.store.removeSubtask;
  public readonly resetForm = this.store.resetForm;
  public readonly toggleProposalLabel = this.store.toggleProposalLabel;
  public readonly updateProposalStatus = this.store.updateProposalStatus;
  public readonly updateProposalSummary = this.store.updateProposalSummary;
  public readonly updateProposalTitle = this.store.updateProposalTitle;
  public readonly updateSubtaskTitle = this.store.updateSubtaskTitle;

  public readonly readInputValue = (event: Event): string => {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement | null;
    return target?.value ?? '';
  };
}
