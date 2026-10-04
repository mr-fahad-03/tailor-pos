/**
 * Permission catalog.
 *
 * A permission is a plain string the API checks before running a handler.
 * Roles are only a convenient starting set — every user stores an explicit
 * permission list, so an admin can tick/untick individual capabilities per
 * person. `super_admin` bypasses the list entirely and always has everything.
 */

export const PERMISSIONS = [
  'dashboard.view',

  'jobcards.view',
  'jobcards.create',
  'jobcards.edit',
  'jobcards.payment',
  'jobcards.close',
  'jobcards.convert',

  'sales.view',
  'sales.create',

  'ledgers.view',
  'ledgers.manage',

  'products.view',
  'products.manage',

  'payments.view',

  'reports.view',

  'settings.manage',
  'users.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLES = ['super_admin', 'admin', 'salesman'] as const;
export type Role = (typeof ROLES)[number];

/** Human-readable grouping used by the Users screen to render checkboxes. */
export const PERMISSION_GROUPS: { group: string; items: { key: Permission; label: string }[] }[] = [
  {
    group: 'Dashboard',
    items: [{ key: 'dashboard.view', label: 'View dashboard' }],
  },
  {
    group: 'Job Cards',
    items: [
      { key: 'jobcards.view', label: 'View job cards' },
      { key: 'jobcards.create', label: 'Create job cards' },
      { key: 'jobcards.edit', label: 'Edit job cards' },
      { key: 'jobcards.payment', label: 'Take payments / advances' },
      { key: 'jobcards.close', label: 'Close & reopen' },
      { key: 'jobcards.convert', label: 'Convert to sale' },
    ],
  },
  {
    group: 'Sales',
    items: [
      { key: 'sales.view', label: 'View sales & returns' },
      { key: 'sales.create', label: 'Create sales & returns' },
    ],
  },
  {
    group: 'Masters',
    items: [
      { key: 'ledgers.view', label: 'View ledgers' },
      { key: 'ledgers.manage', label: 'Add / edit / delete ledgers' },
      { key: 'products.view', label: 'View products' },
      { key: 'products.manage', label: 'Add / edit / delete products' },
    ],
  },
  {
    group: 'Accounts',
    items: [
      { key: 'payments.view', label: 'View all payments' },
      { key: 'reports.view', label: 'View reports' },
    ],
  },
  {
    group: 'Administration',
    items: [
      { key: 'settings.manage', label: 'Change business settings' },
      { key: 'users.manage', label: 'Manage users & permissions' },
    ],
  },
];

/**
 * Admins get the full catalog. They can reach the Users screen, but
 * `assertMayTouchRole` in the users route still stops them from creating or
 * editing a Super Admin, so this is not a privilege-escalation path.
 */
const ADMIN_PERMISSIONS: Permission[] = [...PERMISSIONS];

const SALESMAN_PERMISSIONS: Permission[] = [
  'dashboard.view',
  'jobcards.view',
  'jobcards.create',
  'jobcards.edit',
  'jobcards.payment',
  'sales.view',
  'sales.create',
  'ledgers.view',
  'products.view',
];

/** Default permission set pre-filled when a user of this role is created. */
export const ROLE_DEFAULTS: Record<Role, Permission[]> = {
  super_admin: [...PERMISSIONS],
  admin: ADMIN_PERMISSIONS,
  salesman: SALESMAN_PERMISSIONS,
};

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  salesman: 'Salesman',
};

export function isPermission(value: unknown): value is Permission {
  return typeof value === 'string' && (PERMISSIONS as readonly string[]).includes(value);
}

export function sanitizePermissions(input: unknown): Permission[] {
  if (!Array.isArray(input)) return [];
  const set = new Set<Permission>();
  for (const v of input) if (isPermission(v)) set.add(v);
  // Keep catalog order so stored arrays are stable and comparable.
  return PERMISSIONS.filter((p) => set.has(p));
}

/** Effective permissions for a user — super admins always hold every one. */
export function effectivePermissions(role: Role, permissions: string[]): Permission[] {
  if (role === 'super_admin') return [...PERMISSIONS];
  return sanitizePermissions(permissions);
}
