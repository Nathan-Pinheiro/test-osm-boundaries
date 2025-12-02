import { Routes } from '@angular/router';
import { MapComponent } from './map/map.component';
import { MenuComponent } from './menu/menu.component';
import { ParcComponent } from './parc/parc.component';
import { RandoComponent } from './rando/rando.component';
import { TopologyComponent } from './topology/topology.component';
import { TestInteraction } from './test-interaction/test-interaction';

export const routes: Routes = [
  { path: '', component: MenuComponent },
  { path: 'borders', component: MapComponent },
  { path: 'border', redirectTo: 'borders', pathMatch: 'full' },
  { path: 'parc', component: ParcComponent },
  { path: 'rando', component: RandoComponent },
  { path: 'topology', component: TopologyComponent},
  { path: 'test-interaction', component: TestInteraction}
];

