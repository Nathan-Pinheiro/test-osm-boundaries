import { Routes } from '@angular/router';
import { MapPage } from './map-test/map-test.component';
import { MenuComponent } from './menu/menu.component';
import { ParcComponent } from './parc/parc.component';
import { RandoComponent } from './rando/rando.component';
import { CarrouselPage } from './carrousel/carrousel.component';
import { Interaction } from './interaction/interaction';

import { BorderTestPage as CountryBorderPage } from './country-borders/country-borders.component';

export const routes: Routes = [
  { path: '', component: MenuComponent },
  { path: 'country_borders', component: CountryBorderPage },
  { path: 'carrousel', component: CarrouselPage },
  { path: 'border', redirectTo: 'country_borders', pathMatch: 'full' },
  { path: 'borders', redirectTo: 'country_borders', pathMatch: 'full' },
  { path: 'parc', component: ParcComponent },
  { path: 'rando', component: RandoComponent },
  { path: 'interaction', component: Interaction},
  { path: 'test-map', component: MapPage}
];