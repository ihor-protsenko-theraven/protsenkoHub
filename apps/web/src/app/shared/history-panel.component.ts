import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, TemplateRef, contentChild, input, signal } from '@angular/core';

@Component({
  selector: 'app-history-panel',
  imports: [NgTemplateOutlet],
  templateUrl: './history-panel.component.html',
  styleUrl: './history-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryPanel {
  readonly count = input(0);
  readonly label = input('Історія');
  readonly empty = input('Поки нічого немає.');
  readonly open = signal(false);
  readonly body = contentChild(TemplateRef);

  onToggle(event: Event): void {
    this.open.set((event.currentTarget as HTMLDetailsElement).open);
  }
}
