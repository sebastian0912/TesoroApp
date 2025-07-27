import { TestBed } from '@angular/core/testing';

import { ActivosService } from './activos.service';

describe('ActivosService', () => {
  let service: ActivosService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ActivosService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
