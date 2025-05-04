import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DocumentModalComponent } from './document-modal.component';

describe('DocumentModalComponent', () => {
  let component: DocumentModalComponent;
  let fixture: ComponentFixture<DocumentModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocumentModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DocumentModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
