import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TopologyComponent } from './topology.component';

describe('Topography', () => {
  let component: TopologyComponent;
  let fixture: ComponentFixture<TopologyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TopologyComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TopologyComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
