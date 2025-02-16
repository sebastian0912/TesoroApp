import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManageWorkersComponent } from './manage-workers.component';

describe('ManageWorkersComponent', () => {
  let component: ManageWorkersComponent;
  let fixture: ComponentFixture<ManageWorkersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManageWorkersComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ManageWorkersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
