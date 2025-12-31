import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';

import { AppealsApi } from '@core/api/appeals-api';
import {
  AppealConfigResponse,
  AppealGenerationRequest,
  AppealGenerationResponse,
} from '@core/models';

import { AchievementOutputPage } from './achievement-output.page';

class AppealsApiStub {
  public config: AppealConfigResponse = {
    labels: [
      {
        id: 'label-1',
        name: 'Sales',
        color: '#1f2937',
        description: 'Sales wins',
        achievements: [{ id: 'ach-1', title: 'Closed deal', summary: 'Enterprise' }],
      },
    ],
    recommended_flow: ['challenge', 'action', 'result', 'reflection'],
    formats: [
      { id: 'markdown', name: 'Markdown', description: 'Rich text', editor_mode: 'markdown' },
      { id: 'table', name: 'CSV', description: 'Table', editor_mode: 'csv' },
      { id: 'bullet_list', name: 'Bullets', description: 'Bullets', editor_mode: 'markdown' },
    ],
  };

  public generateResponse: AppealGenerationResponse = {
    generation_id: 'gen-1',
    subject_echo: 'Sales',
    flow: ['challenge', 'action'],
    warnings: [],
    formats: {
      markdown: { content: 'Output', tokens_used: 12 },
    },
  };

  public readonly getConfig = jasmine.createSpy('getConfig').and.callFake(() => of(this.config));
  public readonly generate = jasmine
    .createSpy('generate')
    .and.callFake((_payload: AppealGenerationRequest) => of(this.generateResponse));
}

describe('AchievementOutputPage', () => {
  let fixture: ComponentFixture<AchievementOutputPage>;
  let component: AchievementOutputPage;
  let api: AppealsApiStub;

  beforeEach(async () => {
    api = new AppealsApiStub();

    await TestBed.configureTestingModule({
      imports: [AchievementOutputPage],
      providers: [{ provide: AppealsApi, useValue: api }],
    }).compileComponents();

    fixture = TestBed.createComponent(AchievementOutputPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  const access = <T>(instance: AchievementOutputPage, key: string): T =>
    (instance as unknown as Record<string, T>)[key];

  it('initializes form defaults from config', () => {
    expect(component.form.controls.subjectType.value()).toBe('label');
    expect(component.form.controls.subjectLabelId.value()).toBe('label-1');
    expect(component.form.controls.flow.value()).toEqual(['challenge', 'action', 'result', 'reflection']);
    expect(component.form.controls.formats.value()).toEqual(['markdown', 'table', 'bullet_list']);
  });

  it('builds normalized request payloads', () => {
    component.form.patchValue({
      subjectType: 'custom',
      subjectCustom: '  Onboarding  ',
      flow: ['Step 1', 'Step 1', ' ', 'Step 2', 'Step 3', 'Step 4', 'Step 5', 'Step 6'],
      formats: ['table', 'markdown', 'table', 'unknown'],
    });

    const buildRequestPayload = access<() => AppealGenerationRequest | null>(
      component,
      'buildRequestPayload',
    );
    const payload = buildRequestPayload();

    expect(payload).toEqual({
      subject: { type: 'custom', value: 'Onboarding' },
      flow: ['Step 1', 'Step 2', 'Step 3', 'Step 4', 'Step 5'],
      formats: ['table', 'markdown'],
    });
  });

  it('flags rate limit errors on generation', async () => {
    api.generate.and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 429,
            statusText: 'Too Many Requests',
            error: { detail: 'limit reached' },
          }),
      ),
    );

    const event = { preventDefault: jasmine.createSpy('preventDefault') } as unknown as SubmitEvent;
    await component.submit(event);

    expect(component.limitReached()).toBeTrue();
    expect(component.generationError()).toBeNull();
  });
});
