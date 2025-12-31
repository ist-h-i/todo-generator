import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { WorkspaceStore } from '@core/state/workspace-store';
import { TemplatePreset } from '@core/models';
import { SignalControl, createSignalForm } from '@shared/forms/signal-forms';
import { PageLayout } from '@shared/ui/page-layout/page-layout';
import { UiSelect } from '@shared/ui/select/ui-select';

/**
 * Settings page exposing workspace configuration controls.
 */
@Component({
  selector: 'app-settings-page',
  imports: [CommonModule, FormsModule, PageLayout, UiSelect],
  templateUrl: './settings.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {
  private readonly workspace = inject(WorkspaceStore);

  public constructor() {
    void this.workspace.refreshWorkspaceData();
  }

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

  public readonly labelForm = createSignalForm({ name: '', color: '#38bdf8' });
  public readonly statusForm = createSignalForm({
    name: '',
    category: 'todo' as 'todo' | 'in-progress' | 'done',
    color: '#64748b',
  });
  public readonly templateForm = createSignalForm({
    name: '',
    description: '',
    defaultStatusId: 'todo',
    defaultLabelIds: [] as readonly string[],
    confidenceThreshold: 60,
    showStoryPoints: true,
    showDueDate: false,
    showAssignee: true,
    showConfidence: true,
  });
  public readonly templateEditForm = createSignalForm({
    name: '',
    description: '',
    defaultStatusId: 'todo',
    defaultLabelIds: [] as readonly string[],
    confidenceThreshold: 60,
    showStoryPoints: true,
    showDueDate: false,
    showAssignee: true,
    showConfidence: true,
  });
  public readonly editingTemplateId = signal<string | null>(null);

  public readonly updateConfidenceThreshold = (
    control: SignalControl<number>,
    percentValue: number,
  ): void => {
    const normalized = Number.isFinite(percentValue) ? percentValue : control.value();
    const clamped = Math.min(Math.max(normalized, 0), 100);
    control.setValue(clamped);
  };

  /**
   * Handles label form submission.
   *
   * @param event - Browser submit event.
   */
  public readonly saveLabel = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();
    const value = this.labelForm.value();
    const name = value.name.trim();
    if (name.length === 0) {
      return;
    }
    try {
      await this.workspace.addLabel({ name, color: value.color });
      this.labelForm.reset({ name: '', color: '#38bdf8' });
    } catch (error) {
      console.error(error);
    }
  };

  /**
   * Handles status form submission.
   *
   * @param event - Browser submit event.
   */
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
      this.statusForm.reset({ name: '', category: 'todo', color: '#64748b' });
    } catch (error) {
      console.error(error);
    }
  };

  /**
   * Persists a newly defined template into the workspace store.
   *
   * @param event - Browser submit event.
   */
  public readonly saveTemplatePreset = (event: SubmitEvent): void => {
    event.preventDefault();
    const value = this.templateForm.value();
    if (value.name.trim().length === 0) {
      return;
    }

    const normalized = Number.isFinite(value.confidenceThreshold) ? value.confidenceThreshold : 60;
    const threshold = Math.min(Math.max(normalized, 0), 100);
    this.workspace.addTemplate({
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
    });

    this.templateForm.reset({
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
  };

  /**
   * Opens the inline editor for the provided template preset.
   *
   * @param template - Template currently being edited.
   */
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

  /**
   * Closes the template editor without applying changes.
   */
  public readonly cancelTemplateEdit = (): void => {
    this.editingTemplateId.set(null);
    this.templateEditForm.reset({
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
  };

  /**
   * Applies template updates captured by the inline editor.
   *
   * @param event - Browser submit event.
   */
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

    const normalized = Number.isFinite(value.confidenceThreshold) ? value.confidenceThreshold : 60;
    const threshold = Math.min(Math.max(normalized, 0), 100);
    try {
      await this.workspace.updateTemplate(templateId, {
        name,
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
      });
      this.cancelTemplateEdit();
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

  /**
   * Removes a template from the configuration list.
   *
   * @param templateId - Identifier of the template to remove.
   */
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

  /**
   * Removes a status from the workspace configuration and updates dependent forms.
   *
   * @param statusId - Identifier of the status to remove.
   */
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

  /**
   * Removes a label from the workspace and prunes form selections.
   *
   * @param labelId - Identifier of the label to delete.
   */
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
}
