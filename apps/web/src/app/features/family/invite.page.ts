import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormField, form, minLength, required } from '@angular/forms/signals';
import { switchMap } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { InvitationService } from './invitation.service';
import type { InvitationPreview } from './family.model';

@Component({
  selector: 'app-invite-page',
  imports: [FormField],
  providers: [InvitationService],
  templateUrl: './invite.page.html',
  styleUrl: './invite.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvitePage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly family = inject(InvitationService);
  readonly auth = inject(AuthService);
  readonly token = this.route.snapshot.paramMap.get('token') ?? '';
  readonly preview = signal<InvitationPreview | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly mode = signal<'login' | 'register'>('register');
  readonly loginModel = signal({ password: '' });
  readonly registerModel = signal({ displayName: '', password: '' });
  readonly loginForm = form(this.loginModel, (path) => { required(path.password); minLength(path.password, 8); });
  readonly registerForm = form(this.registerModel, (path) => { required(path.displayName); minLength(path.displayName, 2); required(path.password); minLength(path.password, 8); });

  constructor() {
    this.family.preview(this.token).subscribe({
      next: (preview) => { this.preview.set(preview); this.loading.set(false); },
      error: () => { this.error.set('Запрошення недійсне або термін його дії минув.'); this.loading.set(false); },
    });
    if (!this.auth.ready()) this.auth.bootstrap().subscribe({ error: () => undefined });
  }

  accept(): void {
    if (!this.auth.user()) return;
    this.busy.set(true);
    this.error.set('');
    this.family.accept(this.token).subscribe({
      next: ({ user }) => this.complete(user),
      error: () => { this.busy.set(false); this.error.set('Не вдалося прийняти запрошення. Перевірте, чи ви увійшли з потрібною адресою.'); },
    });
  }

  login(): void {
    const invitation = this.preview();
    if (!invitation || !this.loginForm().valid()) return;
    this.busy.set(true);
    this.error.set('');
    this.auth.login(invitation.email, this.loginModel().password).pipe(switchMap(() => this.family.accept(this.token))).subscribe({
      next: ({ user }) => this.complete(user),
      error: () => { this.busy.set(false); this.error.set('Не вдалося увійти або прийняти запрошення. Перевірте пароль.'); },
    });
  }

  register(): void {
    if (!this.registerForm().valid()) return;
    this.busy.set(true);
    this.error.set('');
    this.family.register(this.token, this.registerModel()).subscribe({
      next: ({ user }) => this.complete(user),
      error: () => { this.busy.set(false); this.error.set('Не вдалося створити акаунт. Якщо він уже є, виберіть вхід.'); },
    });
  }

  private complete(user: Parameters<AuthService['setUser']>[0]): void {
    this.auth.setUser(user);
    void this.router.navigateByUrl('/app/family');
  }
}
