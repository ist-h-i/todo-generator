import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { AdminApi } from './admin-api';
import { buildApiUrl } from './api.config';

describe('AdminApi', () => {
  let service: AdminApi;
  let httpMock: HttpTestingController;
  let baseUrl: string;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AdminApi],
    });

    service = TestBed.inject(AdminApi);
    httpMock = TestBed.inject(HttpTestingController);
    baseUrl = buildApiUrl('/');
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('maps each admin endpoint to the expected HTTP request', () => {
    service.listCompetencies().subscribe();
    httpMock.expectOne(`${baseUrl}admin/competencies`).flush([]);

    service.createCompetency({ name: 'AI literacy' } as never).subscribe();
    const createCompetency = httpMock.expectOne(`${baseUrl}admin/competencies`);
    expect(createCompetency.request.method).toBe('POST');
    createCompetency.flush({ id: 'competency-1' });

    service.updateCompetency('competency-1', { description: 'Updated' }).subscribe();
    const updateCompetency = httpMock.expectOne(`${baseUrl}admin/competencies/competency-1`);
    expect(updateCompetency.request.method).toBe('PATCH');
    updateCompetency.flush({ id: 'competency-1' });

    service.triggerEvaluation('competency-1', { user_id: 'user-1' } as never).subscribe();
    const triggerEvaluation = httpMock.expectOne(
      `${baseUrl}admin/competencies/competency-1/evaluate`,
    );
    expect(triggerEvaluation.request.method).toBe('POST');
    triggerEvaluation.flush({ id: 'evaluation-1' });

    service.listEvaluations().subscribe();
    httpMock.expectOne(`${baseUrl}admin/evaluations`).flush([]);

    service.listUsers().subscribe();
    httpMock.expectOne(`${baseUrl}admin/users`).flush([]);

    service.updateUser('user-1', { role: 'owner' } as never).subscribe();
    const updateUser = httpMock.expectOne(`${baseUrl}admin/users/user-1`);
    expect(updateUser.request.method).toBe('PATCH');
    updateUser.flush({ id: 'user-1' });

    service.deleteUser('user-1').subscribe();
    const deleteUser = httpMock.expectOne(`${baseUrl}admin/users/user-1`);
    expect(deleteUser.request.method).toBe('DELETE');
    deleteUser.flush(null);

    service.getApiCredential('openai').subscribe();
    httpMock.expectOne(`${baseUrl}admin/api-credentials/openai`).flush({ provider: 'openai' });

    service.listApiCredentialModels('openai').subscribe();
    httpMock.expectOne(`${baseUrl}admin/api-credentials/openai/models`).flush([]);

    service.upsertApiCredential('openai', { api_key: 'secret' } as never).subscribe();
    const upsertCredential = httpMock.expectOne(`${baseUrl}admin/api-credentials/openai`);
    expect(upsertCredential.request.method).toBe('PUT');
    upsertCredential.flush({ provider: 'openai' });

    service.getQuotaDefaults().subscribe();
    httpMock.expectOne(`${baseUrl}admin/quotas/defaults`).flush({ daily: 10 });

    service.updateQuotaDefaults({ daily: 20 } as never).subscribe();
    const updateQuotaDefaults = httpMock.expectOne(`${baseUrl}admin/quotas/defaults`);
    expect(updateQuotaDefaults.request.method).toBe('PUT');
    updateQuotaDefaults.flush({ daily: 20 });
  });
});
