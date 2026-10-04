import { app } from './app';
import { config } from './config';
import { connectDb } from './db';

/**
 * Local development server. On Vercel the app is served by a serverless
 * function instead (see client/pages/api), which never runs this file.
 */
async function main() {
  await connectDb();
  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[api] listening on http://localhost:${config.port}/api`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[api:fatal]', err);
  process.exit(1);
});
