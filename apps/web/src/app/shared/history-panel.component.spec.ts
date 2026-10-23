import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HistoryPanel } from './history-panel.component';

@Component({
  imports: [HistoryPanel],
  template: `
    <app-history-panel [count]="1" label="Історія">
      <ng-template><p id="past">Минулий запис</p></ng-template>
    </app-history-panel>
  `,
})
class HistoryHost {}

@Component({
  imports: [HistoryPanel],
  template: `<app-history-panel [count]="0" empty="Записів немає."><ng-template><p id="unexpected">Запис</p></ng-template></app-history-panel>`,
})
class EmptyHistoryHost {}

describe('HistoryPanel', () => {
  it('creates projected records only after the panel is opened', async () => {
    TestBed.configureTestingModule({ imports: [HistoryHost] });
    const fixture = TestBed.createComponent(HistoryHost);
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('#past')).toBeNull();
    expect(host.textContent).toContain('Історія');

    const details = host.querySelector('details');
    expect(details).not.toBeNull();
    details!.open = true;
    details!.dispatchEvent(new Event('toggle'));
    await fixture.whenStable();

    expect(host.querySelector('#past')?.textContent).toBe('Минулий запис');
  });

  it('shows one empty message when history has no records', async () => {
    TestBed.configureTestingModule({ imports: [EmptyHistoryHost] });
    const fixture = TestBed.createComponent(EmptyHistoryHost);
    const details = (fixture.nativeElement as HTMLElement).querySelector('details')!;
    details.open = true;
    details.dispatchEvent(new Event('toggle'));
    await fixture.whenStable();

    expect(details.textContent).toContain('Записів немає.');
    expect(details.querySelector('#unexpected')).toBeNull();
  });
});
