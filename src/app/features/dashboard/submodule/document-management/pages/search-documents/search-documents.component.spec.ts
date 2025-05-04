import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SearchDocumentsComponent } from './search-documents.component';

describe('SearchDocumentsComponent', () => {
  let component: SearchDocumentsComponent;
  let fixture: ComponentFixture<SearchDocumentsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchDocumentsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SearchDocumentsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
