import { Request, Response, NextFunction } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config';
import { HttpError } from '../middleware';
import { User } from '../models/User';
import { Permission, Role, effectivePermissions } from './permissions';

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: Role;
  permissions: Permission[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

interface TokenPayload {
  sub: string;
  username: string;
  role: Role;
}

export function signToken(user: { id: string; username: string; role: Role }): string {
  const payload: TokenPayload = { sub: user.id, username: user.username, role: user.role };
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as SignOptions);
}

function readToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

/**
 * Verifies the bearer token and loads the user fresh from the database on
 * every request, so a deactivated account or an edited permission set takes
 * effect immediately rather than when the token eventually expires.
 */
const authContext: { user?: AuthUser } = {};

export const requireAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const token = readToken(req);
  if (!token) {
    next(new HttpError(401, 'Sign in to continue'));
    return;
  }

  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, config.jwtSecret) as TokenPayload;
  } catch {
    next(new HttpError(401, 'Your session has expired — please sign in again'));
    return;
  }

  User.findById(payload.sub)
    .lean()
    .then((doc: unknown) => {
      const found = doc as
        | { _id: unknown; username: string; name: string; role: Role; permissions?: string[]; active?: boolean }
        | null;
      if (!found) {
        next(new HttpError(401, 'Account no longer exists'));
        return;
      }
      if (found.active === false) {
        next(new HttpError(403, 'This account has been deactivated'));
        return;
      }
      authContext.user = {
        id: String(found._id),
        username: found.username,
        name: found.name,
        role: found.role,
        permissions: effectivePermissions(found.role, found.permissions ?? []),
      };
      Object.defineProperty(req, 'user', {
        get: () => authContext.user,
        configurable: true,
      });
      next();
    })
    .catch(next);
};

/** Route guard: the signed-in user must hold every listed permission. */
export const requirePerm =
  (...needed: Permission[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new HttpError(401, 'Sign in to continue'));
      return;
    }
    const missing = needed.filter((p) => !req.user!.permissions.includes(p));
    if (missing.length > 0) {
      next(new HttpError(403, `You do not have permission to do that (${missing.join(', ')})`));
      return;
    }
    next();
  };

export const can = (req: Request, permission: Permission): boolean =>
  Boolean(req.user?.permissions.includes(permission));

/**
 * Route guard for things only the owner of the system may see. This is checked
 * against the role itself, not a permission, so it cannot be handed to another
 * account from the Users screen.
 */
export const requireSuperAdmin = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user) {
    next(new HttpError(401, 'Sign in to continue'));
    return;
  }
  if (req.user.role !== 'super_admin') {
    next(new HttpError(403, 'Only a Super Admin can view the change log'));
    return;
  }
  next();
};
