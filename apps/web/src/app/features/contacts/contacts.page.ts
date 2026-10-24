import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormField, email, form, required } from '@angular/forms/signals';
import { CONTACT_CATEGORIES } from './contacts.config';
import { ContactCategory, ContactForm, ContactItem, ContactPayload } from './contacts.model';
import { ContactsService } from './contacts.service';
import { contactCategoryLabel } from './contacts.util';

const emptyForm = (): ContactForm => ({
  name: '', category: 'DOCTOR', phone: '', email: '', organization: '', notes: '',
});

@Component({
  selector: 'app-contacts-page',
  imports: [FormField],
  providers: [ContactsService],
  templateUrl: './contacts.page.html',
  styleUrl: './contacts.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactsPage {
  readonly data = inject(ContactsService);
  readonly contacts = this.data.contacts;
  readonly availableContacts = computed(() => this.contacts.hasValue() ? this.contacts.value() : []);
  readonly categories = CONTACT_CATEGORIES;
  readonly categoryLabel = contactCategoryLabel;
  readonly search = signal('');
  readonly category = signal<ContactCategory | 'ALL'>('ALL');
  readonly filtered = computed(() => {
    const query = this.search().trim().toLocaleLowerCase('uk');
    return this.availableContacts().filter((contact) =>
      (this.category() === 'ALL' || contact.category === this.category()) &&
      (!query || [contact.name, contact.organization, contact.phone, contact.email]
        .some((part) => part?.toLocaleLowerCase('uk').includes(query))),
    );
  });
  readonly formOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly deletingId = signal<string | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly model = signal<ContactForm>(emptyForm());
  readonly contactForm = form(this.model, (path) => {
    required(path.name);
    email(path.email);
  });

  createNew(): void {
    this.editingId.set(null);
    this.model.set(emptyForm());
    this.error.set('');
    this.formOpen.set(true);
  }

  edit(contact: ContactItem): void {
    this.editingId.set(contact.id);
    this.model.set({
      name: contact.name,
      category: contact.category,
      phone: contact.phone ?? '',
      email: contact.email ?? '',
      organization: contact.organization ?? '',
      notes: contact.notes ?? '',
    });
    this.error.set('');
    this.formOpen.set(true);
  }

  cancel(): void {
    this.formOpen.set(false);
    this.editingId.set(null);
    this.error.set('');
  }

  save(): void {
    const value = this.model();
    if (!value.name.trim() || (value.email && !this.contactForm.email().valid())) {
      this.error.set('Вкажіть ім’я та коректну електронну адресу.');
      return;
    }
    const payload: ContactPayload = {
      name: value.name.trim(),
      category: value.category,
      phone: value.phone.trim() || null,
      email: value.email.trim() || null,
      organization: value.organization.trim() || null,
      notes: value.notes.trim() || null,
    };
    this.busy.set(true);
    const id = this.editingId();
    const request = id ? this.data.update(id, payload) : this.data.create(payload);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.notice.set(id ? 'Контакт оновлено.' : 'Контакт додано.');
        this.cancel();
      },
      error: () => {
        this.busy.set(false);
        this.error.set('Не вдалося зберегти контакт.');
      },
    });
  }

  remove(id: string): void {
    this.busy.set(true);
    this.data.remove(id).subscribe({
      next: () => {
        this.busy.set(false);
        this.deletingId.set(null);
        this.notice.set('Контакт видалено.');
      },
      error: () => {
        this.busy.set(false);
        this.error.set('Не вдалося видалити контакт.');
      },
    });
  }
}
