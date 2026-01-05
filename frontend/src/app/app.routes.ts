import { Routes } from '@angular/router';
import { MapPage } from './map-test/map-test.component';
import { MenuComponent } from './menu/menu.component';
import { ParcComponent } from './parc/parc.component';
import { RandoComponent } from './rando/rando.component';
import { Interaction } from './interaction/interaction';

import { BorderTestPage } from './border-test/border-test.component';

export const routes: Routes = [
  { path: '', component: MenuComponent },
  { path: 'borders', component: BorderTestPage },
  { path: 'border', redirectTo: 'borders', pathMatch: 'full' },
  { path: 'parc', component: ParcComponent },
  { path: 'rando', component: RandoComponent },
  { path: 'interaction', component: Interaction},
  { path: 'test-map', component: MapPage}
];