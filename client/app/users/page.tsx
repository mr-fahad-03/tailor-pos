'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { AuthUser, PermissionCatalog, Role } from '@/lib/types';
import { Card, EmptyState, Field, Select, TextInput } from '@/components/ui';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/components/AuthContext';
import { fmtDate } from '@/lib/format';

const ROLE_TONE: Record<Role, string> = {
  super_admin: 'bg-brand-100 text-brand-800',
  admin: 'bg-brass-100 text-brass-800',
  salesman: 'bg-ink-200 text-ink-700',
};

interface FormState {
  id: string | null;
  username: string;
  name: string;
  password: string;
  role: Role;
  active: boolean;
  permissions: string[];
}

const BLANK: FormState = {
  id: null,
  username: '',
  name: '',
  password: '',
  role: 'salesman',
  active: true,
  permissions: [],
};

export default function UsersPage() {
  const { toast } = useToast();
  const { user: me, refresh } = useAuth();

  const [rows, setRows] = useState<AuthUser[]>([]);
  const [catalog, setCatalog] = useState<PermissionCatalog | null>(null);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<AuthUser | null>(null);

  const load = useCallback(
    async (query = '') => {
      try {
        const res = await api.users.list(query);
        setRows(res.items);
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Could not load users', 'error');
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    void load();
    api.auth
      .permissions()
      .then(setCatalog)
      .catch(() => setCatalog(null));
  }, [load]);

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => void load(q), 250);
    return () => clearTimeout(t);
  }, [q, load]);

  const isSuperAdmin = me?.role === 'super_admin';

  function openCreate() {
    setError('');
    setForm({ ...BLANK, permissions: defaultsFor('salesman') });
  }

  function openEdit(u: AuthUser) {
    setError('');
    setForm({
      id: u.id,
      username: u.username,
      name: u.name,
      password: '',
      role: u.role,
      active: u.active,
      permissions: [...u.permissions],
    });
  }

  /** Mirrors the server's ROLE_DEFAULTS so the checkboxes pre-fill sensibly. */
  function defaultsFor(role: Role): string[] {
    if (!catalog) return [];
    const all = catalog.permissions;
    if (role === 'super_admin' || role === 'admin') return [...all];
    return all.filter((p) =>
      [
        'dashboard.view',
        'jobcards.view',
        'jobcards.create',
        'jobcards.edit',
        'jobcards.payment',
        'sales.view',
        'sales.create',
        'ledgers.view',
        'products.view',
      ].includes(p),
    );
  }

  function toggle(key: string) {
    setForm((f) =>
      f
        ? {
            ...f,
            permissions: f.permissions.includes(key)
              ? f.permissions.filter((p) => p !== key)
              : [...f.permissions, key],
          }
        : f,
    );
  }

  async function save() {
    if (!form) return;
    setError('');
    setBusy(true);
    try {
      if (form.id) {
        await api.users.update(form.id, {
          name: form.name,
          role: form.role,
          active: form.active,
          permissions: form.permissions,
          ...(form.password ? { password: form.password } : {}),
        });
        toast('User updated');
      } else {
        await api.users.create({
          username: form.username,
          name: form.name,
          password: form.password,
          role: form.role,
          active: form.active,
          permissions: form.permissions,
        });
        toast('User created');
      }
      setForm(null);
      await load(q);
      // Our own permissions may have just changed.
      if (form.id === me?.id) await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save user');
    } finally {
      setBusy(false);
    }
  }

  async function doDelete(u: AuthUser) {
    setBusy(true);
    try {
      await api.users.remove(u.id);
      toast(`Deleted ${u.username}`);
      setConfirmDelete(null);
      await load(q);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not delete user', 'error');
    } finally {
      setBusy(false);
    }
  }

  const superAdminLocked = (u: AuthUser) => u.role === 'super_admin' && !isSuperAdmin;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-sub">
            Who can sign in, and exactly what each person is allowed to do.
          </p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          + New User
        </button>
      </div>

      <div className="mt-6 max-w-sm">
        <TextInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or username…"
        />
      </div>

      <Card className="mt-4 overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-ink-100" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No users found" sub="Create an account to get someone started." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-ink-200 bg-ink-50">
                  <th className="th">User</th>
                  <th className="th">Role</th>
                  <th className="th">Permissions</th>
                  <th className="th">Status</th>
                  <th className="th">Last sign-in</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((u) => (
                  <tr key={u.id} className="hover:bg-ink-50/70">
                    <td className="td">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ink-100 text-[11px] font-bold text-ink-600">
                          {u.name.slice(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <p className="font-semibold text-ink-900">
                            {u.name}
                            {u.id === me?.id && (
                              <span className="ml-2 badge-muted">you</span>
                            )}
                          </p>
                          <p className="font-mono text-[11px] text-ink-500">@{u.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="td">
                      <span className={`badge ${ROLE_TONE[u.role]}`}>{u.roleLabel}</span>
                    </td>
                    <td className="td text-ink-600">
                      {u.role === 'super_admin' ? 'All (unrestricted)' : `${u.permissions.length} granted`}
                    </td>
                    <td className="td">
                      {u.active ? (
                        <span className="badge bg-brand-100 text-brand-800">Active</span>
                      ) : (
                        <span className="badge bg-rose-100 text-rose-700">Disabled</span>
                      )}
                    </td>
                    <td className="td text-ink-500">
                      {u.lastLoginAt ? fmtDate(u.lastLoginAt) : 'Never'}
                    </td>
                    <td className="td text-right">
                      <div className="inline-flex gap-1">
                        <button
                          className="btn-ghost !px-2.5 !py-1 text-xs"
                          onClick={() => openEdit(u)}
                          disabled={superAdminLocked(u)}
                          title={
                            superAdminLocked(u)
                              ? 'Only a Super Admin can edit a Super Admin'
                              : undefined
                          }
                        >
                          Edit
                        </button>
                        <button
                          className="btn-ghost !px-2.5 !py-1 text-xs text-rose-600 hover:bg-rose-50"
                          onClick={() => setConfirmDelete(u)}
                          disabled={u.id === me?.id || superAdminLocked(u)}
                          title={u.id === me?.id ? 'You cannot delete your own account' : undefined}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* --- create / edit ------------------------------------------------ */}
      {form && (
        <Modal
          open
          wide
          title={form.id ? `Edit ${form.username}` : 'New user'}
          sub="Role sets the starting permissions — tick or untick anything below."
          onClose={() => setForm(null)}
          footer={
            <>
              <button className="btn-soft" onClick={() => setForm(null)} disabled={busy}>
                Cancel
              </button>
              <button className="btn-primary" onClick={save} disabled={busy}>
                {busy ? 'Saving…' : form.id ? 'Save changes' : 'Create user'}
              </button>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <TextInput
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Imran Khan"
              />
            </Field>
            <Field label="Username">
              <TextInput
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })}
                disabled={Boolean(form.id)}
                placeholder="lowercase, no spaces"
                className={form.id ? 'bg-ink-50 text-ink-500' : ''}
              />
            </Field>
            <Field label={form.id ? 'New password (leave blank to keep)' : 'Password'}>
              <TextInput
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="new-password"
                placeholder="at least 8 characters"
              />
            </Field>
            <Field label="Role">
              <Select
                value={form.role}
                onChange={(e) => {
                  const role = e.target.value as Role;
                  setForm({ ...form, role, permissions: defaultsFor(role) });
                }}
              >
                <option value="salesman">Salesman</option>
                <option value="admin">Admin</option>
                <option value="super_admin" disabled={!isSuperAdmin}>
                  Super Admin {isSuperAdmin ? '' : '(Super Admin only)'}
                </option>
              </Select>
            </Field>
          </div>

          <label className="mt-4 inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-ink-700">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            />
            Account is active (can sign in)
          </label>

          <div className="mt-6 border-t border-ink-100 pt-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-ink-900">Permissions</p>
                <p className="mt-0.5 text-xs text-ink-500">
                  {form.role === 'super_admin'
                    ? 'Super Admins always hold every permission — this list is fixed.'
                    : `${form.permissions.length} of ${catalog?.permissions.length ?? 0} granted`}
                </p>
              </div>
              {form.role !== 'super_admin' && (
                <button
                  className="btn-soft !py-1.5 text-xs"
                  onClick={() => setForm({ ...form, permissions: defaultsFor(form.role) })}
                >
                  Reset to role defaults
                </button>
              )}
            </div>

            {!catalog ? (
              <p className="text-sm text-ink-500">Loading permissions…</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {catalog.groups.map((g) => (
                  <div key={g.group} className="rounded-lg border border-ink-200 bg-ink-50/50 p-3">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-500">
                      {g.group}
                    </p>
                    <div className="space-y-1.5">
                      {g.items.map((item) => {
                        const checked =
                          form.role === 'super_admin' || form.permissions.includes(item.key);
                        return (
                          <label
                            key={item.key}
                            className={`flex items-start gap-2 text-[13px] ${
                              form.role === 'super_admin'
                                ? 'cursor-not-allowed text-ink-400'
                                : 'cursor-pointer text-ink-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={form.role === 'super_admin'}
                              onChange={() => toggle(item.key)}
                              className="mt-0.5 h-3.5 w-3.5 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                            />
                            {item.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
              {error}
            </p>
          )}
        </Modal>
      )}

      {/* --- delete confirm ----------------------------------------------- */}
      {confirmDelete && (
        <Modal
          open
          title="Delete user"
          onClose={() => setConfirmDelete(null)}
          footer={
            <>
              <button className="btn-soft" onClick={() => setConfirmDelete(null)} disabled={busy}>
                Cancel
              </button>
              <button className="btn-danger" onClick={() => doDelete(confirmDelete)} disabled={busy}>
                {busy ? 'Deleting…' : 'Delete user'}
              </button>
            </>
          }
        >
          <p className="text-sm leading-relaxed text-ink-700">
            Permanently delete <strong className="font-bold">{confirmDelete.name}</strong> (
            <span className="font-mono text-xs">@{confirmDelete.username}</span>)? They will lose
            access immediately. Stitching orders and bills they created are kept.
          </p>
        </Modal>
      )}
    </div>
  );
}
