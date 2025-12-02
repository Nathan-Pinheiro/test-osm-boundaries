import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TestInteraction } from './test-interaction';

describe('TestInteraction', () => {
  let component: TestInteraction;
  let fixture: ComponentFixture<TestInteraction>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestInteraction]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TestInteraction);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
