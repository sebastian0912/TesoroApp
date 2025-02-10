import { TestBed } from '@angular/core/testing';

import { TrasladosService } from './traslados.service';

describe('TrasladosService', () => {
  let service: TrasladosService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TrasladosService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
