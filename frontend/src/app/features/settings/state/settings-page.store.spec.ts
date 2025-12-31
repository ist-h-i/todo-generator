import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { WorkspaceSettings } from '@core/models';
import { WorkspaceStore } from '@core/state/workspace-store';

import { SettingsPageStore } from './settings-page.store';

describe('SettingsPageStore', () => {
  let store: SettingsPageStore;
  let workspaceStore: jasmine.SpyObj<WorkspaceStore> & { settings: ReturnType<typeof signal> };

  beforeEach(() => {
    const settings: WorkspaceSettings = {
      defaultStatusId: 'todo',
      defaultAssignee: '',
      timezone: '',
      statuses: [
        { id: 'todo', name: 'Todo', category: 'todo', order: 0, color: '#64748b' },
        { id: 'done', name: 'Done', category: 'done', order: 1, color: '#16a34a' },
      ],
      labels: [
        { id: 'label-1', name: 'Label One', color: '#38bdf8' },
        { id: 'label-2', name: 'Label Two', color: '#a855f7' },
      ],
      templates: [],
      storyPointScale: [],
    };

    workspaceStore = jasmine.createSpyObj<WorkspaceStore>('WorkspaceStore', [
      'refreshWorkspaceData',
      'addLabel',
      'addStatus',
      'addTemplate',
      'updateTemplate',
      'removeTemplate',
      'removeStatus',
      'removeLabel',
    ]) as jasmine.SpyObj<WorkspaceStore> & { settings: ReturnType<typeof signal> };
    workspaceStore.settings = signal(settings);
    workspaceStore.refreshWorkspaceData.and.resolveTo();
    workspaceStore.addLabel.and.resolveTo();
    workspaceStore.addStatus.and.resolveTo();
    workspaceStore.addTemplate.and.resolveTo();
    workspaceStore.updateTemplate.and.resolveTo();
    workspaceStore.removeTemplate.and.resolveTo();
    workspaceStore.removeStatus.and.resolveTo(null);
    workspaceStore.removeLabel.and.resolveTo(false);

    TestBed.configureTestingModule({
      providers: [SettingsPageStore, { provide: WorkspaceStore, useValue: workspaceStore }],
    });

    store = TestBed.inject(SettingsPageStore);
  });

  it('clamps confidence threshold updates to the valid range', () => {
    const control = store.templateForm.controls.confidenceThreshold;

    store.updateConfidenceThreshold(control, 140);
    expect(control.value()).toBe(100);

    store.updateConfidenceThreshold(control, -10);
    expect(control.value()).toBe(0);

    control.setValue(72);
    store.updateConfidenceThreshold(control, Number.NaN);
    expect(control.value()).toBe(72);
  });

  it('toggles label selections for new templates', () => {
    const control = store.templateForm.controls.defaultLabelIds;

    store.toggleCreateTemplateLabel('label-1', true);
    store.toggleCreateTemplateLabel('label-2', true);
    expect(control.value()).toEqual(['label-1', 'label-2']);

    store.toggleCreateTemplateLabel('label-1', false);
    expect(control.value()).toEqual(['label-2']);
  });

  it('submits template presets with normalized payloads', async () => {
    store.templateForm.controls.name.setValue('  Sprint Plan  ');
    store.templateForm.controls.description.setValue('  Kickoff checklist  ');
    store.templateForm.controls.defaultStatusId.setValue('done');
    store.templateForm.controls.defaultLabelIds.setValue(['label-1']);
    store.templateForm.controls.confidenceThreshold.setValue(140);
    store.templateForm.controls.showStoryPoints.setValue(false);
    store.templateForm.controls.showDueDate.setValue(true);
    store.templateForm.controls.showAssignee.setValue(false);
    store.templateForm.controls.showConfidence.setValue(true);

    const event = { preventDefault: jasmine.createSpy('preventDefault') } as SubmitEvent;
    await store.saveTemplatePreset(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(workspaceStore.addTemplate).toHaveBeenCalledWith({
      name: 'Sprint Plan',
      description: 'Kickoff checklist',
      defaultStatusId: 'done',
      defaultLabelIds: ['label-1'],
      confidenceThreshold: 100,
      fieldVisibility: {
        showStoryPoints: false,
        showDueDate: true,
        showAssignee: false,
        showConfidence: true,
      },
    });
  });

  it('prunes label selections when a label is removed', async () => {
    workspaceStore.removeLabel.and.resolveTo(true);
    store.templateForm.controls.defaultLabelIds.setValue(['label-1', 'label-2']);
    store.templateEditForm.controls.defaultLabelIds.setValue(['label-1']);

    await store.removeLabel('label-1');

    expect(workspaceStore.removeLabel).toHaveBeenCalledWith('label-1');
    expect(store.templateForm.controls.defaultLabelIds.value()).toEqual(['label-2']);
    expect(store.templateEditForm.controls.defaultLabelIds.value()).toEqual([]);
  });
});
