import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { DailyReportsGateway } from '@core/api/daily-reports-gateway';
import {
  DailyReportDetail,
  DailyReportListItem,
  DailyReportCreateRequest,
} from '@core/models';

@Component({
  selector: 'app-daily-reports-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './page.html',
  styleUrl: './page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DailyReportsPage {
  private readonly gateway = inject(DailyReportsGateway);
  private readonly fb = inject(FormBuilder);

  private readonly pendingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly successState = signal<string | null>(null);
  private readonly reportsState = signal<readonly DailyReportListItem[]>([]);
  private readonly selectedDetail = signal<DailyReportDetail | null>(null);

  public readonly form = this.fb.group({
    report_date: [this.todayString(), Validators.required],
    tags: [''],
    sections: this.fb.array([this.createSectionGroup()]),
  });

  public readonly pending = computed(() => this.pendingState());
  public readonly error = computed(() => this.errorState());
  public readonly successMessage = computed(() => this.successState());
  public readonly reports = computed(() => this.reportsState());
  public readonly detail = computed(() => this.selectedDetail());

  public constructor() {
    void this.refreshReports();
  }

  public get sections(): FormArray<FormGroup> {
    return this.form.get('sections') as FormArray<FormGroup>;
  }

  public trackByReport = (_: number, item: DailyReportListItem): string => item.id;

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
      this.selectedDetail.set(detail);
      this.successState.set('AI 解析が完了しました。提案されたタスクを確認してください。');
      this.updateReportsCollection(detail);
      this.resetForm();
    } catch (error) {
      this.errorState.set(this.extractErrorMessage(error));
    } finally {
      this.pendingState.set(false);
    }
  }

  public async openReport(reportId: string): Promise<void> {
    if (this.pending()) {
      return;
    }
    this.pendingState.set(true);
    this.errorState.set(null);
    this.successState.set(null);
    try {
      const detail = await firstValueFrom(this.gateway.getReport(reportId));
      this.selectedDetail.set(detail);
    } catch (error) {
      this.errorState.set(this.extractErrorMessage(error));
    } finally {
      this.pendingState.set(false);
    }
  }

  private async refreshReports(): Promise<void> {
    this.pendingState.set(true);
    this.errorState.set(null);
    try {
      const reports = await firstValueFrom(this.gateway.listReports());
      this.reportsState.set(reports);
    } catch (error) {
      this.errorState.set(this.extractErrorMessage(error));
    } finally {
      this.pendingState.set(false);
    }
  }

  private createSectionGroup(): FormGroup {
    return this.fb.group({
      title: [''],
      body: ['', Validators.required],
    });
  }

  private buildCreatePayload(): DailyReportCreateRequest | null {
    const value = this.form.value;
    const sections = this.sections.controls
      .map((control) => control.value)
      .map((section) => ({
        title: section.title?.trim() ?? null,
        body: (section.body ?? '').trim(),
      }))
      .filter((section) => section.body.length > 0);

    if (sections.length === 0 || !value.report_date) {
      return null;
    }

    return {
      report_date: value.report_date,
      shift_type: null,
      tags: this.parseTags(value.tags ?? ''),
      sections,
      auto_ticket_enabled: false,
    } satisfies DailyReportCreateRequest;
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
      report_date: this.todayString(),
      tags: '',
    });
  }

  private updateReportsCollection(detail: DailyReportDetail): void {
    const summary = detail.sections[0]?.body ?? '';
    const item: DailyReportListItem = {
      id: detail.id,
      report_date: detail.report_date,
      status: detail.status,
      shift_type: detail.shift_type,
      tags: detail.tags,
      auto_ticket_enabled: detail.auto_ticket_enabled,
      created_at: detail.created_at,
      updated_at: detail.updated_at,
      card_count: detail.cards.length,
      proposal_count: detail.pending_proposals.length,
      summary,
    };
    const filtered = this.reportsState().filter((report) => report.id !== detail.id);
    this.reportsState.set([item, ...filtered]);
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
      return '日報の処理に失敗しました。時間をおいて再度お試しください。';
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    return '日報の処理に失敗しました。';
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

  private todayString(): string {
    const today = new Date();
    const month = `${today.getMonth() + 1}`.padStart(2, '0');
    const day = `${today.getDate()}`.padStart(2, '0');
    return `${today.getFullYear()}-${month}-${day}`;
  }
}
