import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecibirEnvioComponent } from './recibir-envio.component';

describe('RecibirEnvioComponent', () => {
  let component: RecibirEnvioComponent;
  let fixture: ComponentFixture<RecibirEnvioComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecibirEnvioComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RecibirEnvioComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
