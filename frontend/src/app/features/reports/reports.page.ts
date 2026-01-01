import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { PageLayout } from '@shared/ui/page-layout/page-layout';
import { LocalDateTimePipe } from '@shared/pipes/local-date-time';
import { UiSelect } from '@shared/ui/select/ui-select';
import { AiMark } from '@shared/ui/ai-mark/ai-mark';

type SectionFormControls = {
  title: FormControl<string>;
  body: FormControl<string>;
};
type SectionFormGroup = FormGroup<SectionFormControls>;
type SubtaskFormControls = {
  title: FormControl<string>;
  description: FormControl<string>;
  status: FormControl<string>;
};
type SubtaskFormGroup = FormGroup<SubtaskFormControls>;
type ProposalFormControls = {
  title: FormControl<string>;
  summary: FormControl<string>;
  status: FormControl<string>;
  labels: FormControl<string>;
  priority: FormControl<string>;
  dueInDays: FormControl<number | null>;
  subtasks: FormArray<SubtaskFormGroup>;
};
type ProposalFormGroup = FormGroup<ProposalFormControls>;
type ReportFormControls = {
  tags: FormControl<string>;
  sections: FormArray<SectionFormGroup>;
};

@Component({
  selector: 'app-report-assistant-page',
  imports: [ReactiveFormsModule, RouterLink, PageLayout, LocalDateTimePipe, UiSelect, AiMark],
  templateUrl: './reports.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportAssistantPage {
  private readonly gateway = inject(StatusReportsGateway);
  private readonly workspace = inject(WorkspaceStore);

  public constructor() {
    void this.workspace.refreshWorkspaceData();
  }

  private readonly pendingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly successState = signal<string | null>(null);
  private readonly detailState = signal<StatusReportDetail | null>(null);
  private readonly publishPendingState = signal(false);
  private readonly publishErrorState = signal<string | null>(null);
  private readonly publishSuccessState = signal<string | null>(null);
  public readonly proposals = new FormArray<ProposalFormGroup>([]);
  public readonly statusSelectOptions = computed(() => {
    const statuses = [...this.workspace.settings().statuses].sort(
      (left, right) => (left.order ?? 0) - (right.order ?? 0),
    );
    const options = statuses.map((status) => ({ value: status.id, label: status.name }));
    return [{ value: '', label: 'ステータスを選択' }, ...options];
  });

  public readonly priorityOptions: ReadonlyArray<{ value: string; label: string }> = [
    { value: 'urgent', label: 'urgent' },
    { value: 'high', label: 'high' },
    { value: 'medium', label: 'medium' },
    { value: 'low', label: 'low' },
  ];
  private readonly statusNameIndex = computed(() => {
    const index = new Map<string, string>();
    for (const status of this.workspace.settings().statuses) {
      index.set(status.id, status.name);

      const normalizedId = status.id.trim().toLowerCase();
      if (normalizedId) {
        index.set(normalizedId, status.name);
      }

      const normalizedName = status.name.trim().toLowerCase();
      if (normalizedName) {
        index.set(normalizedName, status.name);
      }

      if (status.category) {
        const normalizedCategory = status.category.trim().toLowerCase();
        if (normalizedCategory) {
          index.set(normalizedCategory, status.name);
        }
      }
    }
    return index;
  });

  public readonly form: FormGroup<ReportFormControls> = new FormGroup({
    tags: new FormControl('', { nonNullable: true }),
    sections: new FormArray<SectionFormGroup>([this.createSectionGroup()]),
  });

  private readonly syncProposalsEffect = effect(() => {
    const detail = this.detailState();
    if (!detail) {
      this.clearEditableProposals();
      return;
    }

    this.replaceEditableProposals(detail.pending_proposals);
  });

  public readonly pending = computed(() => this.pendingState());
  public readonly error = computed(() => this.errorState());
  public readonly successMessage = computed(() => this.successState());
  public readonly detail = computed(() => this.detailState());
  public readonly processingWarnings = computed(() => {
    const detail = this.detailState();
    if (!detail) {
      return [];
    }

    const warnings = detail.processing_meta['ai_warnings'];
    if (!Array.isArray(warnings)) {
      return [];
    }

    return warnings
      .filter((warning): warning is string => typeof warning === 'string')
      .map((warning) => warning.trim())
      .filter((warning) => warning.length > 0);
  });
  public readonly hasProcessingWarnings = computed(() => this.processingWarnings().length > 0);
  public readonly publishPending = computed(() => this.publishPendingState());
  public readonly publishError = computed(() => this.publishErrorState());
  public readonly publishSuccess = computed(() => this.publishSuccessState());

  public readonly formatProposalStatus = (status: string | null | undefined): string => {
    if (!status) {
      return '未設定';
    }

    const index = this.statusNameIndex();
    const directMatch = index.get(status);
    if (directMatch) {
      return directMatch;
    }

    const normalized = status.trim().toLowerCase();
    if (!normalized) {
      return '未設定';
    }

    return index.get(normalized) ?? '未設定';
  };

  public get sections(): FormArray<SectionFormGroup> {
    return this.form.controls.sections;
  }

  public get proposalControls(): ProposalFormGroup[] {
    return this.proposals.controls;
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

  public addProposal(): void {
    this.proposals.push(this.createProposalGroup());
    this.clearPublishFeedback();
  }

  public removeProposal(index: number): void {
    if (index < 0 || index >= this.proposals.length) {
      return;
    }
    this.proposals.removeAt(index);
    this.clearPublishFeedback();
  }

  public proposalSubtasks(index: number): FormArray<SubtaskFormGroup> {
    return this.proposals.at(index)!.controls.subtasks;
  }

  public addSubtask(index: number): void {
    const subtasks = this.proposalSubtasks(index);
    subtasks.push(this.createSubtaskGroup());
    this.clearPublishFeedback();
  }

  public removeSubtask(proposalIndex: number, subtaskIndex: number): void {
    const subtasks = this.proposalSubtasks(proposalIndex);
    if (!subtasks) {
      return;
    }

    if (subtaskIndex < 0 || subtaskIndex >= subtasks.length) {
      return;
    }

    subtasks.removeAt(subtaskIndex);
    this.clearPublishFeedback();
  }

  public async publishProposal(index: number): Promise<void> {
    if (this.publishPending()) {
      return;
    }

    const group = this.proposals.at(index);
    if (!group) {
      return;
    }

    group.markAllAsTouched();
    const proposal = this.buildProposalPayload(group);
    if (!proposal) {
      this.publishErrorState.set('提案の必須項目を入力してください。');
      this.publishSuccessState.set(null);
      return;
    }

    await this.publishProposals([proposal]);
  }

  private async publishProposals(proposals: readonly StatusReportProposal[]): Promise<void> {
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
      generatedBy: 'status_report',
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

    const byId = settings.statuses.find((status) => status.id.trim().toLowerCase() === normalized);
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

  private readonly mapSubtasks = (
    subtasks: readonly StatusReportProposalSubtask[] | undefined,
  ): readonly Subtask[] | undefined => {
    if (!subtasks || subtasks.length === 0) {
      return undefined;
    }

    const mapped: Subtask[] = [];
    for (const subtask of subtasks) {
      const title = (subtask.title ?? '').trim();
      const description = subtask.description?.trim();
      const combined =
        typeof this.composeSubtaskTitle === 'function'
          ? this.composeSubtaskTitle(title, description)
          : [title, description].filter((segment) => segment).join(' — ');
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
  };

  private readonly composeSubtaskTitle = (
    title: string,
    description: string | undefined,
  ): string => {
    if (title && description) {
      return `${title} — ${description}`;
    }

    if (title) {
      return title;
    }

    return description ?? '';
  };

  private resolveSubtaskStatus(statusName: string | null | undefined): Subtask['status'] {
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

  private formatPublishSuccessMessage(proposals: readonly StatusReportProposal[]): string {
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

  private createSectionGroup(): SectionFormGroup {
    return new FormGroup<SectionFormControls>({
      title: new FormControl('', { nonNullable: true }),
      body: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    });
  }

  private createProposalGroup(proposal?: StatusReportProposal): ProposalFormGroup {
    const settings = this.workspace.settings();
    const statusId = this.resolveStatusId(proposal?.status, settings) ?? '';
    return new FormGroup<ProposalFormControls>({
      title: new FormControl(proposal?.title ?? '', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      summary: new FormControl(proposal?.summary ?? '', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      status: new FormControl(statusId, { nonNullable: true }),
      labels: new FormControl(proposal ? proposal.labels.join(', ') : '', { nonNullable: true }),
      priority: new FormControl(proposal?.priority ?? 'medium', { nonNullable: true }),
      dueInDays: new FormControl<number | null>(proposal?.due_in_days ?? null),
      subtasks: new FormArray<SubtaskFormGroup>(
        (proposal?.subtasks ?? []).map((subtask) => this.createSubtaskGroup(subtask)),
      ),
    });
  }

  private createSubtaskGroup(subtask?: StatusReportProposalSubtask): SubtaskFormGroup {
    const status = this.normalizeSubtaskStatusForEditing(subtask?.status);
    return new FormGroup<SubtaskFormControls>({
      title: new FormControl(subtask?.title ?? '', { nonNullable: true }),
      description: new FormControl(subtask?.description ?? '', { nonNullable: true }),
      status: new FormControl(status || 'todo', { nonNullable: true }),
    });
  }

  private normalizeSubtaskStatusForEditing(status: string | null | undefined): string {
    if (!status) {
      return '';
    }

    const trimmed = status.trim();
    if (!trimmed) {
      return '';
    }

    const normalized = trimmed.toLowerCase();
    const settings = this.workspace.settings();

    const matchById = settings.statuses.find(
      (candidate) => candidate.id.trim().toLowerCase() === normalized,
    );
    if (matchById?.category) {
      return matchById.category;
    }

    const matchByName = settings.statuses.find(
      (candidate) => candidate.name.trim().toLowerCase() === normalized,
    );
    if (matchByName?.category) {
      return matchByName.category;
    }

    const matchByCategory = settings.statuses.find(
      (candidate) => candidate.category === normalized,
    );
    if (matchByCategory?.category) {
      return matchByCategory.category;
    }

    const resolved = this.resolveSubtaskStatus(trimmed);
    if (resolved === 'todo' && normalized !== 'todo') {
      return '';
    }

    return resolved;
  }

  private buildCreatePayload(): StatusReportCreateRequest | null {
    const sections = this.sections
      .getRawValue()
      .map((section) => {
        const title = section.title.trim();
        return {
          title: title.length > 0 ? title : null,
          body: section.body.trim(),
        };
      })
      .filter((section) => section.body.length > 0);

    if (sections.length === 0) {
      return null;
    }

    return {
      shift_type: null,
      tags: this.parseTags(this.form.controls.tags.value),
      sections,
      auto_ticket_enabled: false,
    } satisfies StatusReportCreateRequest;
  }

  private parseTags(value: string): readonly string[] {
    return value
      .replace(/[\r\n、]/g, ',')
      .split(',')
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

  private replaceEditableProposals(proposals: readonly StatusReportProposal[]): void {
    this.proposals.clear();
    for (const proposal of proposals) {
      this.proposals.push(this.createProposalGroup(proposal));
    }
    this.clearPublishFeedback();
  }

  private clearEditableProposals(): void {
    this.proposals.clear();
    this.clearPublishFeedback();
  }

  private buildProposalPayload(group: ProposalFormGroup): StatusReportProposal | null {
    const raw = group.getRawValue();

    const title = raw.title.trim();
    const summary = raw.summary.trim();
    if (!title || !summary) {
      return null;
    }

    const status = raw.status.trim();
    const labels = this.parseTags(raw.labels);
    const priority = raw.priority.trim() || 'medium';
    const dueInDays = this.parseDueInDays(raw.dueInDays);
    const subtasks = this.buildSubtaskPayloads(raw.subtasks);

    return {
      title,
      summary,
      status,
      labels,
      priority,
      due_in_days: dueInDays,
      subtasks,
    } satisfies StatusReportProposal;
  }

  private parseDueInDays(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const numeric = typeof value === 'number' ? value : Number.parseInt(value, 10);
    if (!Number.isFinite(numeric)) {
      return null;
    }

    return numeric;
  }

  private buildSubtaskPayloads(
    subtasks: readonly {
      title: string;
      description: string;
      status: string;
    }[],
  ): readonly StatusReportProposalSubtask[] {
    const mapped: StatusReportProposalSubtask[] = [];

    for (const subtask of subtasks) {
      const title = subtask.title.trim();
      const description = subtask.description.trim();
      const status = subtask.status.trim();

      if (!title && !description) {
        continue;
      }

      mapped.push({
        title: title || description,
        description: description || null,
        status: status || undefined,
      });
    }

    return mapped;
  }
}
