import type { NextApiRequest, NextApiResponse } from 'next';
import type { Request, Response } from 'express';
import app from 'tailor-pos-server/src/app';

/**
 * Serves the whole Express API as one Vercel serverless function, mounted at
 * /api on the same domain as the site — so the browser never makes a
 * cross-origin request and there is no CORS to configure.
 *
 * Next must not consume the request body first; Express's own json() parser
 * reads the raw stream.
 */
export const config = {
  api: { bodyParser: false, externalResolver: true },
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return new Promise<void>((resolve, reject) => {
    res.on('finish', resolve);
    res.on('close', resolve);
    try {
      app(req as unknown as Request, res as unknown as Response);
    } catch (err) {
      reject(err);
    }
  });
}
