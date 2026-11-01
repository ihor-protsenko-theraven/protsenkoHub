import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormField, form, required } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { Loader } from '../../shared/loader.component';
import {
  MEASUREMENT_FILTERS,
  MeasurementFilter,
  createEmptyMeasurementForm,
} from './measurements.config';
import {
  EnrichedMeasurement,
  MeasurementFormModel,
  MeasurementPayload,
  MetricSummary,
} from './measurements.model';
import { MeasurementsService } from './measurements.service';
import {
  enrichMeasurements,
  formatDelta,
  formatHead,
  formatHeight,
  formatWeight,
  formatWeightDelta,
} from './measurements.util';

@Component({
  selector: 'app-measurements-page',
  imports: [DatePipe, FormField, Loader, RouterLink],
  providers: [MeasurementsService],
  templateUrl: './measurements.page.html',
  styleUrl: './measurements.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeasurementsPage {
  private readonly data = inject(MeasurementsService);

  readonly feedResource = this.data.feed;
  readonly filters = MEASUREMENT_FILTERS;
  readonly filter = signal<MeasurementFilter>('ALL');

  readonly formOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly deletingId = signal<string | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');

  readonly model = signal<MeasurementFormModel>(createEmptyMeasurementForm());
  readonly measurementForm = form(this.model, (path) => {
    required(path.measuredAt);
  });

  readonly feed = computed(() =>
    this.feedResource.hasValue()
      ? this.feedResource.value()
      : { child: null, measurements: [] },
  );

  readonly child = computed(() => this.feed().child);
  readonly rawMeasurements = computed(() => this.feed().measurements);

  readonly enrichedMeasurements = computed(() =>
    enrichMeasurements(this.rawMeasurements(), this.child()?.birthDate),
  );

  readonly latestWeight = computed(
    () => this.enrichedMeasurements().find((m) => m.weightKg != null) ?? null,
  );
  readonly latestHeight = computed(
    () => this.enrichedMeasurements().find((m) => m.heightCm != null) ?? null,
  );
  readonly latestHead = computed(
    () =>
      this.enrichedMeasurements().find((m) => m.headCircumferenceCm != null) ??
      null,
  );

  readonly summaryCards = computed<readonly MetricSummary[]>(() => {
    const w = this.latestWeight();
    const h = this.latestHeight();
    const head = this.latestHead();

    return [
      {
        key: 'weight',
        label: 'Вага',
        valueFormatted: w ? formatWeight(w.weightKg) : '—',
        deltaFormatted: w ? formatWeightDelta(w.weightDeltaGrams) : null,
        measuredAtFormatted: w?.measuredAt ?? '',
        unit: 'кг',
      },
      {
        key: 'height',
        label: 'Зріст',
        valueFormatted: h ? formatHeight(h.heightCm) : '—',
        deltaFormatted: h ? formatDelta(h.heightDeltaCm, 'см') : null,
        measuredAtFormatted: h?.measuredAt ?? '',
        unit: 'см',
      },
      {
        key: 'head',
        label: 'Окружність голови',
        valueFormatted: head ? formatHead(head.headCircumferenceCm) : '—',
        deltaFormatted: head ? formatDelta(head.headDeltaCm, 'см') : null,
        measuredAtFormatted: head?.measuredAt ?? '',
        unit: 'см',
      },
    ];
  });

  readonly visibleMeasurements = computed(() => {
    const list = this.enrichedMeasurements();
    const currentFilter = this.filter();
    if (currentFilter === 'ALL') return list;
    if (currentFilter === 'weight') return list.filter((m) => m.weightKg != null);
    if (currentFilter === 'height') return list.filter((m) => m.heightCm != null);
    if (currentFilter === 'head')
      return list.filter((m) => m.headCircumferenceCm != null);
    return list;
  });

  // Helpers for template
  readonly formatWeight = formatWeight;
  readonly formatHeight = formatHeight;
  readonly formatHead = formatHead;
  readonly formatWeightDelta = formatWeightDelta;
  readonly formatDelta = formatDelta;

  createNew(): void {
    this.editingId.set(null);
    this.model.set(createEmptyMeasurementForm());
    this.error.set('');
    this.formOpen.set(true);
  }

  edit(item: EnrichedMeasurement): void {
    this.editingId.set(item.id);
    this.model.set({
      measuredAt: item.measuredAt.slice(0, 10),
      weightKg: item.weightKg != null ? String(item.weightKg) : '',
      heightCm: item.heightCm != null ? String(item.heightCm) : '',
      headCircumferenceCm:
        item.headCircumferenceCm != null ? String(item.headCircumferenceCm) : '',
      notes: item.notes ?? '',
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
    const val = this.model();
    if (!val.measuredAt) {
      this.error.set('Вкажіть дату вимірювання.');
      return;
    }

    const weightParsed = val.weightKg.trim()
      ? Number(val.weightKg.replace(',', '.'))
      : null;
    const heightParsed = val.heightCm.trim()
      ? Number(val.heightCm.replace(',', '.'))
      : null;
    const headParsed = val.headCircumferenceCm.trim()
      ? Number(val.headCircumferenceCm.replace(',', '.'))
      : null;

    if (
      (weightParsed !== null && (!Number.isFinite(weightParsed) || weightParsed <= 0)) ||
      (heightParsed !== null && (!Number.isFinite(heightParsed) || heightParsed <= 0)) ||
      (headParsed !== null && (!Number.isFinite(headParsed) || headParsed <= 0))
    ) {
      this.error.set('Значення мають бути додатними числами.');
      return;
    }

    if (weightParsed === null && heightParsed === null && headParsed === null) {
      this.error.set(
        'Вкажіть хоча б один показник: вагу, зріст або окружність голови.',
      );
      return;
    }

    const payload: MeasurementPayload = {
      measuredAt: new Date(val.measuredAt).toISOString(),
      weightKg: weightParsed,
      heightCm: heightParsed,
      headCircumferenceCm: headParsed,
      notes: val.notes.trim() || null,
    };

    this.busy.set(true);
    const id = this.editingId();
    const request = id
      ? this.data.update(id, payload)
      : this.data.create(payload);

    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.notice.set(id ? 'Вимірювання оновлено.' : 'Вимірювання додано.');
        this.cancel();
      },
      error: () => {
        this.busy.set(false);
        this.error.set('Не вдалося зберегти вимірювання.');
      },
    });
  }

  confirmDelete(id: string): void {
    this.deletingId.set(id);
  }

  cancelDelete(): void {
    this.deletingId.set(null);
  }

  deleteConfirmed(id: string): void {
    this.busy.set(true);
    this.data.remove(id).subscribe({
      next: () => {
        this.busy.set(false);
        this.deletingId.set(null);
        this.notice.set('Запис видалено.');
      },
      error: () => {
        this.busy.set(false);
        this.error.set('Не вдалося видалити запис.');
      },
    });
  }
}
