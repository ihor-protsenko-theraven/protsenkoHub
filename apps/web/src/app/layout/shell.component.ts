import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { APP_LOCALE } from '../core/locale.config';
import { NavItem } from './nav-item.model';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  readonly today = new Intl.DateTimeFormat(APP_LOCALE, { dateStyle: 'full' }).format(new Date());
  readonly nav: readonly NavItem[] = [
    { path: '/app/calendar', label: 'Календар', icon: '▦', description: 'Події та плани сім’ї' },
    { path: '/app/shopping', label: 'Покупки', icon: '◧', description: 'Спільний список покупок' },
    { path: '/app/children', label: 'Діти', icon: '✳', description: 'Задачі та нагадування по дітях' },
    { path: '/app/sleep', label: 'Сон', icon: '☾', description: 'Графік сну Соломії' },
    { path: '/app/contacts', label: 'Контакти', icon: '◉', description: 'Важливі люди й номери' },
  ];
}
