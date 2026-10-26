import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-loader',
  template: `
    <span class="loader" role="status">
      <span class="loader__label">{{ label() }}</span>
    </span>
  `,
  styleUrl: './loader.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Loader {
  readonly label = input('Завантажуємо…');
}
