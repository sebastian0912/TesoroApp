import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompanyDocsAccessComponent } from './company-docs-access.component';

describe('CompanyDocsAccessComponent', () => {
  let component: CompanyDocsAccessComponent;
  let fixture: ComponentFixture<CompanyDocsAccessComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompanyDocsAccessComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CompanyDocsAccessComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
