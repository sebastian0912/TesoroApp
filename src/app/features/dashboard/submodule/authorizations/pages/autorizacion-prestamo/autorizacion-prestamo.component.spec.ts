import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AutorizacionPrestamoComponent } from './autorizacion-prestamo.component';

describe('AutorizacionPrestamoComponent', () => {
  let component: AutorizacionPrestamoComponent;
  let fixture: ComponentFixture<AutorizacionPrestamoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AutorizacionPrestamoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AutorizacionPrestamoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
