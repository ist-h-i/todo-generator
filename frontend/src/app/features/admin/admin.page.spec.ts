import { TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { of } from 'rxjs';
import { RouterTestingModule } from '@angular/router/testing';

import { AdminApi } from '@core/api/admin-api';
import { Auth } from '@core/auth/auth';
import {
  AdminUser,
  ApiCredential,
  AuthenticatedUser,
  Competency,
  CompetencyInput,
  CompetencyEvaluation,
  CompetencyLevelDefinition,
  QuotaDefaults,
} from '@core/models';

import { AdminPage } from './admin.page';

class MockAdminApiService {
  private readonly emptyCompetency: Competency = {
    id: 'competency-001',
    name: 'Communication',
    level: 'junior',
    description: '',
    rubric: {},
    sort_order: 0,
    is_active: true,
    criteria: [],
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    level_definition: null,
  };
  public competencies: Competency[] = [];
  public users: AdminUser[] = [];
  public evaluations: CompetencyEvaluation[] = [];
  public competencyLevels: CompetencyLevelDefinition[] = [];
  public quotaDefaults: QuotaDefaults = {
    card_daily_limit: 3,
    evaluation_daily_limit: 3,
    analysis_daily_limit: 10,
    status_report_daily_limit: 5,
    immunity_map_daily_limit: 5,
    immunity_map_candidate_daily_limit: 10,
    appeal_daily_limit: 5,
    auto_card_daily_limit: 25,
  };
  public credential: ApiCredential = {
    provider: 'gemini',
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    model: 'models/gemini-2.5-flash',
    secret_hint: null,
  };
  public models: string[] = [];

  public readonly listCompetencies = jasmine
    .createSpy('listCompetencies')
    .and.callFake(() => of(this.competencies));

  public readonly listUsers = jasmine.createSpy('listUsers').and.callFake(() => of(this.users));

  public readonly listEvaluations = jasmine
    .createSpy('listEvaluations')
    .and.callFake(() => of(this.evaluations));

  public readonly listCompetencyLevels = jasmine
    .createSpy('listCompetencyLevels')
    .and.callFake(() => of(this.competencyLevels));

  public readonly getQuotaDefaults = jasmine
    .createSpy('getQuotaDefaults')
    .and.callFake(() => of(this.quotaDefaults));

  public readonly getApiCredential = jasmine
    .createSpy('getApiCredential')
    .and.callFake(() => of(this.credential));

  public readonly listApiCredentialModels = jasmine
    .createSpy('listApiCredentialModels')
    .and.callFake(() => of(this.models));

  public readonly createCompetency = jasmine
    .createSpy('createCompetency')
    .and.callFake((_payload: CompetencyInput) => of(this.emptyCompetency));

  public readonly updateCompetency = jasmine
    .createSpy('updateCompetency')
    .and.callFake((_id: string, _payload: Partial<CompetencyInput>) => of(this.emptyCompetency));

  public readonly deleteCompetency = jasmine
    .createSpy('deleteCompetency')
    .and.callFake((_id: string) => of(undefined));

  public readonly deleteUser = jasmine.createSpy('deleteUser').and.callFake(() => of(undefined));
}

class MockAuthService {
  private readonly userStore = signal<AuthenticatedUser | null>(null);

  public readonly user = computed(() => this.userStore());

  public setUser(user: AuthenticatedUser | null): void {
    this.userStore.set(user);
  }
}

describe('AdminPage', () => {
  let api: MockAdminApiService;
  let auth: MockAuthService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminPage, RouterTestingModule],
      providers: [
        { provide: AdminApi, useClass: MockAdminApiService },
        { provide: Auth, useClass: MockAuthService },
      ],
    }).compileComponents();

    api = TestBed.inject(AdminApi) as unknown as MockAdminApiService;
    auth = TestBed.inject(Auth) as unknown as MockAuthService;
  });

  it('does not delete the active administrator account', () => {
    const currentAdmin: AdminUser = {
      id: 'admin-001',
      email: 'admin@example.com',
      is_admin: true,
      is_active: true,
      card_daily_limit: null,
      evaluation_daily_limit: null,
      analysis_daily_limit: null,
      status_report_daily_limit: null,
      immunity_map_daily_limit: null,
      immunity_map_candidate_daily_limit: null,
      appeal_daily_limit: null,
      auto_card_daily_limit: null,
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
    };
    const authenticatedUser: AuthenticatedUser = {
      id: currentAdmin.id,
      email: currentAdmin.email,
      is_admin: true,
      created_at: currentAdmin.created_at,
      updated_at: currentAdmin.updated_at,
      nickname: null,
      experience_years: null,
      roles: [],
      bio: null,
      avatar_url: null,
    };

    api.users = [currentAdmin];
    auth.setUser(authenticatedUser);

    const fixture = TestBed.createComponent(AdminPage);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    spyOn(window, 'confirm');

    component.deleteUser(currentAdmin);

    expect(component.isCurrentUser(currentAdmin)).toBeTrue();
    expect(window.confirm).not.toHaveBeenCalled();
    expect(api.deleteUser).not.toHaveBeenCalled();
    expect(component.error()).toBe('自分のアカウントは削除できません…');
  });

  it('retains default competency levels when the API omits them', () => {
    api.competencyLevels = [
      {
        id: 'custom-senior',
        value: 'senior',
        label: '上級',
        scale: 7,
        description: null,
        sort_order: 2,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      },
    ];

    const fixture = TestBed.createComponent(AdminPage);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    const values = component.competencyLevels().map((level) => level.value);

    expect(values).toContain('junior');
    expect(values).toContain('intermediate');
    expect(values).toContain('senior');
  });

  it('updates an existing competency when editing', () => {
    const competency: Competency = {
      id: 'competency-123',
      name: 'Communication',
      level: 'junior',
      description: 'Old description',
      rubric: {},
      sort_order: 0,
      is_active: true,
      criteria: [
        {
          id: 'criterion-001',
          title: 'Clarity',
          description: 'Old',
          is_active: true,
          order_index: 0,
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
        },
      ],
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
      level_definition: null,
    };
    api.competencies = [competency];

    const updated: Competency = {
      ...competency,
      name: 'Updated communication',
      description: 'New description',
      updated_at: '2024-01-02T00:00:00.000Z',
    };
    api.updateCompetency.and.returnValue(of(updated));

    const fixture = TestBed.createComponent(AdminPage);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.editCompetency(competency);
    expect(component.editingCompetencyId()).toBe(competency.id);

    component.competencyForm.controls.name.setValue(updated.name);
    component.competencyForm.controls.description.setValue(updated.description ?? '');

    component.createCompetency();

    expect(api.updateCompetency).toHaveBeenCalled();
    expect(component.editingCompetencyId()).toBeNull();
    expect(component.competencies().find((item) => item.id === competency.id)?.name).toBe(
      updated.name,
    );
  });

  it('deletes a competency and cancels editing', () => {
    const competency: Competency = {
      id: 'competency-123',
      name: 'Communication',
      level: 'junior',
      description: 'Old description',
      rubric: {},
      sort_order: 0,
      is_active: true,
      criteria: [],
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
      level_definition: null,
    };
    api.competencies = [competency];

    const fixture = TestBed.createComponent(AdminPage);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.editCompetency(competency);
    expect(component.editingCompetencyId()).toBe(competency.id);

    spyOn(window, 'confirm').and.returnValue(true);
    api.deleteCompetency.and.returnValue(of(undefined));

    component.deleteCompetency(competency);

    expect(api.deleteCompetency).toHaveBeenCalledWith(competency.id);
    expect(component.competencies()).toEqual([]);
    expect(component.editingCompetencyId()).toBeNull();
  });
});
