import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AbsencesNew } from './absences-new';

describe('AbsencesNew', () => {
  let component: AbsencesNew;
  let fixture: ComponentFixture<AbsencesNew>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AbsencesNew]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AbsencesNew);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
