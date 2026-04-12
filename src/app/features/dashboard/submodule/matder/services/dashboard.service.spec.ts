import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { MatderDashboardService } from './dashboard.service';
import { environment } from '@/environments/environment';

describe('MatderDashboardService', () => {
  let service: MatderDashboardService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiUrl}/matder`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(MatderDashboardService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getOverview() should GET dashboard overview', async () => {
    const mock = { total_workspaces: 3, total_boards: 5, total_tasks: 42, completion_rate: 60, workspace_indicators: [], board_indicators: [] };
    const promise = service.getOverview();
    const req = httpMock.expectOne(`${base}/dashboard/overview/`);
    expect(req.request.method).toBe('GET');
    req.flush(mock);
    const result = await promise;
    expect(result.total_workspaces).toBe(3);
    expect(result.total_tasks).toBe(42);
  });

  it('getNotifications() should GET notifications', async () => {
    const mock = [{ id: 1, title: 'New task', read: false }];
    const promise = service.getNotifications();
    const req = httpMock.expectOne(`${base}/notifications/`);
    expect(req.request.method).toBe('GET');
    req.flush(mock);
    const result = await promise;
    expect(result.length).toBe(1);
  });

  it('getUnreadCount() should GET unread count', async () => {
    const mock = { count: 5 };
    const promise = service.getUnreadCount();
    const req = httpMock.expectOne(`${base}/notifications/unread-count/`);
    expect(req.request.method).toBe('GET');
    req.flush(mock);
    const result = await promise;
    expect(result.count).toBe(5);
  });

  it('markRead() should PATCH notification', async () => {
    const promise = service.markRead(1);
    const req = httpMock.expectOne(`${base}/notifications/1/read/`);
    expect(req.request.method).toBe('PATCH');
    req.flush({});
    await promise;
  });

  it('markAllRead() should PATCH read-all', async () => {
    const promise = service.markAllRead();
    const req = httpMock.expectOne(`${base}/notifications/read-all/`);
    expect(req.request.method).toBe('PATCH');
    req.flush({ marked: 5 });
    await promise;
  });

  it('getGroups() should GET groups', async () => {
    const mock = [{ id: 1, name: 'Devs', member_count: 3 }];
    const promise = service.getGroups();
    const req = httpMock.expectOne(`${base}/groups/`);
    expect(req.request.method).toBe('GET');
    req.flush(mock);
    const result = await promise;
    expect(result[0].name).toBe('Devs');
  });

  it('createGroup() should POST a group', async () => {
    const data = { name: 'QA Team' };
    const mock = { id: 2, ...data, member_count: 0 };
    const promise = service.createGroup(data);
    const req = httpMock.expectOne(`${base}/groups/`);
    expect(req.request.method).toBe('POST');
    req.flush(mock);
    const result = await promise;
    expect(result.name).toBe('QA Team');
  });

  it('getAuditLogs() should GET audit logs', async () => {
    const mock = [{ id: 1, action: 'BOARD_CREATED', entity_type: 'Board' }];
    const promise = service.getAuditLogs();
    const req = httpMock.expectOne(`${base}/audit/`);
    expect(req.request.method).toBe('GET');
    req.flush(mock);
    const result = await promise;
    expect(result.length).toBe(1);
  });

  it('getImportLogs() should GET import logs', async () => {
    const mock = [{ id: 1, file_name: 'data.xlsx', status: 'COMPLETED' }];
    const promise = service.getImportLogs();
    const req = httpMock.expectOne(`${base}/import/`);
    expect(req.request.method).toBe('GET');
    req.flush(mock);
    const result = await promise;
    expect(result[0].status).toBe('COMPLETED');
  });
});
