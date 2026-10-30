import { ArgumentsHost, Catch, HttpStatus, Injectable } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Response } from 'express';
import { AUTH } from './auth.config';

const SESSION_FOREIGN_KEYS = [
  'householdId',
  'createdById',
  'updatedById',
  'startedById',
  'endedById',
  'userId',
] as const;

export function isStaleSessionPrismaError(exception: unknown): boolean {
  if (
    typeof exception !== 'object' ||
    exception === null ||
    !('code' in exception)
  ) {
    return false;
  }
  const code = exception.code;
  const meta =
    'meta' in exception &&
    typeof exception.meta === 'object' &&
    exception.meta !== null
      ? exception.meta
      : null;

  if (code === 'P2003') {
    const constraint =
      meta && 'constraint' in meta && typeof meta.constraint === 'string'
        ? meta.constraint
        : '';
    const fieldName =
      meta && 'field_name' in meta && typeof meta.field_name === 'string'
        ? meta.field_name
        : '';
    const message =
      'message' in exception && typeof exception.message === 'string'
        ? exception.message
        : '';
    const target = `${constraint} ${fieldName} ${message}`;
    return SESSION_FOREIGN_KEYS.some((key) => target.includes(key));
  }

  if (code === 'P2025') {
    const modelName =
      meta && 'modelName' in meta && typeof meta.modelName === 'string'
        ? meta.modelName
        : '';
    return modelName === 'Household' || modelName === 'User';
  }

  return false;
}

@Injectable()
@Catch()
export class StaleSessionExceptionFilter extends BaseExceptionFilter {
  override catch(exception: unknown, host: ArgumentsHost): void {
    if (isStaleSessionPrismaError(exception)) {
      const response = host.switchToHttp().getResponse<Response>();
      response.clearCookie?.(AUTH.cookieName, { path: AUTH.cookiePath });
      response.status(HttpStatus.UNAUTHORIZED).json({
        statusCode: HttpStatus.UNAUTHORIZED,
        message: 'Сесія застаріла. Увійдіть знову.',
        error: 'Unauthorized',
      });
      return;
    }
    super.catch(exception, host);
  }
}
