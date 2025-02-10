import { TestBed } from '@angular/core/testing';

import { ComercializadoraService } from './comercializadora.service';

describe('ComercializadoraService', () => {
  let service: ComercializadoraService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ComercializadoraService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
