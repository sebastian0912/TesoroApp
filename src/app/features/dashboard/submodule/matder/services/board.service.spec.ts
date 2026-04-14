import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { BoardService } from './board.service';
import { environment } from '@/environments/environment';

describe('BoardService', () => {
  let service: BoardService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiUrl}/matder`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(BoardService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('listBoards() should GET boards', async () => {
    const mock = [{ id: 1, name: 'Board A' }];
    const promise = service.listBoards();
    const req = httpMock.expectOne(`${base}/boards/`);
    expect(req.request.method).toBe('GET');
    req.flush(mock);
    const result = await promise;
    expect(result.length).toBe(1);
  });

  it('getBoard() should GET a single board', async () => {
    const mock = { id: 1, name: 'Board A' };
    const promise = service.getBoard(1);
    const req = httpMock.expectOne(`${base}/boards/1/`);
    expect(req.request.method).toBe('GET');
    req.flush(mock);
    const result = await promise;
    expect(result.name).toBe('Board A');
  });

  it('createBoard() should POST a board', async () => {
    const data = { workspace: 1, name: 'New Board' };
    const mock = { id: 2, ...data };
    const promise = service.createBoard(data);
    const req = httpMock.expectOne(`${base}/boards/`);
    expect(req.request.method).toBe('POST');
    req.flush(mock);
    const result = await promise;
    expect(result.name).toBe('New Board');
  });

  it('deleteBoard() should DELETE a board', async () => {
    const promise = service.deleteBoard(1);
    const req = httpMock.expectOne(`${base}/boards/1/`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    await promise;
  });

  it('getBoardLists() should GET lists for a board', async () => {
    const mock = [{ id: 1, name: 'Todo', cards: [] }];
    const promise = service.getBoardLists(1);
    const req = httpMock.expectOne(`${base}/boards/1/lists/`);
    expect(req.request.method).toBe('GET');
    req.flush(mock);
    const result = await promise;
    expect(result.length).toBe(1);
  });

  it('createCard() should POST a card to the correct list endpoint', async () => {
    const data = { board_list: 101, title: 'Fix bug', position: 0 };
    const mock = { id: 10, ...data };
    const promise = service.createCard(data);
    const req = httpMock.expectOne(`${base}/lists/101/cards/`);
    expect(req.request.method).toBe('POST');
    req.flush(mock);
    const result = await promise;
    expect(result.title).toBe('Fix bug');
  });

  it('moveCard() should PATCH card position with new field names', async () => {
    const mock = { id: 10, board_list: 2, position: 0 };
    const promise = service.moveCard(10, 2, 0);
    const req = httpMock.expectOne(`${base}/cards/10/move/`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ new_list_id: 2, new_position: 0 });
    req.flush(mock);
    await promise;
  });

  it('getCardDetail() should GET card detail', async () => {
    const mock = { id: 1, title: 'T', checklist_items: [], comments: [], card_labels: [], uploads: [] };
    const promise = service.getCardDetail(1);
    const req = httpMock.expectOne(`${base}/cards/1/detail/`);
    expect(req.request.method).toBe('GET');
    req.flush(mock);
    const result = await promise;
    expect(result.title).toBe('T');
  });

  it('createComment() should POST a comment', async () => {
    const mock = { id: 1, body: 'Hello' };
    const promise = service.createComment(5, 'Hello');
    const req = httpMock.expectOne(`${base}/cards/5/comments/`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ body: 'Hello' });
    req.flush(mock);
    await promise;
  });

  it('createChecklistItem() should POST a checklist item', async () => {
    const mock = { id: 1, content: 'Step 1', completed: false };
    const promise = service.createChecklistItem(5, 'Step 1');
    const req = httpMock.expectOne(`${base}/cards/5/checklist-items/`);
    expect(req.request.method).toBe('POST');
    req.flush(mock);
    await promise;
  });

  it('getCalendarCards() should GET assigned calendar cards', async () => {
    const mock = [{ id: 1, title: 'Task', due_at: '2026-05-01' }];
    const promise = service.getCalendarCards();
    const req = httpMock.expectOne(`${base}/cards/assigned/calendar/`);
    expect(req.request.method).toBe('GET');
    req.flush(mock);
    const result = await promise;
    expect(result.length).toBe(1);
  });
});
