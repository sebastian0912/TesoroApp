import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeerAdresComponent } from './leer-adres.component';

describe('LeerAdresComponent', () => {
  let component: LeerAdresComponent;
  let fixture: ComponentFixture<LeerAdresComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeerAdresComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LeerAdresComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
