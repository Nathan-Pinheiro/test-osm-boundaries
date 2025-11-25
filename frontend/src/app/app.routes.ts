import { Routes } from '@angular/router';
import { MapComponent } from './map/map.component';
import { MenuComponent } from './menu/menu.component';
import { ParcComponent } from './parc/parc.component';
import { RandoComponent } from './rando/rando.component';

export const routes: Routes = [
  { path: '', component: MenuComponent },
  { path: 'borders', component: MapComponent },
  { path: 'border', redirectTo: 'borders', pathMatch: 'full' },
  { path: 'parc', component: ParcComponent },
  { path: 'rando', component: RandoComponent }
];

