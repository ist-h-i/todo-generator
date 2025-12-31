import { afterNextRender, ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule } from '@angular/cdk/drag-drop';

import { PageHeader } from '@shared/ui/page-header/page-header';
import { LocalDateTimePipe } from '@shared/pipes/local-date-time';

import { BoardPageStore } from './state/board-page.store';

type ColumnAccentSource = { readonly accent: string };

@Component({
  selector: 'app-board-page',
  imports: [CommonModule, DragDropModule, PageHeader, LocalDateTimePipe],
  templateUrl: './board.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [BoardPageStore],
})
export class BoardPage {
  private readonly store = inject(BoardPageStore);

  public readonly subtaskStatusOptions = this.store.subtaskStatusOptions;
  public readonly groupingSignal = this.store.groupingSignal;
  public readonly groupingLabelSignal = this.store.groupingLabelSignal;
  public readonly columnsSignal = this.store.columnsSignal;
  public readonly filtersSignal = this.store.filtersSignal;
  public readonly filteredCardsSignal = this.store.filteredCardsSignal;
  public readonly statusesSignal = this.store.statusesSignal;
  public readonly labelsSignal = this.store.labelsSignal;
  public readonly quickFilters = this.store.quickFilters;
  public readonly cardsByIdSignal = this.store.cardsByIdSignal;
  public readonly labelsByIdSignal = this.store.labelsByIdSignal;
  public readonly statusesByIdSignal = this.store.statusesByIdSignal;
  public readonly isSubtaskResolved = this.store.isSubtaskResolved;
  public readonly isCardResolved = this.store.isCardResolved;
  public readonly subtaskColumnsSignal = this.store.subtaskColumnsSignal;
  public readonly searchForm = this.store.searchForm;
  public readonly cardForm = this.store.cardForm;
  public readonly newSubtaskForm = this.store.newSubtaskForm;
  public readonly commentAuthorNameSignal = this.store.commentAuthorNameSignal;
  public readonly commentsByContextSignal = this.store.commentsByContextSignal;
  public readonly orphanedSubtaskCommentsSignal = this.store.orphanedSubtaskCommentsSignal;
  public readonly isCardFormValid = this.store.isCardFormValid;
  public readonly isNewSubtaskFormValid = this.store.isNewSubtaskFormValid;
  public readonly quickFilterSummarySignal = this.store.quickFilterSummarySignal;
  public readonly updateSearch = this.store.updateSearch;
  public readonly clearFilters = this.store.clearFilters;
  public readonly toggleQuickFilter = this.store.toggleQuickFilter;
  public readonly isQuickFilterActive = this.store.isQuickFilterActive;
  public readonly selectGrouping = this.store.selectGrouping;
  public readonly openCard = this.store.openCard;
  public readonly confirmDeleteCard = this.store.confirmDeleteCard;
  public readonly moveCard = this.store.moveCard;
  public readonly handleDrop = this.store.handleDrop;
  public readonly handleSubtaskDrop = this.store.handleSubtaskDrop;
  public readonly selectedCardSignal = this.store.selectedCardSignal;
  public readonly saveCardDetails = this.store.saveCardDetails;
  public readonly commentDraftValue = this.store.commentDraftValue;
  public readonly updateCommentDraft = this.store.updateCommentDraft;
  public readonly isCommentDraftValid = this.store.isCommentDraftValid;
  public readonly isContextBeingEdited = this.store.isContextBeingEdited;
  public readonly commentsForContext = this.store.commentsForContext;
  public readonly startEditingComment = this.store.startEditingComment;
  public readonly cancelCommentEditing = this.store.cancelCommentEditing;
  public readonly isCommentBeingEdited = this.store.isCommentBeingEdited;
  public readonly saveCommentForContext = this.store.saveCommentForContext;
  public readonly removeComment = this.store.removeComment;
  public readonly updateSubtaskTitle = this.store.updateSubtaskTitle;
  public readonly updateSubtaskAssignee = this.store.updateSubtaskAssignee;
  public readonly updateSubtaskEstimate = this.store.updateSubtaskEstimate;
  public readonly updateSubtaskDueDate = this.store.updateSubtaskDueDate;
  public readonly changeSubtaskStatus = this.store.changeSubtaskStatus;
  public readonly deleteSubtask = this.store.deleteSubtask;
  public readonly addSubtask = this.store.addSubtask;
  public readonly isActiveCard = this.store.isActiveCard;
  public readonly statusColor = this.store.statusColor;
  public readonly statusBorderColor = this.store.statusBorderColor;
  public readonly cardBackground = this.store.cardBackground;
  public readonly columnAccent: (column: ColumnAccentSource) => string = this.store.columnAccent;
  public readonly columnBorderColor: (column: ColumnAccentSource) => string =
    this.store.columnBorderColor;
  public readonly columnBackground: (column: ColumnAccentSource) => string =
    this.store.columnBackground;
  public readonly statusName = this.store.statusName;
  public readonly subtaskStatusLabel = this.store.subtaskStatusLabel;
  public readonly subtaskStatusAccent = this.store.subtaskStatusAccent;
  public readonly priorityLabel = this.store.priorityLabel;
  public readonly dateInputValue = this.store.dateInputValue;
  public readonly labelName = this.store.labelName;
  public readonly isLabelApplied = this.store.isLabelApplied;
  public readonly handleLabelToggle = this.store.handleLabelToggle;

  public constructor() {
    afterNextRender(() => {
      void this.store.refreshWorkspaceData();
    });
  }
}
