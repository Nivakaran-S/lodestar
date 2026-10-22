import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { ODataError } from './errors';

const CODES: Record<number, string> = {
  400: 'BadRequest',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'NotFound',
  405: 'MethodNotAllowed',
  406: 'NotAcceptable',
  409: 'Conflict',
  412: 'PreconditionFailed',
  413: 'PayloadTooLarge',
  415: 'UnsupportedMediaType',
  422: 'UnprocessableEntity',
  428: 'PreconditionRequired',
  429: 'TooManyRequests',
  501: 'NotImplemented',
  502: 'BadGateway',
  503: 'ServiceUnavailable',
};

/** Maps Prisma engine errors to OData errors without leaking internals. */
function fromPrisma(err: any): ODataError | undefined {
  const target = Array.isArray(err?.meta?.target) ? err.meta.target.join(',') : (err?.meta?.field_name ?? null);
  switch (err?.code) {
    case 'P2002':
      return ODataError.conflict('An entity with the same key or unique value already exists', target);
    case 'P2003':
      return ODataError.conflict('A referenced entity does not exist', target);
    case 'P2025':
      return ODataError.notFound('The entity was not found', target);
    case 'P2000':
      return ODataError.badRequest('A value is too long for its property', target);
  }
  if (err?.name === 'PrismaClientValidationError') {
    return ODataError.badRequest('The request data is incomplete or has the wrong shape');
  }
  return undefined;
}

/** Converts any error into an OData error response (PLATFORM.md §3). */
export function toODataError(err: unknown): ODataError {
  if (err instanceof ODataError) return err;
  if (err instanceof HttpException) {
    const status = err.getStatus();
    const res = err.getResponse() as any;
    const message = typeof res === 'string' ? res : Array.isArray(res?.message) ? res.message.join('; ') : (res?.message ?? err.message);
    // A handler may name a precise code: new UnauthorizedException({ code: 'DeviceMismatch', message }).
    const code = typeof res?.code === 'string' && /^[A-Za-z][\w.]*$/.test(res.code) ? res.code : undefined;
    return new ODataError(status, code ?? CODES[status] ?? (status >= 500 ? 'InternalError' : 'BadRequest'), message);
  }
  if ((err as any)?.type === 'entity.parse.failed') return ODataError.badRequest('The request body is not valid JSON');
  if ((err as any)?.type === 'entity.too.large') return new ODataError(413, 'PayloadTooLarge', 'The request body is too large');
  return fromPrisma(err) ?? new ODataError(500, 'InternalError', 'An unexpected error occurred');
}

@Catch()
export class ODataExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('OData');

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== 'http') throw exception;
    const res = host.switchToHttp().getResponse();
    const req = host.switchToHttp().getRequest();
    const err = toODataError(exception);
    if (err.status >= 500) this.logger.error(`${req?.method} ${req?.originalUrl}: ${(exception as Error)?.stack ?? exception}`);
    if (res.headersSent) return;
    res.status(err.status);
    res.setHeader('OData-Version', '4.0');
    res.setHeader('Content-Type', 'application/json;odata.metadata=minimal');
    res.setHeader('Cache-Control', 'no-store');
    if (err.status === 401) res.setHeader('WWW-Authenticate', 'Bearer realm="lodestar", error="invalid_token"');
    res.send(JSON.stringify(err.toJSON()));
  }
}
