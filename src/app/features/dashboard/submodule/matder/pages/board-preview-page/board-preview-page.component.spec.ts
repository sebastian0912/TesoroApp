import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { BoardPreviewPageComponent } from './board-preview-page.component';

describe('BoardPreviewPageComponent', () => {
  let component: BoardPreviewPageComponent;
  let fixture: ComponentFixture<BoardPreviewPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BoardPreviewPageComponent, HttpClientTestingModule, RouterTestingModule],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '1' } } } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BoardPreviewPageComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start in loading state', () => {
    expect(component.loading()).toBe(true);
  });

  it('should have null board initially', () => {
    expect(component.board()).toBeNull();
  });

  it('should have empty lists initially', () => {
    expect(component.lists()).toEqual([]);
  });

  it('getListIds() should return list id strings', () => {
    component.lists.set([
      { id: 1, uuid: '', board: 1, name: 'Todo', list_type: 'TODO', position: 0, cards: [], created_at: '', updated_at: '' },
      { id: 2, uuid: '', board: 1, name: 'Done', list_type: 'DONE', position: 1, cards: [], created_at: '', updated_at: '' },
    ]);
    expect(component.getListIds()).toEqual(['list-1', 'list-2']);
  });

  it('priorityColor() should return correct colors', () => {
    expect(component.priorityColor('LOW')).toBe('#22c55e');
    expect(component.priorityColor('HIGH')).toBe('#ef4444');
    expect(component.priorityColor('URGENT')).toBe('#7c3aed');
    expect(component.priorityColor('UNKNOWN')).toBe('#9e9e9e');
  });

  it('startAddCard() should set addingToListId', () => {
    component.startAddCard(5);
    expect(component.addingToListId).toBe(5);
    expect(component.newCardTitle).toBe('');
  });

  it('cancelAddCard() should reset addingToListId', () => {
    component.addingToListId = 5;
    component.cancelAddCard();
    expect(component.addingToListId).toBeNull();
  });
});
