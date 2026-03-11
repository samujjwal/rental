import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';
import { I18nExceptionFilter } from './i18n-exception.filter';

function createMockHost(locale?: string, url = '/api/test') {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const request = { locale: locale || 'en', url };
  const response = { status };

  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  return { host, request, response, status, json };
}

describe('I18nExceptionFilter', () => {
  let filter: I18nExceptionFilter;

  beforeEach(() => {
    filter = new I18nExceptionFilter();
  });

  it('returns the original message when no messageKey is present', () => {
    const { host, status, json } = createMockHost('en');
    const exception = new HttpException('Something went wrong', HttpStatus.BAD_REQUEST);

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: 'Something went wrong',
        path: '/api/test',
      }),
    );
    expect(json.mock.calls[0][0]).not.toHaveProperty('messageKey');
  });

  it('translates messageKey to English when locale is en', () => {
    const { host, json } = createMockHost('en');
    const exception = new HttpException(
      { message: 'fallback', messageKey: 'auth.invalidCredentials' },
      HttpStatus.UNAUTHORIZED,
    );

    filter.catch(exception, host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        message: 'Invalid credentials',
        messageKey: 'auth.invalidCredentials',
      }),
    );
  });

  it('translates messageKey to Nepali when locale is ne', () => {
    const { host, json } = createMockHost('ne');
    const exception = new HttpException(
      { message: 'fallback', messageKey: 'auth.invalidCredentials' },
      HttpStatus.UNAUTHORIZED,
    );

    filter.catch(exception, host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        message: 'अमान्य इमेल वा पासवर्ड',
        messageKey: 'auth.invalidCredentials',
      }),
    );
  });

  it('defaults locale to en when request.locale is not set', () => {
    const { host, json } = createMockHost(undefined);
    const exception = new HttpException(
      { message: 'fallback', messageKey: 'common.notFound' },
      HttpStatus.NOT_FOUND,
    );

    filter.catch(exception, host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        message: 'Resource not found',
        messageKey: 'common.notFound',
      }),
    );
  });

  it('handles string exception responses', () => {
    const { host, json } = createMockHost('en');
    const exception = new HttpException('Plain string error', HttpStatus.FORBIDDEN);

    filter.catch(exception, host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        message: 'Plain string error',
      }),
    );
  });

  it('includes timestamp and path in the response', () => {
    const { host, json } = createMockHost('en', '/api/bookings/123');
    const exception = new HttpException('Not found', HttpStatus.NOT_FOUND);

    filter.catch(exception, host);

    const body = json.mock.calls[0][0];
    expect(body.timestamp).toBeDefined();
    expect(body.path).toBe('/api/bookings/123');
  });
});
