import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Interaction } from './interaction';

describe('TestInteraction', () => {
  let component: Interaction;
  let fixture: ComponentFixture<Interaction>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Interaction]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Interaction);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
