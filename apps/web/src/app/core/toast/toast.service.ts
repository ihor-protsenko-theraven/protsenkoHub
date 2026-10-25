import { Injectable, signal } from '@angular/core';
import { TOAST_CONFIG } from './toast.config';
import type { ToastMessage } from './toast.model';

@Injectable()
export class ToastService {
  private nextId = 0;
  private readonly currentMessages = signal<ToastMessage[]>([]);
  readonly messages = this.currentMessages.asReadonly();

  error(text: string): void {
    this.show(text, 'error');
  }

  success(text: string): void {
    this.show(text, 'success');
  }

  dismiss(id: number): void {
    this.currentMessages.update((messages) => messages.filter((message) => message.id !== id));
  }

  dismissConnectivityError(): void {
    this.currentMessages.update((messages) => messages.filter((message) =>
      message.kind !== 'error' || message.text !== TOAST_CONFIG.connectivityErrorMessage));
  }

  private show(text: string, kind: ToastMessage['kind']): void {
    if (this.currentMessages().some((message) => message.text === text && message.kind === kind)) return;
    const id = ++this.nextId;
    this.currentMessages.update((messages) => [...messages.slice(1 - TOAST_CONFIG.maxVisible), {
      id, text, kind, role: kind === 'error' ? 'alert' : 'status',
    }]);
    if (kind === 'success') setTimeout(() => this.dismiss(id), TOAST_CONFIG.successDurationMs);
  }
}
