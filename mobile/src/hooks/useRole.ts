import { useAuthStore, ShopRole } from '@/store/auth';

/**
 * Returns the current user's role and permission helpers.
 *
 * Role hierarchy: superuser > owner > manager > staff
 * superuser bypasses ALL role gates (test / admin use).
 *
 * Permission matrix:
 *   Treasury / Payouts   — owner + superuser
 *   Reports / Analytics  — owner + manager + superuser
 *   Sales / Scan / Credit — all roles
 */
export function useRole() {
  const role = useAuthStore(s => s.role);
  const isSuperuser = role === 'superuser';

  return {
    role,
    isSuperuser,
    isOwner:   isSuperuser || role === 'owner',
    isManager: isSuperuser || role === 'owner' || role === 'manager',
    isStaff:   true, // all roles can do basic operations

    /** Returns true if the role can access treasury/payouts */
    canAccessTreasury: isSuperuser || role === 'owner',

    /** Returns true if the role can view reports and analytics */
    canAccessReports: isSuperuser || role === 'owner' || role === 'manager',

    /** Returns true if the role can manage inventory (add/edit products) */
    canManageInventory: isSuperuser || role === 'owner' || role === 'manager',
  };
}
