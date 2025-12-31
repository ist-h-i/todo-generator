import { Injectable, computed, inject, signal } from '@angular/core';

import { TemplatePreset } from '@core/models';
import { WorkspaceStore } from '@core/state/workspace-store';
import { SignalControl, createSignalForm } from '@shared/forms/signal-forms';

type LabelFormState = {
  name: string;
  color: string;
};

type StatusFormState = {
  name: string;
  category: 'todo' | 'in-progress' | 'done';
  color: string;
};

type TemplateFormState = {
  name: string;
  description: string;
  defaultStatusId: string;
  defaultLabelIds: readonly string[];
  confidenceThreshold: number;
  showStoryPoints: boolean;
  showDueDate: boolean;
  showAssignee: boolean;
  showConfidence: boolean;
};

const DEFAULT_LABEL_FORM: LabelFormState = {
  name: '',
  color: '#38bdf8',
};

const DEFAULT_STATUS_FORM: StatusFormState = {
  name: '',
  category: 'todo',
  color: '#64748b',
};

const buildTemplateDefaults = (): TemplateFormState => ({
  name: '',
  description: '',
  defaultStatusId: 'todo',
  defaultLabelIds: [],
  confidenceThreshold: 60,
  showStoryPoints: true,
  showDueDate: false,
  showAssignee: true,
  showConfidence: true,
});

const clampPercent = (value: number): number => Math.min(Math.max(value, 0), 100);

/**
 * Settings page facade that manages workspace configuration state.
 */
@Injectable()
export class SettingsPageStore {
  private readonly workspace = inject(WorkspaceStore);

  public readonly settingsSignal = this.workspace.settings;
  public readonly labelsById = computed(() => {
    const map = new Map<string, string>();
    for (const label of this.settingsSignal().labels) {
      map.set(label.id, label.name);
    }
    return map;
  });
  public readonly statusesById = computed(() => {
    const map = new Map<string, string>();
    for (const status of this.settingsSignal().statuses) {
      map.set(status.id, status.name);
    }
    return map;
  });
  public readonly statusSelectOptions = computed(() =>
    this.settingsSignal().statuses.map((status) => ({
      value: status.id,
      label: status.name,
    })),
  );
  public readonly statusCount = computed(() => this.settingsSignal().statuses.length);

  public readonly labelForm = createSignalForm(DEFAULT_LABEL_FORM);
  public readonly statusForm = createSignalForm(DEFAULT_STATUS_FORM);
  public readonly templateForm = createSignalForm(buildTemplateDefaults());
  public readonly templateEditForm = createSignalForm(buildTemplateDefaults());
  public readonly editingTemplateId = signal<string | null>(null);

  public constructor() {
    void this.workspace.refreshWorkspaceData();
  }

  public readonly updateConfidenceThreshold = (
    control: SignalControl<number>,
    percentValue: number,
  ): void => {
    const normalized = Number.isFinite(percentValue) ? percentValue : control.value();
    control.setValue(clampPercent(normalized));
  };

