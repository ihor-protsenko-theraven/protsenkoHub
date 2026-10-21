import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ToastComponent } from './toast.component';
import { ToastService } from './toast.service';
import { EXPECTED_GUEST_SESSION, apiErrorInterceptor } from './api-error.interceptor';

describe('global toast messages', () => {
  it('renders API errors in the root toast host and ignores an expected guest session', () => {
    TestBed.configureTestingModule({
      imports: [ToastComponent],
      providers: [
        ToastService,
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    const fixture = TestBed.createComponent(ToastComponent);
    const http = TestBed.inject(HttpTestingController);
    const client = TestBed.inject(ToastService);
    const requests = TestBed.inject(HttpClient);

    requests.get('/api/v1/auth/me', {
      context: new HttpContext().set(EXPECTED_GUEST_SESSION, true),
    }).subscribe({ error: () => undefined });
    http.expectOne('/api/v1/auth/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(client.messages()).toHaveLength(0);

    requests.post('/api/v1/sleep-reminders/subscribe', {}).subscribe({ error: () => undefined });
    http.expectOne('/api/v1/sleep-reminders/subscribe').flush(
      { message: 'Цей push-сервіс не підтримується.' },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();

    const alert = (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Цей push-сервіс не підтримується.');
    client.error('Цей push-сервіс не підтримується.');
    expect(client.messages()).toHaveLength(1);
    (alert?.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(client.messages()).toHaveLength(0);
    http.verify();
  });
});
