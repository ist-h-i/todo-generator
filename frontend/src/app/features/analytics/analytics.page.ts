import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, inject, viewChild } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { MermaidViewer } from '@shared/ui/mermaid-viewer/mermaid-viewer';
import { PageLayout } from '@shared/ui/page-layout/page-layout';
import { UiSelect } from '@shared/ui/select/ui-select';
import { AiMark } from '@shared/ui/ai-mark/ai-mark';

import { AnalyticsPageStore } from './state/analytics-page.store';

/**
 * ワークスペース全体のメトリクスを俯瞰する分析ダッシュボード。
 */
@Component({
  selector: 'app-analytics-page',
  imports: [
    DecimalPipe,
    RouterLink,
    ReactiveFormsModule,
    MermaidViewer,
    PageLayout,
    UiSelect,
    AiMark,
  ],
  templateUrl: './analytics.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AnalyticsPageStore],
})
export class AnalyticsPage {
  private readonly store = inject(AnalyticsPageStore);

  private readonly immunityMapMermaidViewer = viewChild<ElementRef<HTMLElement>>(
    'immunityMapMermaidViewer',
  );

  public readonly windowDaysOptions = this.store.windowDaysOptions;
  public readonly windowDaysControl = this.store.windowDaysControl;

  public readonly summarySignal = this.store.summarySignal;
  public readonly statusBreakdown = this.store.statusBreakdown;
  public readonly labelBreakdown = this.store.labelBreakdown;
  public readonly pointSummary = this.store.pointSummary;

  public readonly candidatesRequested = this.store.candidatesRequested;
  public readonly candidates = this.store.candidates;
  public readonly candidateContextSummary = this.store.candidateContextSummary;
  public readonly candidateWarnings = this.store.candidateWarnings;
  public readonly candidateSourcesLabel = this.store.candidateSourcesLabel;
  public readonly candidateEmptyStateMessage = this.store.candidateEmptyStateMessage;
  public readonly candidatesLoading = this.store.candidatesLoading;
  public readonly candidatesError = this.store.candidatesError;

  public readonly advancedMode = this.store.advancedMode;
  public readonly selectedCandidateIds = this.store.selectedCandidateIds;
  public readonly selectedCandidateCount = this.store.selectedCandidateCount;

  public readonly shouldText = this.store.shouldText;
  public readonly cannotText = this.store.cannotText;
  public readonly wantText = this.store.wantText;
  public readonly contextText = this.store.contextText;

  public readonly isGenerating = this.store.isGenerating;
  public readonly generationError = this.store.generationError;
  public readonly generatedMap = this.store.generatedMap;
  public readonly copyStatus = this.store.copyStatus;

  public readonly toggleAdvancedMode = this.store.toggleAdvancedMode;
  public readonly refreshCandidates = this.store.refreshCandidates;
  public readonly toggleCandidateSelection = this.store.toggleCandidateSelection;
  public readonly updateCandidateText = this.store.updateCandidateText;
  public readonly candidateText = this.store.candidateText;
  public readonly formatKindLabel = this.store.formatKindLabel;
  public readonly formatReadoutKind = this.store.formatReadoutKind;
  public readonly formatEvidenceType = this.store.formatEvidenceType;
  public readonly updateShouldText = this.store.updateShouldText;
  public readonly updateCannotText = this.store.updateCannotText;
  public readonly updateWantText = this.store.updateWantText;
  public readonly updateContextText = this.store.updateContextText;
  public readonly copyMermaid = this.store.copyMermaid;
  public readonly downloadMarkdown = this.store.downloadMarkdown;

  public readonly readInputValue = (event: Event): string => {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement | null;
    return target?.value ?? '';
  };

  public readonly generateImmunityMap = async (): Promise<void> => {
    const generated = await this.store.generateImmunityMap();
    if (generated) {
      this.scrollMermaidViewerIntoView();
    }
  };

  private scrollMermaidViewerIntoView(attempt: number = 0): void {
    if (typeof document === 'undefined') {
      return;
    }

    const element = this.immunityMapMermaidViewer()?.nativeElement;
    if (!element) {
      if (attempt < 5) {
        setTimeout(() => this.scrollMermaidViewerIntoView(attempt + 1), 0);
      }
      return;
    }

    element.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
  }
}
