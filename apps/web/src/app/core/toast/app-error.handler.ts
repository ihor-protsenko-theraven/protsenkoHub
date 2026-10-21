import { ErrorHandler, Injectable, inject } from '@angular/core';
import { ToastService } from './toast.service';

@Injectable()
export class AppErrorHandler implements ErrorHandler {
  private readonly toasts = inject(ToastService);
  private readonly defaultHandler = new ErrorHandler();

  handleError(error: unknown): void {
    this.defaultHandler.handleError(error);
    this.toasts.error('Сталася неочікувана помилка. Оновіть сторінку та спробуйте ще раз.');
  }
}
