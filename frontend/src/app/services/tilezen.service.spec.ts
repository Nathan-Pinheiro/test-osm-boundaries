import { TestBed } from '@angular/core/testing';

import { TilezenService } from './tilezen.service';

describe('TilezenService', () => {
  let service: TilezenService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TilezenService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
