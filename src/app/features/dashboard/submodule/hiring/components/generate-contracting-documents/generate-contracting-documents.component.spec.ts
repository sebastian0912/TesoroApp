import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GenerateContractingDocumentsComponent } from './generate-contracting-documents.component';

describe('GenerateContractingDocumentsComponent', () => {
  let component: GenerateContractingDocumentsComponent;
  let fixture: ComponentFixture<GenerateContractingDocumentsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GenerateContractingDocumentsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GenerateContractingDocumentsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
