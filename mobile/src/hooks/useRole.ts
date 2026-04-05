import { useAuthStore, ShopRole } from '@/store/auth';

/**
 * Returns the current user's role and permission helpers.
 *
 * Role hierarchy: owner > manager > staff
 *
 * Permission matrix:
 *   Treasury / Payouts   — owner only
 *   Reports / Analytics  — owner + manager
 *   Sales / Scan / Credit — all roles
 */
export function useRole() {
  const role = useAuthStore(s => s.role);

  return {
    role,
    isOwner:   role === 'owner',
    isManager: role === 'owner' || role === 'manager',
    isStaff:   true, // all roles can do basic operations

    /** Returns true if the role can access treasury/payouts */
    canAccessTreasury: role === 'owner',

    /** Returns true if the role can view reports and analytics */
    canAccessReports: role === 'owner' || role === 'manager',

    /** Returns true if the role can manage inventory (add/edit products) */
    canManageInventory: role === 'owner' || role === 'manager',
  };
}
