import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { RouterLink } from '@angular/router';

import { StatusReportsGateway } from '@core/api/status-reports-gateway';
import {
  StatusReportDetail,
  StatusReportCreateRequest,
  StatusReportProposal,
  StatusReportProposalSubtask,
  WorkspaceSettings,
  Card,
  Subtask,
} from '@core/models';
import { WorkspaceStore } from '@core/state/workspace-store';
import { createId } from '@core/utils/create-id';
import { PageLayoutComponent } from '@shared/ui/page-layout/page-layout';

@Component({
  selector: 'app-report-assistant-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PageLayoutComponent],
  templateUrl: './reports-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportAssistantPageComponent {
  private readonly gateway = inject(StatusReportsGateway);
  private readonly fb = inject(FormBuilder);
  private readonly workspace = inject(WorkspaceStore);

  private readonly pendingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly successState = signal<string | null>(null);
  private readonly detailState = signal<StatusReportDetail | null>(null);
  private readonly publishPendingState = signal(false);
  private readonly publishErrorState = signal<string | null>(null);
  private readonly publishSuccessState = signal<string | null>(null);

  public readonly form = this.fb.group({
    tags: [''],
    sections: this.fb.array([this.createSectionGroup()]),
  });

  public readonly pending = computed(() => this.pendingState());
  public readonly error = computed(() => this.errorState());
  public readonly successMessage = computed(() => this.successState());
  public readonly detail = computed(() => this.detailState());
  public readonly publishPending = computed(() => this.publishPendingState());
  public readonly publishError = computed(() => this.publishErrorState());
  public readonly publishSuccess = computed(() => this.publishSuccessState());

  public get sections(): FormArray<FormGroup> {
    return this.form.get('sections') as FormArray<FormGroup>;
  }

  public addSection(): void {
    this.sections.push(this.createSectionGroup());
  }

  public removeSection(index: number): void {
    if (this.sections.length <= 1) {
      return;
    }
    this.sections.removeAt(index);
  }

  public async submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (this.pending()) {
      return;
    }

    const payload = this.buildCreatePayload();
    if (!payload) {
      this.errorState.set('本文が入力されたセクションを最低 1 つ追加してください。');
      return;
    }

    this.pendingState.set(true);
    this.errorState.set(null);
    this.successState.set(null);

    try {
      const created = await firstValueFrom(this.gateway.createReport(payload));
      const detail = await firstValueFrom(this.gateway.submitReport(created.id));
      this.detailState.set(detail);
      this.successState.set('AI 解析が完了しました。提案されたタスクを確認してください。');
      this.clearPublishFeedback();
      this.resetForm();
    } catch (error) {
      this.errorState.set(this.extractErrorMessage(error));
    } finally {
      this.pendingState.set(false);
    }
  }

  public async publishProposal(proposal: StatusReportProposal): Promise<void> {
    if (this.publishPending()) {
      return;
    }

    await this.publishProposals([proposal]);
  }

  private async publishProposals(
    proposals: readonly StatusReportProposal[],
  ): Promise<void> {
    if (proposals.length === 0) {
      return;
    }

    this.publishPendingState.set(true);
    this.publishErrorState.set(null);
    this.publishSuccessState.set(null);

    const createdCardIds: string[] = [];
    try {
      const settings = this.workspace.settings();
      for (const proposal of proposals) {
        const card = await this.workspace.createCardFromSuggestion(
          this.mapProposalToSuggestion(proposal, settings),
        );
        createdCardIds.push(card.id);
      }

      this.publishSuccessState.set(this.formatPublishSuccessMessage(proposals));
    } catch (error) {
      console.error('Failed to publish status report proposals', error);
      for (const cardId of createdCardIds) {
        this.workspace.removeCard(cardId);
      }
      this.publishErrorState.set('カードの追加に失敗しました。時間をおいて再度お試しください。');
    } finally {
      this.publishPendingState.set(false);
    }
  }

  private mapProposalToSuggestion(
    proposal: StatusReportProposal,
    settings: WorkspaceSettings,
  ): Parameters<WorkspaceStore['createCardFromSuggestion']>[0] {
    const statusId = this.resolveStatusId(proposal.status, settings);
    const labelIds = this.resolveLabelIds(proposal.labels, settings);
    const dueDate = this.resolveDueDate(proposal.due_in_days);
    const priority = this.resolvePriority(proposal.priority);
    const subtasks = this.mapSubtasks(proposal.subtasks);

    return {
      title: proposal.title,
      summary: proposal.summary,
      statusId,
      labelIds,
      priority,
      dueDate,
      subtasks,
    };
  }

  private resolveStatusId(
    statusName: string | null | undefined,
    settings: WorkspaceSettings,
  ): string | undefined {
    if (!statusName) {
      return undefined;
    }

    const normalized = statusName.trim().toLowerCase();
    if (!normalized) {
      return undefined;
    }

    const byId = settings.statuses.find(
      (status) => status.id.trim().toLowerCase() === normalized,
    );
    if (byId) {
      return byId.id;
    }

    const byName = settings.statuses.find(
      (status) => status.name.trim().toLowerCase() === normalized,
    );
    if (byName) {
      return byName.id;
    }

    const byCategory = settings.statuses.find((status) => status.category === normalized);
    return byCategory?.id;
  }

  private resolveLabelIds(
    labels: readonly string[] | undefined,
    settings: WorkspaceSettings,
  ): readonly string[] | undefined {
    if (!labels || labels.length === 0) {
      return undefined;
    }

    const lookup = new Map<string, string>();
    for (const label of settings.labels) {
      lookup.set(label.id.trim().toLowerCase(), label.id);
      lookup.set(label.name.trim().toLowerCase(), label.id);
    }

    const resolved = labels
      .map((label) => lookup.get(label.trim().toLowerCase()))
      .filter((value): value is string => Boolean(value));

    if (resolved.length === 0) {
      return undefined;
    }

    return Array.from(new Set(resolved));
  }

  private resolveDueDate(dueInDays: number | null | undefined): string | undefined {
    if (dueInDays === null || dueInDays === undefined) {
      return undefined;
    }

    const numeric = Number(dueInDays);
    if (!Number.isFinite(numeric)) {
      return undefined;
    }

    const today = new Date();
    today.setUTCDate(today.getUTCDate() + Math.trunc(numeric));
    return today.toISOString();
  }

  private resolvePriority(priority: string | null | undefined): Card['priority'] {
    if (!priority) {
      return 'medium';
    }

    const normalized = priority.trim().toLowerCase();
    switch (normalized) {
      case 'low':
      case 'minor':
      case 'lowest':
        return 'low';
      case 'high':
      case 'important':
      case 'major':
        return 'high';
      case 'urgent':
      case 'critical':
      case 'highest':
      case 'immediate':
        return 'urgent';
      default:
        return 'medium';
    }
  }

  private mapSubtasks(
    subtasks: readonly StatusReportProposalSubtask[] | undefined,
  ): readonly Subtask[] | undefined {
    if (!subtasks || subtasks.length === 0) {
      return undefined;
    }

    const mapped: Subtask[] = [];
    for (const subtask of subtasks) {
      const title = (subtask.title ?? '').trim();
      const description = subtask.description?.trim();
      const combined = this.composeSubtaskTitle(title, description);
      if (!combined) {
        continue;
      }

      mapped.push({
        id: createId(),
        title: combined,
        status: this.resolveSubtaskStatus(subtask.status),
      });
    }

    if (mapped.length === 0) {
      return undefined;
    }

    return mapped;
  }

  private composeSubtaskTitle(title: string, description: string | undefined): string {
    if (title && description) {
      return `${title} — ${description}`;
    }

    if (title) {
      return title;
    }

    return description ?? '';
  }

  private resolveSubtaskStatus(
    statusName: string | null | undefined,
  ): Subtask['status'] {
    if (!statusName) {
      return 'todo';
    }

    const normalized = statusName.trim().toLowerCase();
    switch (normalized) {
      case 'done':
      case 'completed':
      case 'complete':
      case 'resolved':
      case 'closed':
        return 'done';
      case 'in-progress':
      case 'in_progress':
      case 'doing':
      case 'active':
      case 'progress':
      case 'review':
      case 'qa':
      case 'testing':
      case 'blocked':
        return 'in-progress';
      case 'non-issue':
      case 'non_issue':
      case 'not-applicable':
      case 'not_applicable':
      case 'skipped':
      case 'n/a':
      case 'na':
        return 'non-issue';
      default:
        return 'todo';
    }
  }

  private formatPublishSuccessMessage(
    proposals: readonly StatusReportProposal[],
  ): string {
    if (proposals.length === 1) {
      return `カード「${proposals[0]?.title ?? ''}」をボードに追加しました。`;
    }

    const [first] = proposals;
    return `${proposals.length}件のカードをボードに追加しました（最初の提案: 「${first?.title ?? ''}」）。`;
  }

  private clearPublishFeedback(): void {
    this.publishErrorState.set(null);
    this.publishSuccessState.set(null);
  }

  private createSectionGroup(): FormGroup {
    return this.fb.group({
      title: [''],
      body: ['', Validators.required],
    });
  }

  private buildCreatePayload(): StatusReportCreateRequest | null {
    const value = this.form.value;
    const sections = this.sections.controls
      .map((control) => control.value)
      .map((section) => ({
        title: section.title?.trim() ?? null,
        body: (section.body ?? '').trim(),
      }))
      .filter((section) => section.body.length > 0);

    if (sections.length === 0) {
      return null;
    }

    return {
      shift_type: null,
      tags: this.parseTags(value.tags ?? ''),
      sections,
      auto_ticket_enabled: false,
    } satisfies StatusReportCreateRequest;
  }

  private parseTags(value: string): readonly string[] {
    return value
      .split(/[,\s]+/)
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
  }

  private resetForm(): void {
    while (this.sections.length > 1) {
      this.sections.removeAt(this.sections.length - 1);
    }
    this.sections.at(0)?.reset({ title: '', body: '' });
    this.form.patchValue({
      tags: '',
    });
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const detail = this.resolveDetailMessage(error.error);
      if (detail) {
        return detail;
      }
      if (error.status === 0) {
        return 'サーバーに接続できませんでした。時間をおいて再度お試しください。';
      }
      return '日報・週報の処理に失敗しました。時間をおいて再度お試しください。';
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    return '日報・週報の処理に失敗しました。';
  }

  private resolveDetailMessage(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === 'string' && detail.trim().length > 0) {
      return detail;
    }
    return null;
  }
}
