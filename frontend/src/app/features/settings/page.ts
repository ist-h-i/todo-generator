import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { WorkspaceStore } from '@core/state/workspace-store';
import { TemplatePreset } from '@core/models';
import { SignalControl, createSignalForm } from '@lib/forms/signal-forms';

/**
 * Settings page exposing workspace configuration controls.
 */
@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './page.html',
  styleUrl: './page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {
  private readonly workspace = inject(WorkspaceStore);

  public readonly settingsSignal = this.workspace.settings;
  public readonly labelsById = computed(() => {
    const map = new Map<string, string>();
    for (const label of this.settingsSignal().labels) {
      map.set(label.id, label.name);
    }
    return map;
  });
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
    confidenceThreshold: 0.6,
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
    confidenceThreshold: 0.6,
    showStoryPoints: true,
    showDueDate: false,
    showAssignee: true,
    showConfidence: true,
  });
  public readonly editingTemplateId = signal<string | null>(null);

  /**
   * Handles label form submission.
   *
   * @param event - Browser submit event.
   */
  public readonly saveLabel = (event: SubmitEvent): void => {
    event.preventDefault();
    const value = this.labelForm.value();
    if (value.name.trim().length === 0) {
      return;
    }
    this.workspace.addLabel({ name: value.name.trim(), color: value.color });
    this.labelForm.reset({ name: '', color: '#38bdf8' });
  };

  /**
   * Handles status form submission.
   *
   * @param event - Browser submit event.
   */
  public readonly saveStatus = (event: SubmitEvent): void => {
    event.preventDefault();
    const value = this.statusForm.value();
    if (value.name.trim().length === 0) {
      return;
    }
    this.workspace.addStatus({
      name: value.name.trim(),
      category: value.category,
      color: value.color,
    });
    this.statusForm.reset({ name: '', category: 'todo', color: '#64748b' });
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

    const normalized = Number.isFinite(value.confidenceThreshold) ? value.confidenceThreshold : 0.5;
    const threshold = Math.min(Math.max(normalized, 0), 1);
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
      confidenceThreshold: 0.6,
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
      confidenceThreshold: 0.6,
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
  public readonly updateTemplatePreset = (event: SubmitEvent): void => {
    event.preventDefault();
    const templateId = this.editingTemplateId();
    if (!templateId) {
      return;
    }

    const value = this.templateEditForm.value();
    if (value.name.trim().length === 0) {
      return;
    }

    const normalized = Number.isFinite(value.confidenceThreshold) ? value.confidenceThreshold : 0.5;
    const threshold = Math.min(Math.max(normalized, 0), 1);
    this.workspace.updateTemplate(templateId, {
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

    this.cancelTemplateEdit();
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
  public readonly removeTemplate = (templateId: string): void => {
    this.workspace.removeTemplate(templateId);
    if (this.editingTemplateId() === templateId) {
      this.cancelTemplateEdit();
    }
  };

  /**
   * Removes a status from the workspace configuration and updates dependent forms.
   *
   * @param statusId - Identifier of the status to remove.
   */
  public readonly removeStatus = (statusId: string): void => {
    const fallback = this.workspace.removeStatus(statusId);
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
  };

  /**
   * Removes a label from the workspace and prunes form selections.
   *
   * @param labelId - Identifier of the label to delete.
   */
  public readonly removeLabel = (labelId: string): void => {
    const removed = this.workspace.removeLabel(labelId);
    if (!removed) {
      return;
    }

    const pruneSelection = (control: SignalControl<readonly string[]>): void => {
      control.updateValue((current) => current.filter((id) => id !== labelId));
    };

    pruneSelection(this.templateForm.controls.defaultLabelIds);
    pruneSelection(this.templateEditForm.controls.defaultLabelIds);
  };
}
