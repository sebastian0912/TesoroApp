import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VerPdfsComponent } from './ver-pdfs.component';

describe('VerPdfsComponent', () => {
  let component: VerPdfsComponent;
  let fixture: ComponentFixture<VerPdfsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VerPdfsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VerPdfsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
