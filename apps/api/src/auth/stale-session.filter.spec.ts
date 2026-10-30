import type { ArgumentsHost } from '@nestjs/common';
import {
  StaleSessionExceptionFilter,
  isStaleSessionPrismaError,
} from './stale-session.filter';

describe('StaleSessionExceptionFilter', () => {
  it('recognizes Prisma P2003 foreign key errors for stale userId and householdId claims', () => {
    expect(
      isStaleSessionPrismaError({
        code: 'P2003',
        meta: {
          modelName: 'Contact',
          constraint: 'Contact_createdById_fkey',
        },
      }),
    ).toBe(true);

    expect(
      isStaleSessionPrismaError({
        code: 'P2003',
        meta: {
          modelName: 'SleepProfile',
          constraint: 'SleepProfile_householdId_fkey',
        },
      }),
    ).toBe(true);

    expect(
      isStaleSessionPrismaError({
        code: 'P2003',
        meta: {
          modelName: 'ShoppingItem',
          constraint: 'ShoppingItem_listId_fkey',
        },
      }),
    ).toBe(false);
  });

  it('clears the access_token cookie and returns 401 when a stale session triggers P2003', () => {
    const clearCookie = vi.fn();
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ clearCookie, status }),
      }),
    } as unknown as ArgumentsHost;

    const filter = new StaleSessionExceptionFilter();
    filter.catch(
      {
        code: 'P2003',
        meta: {
          modelName: 'Contact',
          constraint: 'Contact_createdById_fkey',
        },
      },
      host,
    );

    expect(clearCookie).toHaveBeenCalledWith('access_token', { path: '/' });
    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({
      statusCode: 401,
      message: 'Сесія застаріла. Увійдіть знову.',
      error: 'Unauthorized',
    });
  });
});
