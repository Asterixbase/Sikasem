import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, Pressable, Alert, ScrollView } from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { adminApi } from '@/api';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import { ScreenHeader, SafeScrollView, Button, LoadingState, ErrorState } from '@/components';

type RoleTab = 'Manager' | 'Cashier' | 'Inventory' | '+Custom';

interface Permission {
  key: string;
  label: string;
  type: 'checkbox' | 'toggle';
  sensitive?: boolean;
}

const SALES_PERMISSIONS: Permission[] = [
  { key: 'edit_prices', label: 'Edit Prices', type: 'checkbox' },
  { key: 'issue_refunds', label: 'Issue Refunds', type: 'checkbox' },
  { key: 'override_credit', label: 'Override Credit', type: 'checkbox' },
];

const INVENTORY_PERMISSIONS: Permission[] = [
  { key: 'manual_adjustments', label: 'Manual Adjustments', type: 'toggle' },
  { key: 'bulk_ocr', label: 'Bulk OCR', type: 'toggle' },
  { key: 'delete_skus', label: 'Delete SKUs', type: 'toggle' },
];

const COMPLIANCE_PERMISSIONS: Permission[] = [
  { key: 'export_gra_csv', label: 'Export GRA CSV', type: 'toggle', sensitive: true },
  { key: 'delete_invoices', label: 'Delete Invoices', type: 'toggle', sensitive: true },
  { key: 'security_audit', label: 'Security Audit', type: 'toggle', sensitive: true },
];

const DEFAULT_MANAGER: Record<string, boolean> = {
  edit_prices: true,
  issue_refunds: true,
  override_credit: false,
  manual_adjustments: true,
  bulk_ocr: true,
  delete_skus: false,
  export_gra_csv: true,
  delete_invoices: false,
  security_audit: true,
};

