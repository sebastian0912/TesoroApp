import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AutorizarVetadoComponent } from './autorizar-vetado.component';

describe('AutorizarVetadoComponent', () => {
  let component: AutorizarVetadoComponent;
  let fixture: ComponentFixture<AutorizarVetadoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AutorizarVetadoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AutorizarVetadoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
