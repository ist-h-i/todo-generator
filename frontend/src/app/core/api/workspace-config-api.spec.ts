import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { WorkspaceConfigApi } from './workspace-config-api';
import { buildApiUrl } from './api.config';

describe('WorkspaceConfigApi', () => {
  let service: WorkspaceConfigApi;
  let httpMock: HttpTestingController;
  let baseUrl: string;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [WorkspaceConfigApi],
    });

    service = TestBed.inject(WorkspaceConfigApi);
    httpMock = TestBed.inject(HttpTestingController);
    baseUrl = buildApiUrl('/');
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('manages statuses, labels and templates through dedicated endpoints', () => {
    service.listStatuses().subscribe();
    httpMock.expectOne(`${baseUrl}statuses`).flush([]);

    service.createStatus({ name: 'In Review' } as never).subscribe();
    const createStatus = httpMock.expectOne(`${baseUrl}statuses`);
    expect(createStatus.request.method).toBe('POST');
    createStatus.flush({ id: 'status-review' });

    service.updateStatus('status-review', { color: '#facc15' }).subscribe();
    const updateStatus = httpMock.expectOne(`${baseUrl}statuses/status-review`);
    expect(updateStatus.request.method).toBe('PUT');
    updateStatus.flush({ id: 'status-review' });

    service.deleteStatus('status-review').subscribe();
    const deleteStatus = httpMock.expectOne(`${baseUrl}statuses/status-review`);
    expect(deleteStatus.request.method).toBe('DELETE');
    deleteStatus.flush(null);

    service.listLabels().subscribe();
    httpMock.expectOne(`${baseUrl}labels`).flush([]);

    service.createLabel({ name: 'Ops', color: '#2563eb' } as never).subscribe();
    const createLabel = httpMock.expectOne(`${baseUrl}labels`);
    expect(createLabel.request.method).toBe('POST');
    createLabel.flush({ id: 'label-ops' });

    service.updateLabel('label-ops', { color: '#1d4ed8' }).subscribe();
    const updateLabel = httpMock.expectOne(`${baseUrl}labels/label-ops`);
    expect(updateLabel.request.method).toBe('PUT');
    updateLabel.flush({ id: 'label-ops' });

    service.deleteLabel('label-ops').subscribe();
    const deleteLabel = httpMock.expectOne(`${baseUrl}labels/label-ops`);
    expect(deleteLabel.request.method).toBe('DELETE');
    deleteLabel.flush(null);

    service.listTemplates().subscribe();
    httpMock.expectOne(`${baseUrl}workspace/templates`).flush([]);

    service.createTemplate({ name: 'Default' } as never).subscribe();
    const createTemplate = httpMock.expectOne(`${baseUrl}workspace/templates`);
    expect(createTemplate.request.method).toBe('POST');
    createTemplate.flush({ id: 'template-1' });

    service.updateTemplate('template-1', { description: 'Updated' }).subscribe();
    const updateTemplate = httpMock.expectOne(`${baseUrl}workspace/templates/template-1`);
    expect(updateTemplate.request.method).toBe('PATCH');
    updateTemplate.flush({ id: 'template-1' });

    service.deleteTemplate('template-1').subscribe();
    const deleteTemplate = httpMock.expectOne(`${baseUrl}workspace/templates/template-1`);
    expect(deleteTemplate.request.method).toBe('DELETE');
    deleteTemplate.flush(null);
  });
});
