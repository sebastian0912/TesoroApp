import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Financiera } from './financiera';

describe('Financiera', () => {
  let component: Financiera;
  let fixture: ComponentFixture<Financiera>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Financiera]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Financiera);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
