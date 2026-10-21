import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormField, email, form, required } from '@angular/forms/signals';
import { AuthService } from '../../core/services/auth.service';
import { FamilyService } from './family.service';

@Component({
  selector: 'app-family-page',
  imports: [DatePipe, FormField],
  providers: [FamilyService],
  templateUrl: './family.page.html',
  styleUrl: './family.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FamilyPage {
  readonly auth = inject(AuthService);
  readonly family = inject(FamilyService);
  readonly model = signal({ email: '' });
  readonly inviteForm = form(this.model, (path) => { required(path.email); email(path.email); });
  readonly link = signal('');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');

  invite(): void {
    if (!this.inviteForm().valid()) return;
    this.busy.set(true);
    this.error.set('');
    this.family.createInvitation(this.model().email.trim()).subscribe({
      next: ({ token }) => {
        this.link.set(`${location.origin}/invite/${token}`);
        this.notice.set('Запрошення створено. Передайте посилання особисто.');
        this.busy.set(false);
        this.family.overview.reload();
      },
      error: () => { this.error.set('Не вдалося створити запрошення. Перевірте адресу й спробуйте ще раз.'); this.busy.set(false); },
    });
  }

  async copy(): Promise<void> {
    try { await navigator.clipboard.writeText(this.link()); this.notice.set('Посилання скопійовано.'); }
    catch { this.notice.set('Скопіюйте посилання з поля нижче.'); }
  }

  revoke(id: string): void {
    this.busy.set(true);
    this.family.revokeInvitation(id).subscribe({
      next: () => { this.busy.set(false); this.family.overview.reload(); this.notice.set('Запрошення скасовано.'); },
      error: () => { this.busy.set(false); this.error.set('Не вдалося скасувати запрошення.'); },
    });
  }
}
