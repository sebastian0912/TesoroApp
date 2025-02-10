import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EnviarMercanciaComponent } from './enviar-mercancia.component';

describe('EnviarMercanciaComponent', () => {
  let component: EnviarMercanciaComponent;
  let fixture: ComponentFixture<EnviarMercanciaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EnviarMercanciaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EnviarMercanciaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
