
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AppealsApi } from '@core/api/appeals-api';
import {
  AppealConfigResponse,
  AppealGenerationRequest,
  AppealGenerationResponse,
} from '@core/models';
import { createSignalForm } from '@shared/forms/signal-forms';
import { AiMark } from '@shared/ui/ai-mark/ai-mark';
import { PageLayout } from '@shared/ui/page-layout/page-layout';
import { UiSelect } from '@shared/ui/select/ui-select';

type SubjectType = 'label' | 'custom';
type CopyStatus = 'idle' | 'copied' | 'failed';
type GenerationStatus = 'success' | 'partial' | 'fallback';

interface GenerationBadge {
  readonly label: string;
  readonly message: string;
}

interface DownloadOption {
  readonly label: string;
  readonly extension: string;
  readonly mime: string;
}

interface AchievementOutputForm {
  subjectType: SubjectType;
  subjectLabelId: string;
  subjectCustom: string;
  flow: string[];
  formats: string[];
}

@Component({
  selector: 'app-achievement-output-page',
  imports: [PageLayout, UiSelect, AiMark],
  templateUrl: './achievement-output.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AchievementOutputPage {
  private readonly appealsApi = inject(AppealsApi);
  private readonly destroyRef = inject(DestroyRef);

  public readonly form = createSignalForm<AchievementOutputForm>({
    subjectType: 'label',
    subjectLabelId: '',
    subjectCustom: '',
    flow: [''],
    formats: [],
  });

  private readonly configState = signal<AppealConfigResponse | null>(null);
  private readonly configLoadingState = signal(false);
  private readonly configErrorState = signal<string | null>(null);

  private readonly generatingState = signal(false);
  private readonly resultState = signal<AppealGenerationResponse | null>(null);
  private readonly validationErrorState = signal<string | null>(null);
  private readonly generationErrorState = signal<string | null>(null);
  private readonly limitReachedState = signal(false);
  private readonly activeFormatIdState = signal<string | null>(null);
  private readonly editableFormatsState = signal<Record<string, string>>({});
  private readonly copyStatusState = signal<CopyStatus>('idle');

  private copyStatusTimer: number | null = null;

  public readonly config = computed(() => this.configState());
  public readonly configLoading = computed(() => this.configLoadingState());
  public readonly configError = computed(() => this.configErrorState());
  public readonly generating = computed(() => this.generatingState());
  public readonly result = computed(() => this.resultState());
  public readonly validationError = computed(() => this.validationErrorState());
  public readonly generationError = computed(() => this.generationErrorState());
  public readonly limitReached = computed(() => this.limitReachedState());
  public readonly activeFormatId = computed(() => this.activeFormatIdState());
  public readonly copyStatus = computed(() => this.copyStatusState());

  public readonly labels = computed(() => this.configState()?.labels ?? []);
  public readonly labelSelectOptions = computed(() =>
    this.labels().map((label) => ({ value: label.id, label: label.name })),
  );
  public readonly formats = computed(() => this.configState()?.formats ?? []);
  public readonly hasLabels = computed(() => this.labels().length > 0);
  public readonly flowSteps = computed(() => this.form.controls.flow.value());

  public readonly selectedFormats = computed(() => {
    const selected = new Set(this.form.controls.formats.value());
    return this.formats().filter((format) => selected.has(format.id));
  });

  public readonly selectedLabel = computed(() => {
    const labels = this.labels();
    const labelId = this.form.controls.subjectLabelId.value();
    return labels.find((label) => label.id === labelId) ?? null;
  });

  public readonly activeFormat = computed(() => {
    const activeId = this.activeFormatIdState();
    if (!activeId) {
      return null;
    }
    return this.formats().find((format) => format.id === activeId) ?? null;
  });

  public readonly activeContent = computed(() => {
    const activeId = this.activeFormatIdState();
    if (!activeId) {
      return '';
    }
    return this.editableFormatsState()[activeId] ?? '';
  });

  public readonly activeTokens = computed(() => {
    const result = this.resultState();
    const activeId = this.activeFormatIdState();
    if (!result || !activeId) {
      return null;
    }
    const tokens = result.formats[activeId]?.tokens_used;
    return typeof tokens === 'number' ? tokens : null;
  });

  public readonly generationBadge = computed<GenerationBadge | null>(() => {
    const result = this.resultState();
    const status = result?.generation_status as GenerationStatus | undefined;
    if (!result || !status || status === 'success') {
      return null;
    }

    const reason = result.ai_failure_reason?.trim();

    if (status === 'partial') {
      return {
        label: '一部フォールバック',
        message: reason
          ? `AI の一部生成に失敗したため、フォールバック結果を混在させています（理由: ${reason}）`
          : 'AI の応答が不完全だったため、フォールバック結果を混在させています。',
      };
    }

    return {
      label: 'フォールバック',
      message: reason
        ? `AI 生成に失敗したため、フォールバック結果を表示しています（理由: ${reason}）`
        : 'AI が利用できないため、フォールバック結果を表示しています。',
    };
  });

  public readonly canCopy = computed(() => {
    const content = this.activeContent().trim();
    return content.length > 0;
  });

  private readonly downloadOption = computed<DownloadOption | null>(() => {
    const format = this.activeFormat();
    if (!format) {
      return null;
    }

    if (format.id === 'markdown') {
      return {
        label: 'Markdown (.md) をダウンロード',
        extension: 'md',
        mime: 'text/markdown;charset=utf-8',
      };
    }

    if (format.id === 'bullet_list') {
      return {
        label: '箇条書き (.txt) をダウンロード',
        extension: 'txt',
        mime: 'text/plain;charset=utf-8',
      };
    }

    if (format.editor_mode === 'csv') {
      return {
        label: 'CSV をダウンロード',
        extension: 'csv',
        mime: 'text/csv;charset=utf-8',
      };
    }

    return {
      label: 'テキスト (.txt) をダウンロード',
      extension: 'txt',
      mime: 'text/plain;charset=utf-8',
    };
  });

  public readonly downloadButtonLabel = computed(
    () => this.downloadOption()?.label ?? 'ダウンロード',
  );

  public readonly canDownload = computed(() => {
    const option = this.downloadOption();
    if (!option) {
      return false;
    }
    return this.activeContent().trim().length > 0;
  });

  public readonly canGenerate = computed(() => {
    if (this.configLoadingState() || !this.configState() || this.limitReachedState()) {
      return false;
    }

    const subjectType = this.form.controls.subjectType.value();
    const subjectValue =
      subjectType === 'label'
        ? this.form.controls.subjectLabelId.value()
        : this.form.controls.subjectCustom.value();
    if (!subjectValue.trim()) {
      return false;
    }

    const hasFlow = this.form.controls.flow.value().some((step) => step.trim().length > 0);
    if (!hasFlow) {
      return false;
    }

    return this.form.controls.formats.value().length > 0;
  });

  private readonly syncActiveFormat = effect(() => {
    const selected = this.selectedFormats();
    if (selected.length === 0) {
      this.activeFormatIdState.set(null);
      return;
    }

    const activeId = this.activeFormatIdState();
    if (!activeId || !selected.some((format) => format.id === activeId)) {
      this.activeFormatIdState.set(selected[0]?.id ?? null);
    }
  });

  public constructor() {
    void this.loadConfig();
    this.destroyRef.onDestroy(() => {
      this.clearCopyTimer();
    });
  }

  public readonly reloadConfig = (): void => {
    void this.loadConfig();
  };

  public setSubjectType(type: SubjectType): void {
    this.form.controls.subjectType.setValue(type);
  }

  public updateSubjectLabel(value: string | string[] | null): void {
    if (typeof value !== 'string') {
      return;
    }
    this.form.controls.subjectLabelId.setValue(value);
  }

  public updateCustomSubject(value: string): void {
    this.form.controls.subjectCustom.setValue(value);
  }

  public addFlowStep(): void {
    this.form.controls.flow.updateValue((steps) => {
      if (steps.length >= 5) {
        return steps;
      }
      return [...steps, ''];
    });
  }

  public updateFlowStep(index: number, value: string): void {
    this.form.controls.flow.updateValue((steps) =>
      steps.map((step, currentIndex) => (currentIndex === index ? value : step)),
    );
  }

  public removeFlowStep(index: number): void {
    this.form.controls.flow.updateValue((steps) => {
      if (steps.length <= 1) {
        return steps;
      }
      return steps.filter((_, currentIndex) => currentIndex !== index);
    });
  }

  public toggleFormat(formatId: string): void {
    this.form.controls.formats.updateValue((formats) => {
      if (formats.includes(formatId)) {
        return formats.filter((id) => id !== formatId);
      }
      return [...formats, formatId];
    });
  }

  public setActiveTab(formatId: string): void {
    this.activeFormatIdState.set(formatId);
  }

  public updateFormatContent(formatId: string | null, value: string): void {
    if (!formatId) {
      return;
    }
    this.editableFormatsState.update((current) => ({
      ...current,
      [formatId]: value,
    }));
  }

  public readonly submit = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();
    if (this.generatingState() || !this.canGenerate()) {
      return;
    }

    const payload = this.buildRequestPayload();
    if (!payload) {
      return;
    }

    this.generatingState.set(true);
    this.validationErrorState.set(null);
    this.generationErrorState.set(null);

    try {
      const response = await firstValueFrom(this.appealsApi.generate(payload));
      this.applyResult(response);
      this.limitReachedState.set(false);
    } catch (error) {
      this.handleGenerateError(error);
    } finally {
      this.generatingState.set(false);
    }
  };

  public readonly copyActiveContent = async (): Promise<void> => {
    const content = this.activeContent();
    if (!content) {
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
        this.setCopyStatus('copied');
        return;
      }
    } catch {
      // fall through
    }

    try {
      const element = document.createElement('textarea');
      element.value = content;
      element.setAttribute('readonly', 'true');
      element.style.position = 'fixed';
      element.style.left = '-9999px';
      document.body.appendChild(element);
      element.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(element);
      this.setCopyStatus(ok ? 'copied' : 'failed');
    } catch {
      this.setCopyStatus('failed');
    }
  };

  public readonly downloadActiveContent = (): void => {
    const option = this.downloadOption();
    if (!option || !this.canDownload() || typeof document === 'undefined') {
      return;
    }

    try {
      const content = this.activeContent();
      const timestamp = new Date().toISOString().split('.')[0].replaceAll(':', '-');
      const fileName = `achievement-output-${timestamp}.${option.extension}`;
      const blob = new Blob([content], { type: option.mime });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  private async loadConfig(): Promise<void> {
    if (this.configLoadingState()) {
      return;
    }

    this.configLoadingState.set(true);
    this.configErrorState.set(null);

    try {
      const response = await firstValueFrom(this.appealsApi.getConfig());
      this.configState.set(response);
      this.limitReachedState.set(false);
      this.initializeForm(response);
    } catch (error) {
      this.configErrorState.set(
        this.extractErrorMessage(error) ?? '設定情報の取得に失敗しました。',
      );
    } finally {
      this.configLoadingState.set(false);
    }
  }

  private initializeForm(config: AppealConfigResponse): void {
    const labels = config.labels ?? [];
    const formats = config.formats ?? [];
    const recommendedFlow = config.recommended_flow ?? [];
    const hasLabels = labels.length > 0;
    const flow = recommendedFlow.length > 0 ? recommendedFlow.slice(0, 5) : [''];

    this.form.patchValue({
      subjectType: hasLabels ? 'label' : 'custom',
      subjectLabelId: hasLabels ? labels[0]?.id ?? '' : '',
      subjectCustom: '',
      flow,
      formats: formats.map((format) => format.id),
    });

    if (formats.length > 0) {
      this.activeFormatIdState.set(formats[0]?.id ?? null);
    }
  }

  private buildRequestPayload(): AppealGenerationRequest | null {
    const subjectType = this.form.controls.subjectType.value();
    const subjectValue =
      subjectType === 'label'
        ? this.form.controls.subjectLabelId.value().trim()
        : this.form.controls.subjectCustom.value().trim();

    if (!subjectValue) {
      this.validationErrorState.set('テーマを入力または選択してください。');
      return null;
    }

    const flow = this.normalizeFlow(this.form.controls.flow.value());
    if (flow.length === 0) {
      this.validationErrorState.set('フローを最低 1 つ入力してください。');
      return null;
    }

    const formats = this.normalizeFormatIds(this.form.controls.formats.value());
    if (formats.length === 0) {
      this.validationErrorState.set('出力形式を 1 つ以上選択してください。');
      return null;
    }

    this.validationErrorState.set(null);

    return {
      subject: {
        type: subjectType,
        value: subjectValue,
      },
      flow,
      formats,
    } satisfies AppealGenerationRequest;
  }

  private normalizeFlow(steps: readonly string[]): string[] {
    const normalized: string[] = [];
    const seen = new Set<string>();

    for (const step of steps) {
      const trimmed = step.trim();
      if (!trimmed || seen.has(trimmed)) {
        continue;
      }
      normalized.push(trimmed);
      seen.add(trimmed);
      if (normalized.length >= 5) {
        break;
      }
    }

    return normalized;
  }

  private normalizeFormatIds(selected: readonly string[]): string[] {
    const available = new Set(this.formats().map((format) => format.id));
    const normalized: string[] = [];
    const seen = new Set<string>();

    for (const formatId of selected) {
      const trimmed = formatId.trim();
      if (!trimmed || seen.has(trimmed) || !available.has(trimmed)) {
        continue;
      }
      seen.add(trimmed);
      normalized.push(trimmed);
    }

    return normalized;
  }

  private applyResult(response: AppealGenerationResponse): void {
    this.resultState.set(response);
    const nextFormats: Record<string, string> = {};
    Object.entries(response.formats ?? {}).forEach(([formatId, payload]) => {
      nextFormats[formatId] = payload?.content ?? '';
    });
    this.editableFormatsState.set(nextFormats);
    this.setCopyStatus('idle');
  }

  private handleGenerateError(error: unknown): void {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 429) {
        this.limitReachedState.set(true);
        this.generationErrorState.set(null);
        return;
      }

      const detail = this.resolveDetailMessage(error.error);
      this.generationErrorState.set(
        detail ?? '実績出力の生成に失敗しました。時間をおいて再度お試しください。',
      );
      return;
    }

    if (error instanceof Error && error.message) {
      this.generationErrorState.set(error.message);
      return;
    }

    this.generationErrorState.set(
      '実績出力の生成に失敗しました。時間をおいて再度お試しください。',
    );
  }

  private extractErrorMessage(error: unknown): string | null {
    if (error instanceof HttpErrorResponse) {
      return this.resolveDetailMessage(error.error);
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    return null;
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

  private setCopyStatus(status: CopyStatus): void {
    this.copyStatusState.set(status);
    this.clearCopyTimer();

    if (status === 'idle') {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    this.copyStatusTimer = window.setTimeout(() => {
      this.copyStatusState.set('idle');
      this.copyStatusTimer = null;
    }, 3200);
  }

  private clearCopyTimer(): void {
    if (typeof window === 'undefined') {
      return;
    }

    if (this.copyStatusTimer !== null) {
      window.clearTimeout(this.copyStatusTimer);
      this.copyStatusTimer = null;
    }
  }
}
