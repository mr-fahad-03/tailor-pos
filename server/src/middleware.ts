import { Request, Response, NextFunction } from 'express';

export const asyncHandler =
  <T extends Request = Request>(
    fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>,
  ) =>
  (req: T, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: Error & { status?: number; code?: number; keyValue?: unknown; name?: string },
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  // eslint-disable-next-line no-console
  console.error('[api:error]', err.message, err.stack);
  if (err.code === 11000) {
    const field = err.keyValue ? Object.keys(err.keyValue)[0] : 'record';
    res.status(409).json({ error: `Duplicate ${field} — this record already exists.` });
    return;
  }
  if (err.name === 'ValidationError' || err.name === 'CastError') {
    res.status(400).json({ error: err.message });
    return;
  }
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
  });
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Not found' });
}
