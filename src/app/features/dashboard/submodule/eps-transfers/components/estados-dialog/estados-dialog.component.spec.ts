import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EstadosDialogComponent } from './estados-dialog.component';

describe('EstadosDialogComponent', () => {
  let component: EstadosDialogComponent;
  let fixture: ComponentFixture<EstadosDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EstadosDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EstadosDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
