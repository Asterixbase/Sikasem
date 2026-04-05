/**
 * RoleGate — wraps a screen or section with a locked overlay when the user
 * doesn't have the required role.
 *
 * Usage:
 *   <RoleGate allowed={['owner']} feature="Treasury">
 *     <TreasuryContent />
 *   </RoleGate>
 *
 * When locked, renders a full-screen placeholder explaining why access
 * is restricted and who to contact. This is the "tier feature" UI.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useRole, } from '@/hooks/useRole';
import { useAuthStore, ShopRole } from '@/store/auth';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';

interface RoleGateProps {
  /** Roles that are allowed to see the content. */
  allowed: ShopRole[];
  /** Human-readable feature name shown in the lock screen. */
  feature: string;
  /** Optional description shown under the feature name. */
  description?: string;
  /** If true, shows an "Upgrade Plan" CTA — for tier-gated features. */
  tierGated?: boolean;
  children: React.ReactNode;
}

const ROLE_LABELS: Record<ShopRole, string> = {
  owner:   'Shop Owner',
  manager: 'Manager',
  staff:   'Staff',
};

export function RoleGate({ allowed, feature, description, tierGated, children }: RoleGateProps) {
  const role = useAuthStore(s => s.role);

  if (allowed.includes(role)) {
    return <>{children}</>;
  }

  // Determine who CAN access this
  const whoCanAccess = allowed.map(r => ROLE_LABELS[r]).join(' or ');

  return (
    <View style={styles.root}>
      {/* Lock card */}
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Text style={styles.lockIcon}>🔒</Text>
        </View>

        <Text style={styles.title}>{feature}</Text>
        <Text style={styles.subtitle}>
          {description ?? `This section is only available to ${whoCanAccess}s.`}
        </Text>

        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>Your role: {ROLE_LABELS[role]}</Text>
        </View>

        <Text style={styles.hint}>
          Contact your shop owner to request access.
        </Text>

        {tierGated && (
          <Pressable
            style={styles.upgradeBtn}
            onPress={() => router.push('/(main)/settings' as any)}
          >
            <Text style={styles.upgradeBtnText}>View Plans →</Text>
          </Pressable>
        )}

        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.gy,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.s6,
  },
  card: {
    backgroundColor: Colors.w,
    borderRadius: Radius.xl,
    padding: Spacing.s6,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    ...Shadows.card,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.gy,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.s4,
  },
  lockIcon: { fontSize: 32 },
  title: {
    ...Typography.titleLG,
    color: Colors.t,
    textAlign: 'center',
    marginBottom: Spacing.s2,
  },
  subtitle: {
    ...Typography.bodyMD,
    color: Colors.t2,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.s4,
  },
  roleBadge: {
    backgroundColor: Colors.gy,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.s3,
    paddingVertical: 6,
    marginBottom: Spacing.s4,
  },
  roleBadgeText: { ...Typography.badge, color: Colors.t2 },
  hint: {
    ...Typography.bodySM,
    color: Colors.t2,
    textAlign: 'center',
    marginBottom: Spacing.s5,
  },
  upgradeBtn: {
    backgroundColor: Colors.g,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.s5,
    paddingVertical: Spacing.s3,
    marginBottom: Spacing.s3,
    width: '100%',
    alignItems: 'center',
  },
  upgradeBtnText: { ...Typography.titleSM, color: Colors.w },
  backBtn: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.s5,
    paddingVertical: Spacing.s3,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.gy2,
  },
  backBtnText: { ...Typography.bodyMD, color: Colors.t2 },
});
