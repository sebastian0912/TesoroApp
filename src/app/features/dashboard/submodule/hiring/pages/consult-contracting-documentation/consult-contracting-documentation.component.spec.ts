import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConsultContractingDocumentationComponent } from './consult-contracting-documentation.component';

describe('ConsultContractingDocumentationComponent', () => {
  let component: ConsultContractingDocumentationComponent;
  let fixture: ComponentFixture<ConsultContractingDocumentationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConsultContractingDocumentationComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConsultContractingDocumentationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
