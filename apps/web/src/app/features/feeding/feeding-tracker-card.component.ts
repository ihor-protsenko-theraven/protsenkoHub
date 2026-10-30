import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { FormField, form, maxLength } from '@angular/forms/signals';
import { FEEDING, FEEDING_STATUSES } from './feeding.config';
import { FeedingDraft, FeedingRecord, FeedingStatus, FoodItem } from './feeding.model';
import { FeedingService } from './feeding.service';
import { formatAllowedFrom } from './feeding-age.util';
import { feedingGuideSteps } from './feeding-guide.util';

interface SavedFeedingDraft extends FeedingDraft {
  updatedAt: string;
}

@Component({
  selector: 'app-feeding-tracker-card',
  imports: [FormField],
  templateUrl: './feeding-tracker-card.component.html',
  styleUrl: './feeding-tracker-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedingTrackerCard {
  private readonly data = inject(FeedingService);
  readonly food = input.required<FoodItem>();
  readonly categoryName = input.required<string>();
  readonly record = input<FeedingRecord | null>(null);
  readonly ageMonths = input<number | null>(null);
  readonly statuses = FEEDING_STATUSES;
  readonly allowedFrom = formatAllowedFrom;
  readonly notesTooLong = FEEDING.notesTooLong;
  readonly busy = signal(false);
  readonly error = signal('');
  readonly steps = computed(() => feedingGuideSteps(this.food().preparationGuide));
  private readonly saved = computed<SavedFeedingDraft>(() => ({
    status: this.record()?.status ?? 'PENDING',
    notes: this.record()?.notes ?? '',
    updatedAt: this.record()?.updatedAt ?? '',
  }));
  readonly model = linkedSignal<SavedFeedingDraft, FeedingDraft>({
    source: this.saved,
    computation: (source, previous) => {
      const dirty = previous !== undefined && (
        previous.value.status !== previous.source.status || previous.value.notes !== previous.source.notes
      );
      if (dirty && previous.source.updatedAt === source.updatedAt) return previous.value;
      return { status: source.status, notes: source.notes };
    },
  });
  readonly draft = form(this.model, (path) => {
    maxLength(path.notes, FEEDING.notesMaxLength, { message: FEEDING.notesTooLong });
  });
  readonly early = computed(() => {
    const age = this.ageMonths();
    return age !== null && age < this.food().allowedFromAgeMonths;
  });
  readonly notesDirty = computed(() => this.model().notes.trim() !== (this.record()?.notes ?? ''));

  setStatus(status: FeedingStatus): void {
    if (this.busy() || this.model().status === status) return;
    this.model.update((current) => ({ ...current, status }));
    this.persist();
  }

  saveNotes(): void {
    if (!this.notesDirty()) return;
    this.persist();
  }

  private persist(): void {
    const notes = this.model().notes.trim();
    if (notes.length > FEEDING.notesMaxLength || this.draft.notes().invalid()) {
      this.error.set(FEEDING.notesTooLong);
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.data.upsert(this.food().id, {
      status: this.model().status,
      notes: notes || null,
    }).subscribe({
      next: () => this.busy.set(false),
      error: () => {
        this.busy.set(false);
        this.error.set(FEEDING.saveError);
      },
    });
  }
}