export default function PermissionsScreen() {
  const [role, setRole] = useState<RoleTab>('Manager');
  const [perms, setPerms] = useState<Record<string, boolean>>(DEFAULT_MANAGER);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: () => adminApi.roles().then(r => r.data),
  });

  const { mutate: saveRole, isPending } = useMutation({
    mutationFn: () => adminApi.updateRole(role.toLowerCase(), perms),
    onSuccess: () => Alert.alert('Saved', 'Role permissions updated'),
    onError: () => Alert.alert('Error', 'Could not save permissions'),
  });

  if (isLoading) return <LoadingState message="Loading roles…" />;
  if (error) return <ErrorState message="Could not load roles" />;

  const togglePerm = (key: string) => {
    setPerms(p => ({ ...p, [key]: !p[key] }));
  };

  const sensitiveActive = COMPLIANCE_PERMISSIONS.filter(p => p.sensitive && perms[p.key]).length;

  return (
    <View style={styles.root}>
      <ScreenHeader title="Permissions & Roles" />
      <SafeScrollView>
        {/* Role tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.roleTabs}
        >
          {(['Manager', 'Cashier', 'Inventory', '+Custom'] as RoleTab[]).map(r => (
            <Pressable
              key={r}
              style={[styles.roleTab, role === r && styles.roleTabActive]}
              onPress={() => setRole(r)}
            >
              <Text style={[styles.roleTabText, role === r && styles.roleTabTextActive]}>{r}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Active assignment */}
        <View style={styles.assignmentCard}>
          <Text style={styles.assignmentText}>ACTIVE ASSIGNMENT — 12 Staff</Text>
          <Text style={styles.assignmentSub}>Showing permissions for {role} role</Text>
        </View>

        {/* Sales Archive section */}
        <Text style={styles.sectionHeader}>SALES ARCHIVE</Text>
        <View style={styles.permList}>
          {SALES_PERMISSIONS.map((perm, idx) => (
            <View key={perm.key} style={[styles.permRow, idx === SALES_PERMISSIONS.length - 1 && styles.noBorder]}>
              <Text style={styles.permLabel}>{perm.label}</Text>
              <Pressable
                style={[styles.checkbox, perms[perm.key] && styles.checkboxActive]}
                onPress={() => togglePerm(perm.key)}
              >
                {perms[perm.key] && <Text style={styles.checkmark}>✓</Text>}
              </Pressable>
            </View>
          ))}
        </View>

        {/* Inventory Management section */}
        <Text style={styles.sectionHeader}>INVENTORY MANAGEMENT</Text>
        <View style={styles.permList}>
          {INVENTORY_PERMISSIONS.map((perm, idx) => (
            <View key={perm.key} style={[styles.permRow, idx === INVENTORY_PERMISSIONS.length - 1 && styles.noBorder]}>
              <Text style={styles.permLabel}>{perm.label}</Text>
              <Switch
                value={perms[perm.key] ?? false}
                onValueChange={() => togglePerm(perm.key)}
                trackColor={{ false: Colors.gy2, true: Colors.g }}
                thumbColor={Colors.w}
              />
            </View>
          ))}
        </View>

        {/* Compliance & Audit section */}
        <Text style={styles.sectionHeader}>COMPLIANCE & AUDIT</Text>
        {sensitiveActive >= 3 && (
          <View style={styles.warnBanner}>
            <Text style={styles.warnText}>3 SENSITIVE TOGGLES ACTIVE</Text>
          </View>
        )}
        <View style={styles.permList}>
          {COMPLIANCE_PERMISSIONS.map((perm, idx) => (
            <View key={perm.key} style={[styles.permRow, idx === COMPLIANCE_PERMISSIONS.length - 1 && styles.noBorder]}>
              <View style={styles.permLabelRow}>
                <Text style={styles.permLabel}>{perm.label}</Text>
                {perm.sensitive && <Text style={styles.sensitiveTag}>SENSITIVE</Text>}
              </View>
              <Switch
                value={perms[perm.key] ?? false}
                onValueChange={() => togglePerm(perm.key)}
                trackColor={{ false: Colors.gy2, true: Colors.rt }}
                thumbColor={Colors.w}
              />
            </View>
          ))}
        </View>

        <Button
          label="Save Changes"
          variant="primary"
          loading={isPending}
          onPress={() => saveRole()}
        />
      </SafeScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.gy },
  roleTabs: { paddingHorizontal: Spacing.s4, paddingVertical: Spacing.s3, gap: 8 },
  roleTab: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  roleTabActive: { borderBottomColor: Colors.g },
  roleTabText: { ...Typography.bodyLG, color: Colors.t2 },
  roleTabTextActive: { color: Colors.g2, fontWeight: '700' },
  assignmentCard: {
    margin: Spacing.s4, backgroundColor: Colors.g,
    borderRadius: Radius.lg, padding: Spacing.s4,
  },
  assignmentText: { ...Typography.label, color: Colors.w },
  assignmentSub: { ...Typography.bodyMD, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  sectionHeader: {
    ...Typography.label, color: Colors.t2,
    paddingHorizontal: Spacing.s4, paddingTop: Spacing.s4, paddingBottom: Spacing.s2,
  },
  warnBanner: {
    marginHorizontal: Spacing.s4, marginBottom: Spacing.s2,
    backgroundColor: Colors.a, borderRadius: Radius.md,
    padding: Spacing.s3, borderLeftWidth: 3, borderLeftColor: Colors.at,
  },
  warnText: { ...Typography.label, color: Colors.at },
  permList: {
    marginHorizontal: Spacing.s4, backgroundColor: Colors.w,
    borderRadius: Radius.lg, overflow: 'hidden', ...Shadows.card,
  },
  permRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.s4, borderBottomWidth: 1, borderBottomColor: Colors.gy2,
  },
  noBorder: { borderBottomWidth: 0 },
  permLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  permLabel: { ...Typography.bodyLG, color: Colors.t },
  sensitiveTag: {
    ...Typography.micro, color: Colors.rt,
    backgroundColor: Colors.r, borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  checkbox: {
    width: 24, height: 24, borderRadius: Radius.xs,
    borderWidth: 2, borderColor: Colors.gy2,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: Colors.g, borderColor: Colors.g },
  checkmark: { fontSize: 14, color: Colors.w, fontWeight: '700' },
});
