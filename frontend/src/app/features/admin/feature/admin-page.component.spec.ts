import { TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { of } from 'rxjs';

import { AdminApiService } from '@core/api/admin-api.service';
import { AuthService } from '@core/auth/auth.service';
import {
  AdminUser,
  ApiCredential,
  AuthenticatedUser,
  Competency,
  CompetencyEvaluation,
  CompetencyLevelDefinition,
  QuotaDefaults,
} from '@core/models';

import { AdminPageComponent } from './admin-page.component';

class MockAdminApiService {
  public competencies: Competency[] = [];
  public users: AdminUser[] = [];
  public evaluations: CompetencyEvaluation[] = [];
  public competencyLevels: CompetencyLevelDefinition[] = [];
  public quotaDefaults: QuotaDefaults = {
    card_daily_limit: 3,
    evaluation_daily_limit: 3,
  };
  public credential: ApiCredential = {
    provider: 'gemini',
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    model: 'models/gemini-2.0-flash',
    secret_hint: null,
  };

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

  public readonly deleteUser = jasmine.createSpy('deleteUser').and.callFake(() => of(undefined));
}

class MockAuthService {
  private readonly userStore = signal<AuthenticatedUser | null>(null);

  public readonly user = computed(() => this.userStore());

  public setUser(user: AuthenticatedUser | null): void {
    this.userStore.set(user);
  }
}

describe('AdminPageComponent', () => {
  let api: MockAdminApiService;
  let auth: MockAuthService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminPageComponent],
      providers: [
        { provide: AdminApiService, useClass: MockAdminApiService },
        { provide: AuthService, useClass: MockAuthService },
      ],
    }).compileComponents();

    api = TestBed.inject(AdminApiService) as unknown as MockAdminApiService;
    auth = TestBed.inject(AuthService) as unknown as MockAuthService;
  });

  it('does not delete the active administrator account', () => {
    const currentAdmin: AdminUser = {
      id: 'admin-001',
      email: 'admin@example.com',
      is_admin: true,
      is_active: true,
      card_daily_limit: null,
      evaluation_daily_limit: null,
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

    const fixture = TestBed.createComponent(AdminPageComponent);
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

    const fixture = TestBed.createComponent(AdminPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    const values = component.competencyLevels().map((level) => level.value);

    expect(values).toContain('junior');
    expect(values).toContain('intermediate');
    expect(values).toContain('senior');
  });
});
