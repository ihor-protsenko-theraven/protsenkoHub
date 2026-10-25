import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormField, email, form, maxLength, required } from '@angular/forms/signals';
import { AuthService } from '../../core/services/auth.service';
import { MOBILE_WEB_ORIGIN_TOKEN } from '../../core/configs/mobile-web.config';
import { isNativeApp } from '../../core/configs/native-platform.config';
import { formatAgeFromBirthDate } from './family-age.util';
import type { ChildProfileForm } from './family.model';
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
  private readonly mobileWebOrigin = inject(MOBILE_WEB_ORIGIN_TOKEN);
  readonly family = inject(FamilyService);
  readonly model = signal({ email: '' });
  readonly inviteForm = form(this.model, (path) => {
    required(path.email);
    email(path.email);
  });
  readonly childModel = linkedSignal<ChildProfileForm>(() => {
    const child = this.family.overview.hasValue() ? this.family.overview.value().child : null;
    return {
      name: child?.name ?? '',
      birthDate: child?.birthDate ?? '',
    };
  });
  readonly childForm = form(this.childModel, (path) => {
    required(path.name);
    maxLength(path.name, 60);
    required(path.birthDate);
  });
  readonly previewAgeLabel = computed(() => {
    const birthDate = this.childModel().birthDate.trim();
    if (!birthDate) {
      return this.family.overview.hasValue() ? this.family.overview.value().child?.ageLabel ?? null : null;
    }
    return formatAgeFromBirthDate(birthDate);
  });
  readonly link = signal('');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');

  saveChild(): void {
    const draft = this.childModel();
    if (!this.childForm().valid() || !this.previewAgeLabel()) {
      this.error.set('Вкажіть ім’я та коректну дату народження дитини.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.family
      .saveChild({
        name: draft.name.trim(),
        birthDate: draft.birthDate.trim(),
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.notice.set('Дані дитини збережено.');
          this.family.overview.reload();
        },
        error: () => {
          this.busy.set(false);
          this.error.set('Не вдалося зберегти дані дитини. Перевірте дату народження.');
        },
      });
  }

  invite(): void {
    if (!this.inviteForm().valid()) return;
    const inviteOrigin = isNativeApp() ? this.mobileWebOrigin : location.origin;
    if (!inviteOrigin) {
      this.error.set('Для запрошень у мобільній збірці потрібна публічна HTTPS-адреса вебзастосунку.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.family.createInvitation(this.model().email.trim()).subscribe({
      next: ({ token }) => {
        this.link.set(`${inviteOrigin}/invite/${encodeURIComponent(token)}`);
        this.notice.set('Запрошення створено. Передайте посилання особисто.');
        this.busy.set(false);
        this.family.overview.reload();
      },
      error: () => {
        this.error.set(
          'Не вдалося створити запрошення. Перевірте адресу й спробуйте ще раз.',
        );
        this.busy.set(false);
      },
    });
  }

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.link());
      this.notice.set('Посилання скопійовано.');
    } catch {
      this.notice.set('Скопіюйте посилання з поля.');
    }
  }

  revoke(id: string): void {
    this.busy.set(true);
    this.family.revokeInvitation(id).subscribe({
      next: () => {
        this.busy.set(false);
        this.family.overview.reload();
        this.notice.set('Запрошення скасовано.');
      },
      error: () => {
        this.busy.set(false);
        this.error.set('Не вдалося скасувати запрошення.');
      },
    });
  }
}
