import { TestBed } from '@angular/core/testing';

import { AutorizacionesService } from './autorizaciones.service';

describe('AutorizacionesService', () => {
  let service: AutorizacionesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AutorizacionesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
