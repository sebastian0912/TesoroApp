import { TestBed } from '@angular/core/testing';

import { SeleccionService } from './seleccion.service';

describe('SeleccionService', () => {
  let service: SeleccionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SeleccionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
