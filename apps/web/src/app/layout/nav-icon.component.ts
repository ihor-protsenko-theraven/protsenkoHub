import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NavItem } from './nav-item.model';

@Component({
  selector: 'app-nav-icon',
  templateUrl: './nav-icon.component.html',
  styleUrl: './nav-icon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavIconComponent {
  readonly name = input.required<NavItem['icon']>();
}
