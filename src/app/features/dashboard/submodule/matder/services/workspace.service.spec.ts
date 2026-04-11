import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { WorkspaceService } from './workspace.service';
import { environment } from '@/environments/environment';

describe('WorkspaceService', () => {
  let service: WorkspaceService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiUrl}/matder/workspaces`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(WorkspaceService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('list() should GET workspaces', async () => {
    const mock = [{ id: 1, name: 'WS1' }];
    const promise = service.list();
    const req = httpMock.expectOne(`${base}/`);
    expect(req.request.method).toBe('GET');
    req.flush(mock);
    const result = await promise;
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('WS1');
  });

  it('get() should GET a single workspace', async () => {
    const mock = { id: 1, name: 'WS1' };
    const promise = service.get(1);
    const req = httpMock.expectOne(`${base}/1/`);
    expect(req.request.method).toBe('GET');
    req.flush(mock);
    const result = await promise;
    expect(result.id).toBe(1);
  });

  it('create() should POST a workspace', async () => {
    const data = { name: 'New WS', description: 'Test' };
    const mock = { id: 2, ...data };
    const promise = service.create(data);
    const req = httpMock.expectOne(`${base}/`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(data);
    req.flush(mock);
    const result = await promise;
    expect(result.name).toBe('New WS');
  });

  it('delete() should DELETE a workspace', async () => {
    const promise = service.delete(1);
    const req = httpMock.expectOne(`${base}/1/`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    await promise;
  });

  it('listMembers() should GET members', async () => {
    const mock = [{ id: 1, role: 'OWNER' }];
    const promise = service.listMembers(5);
    const req = httpMock.expectOne(`${base}/5/members/`);
    expect(req.request.method).toBe('GET');
    req.flush(mock);
    const result = await promise;
    expect(result.length).toBe(1);
  });

  it('addMember() should POST a member', async () => {
    const mock = { id: 10, role: 'MEMBER' };
    const promise = service.addMember(5, '42', 'MEMBER');
    const req = httpMock.expectOne(`${base}/5/members/`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ user: '42', role: 'MEMBER' });
    req.flush(mock);
    const result = await promise;
    expect(result.role).toBe('MEMBER');
  });

  it('updateMember() should PATCH a member', async () => {
    const mock = { id: 10, role: 'MANAGER', active: true };
    const promise = service.updateMember(5, 10, { role: 'MANAGER' });
    const req = httpMock.expectOne(`${base}/5/members/10/`);
    expect(req.request.method).toBe('PATCH');
    req.flush(mock);
    const result = await promise;
    expect(result.role).toBe('MANAGER');
  });
});
