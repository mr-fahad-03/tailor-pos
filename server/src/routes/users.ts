import { Router } from 'express';
import { asyncHandler, HttpError } from '../middleware';
import { User, hashPassword } from '../models/User';
import { requireAuth, requirePerm } from '../auth/guard';
import {
  ROLES,
  ROLE_DEFAULTS,
  ROLE_LABELS,
  Role,
  effectivePermissions,
  sanitizePermissions,
} from '../auth/permissions';

export const userRouter = Router();

userRouter.use(requireAuth, requirePerm('users.manage'));

function present(doc: {
  _id: unknown;
  username: string;
  name: string;
  role: Role;
  permissions?: string[];
  active?: boolean;
  lastLoginAt?: Date;
  createdAt?: Date;
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
    createdAt: doc.createdAt ?? null,
  };
}

function isRole(v: unknown): v is Role {
  return typeof v === 'string' && (ROLES as readonly string[]).includes(v);
}

/**
 * Only a super admin may create, edit or delete another super admin.
 * This stops an admin from escalating their own privileges by minting a
 * super admin account, or from locking the owner out of their own system.
 */
function assertMayTouchRole(actorRole: Role, targetRole: Role): void {
  if (targetRole === 'super_admin' && actorRole !== 'super_admin') {
    throw new HttpError(403, 'Only a Super Admin can manage Super Admin accounts');
  }
}

// GET /users
userRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = String((req.query.q as string) ?? '').trim();
    const filter = q
      ? {
          $or: [
            { name: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
            { username: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
          ],
        }
      : {};
    const items = await User.find(filter).sort({ role: 1, name: 1 }).lean();
    res.json({ items: items.map(present), total: items.length });
  }),
);

// POST /users
userRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const username = String(req.body?.username ?? '').trim().toLowerCase();
    const name = String(req.body?.name ?? '').trim();
    const password = String(req.body?.password ?? '');
    const role = req.body?.role;

    if (!/^[a-z0-9._-]{3,}$/.test(username)) {
      throw new HttpError(
        400,
        'Username must be at least 3 characters (letters, numbers, dot, dash, underscore)',
      );
    }
    if (!name) throw new HttpError(400, 'Full name is required');
    if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
    if (!isRole(role)) throw new HttpError(400, 'Pick a valid role');

    assertMayTouchRole(req.user!.role, role);

    const exists = await User.findOne({ username }).lean();
    if (exists) throw new HttpError(409, 'That username is already taken');

    // Fall back to the role's defaults when the client sends no explicit list.
    const permissions =
      req.body?.permissions === undefined
        ? ROLE_DEFAULTS[role]
        : sanitizePermissions(req.body.permissions);

    const user = await User.create({
      username,
      name,
      role,
      permissions,
      active: req.body?.active !== false,
      passwordHash: await hashPassword(password),
    });

    res.status(201).json(present(user.toObject()));
  }),
);

// PUT /users/:id
userRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw new HttpError(404, 'User not found');

    assertMayTouchRole(req.user!.role, user.role);

    const isSelf = String(user._id) === req.user!.id;

    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) throw new HttpError(400, 'Full name is required');
      user.name = name;
    }

    if (req.body?.role !== undefined) {
      if (!isRole(req.body.role)) throw new HttpError(400, 'Pick a valid role');
      assertMayTouchRole(req.user!.role, req.body.role);
      if (isSelf && req.body.role !== user.role) {
        throw new HttpError(400, 'You cannot change your own role');
      }
      if (user.role === 'super_admin' && req.body.role !== 'super_admin') {
        const others = await User.countDocuments({ role: 'super_admin', _id: { $ne: user._id } });
        if (others === 0) throw new HttpError(400, 'There must be at least one Super Admin');
      }
      user.role = req.body.role;
    }

    if (req.body?.permissions !== undefined) {
      user.permissions = sanitizePermissions(req.body.permissions);
    }

    if (req.body?.active !== undefined) {
      const active = Boolean(req.body.active);
      if (isSelf && !active) throw new HttpError(400, 'You cannot deactivate your own account');
      if (!active && user.role === 'super_admin') {
        const others = await User.countDocuments({
          role: 'super_admin',
          active: { $ne: false },
          _id: { $ne: user._id },
        });
        if (others === 0) throw new HttpError(400, 'There must be at least one active Super Admin');
      }
      user.active = active;
    }

    if (req.body?.password) {
      const password = String(req.body.password);
      if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
      user.passwordHash = await hashPassword(password);
    }

    await user.save();
    res.json(present(user.toObject()));
  }),
);

// DELETE /users/:id
userRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw new HttpError(404, 'User not found');

    assertMayTouchRole(req.user!.role, user.role);

    if (String(user._id) === req.user!.id) {
      throw new HttpError(400, 'You cannot delete your own account');
    }
    if (user.role === 'super_admin') {
      const others = await User.countDocuments({ role: 'super_admin', _id: { $ne: user._id } });
      if (others === 0) throw new HttpError(400, 'There must be at least one Super Admin');
    }

    await user.deleteOne();
    res.json({ ok: true });
  }),
);
