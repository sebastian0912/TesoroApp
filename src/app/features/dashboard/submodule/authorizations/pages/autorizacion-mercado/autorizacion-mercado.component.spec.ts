import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AutorizacionMercadoComponent } from './autorizacion-mercado.component';

describe('AutorizacionMercadoComponent', () => {
  let component: AutorizacionMercadoComponent;
  let fixture: ComponentFixture<AutorizacionMercadoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AutorizacionMercadoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AutorizacionMercadoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
