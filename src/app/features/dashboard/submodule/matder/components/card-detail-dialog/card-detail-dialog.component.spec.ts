import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CardDetailDialogComponent } from './card-detail-dialog.component';

describe('CardDetailDialogComponent', () => {
  let component: CardDetailDialogComponent;
  let fixture: ComponentFixture<CardDetailDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CardDetailDialogComponent, HttpClientTestingModule],
      providers: [
        { provide: MatDialogRef, useValue: { close: jasmine.createSpy('close') } },
        { provide: MAT_DIALOG_DATA, useValue: { cardId: 1 } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CardDetailDialogComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start in loading state', () => {
    expect(component.loading()).toBe(true);
  });

  it('should have null card initially', () => {
    expect(component.card()).toBeNull();
  });

  it('should receive cardId from dialog data', () => {
    expect(component.data.cardId).toBe(1);
  });

  it('should have status options', () => {
    expect(component.statuses).toEqual(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE']);
  });

  it('should have priority options', () => {
    expect(component.priorities).toEqual(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
  });

  it('priorityColor() should return correct colors', () => {
    expect(component.priorityColor('LOW')).toBe('#22c55e');
    expect(component.priorityColor('MEDIUM')).toBe('#f59e0b');
    expect(component.priorityColor('HIGH')).toBe('#ef4444');
    expect(component.priorityColor('URGENT')).toBe('#7c3aed');
  });

  it('close() should close dialog with changed state', () => {
    component.changed = true;
    component.close();
    expect(component.dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('close() should close dialog with false when unchanged', () => {
    component.changed = false;
    component.close();
    expect(component.dialogRef.close).toHaveBeenCalledWith(false);
  });
});