  public readonly saveLabel = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();
    const value = this.labelForm.value();
    const name = value.name.trim();
    if (name.length === 0) {
      return;
    }
    try {
      await this.workspace.addLabel({ name, color: value.color });
      this.labelForm.reset(DEFAULT_LABEL_FORM);
    } catch (error) {
      console.error(error);
    }
  };

  public readonly saveStatus = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();
    const value = this.statusForm.value();
    const name = value.name.trim();
    if (name.length === 0) {
      return;
    }
    try {
      await this.workspace.addStatus({
        name,
        category: value.category,
        color: value.color,
      });
      this.statusForm.reset(DEFAULT_STATUS_FORM);
    } catch (error) {
      console.error(error);
    }
  };

  public readonly saveTemplatePreset = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();
    const value = this.templateForm.value();
    if (value.name.trim().length === 0) {
      return;
    }

    try {
      await this.workspace.addTemplate(this.buildTemplatePayload(value));
      this.templateForm.reset(buildTemplateDefaults());
    } catch (error) {
      console.error(error);
    }
  };

  public readonly openTemplateEditor = (template: TemplatePreset): void => {
    this.editingTemplateId.set(template.id);
    this.templateEditForm.reset({
      name: template.name,
      description: template.description,
      defaultStatusId: template.defaultStatusId,
      defaultLabelIds: template.defaultLabelIds,
      confidenceThreshold: template.confidenceThreshold,
      showStoryPoints: template.fieldVisibility.showStoryPoints,
      showDueDate: template.fieldVisibility.showDueDate,
      showAssignee: template.fieldVisibility.showAssignee,
      showConfidence: template.fieldVisibility.showConfidence,
    });
  };

  public readonly cancelTemplateEdit = (): void => {
    this.editingTemplateId.set(null);
    this.templateEditForm.reset(buildTemplateDefaults());
  };

  public readonly updateTemplatePreset = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();
    const templateId = this.editingTemplateId();
    if (!templateId) {
      return;
    }

    const value = this.templateEditForm.value();
    const name = value.name.trim();
    if (name.length === 0) {
      return;
    }

    try {
      await this.workspace.updateTemplate(templateId, this.buildTemplatePayload(value));
      this.cancelTemplateEdit();
    } catch (error) {
      console.error(error);
    }
  };

  public readonly toggleCreateTemplateLabel = (labelId: string, checked: boolean): void => {
    this.updateDefaultLabelSelection(this.templateForm.controls.defaultLabelIds, labelId, checked);
  };

  public readonly toggleEditTemplateLabel = (labelId: string, checked: boolean): void => {
    this.updateDefaultLabelSelection(
      this.templateEditForm.controls.defaultLabelIds,
      labelId,
      checked,
    );
  };

  public readonly setTemplateDefaultStatus = (value: string | string[] | null): void => {
    if (typeof value !== 'string') {
      return;
    }
    this.templateForm.controls.defaultStatusId.setValue(value);
  };

  public readonly setTemplateEditDefaultStatus = (value: string | string[] | null): void => {
    if (typeof value !== 'string') {
      return;
    }
    this.templateEditForm.controls.defaultStatusId.setValue(value);
  };

  public readonly removeTemplate = async (templateId: string): Promise<void> => {
    const template = this.settingsSignal().templates.find((entry) => entry.id === templateId);
    if (!template || template.isSystemDefault) {
      return;
    }

    try {
      await this.workspace.removeTemplate(templateId);
      if (this.editingTemplateId() === templateId) {
        this.cancelTemplateEdit();
      }
    } catch (error) {
      console.error(error);
    }
  };

  public readonly removeStatus = async (statusId: string): Promise<void> => {
    try {
      const fallback = await this.workspace.removeStatus(statusId);
      if (!fallback) {
        return;
      }

      const statuses = this.settingsSignal().statuses;
      const fallbackId =
        statuses.find((status) => status.id === fallback)?.id ?? statuses[0]?.id ?? fallback;

      const ensureValidStatus = (control: SignalControl<string>): void => {
        if (!statuses.some((status) => status.id === control.value())) {
          control.setValue(fallbackId);
        }
      };

      ensureValidStatus(this.templateForm.controls.defaultStatusId);
      ensureValidStatus(this.templateEditForm.controls.defaultStatusId);
    } catch (error) {
      console.error(error);
    }
  };

  public readonly removeLabel = async (labelId: string): Promise<void> => {
    try {
      const removed = await this.workspace.removeLabel(labelId);
      if (!removed) {
        return;
      }

      const pruneSelection = (control: SignalControl<readonly string[]>): void => {
        control.updateValue((current) => current.filter((id) => id !== labelId));
      };

      pruneSelection(this.templateForm.controls.defaultLabelIds);
      pruneSelection(this.templateEditForm.controls.defaultLabelIds);
    } catch (error) {
      console.error(error);
    }
  };

  private updateDefaultLabelSelection(
    control: SignalControl<readonly string[]>,
    labelId: string,
    checked: boolean,
  ): void {
    control.updateValue((current) => {
      const selection = new Set(current);
      if (checked) {
        selection.add(labelId);
      } else {
        selection.delete(labelId);
      }
      return Array.from(selection);
    });
  }

  private buildTemplatePayload(value: TemplateFormState): {
    name: string;
    description: string;
    defaultStatusId: string;
    defaultLabelIds: readonly string[];
    confidenceThreshold: number;
    fieldVisibility: TemplatePreset['fieldVisibility'];
  } {
    const normalized = Number.isFinite(value.confidenceThreshold)
      ? value.confidenceThreshold
      : 60;
    const threshold = clampPercent(normalized);

    return {
      name: value.name.trim(),
      description: value.description.trim(),
      defaultStatusId: value.defaultStatusId,
      defaultLabelIds: value.defaultLabelIds,
      confidenceThreshold: threshold,
      fieldVisibility: {
        showStoryPoints: value.showStoryPoints,
        showDueDate: value.showDueDate,
        showAssignee: value.showAssignee,
        showConfidence: value.showConfidence,
      },
    };
  }
}
