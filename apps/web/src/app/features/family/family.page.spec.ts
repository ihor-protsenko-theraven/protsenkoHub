import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MOBILE_WEB_ORIGIN_TOKEN } from '../../core/configs/mobile-web.config';
import { AuthService } from '../../core/services/auth.service';
import { FamilyPage } from './family.page';
import { FamilyService } from './family.service';

describe('FamilyPage child profile', () => {
  it('refreshes the native sleep widget after saving the family child', () => {
    const refreshNativeWidget = vi.fn(async () => undefined);
    const reload = vi.fn();
    const saveChild = vi.fn().mockReturnValue(of({
      id: 'child-1', name: 'Соломія', birthDate: '2025-01-01',
    }));
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { refreshNativeWidget } },
        { provide: FamilyService, useValue: {
          overview: { hasValue: () => false, reload }, saveChild,
        } },
        { provide: MOBILE_WEB_ORIGIN_TOKEN, useValue: 'https://example.test' },
      ],
    });
    const page = TestBed.runInInjectionContext(() => new FamilyPage());
    page.childModel.set({ name: 'Соломія', birthDate: '2025-01-01' });

    page.saveChild();

    expect(saveChild).toHaveBeenCalledWith({ name: 'Соломія', birthDate: '2025-01-01' });
    expect(reload).toHaveBeenCalledTimes(1);
    expect(refreshNativeWidget).toHaveBeenCalledTimes(1);
  });
});
