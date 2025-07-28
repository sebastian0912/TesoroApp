import { TestBed } from '@angular/core/testing';

import { InfoVacantesService } from './info-vacantes.service';

describe('InfoVacantesService', () => {
  let service: InfoVacantesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(InfoVacantesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
