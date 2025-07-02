import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrdenUnionDialogComponent } from './orden-union-dialog.component';

describe('OrdenUnionDialogComponent', () => {
  let component: OrdenUnionDialogComponent;
  let fixture: ComponentFixture<OrdenUnionDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrdenUnionDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OrdenUnionDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
