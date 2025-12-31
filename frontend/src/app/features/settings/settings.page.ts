import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';

import { PageLayout } from '@shared/ui/page-layout/page-layout';
import { UiSelect } from '@shared/ui/select/ui-select';

import { SettingsPageStore } from './state/settings-page.store';

/**
 * ワークスペース設定を扱うページ。
 */
@Component({
  selector: 'app-settings-page',
  imports: [DecimalPipe, PageLayout, UiSelect],
  templateUrl: './settings.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [SettingsPageStore],
})
export class SettingsPage {
  private readonly store = inject(SettingsPageStore);

  public readonly settingsSignal = this.store.settingsSignal;
  public readonly labelsById = this.store.labelsById;
  public readonly statusesById = this.store.statusesById;
  public readonly statusSelectOptions = this.store.statusSelectOptions;
  public readonly statusCount = this.store.statusCount;

  public readonly labelForm = this.store.labelForm;
  public readonly statusForm = this.store.statusForm;
  public readonly templateForm = this.store.templateForm;
  public readonly templateEditForm = this.store.templateEditForm;
  public readonly editingTemplateId = this.store.editingTemplateId;

  public readonly updateConfidenceThreshold = this.store.updateConfidenceThreshold;
  public readonly saveLabel = this.store.saveLabel;
  public readonly saveStatus = this.store.saveStatus;
  public readonly saveTemplatePreset = this.store.saveTemplatePreset;
  public readonly openTemplateEditor = this.store.openTemplateEditor;
  public readonly cancelTemplateEdit = this.store.cancelTemplateEdit;
  public readonly updateTemplatePreset = this.store.updateTemplatePreset;
  public readonly toggleCreateTemplateLabel = this.store.toggleCreateTemplateLabel;
  public readonly toggleEditTemplateLabel = this.store.toggleEditTemplateLabel;
  public readonly setTemplateDefaultStatus = this.store.setTemplateDefaultStatus;
  public readonly setTemplateEditDefaultStatus = this.store.setTemplateEditDefaultStatus;
  public readonly removeTemplate = this.store.removeTemplate;
  public readonly removeStatus = this.store.removeStatus;
  public readonly removeLabel = this.store.removeLabel;

}
