import { TestBed } from '@angular/core/testing';

import { TesoreriaService } from './tesoreria.service';

describe('TesoreriaService', () => {
  let service: TesoreriaService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TesoreriaService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
