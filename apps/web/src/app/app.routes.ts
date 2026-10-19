import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'calendar' },
      {
        path: 'calendar',
        loadComponent: () =>
          import('./features/calendar/calendar.page').then((m) => m.CalendarPage),
      },
      {
        path: 'shopping',
        loadComponent: () =>
          import('./features/shopping/shopping.page').then((m) => m.ShoppingPage),
      },
      {
        path: 'children',
        loadComponent: () =>
          import('./features/children/children-page.component').then((m) => m.ChildrenPage),
      },
      {
        path: 'sleep',
        loadComponent: () =>
          import('./features/sleep/sleep.page').then((m) => m.SleepPage),
      },
      {
        path: 'contacts',
        loadComponent: () =>
          import('./features/contacts/contacts.page').then((m) => m.ContactsPage),
      },
    ],
  },
  { path: '', pathMatch: 'full', redirectTo: 'app/calendar' },
  { path: '**', redirectTo: 'app/calendar' },
];
