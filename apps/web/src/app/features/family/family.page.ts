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
  readonly family = inject(FamilyService);
  readonly model = signal({ email: '' });
  readonly inviteForm = form(this.model, (path) => {
    required(path.email);
    email(path.email);
  });
  readonly childModel = linkedSignal<ChildProfileForm>(() => {
    const child = this.family.overview.value()?.child;
    return {
      babyName: child?.name ?? '',
      birthDate: child?.birthDate ?? '',
    };
  });
  readonly childForm = form(this.childModel, (path) => {
    maxLength(path.babyName, 60);
  });
  readonly previewAgeLabel = computed(() => {
    const birthDate = this.childModel().birthDate.trim();
    if (!birthDate) {
      return this.family.overview.value()?.child?.ageLabel ?? null;
    }
    return formatAgeFromBirthDate(birthDate);
  });
  readonly link = signal('');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');

  saveChild(): void {
    const draft = this.childModel();
    this.busy.set(true);
    this.error.set('');
    this.family
      .saveChild({
        babyName: draft.babyName.trim() || null,
        birthDate: draft.birthDate.trim() || null,
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.notice.set('Дані дитини збережено. Ім’я та вік підтягнуться у трекер сну.');
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
    this.busy.set(true);
    this.error.set('');
    this.family.createInvitation(this.model().email.trim()).subscribe({
      next: ({ token }) => {
        this.link.set(`${location.origin}/invite/${token}`);
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
      this.notice.set('Скопіюйте посилання з поля нижче.');
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

function formatAgeFromBirthDate(birthDate: string): string | null {
  const parsed = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const days = Math.floor((Date.now() - parsed.getTime()) / 86_400_000);
  if (days < 0) return null;
  const months = Math.floor(days / 30.436875);
  const extraDays = Math.max(0, Math.round(days - months * 30.436875));
  if (months <= 0) return `${days} дн.`;
  if (months >= 12) {
    const years = Math.floor(months / 12);
    const remMonths = months % 12;
    return remMonths === 0 ? `${years} р.` : `${years} р. ${remMonths} міс.`;
  }
  if (extraDays === 0) return `${months} міс.`;
  return `${months} міс. ${extraDays} дн.`;
}
