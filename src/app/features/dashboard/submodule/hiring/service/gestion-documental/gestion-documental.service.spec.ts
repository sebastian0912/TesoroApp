import { TestBed } from '@angular/core/testing';

import { GestionDocumentalService } from './gestion-documental.service';

describe('GestionDocumentalService', () => {
  let service: GestionDocumentalService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GestionDocumentalService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
