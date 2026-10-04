import { Router } from 'express';
import { asyncHandler, HttpError } from '../middleware';
import { User, hashPassword } from '../models/User';
import { requireAuth, signToken } from '../auth/guard';
import {
  PERMISSION_GROUPS,
  PERMISSIONS,
  ROLE_LABELS,
  Role,
  effectivePermissions,
} from '../auth/permissions';

export const authRouter = Router();

function present(doc: {
  _id: unknown;
  username: string;
  name: string;
  role: Role;
  permissions?: string[];
  active?: boolean;
  lastLoginAt?: Date;
}) {
  return {
    id: String(doc._id),
    username: doc.username,
    name: doc.name,
    role: doc.role,
    roleLabel: ROLE_LABELS[doc.role],
    active: doc.active !== false,
    permissions: effectivePermissions(doc.role, doc.permissions ?? []),
    lastLoginAt: doc.lastLoginAt ?? null,
  };
}

// POST /auth/login
authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const username = String(req.body?.username ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');

    if (!username || !password) throw new HttpError(400, 'Username and password are required');

    const user = await User.findOne({ username });
    // Same message either way so the form cannot be used to probe for usernames.
    if (!user) throw new HttpError(401, 'Incorrect username or password');

    const ok = await user.comparePassword(password);
    if (!ok) throw new HttpError(401, 'Incorrect username or password');
    if (user.active === false) throw new HttpError(403, 'This account has been deactivated');

    user.lastLoginAt = new Date();
    await user.save();

    res.json({ token: signToken({ id: String(user._id), username: user.username, role: user.role }), user: present(user) });
  }),
);

// GET /auth/me
authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user!.id).lean();
    if (!user) throw new HttpError(401, 'Account no longer exists');
    res.json({ user: present(user) });
  }),
);

// POST /auth/change-password — any signed-in user, for their own account
authRouter.post(
  '/change-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const current = String(req.body?.currentPassword ?? '');
    const next = String(req.body?.newPassword ?? '');
    if (next.length < 8) throw new HttpError(400, 'New password must be at least 8 characters');

    const user = await User.findById(req.user!.id);
    if (!user) throw new HttpError(401, 'Account no longer exists');
    if (!(await user.comparePassword(current))) {
      throw new HttpError(400, 'Current password is incorrect');
    }

    user.passwordHash = await hashPassword(next);
    await user.save();
    res.json({ ok: true });
  }),
);

// GET /auth/permissions — catalog used to render the permission checkboxes
authRouter.get('/permissions', requireAuth, (_req, res) => {
  res.json({ permissions: PERMISSIONS, groups: PERMISSION_GROUPS, roleLabels: ROLE_LABELS });
});
