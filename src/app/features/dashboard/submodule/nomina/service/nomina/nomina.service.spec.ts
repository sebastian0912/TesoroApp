import { TestBed } from '@angular/core/testing';

import { NominaService } from './nomina.service';

describe('NominaService', () => {
  let service: NominaService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NominaService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
