import mongoose from 'mongoose';
import { config } from './config';
import { runMigrations } from './migrations';

/**
 * Serverless invocations reuse a warm container, so the connection is cached
 * on the global object rather than opened per request — otherwise every cold
 * request would open another Atlas connection and exhaust the cluster's pool.
 */
interface MongoCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

const globalWithMongo = globalThis as typeof globalThis & { _tailorPosMongo?: MongoCache };

const cache: MongoCache = globalWithMongo._tailorPosMongo ?? { conn: null, promise: null };
globalWithMongo._tailorPosMongo = cache;

export async function connectDb(): Promise<void> {
  if (cache.conn) return;

  if (!cache.promise) {
    mongoose.set('strictQuery', true);
    cache.promise = mongoose
      .connect(config.mongoUri, {
        // Keep the pool small: many short-lived function instances share one cluster.
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 10000,
      })
      .then(async (m) => {
        // eslint-disable-next-line no-console
        console.log('[db] connected');
        await runMigrations();
        return m;
      })
      .catch((err) => {
        // Let the next request retry instead of caching a failed attempt.
        cache.promise = null;
        throw err;
      });
  }

  cache.conn = await cache.promise;
}
