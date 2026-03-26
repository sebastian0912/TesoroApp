import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Afiliaciones } from './afiliaciones';

describe('Afiliaciones', () => {
  let component: Afiliaciones;
  let fixture: ComponentFixture<Afiliaciones>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Afiliaciones]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Afiliaciones);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
