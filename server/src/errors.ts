import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Event') => new HttpError(404, 'NOT_FOUND', `${what} not found`);

/** Flattens zod issues into `{ "location.name": "Location is required" }`, first message per field wins. */
export function toFieldErrors(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_';
    out[key] ??= issue.message;
  }
  return out;
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: 'Please fix the highlighted fields', fieldErrors: toFieldErrors(err) } });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, fieldErrors: err.fieldErrors } });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'BAD_JSON', message: 'Request body is not valid JSON' } });
    return;
  }
  // Errors from Express middleware (e.g. serve-static's 404) carry their own 4xx status.
  const status = Number(err?.status ?? err?.statusCode);
  if (status >= 400 && status < 500) {
    // Generic message: middleware errors can include filesystem paths.
    res.status(status).json({ error: { code: status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST', message: status === 404 ? 'Not found' : 'Bad request' } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong' } });
};
