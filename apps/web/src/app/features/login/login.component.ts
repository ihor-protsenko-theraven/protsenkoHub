import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormField, email, form, minLength, required } from '@angular/forms/signals';
import { Tab, TabContent, TabList, TabPanel, Tabs } from '@angular/aria/tabs';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { LoginModel, RegisterModel } from '../../core/models/auth.model';

@Component({
  selector: 'app-login',
  imports: [FormField, Tabs, TabList, Tab, TabPanel, TabContent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly loginModel = signal<LoginModel>({ email: '', password: '' });
  readonly registerModel = signal<RegisterModel>({ email: '', password: '', displayName: '', householdName: '' });
  readonly loginForm = form(this.loginModel, (path) => {
    required(path.email); email(path.email); required(path.password); minLength(path.password, 8);
  });
  readonly registerForm = form(this.registerModel, (path) => {
    required(path.email); email(path.email); required(path.password); minLength(path.password, 8);
    required(path.displayName); minLength(path.displayName, 2); required(path.householdName);
  });
  readonly mode = signal('login');
  readonly busy = signal(false);
  readonly error = signal('');

  submit(mode: 'login' | 'register'): void {
    this.error.set('');
    const valid = mode === 'login' ? this.loginForm().valid() : this.registerForm().valid();
    if (!valid) { this.error.set('Перевірте поля. Пароль має містити від 8 символів.'); return; }
    this.busy.set(true);
    const request = mode === 'login'
      ? this.auth.login(this.loginModel().email.trim(), this.loginModel().password)
      : this.auth.register({ ...this.registerModel(), email: this.registerModel().email.trim() });
    request.subscribe({
      next: () => void this.router.navigateByUrl(this.auth.consumePostLoginRoute()),
      error: () => {
        this.busy.set(false);
        this.error.set(mode === 'login'
          ? 'Не вдалося увійти. Спробуйте ще раз.'
          : 'Не вдалося створити акаунт. Спробуйте ще раз.');
      },
    });
  }
}
