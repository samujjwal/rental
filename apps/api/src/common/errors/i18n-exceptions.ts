/**
 * i18n-aware exception helpers.
 *
 * Usage:
 *   throw i18nBadRequest('booking.invalidDates');
 *   throw i18nNotFound('listing.notFound');
 *
 * The global I18nExceptionFilter picks up `messageKey` and
 * translates the response body using the caller's Accept-Language.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { getLocalizedMessage, type MessageKey } from '../i18n/messages';

function payload(key: MessageKey) {
  return { message: getLocalizedMessage(key, 'en'), messageKey: key };
}

export const i18nBadRequest = (key: MessageKey) =>
  new BadRequestException(payload(key));

export const i18nNotFound = (key: MessageKey) =>
  new NotFoundException(payload(key));

export const i18nForbidden = (key: MessageKey) =>
  new ForbiddenException(payload(key));

export const i18nUnauthorized = (key: MessageKey) =>
  new UnauthorizedException(payload(key));

export const i18nConflict = (key: MessageKey) =>
  new ConflictException(payload(key));

export const i18nUnprocessable = (key: MessageKey) =>
  new UnprocessableEntityException(payload(key));
