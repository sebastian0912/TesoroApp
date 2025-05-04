import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateDocStructureComponent } from './create-doc-structure.component';

describe('CreateDocStructureComponent', () => {
  let component: CreateDocStructureComponent;
  let fixture: ComponentFixture<CreateDocStructureComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateDocStructureComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreateDocStructureComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
