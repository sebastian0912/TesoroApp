import { TestBed } from '@angular/core/testing';

import { VetadosService } from './vetados.service';

describe('VetadosService', () => {
  let service: VetadosService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(VetadosService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
