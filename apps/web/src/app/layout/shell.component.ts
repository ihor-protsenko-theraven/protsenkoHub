import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { APP_LOCALE } from '../core/configs/locale.config';
import { NavItem } from './nav-item.model';
import { NavIconComponent } from './nav-icon.component';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NavIconComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  readonly moreOpen = signal(false);
  readonly today = new Intl.DateTimeFormat(APP_LOCALE, { dateStyle: 'full' }).format(new Date());
  readonly nav: readonly NavItem[] = [
    { path: '/app/home', label: 'Головна', icon: 'home' },
    { path: '/app/calendar', label: 'Календар', icon: 'calendar' },
    { path: '/app/shopping', label: 'Покупки', icon: 'shopping' },
    { path: '/app/children', label: 'Діти', icon: 'children' },
    { path: '/app/sleep', label: 'Сон', icon: 'sleep' },
    { path: '/app/feeding', label: 'Прикорм', icon: 'feeding' },
    { path: '/app/contacts', label: 'Контакти', icon: 'contacts' },
    { path: '/app/family', label: 'Родина', icon: 'family' },
  ];
  readonly primaryNav = this.nav.slice(0, 5);
  readonly secondaryNav = this.nav.slice(5);
}
