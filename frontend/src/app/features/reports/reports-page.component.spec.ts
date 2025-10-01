import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { of } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

import { StatusReportsGateway } from '@core/api/status-reports-gateway';
import { Card, StatusReportProposalSubtask, WorkspaceSettings } from '@core/models';
import { WorkspaceStore } from '@core/state/workspace-store';

import { ReportAssistantPageComponent } from './reports-page.component';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

class StatusReportsGatewayStub {
  public readonly createReport = jasmine.createSpy('createReport').and.returnValue(of());
  public readonly submitReport = jasmine.createSpy('submitReport').and.returnValue(of());
}

class WorkspaceStoreStub {
  public readonly refreshWorkspaceData = jasmine.createSpy('refreshWorkspaceData');
  public settingsValue: WorkspaceSettings = {
    defaultStatusId: 'todo',
    defaultAssignee: '田中',
    timezone: 'UTC',
    statuses: [
      { id: 'todo', name: '未着手', category: 'todo', order: 1, color: '#1f2937' },
      { id: 'in-progress', name: '進行中', category: 'in-progress', order: 2, color: '#2563eb' },
      { id: 'done', name: '完了', category: 'done', order: 3, color: '#16a34a' },
    ],
    labels: [
      { id: 'label-backend', name: 'Backend', color: '#f97316' },
      { id: 'label-frontend', name: 'Frontend', color: '#3b82f6' },
    ],
    templates: [],
    storyPointScale: [],
  };

  public readonly settings = jasmine.createSpy('settings').and.callFake(() => this.settingsValue);

  public readonly createCardFromSuggestion = jasmine
    .createSpy('createCardFromSuggestion')
    .and.callFake(
      async (
        suggestion: Parameters<WorkspaceStore['createCardFromSuggestion']>[0],
      ): Promise<Card> =>
        ({
          id: 'card-1',
          title: suggestion.title,
          summary: suggestion.summary,
          statusId: suggestion.statusId ?? 'todo',
          labelIds: suggestion.labelIds ?? [],
          priority: suggestion.priority ?? 'medium',
          storyPoints: 3,
          createdAt: new Date().toISOString(),
          subtasks: suggestion.subtasks ?? [],
          comments: [],
          activities: [],
        }) as Card,
    );

  public readonly removeCard = jasmine.createSpy('removeCard');
}

describe('ReportAssistantPageComponent', () => {
  let fixture: ComponentFixture<ReportAssistantPageComponent>;
  let component: ReportAssistantPageComponent;
  let workspace: WorkspaceStoreStub;

  beforeEach(async () => {
    workspace = new WorkspaceStoreStub();

    await TestBed.configureTestingModule({
      imports: [ReportAssistantPageComponent, RouterTestingModule],
      providers: [
        { provide: StatusReportsGateway, useClass: StatusReportsGatewayStub },
        { provide: WorkspaceStore, useValue: workspace },
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({}),
            queryParams: of({}),
            data: of({}),
            snapshot: { params: {}, queryParams: {}, data: {} },
          },
        },
        FormBuilder,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReportAssistantPageComponent);
    component = fixture.componentInstance;
  });

  const access = <T>(instance: ReportAssistantPageComponent, key: string): T =>
    (instance as unknown as Record<string, T>)[key];

  it('normalizes proposal statuses for display', () => {
    expect(component.formatProposalStatus('in-progress')).toBe('進行中');
    expect(component.formatProposalStatus(' 完了 ')).toBe('完了');
    expect(component.formatProposalStatus('未知のステータス')).toBe('未設定');
    expect(component.formatProposalStatus(null)).toBe('未設定');
  });

  it('resolves the canonical status identifier from analyzer output', () => {
    const settings = workspace.settingsValue;
    const resolveStatusId = access<
      (status: string | null | undefined, settings: WorkspaceSettings) => string | undefined
    >(component, 'resolveStatusId');

    expect(resolveStatusId('進行中', settings)).toBe('in-progress');
    expect(resolveStatusId(' IN-PROGRESS ', settings)).toBe('in-progress');
    expect(resolveStatusId('done', settings)).toBe('done');
    expect(resolveStatusId('unknown', settings)).toBeUndefined();
    expect(resolveStatusId('', settings)).toBeUndefined();
  });

  it('maps analyzer label suggestions to workspace identifiers', () => {
    const settings = workspace.settingsValue;
    const resolveLabelIds = access<
      (
        labels: readonly string[] | undefined,
        settings: WorkspaceSettings,
      ) => readonly string[] | undefined
    >(component, 'resolveLabelIds');

    expect(resolveLabelIds(undefined, settings)).toBeUndefined();
    expect(resolveLabelIds([], settings)).toBeUndefined();
    expect(resolveLabelIds(['backend', 'Frontend', 'unknown'], settings)).toEqual([
      'label-backend',
      'label-frontend',
    ]);
  });

  it('maps proposal subtasks into card subtasks while filtering empty entries', () => {
    const mapSubtasks = access<
      (
        subtasks: readonly StatusReportProposalSubtask[] | undefined,
      ) => readonly { title: string; status: string }[] | undefined
    >(component, 'mapSubtasks');

    const subtasks: Mutable<StatusReportProposalSubtask>[] = [
      { title: '調査', description: '原因を分析する', status: 'completed' },
      { title: '  ', description: ' ', status: 'todo' },
      { title: '', description: 'リファクタリング', status: 'non-issue' },
    ];

    const mapped = mapSubtasks(subtasks);
    expect(mapped).toBeDefined();
    expect(mapped?.length).toBe(2);
    expect(mapped?.[0]?.title).toBe('調査 — 原因を分析する');
    expect(mapped?.[0]?.status).toBe('done');
    expect(mapped?.[1]?.title).toBe('リファクタリング');
    expect(mapped?.[1]?.status).toBe('non-issue');
  });

  it('builds subtask payloads from editable proposal forms', () => {
    const buildSubtaskPayloads = access<
      (
        subtasks: readonly {
          title?: string | null;
          description?: string | null;
          status?: string | null;
        }[],
      ) => readonly StatusReportProposalSubtask[]
    >(component, 'buildSubtaskPayloads');

    const payloads = buildSubtaskPayloads([
      { title: 'レビュー', description: 'PR を確認', status: 'done ' },
      { title: '  ', description: '追加調査', status: null },
      { title: '   ', description: '   ' },
    ]);

    expect(payloads).toEqual([
      { title: 'レビュー', description: 'PR を確認', status: 'done' },
      { title: '追加調査', description: '追加調査', status: undefined },
    ]);
  });

  it('normalizes analyzer priorities into card priorities', () => {
    const resolvePriority = access<(priority: string | null | undefined) => Card['priority']>(
      component,
      'resolvePriority',
    );

    expect(resolvePriority(' CRITICAL ')).toBe('urgent');
    expect(resolvePriority('minor')).toBe('low');
    expect(resolvePriority('')).toBe('medium');
    expect(resolvePriority(undefined)).toBe('medium');
  });
});
