import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api';
import { useAuthStore } from '@/store/auth';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import { SafeScrollView, Button, Badge } from '@/components';

interface StaffMember {
  id: string;
  name: string;
  role: string;
  initials: string;
}

const MOCK_STAFF: StaffMember[] = [
  { id: '1', name: 'Ama Mensah', role: 'Manager', initials: 'AM' },
  { id: '2', name: 'Kofi Arhin', role: 'Cashier', initials: 'KA' },
  { id: '3', name: 'Yuki Tanaka', role: 'Inventory', initials: 'YT' },
];

function roleVariant(role: string): 'green' | 'blue' | 'amber' {
  if (role === 'Manager') return 'green';
  if (role === 'Inventory') return 'blue';
  return 'amber';
}

export default function SettingsScreen() {
  const { shopId } = useAuthStore();
  const [online, setOnline] = useState(true);
  const [dpaConsent, setDpaConsent] = useState(true);

  const { data } = useQuery({
    queryKey: ['shop', shopId],
    queryFn: () => api.get(`/shops/${shopId}`).then(r => r.data),
    enabled: !!shopId,
  });

  const shop = data ?? {};
  const shopName = shop.name ?? 'Accra Central Store';
  const shopLocation = shop.location ?? 'Accra, Ghana';

  return (
    <View style={styles.root}>
      {/* Manual header — no back button */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <SafeScrollView>
        {/* Shop card */}
        <View style={styles.shopCard}>
          <View style={styles.shopLogo}>
            <Text style={styles.shopLogoText}>
              {shopName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={styles.shopInfo}>
            <Text style={styles.shopName}>{shopName}</Text>
            <Text style={styles.shopLocation}>{shopLocation}</Text>
          </View>
          <Button
            label="EDIT PROFILE"
            variant="secondary"
            style={styles.editBtn}
            onPress={() => Alert.alert('Edit Profile', 'Profile editing coming soon')}
          />
        </View>

        {/* SIKASEM PRO card */}
        <View style={styles.proCard}>
          <View style={styles.proHeader}>
            <Text style={styles.proSparkle}>✦</Text>
            <Text style={styles.proTitle}>SIKASEM PRO</Text>
            <Text style={styles.proSparkle}>✦</Text>
          </View>
          <Text style={styles.proBullet}>• Unlimited OCR invoice scanning</Text>
          <Text style={styles.proBullet}>• GRA VAT auto-export</Text>
          <Text style={styles.proBullet}>• Advanced analytics & reports</Text>
          <Text style={styles.proBullet}>• Priority WhatsApp support</Text>
          <Button
            label="Upgrade to Pro"
            variant="primary"
            style={styles.upgradeBtn}
            onPress={() => Alert.alert('Upgrade', 'Upgrade flow coming soon')}
          />
        </View>

        {/* Staff Management */}
        <Text style={styles.sectionHeader}>STAFF MANAGEMENT</Text>
        <View style={styles.staffList}>
          {MOCK_STAFF.map((member, idx) => (
            <View key={member.id} style={[styles.staffRow, idx === MOCK_STAFF.length - 1 && styles.noBorder]}>
              <View style={styles.staffAvatar}>
                <Text style={styles.staffInitials}>{member.initials}</Text>
              </View>
              <Text style={styles.staffName}>{member.name}</Text>
              <Badge label={member.role} variant={roleVariant(member.role)} />
            </View>
          ))}
          <Pressable style={styles.addStaffBtn} onPress={() => Alert.alert('Add Staff', 'Staff invitation coming soon')}>
            <Text style={styles.addStaffText}>+ Add staff member</Text>
          </Pressable>
        </View>

        {/* System toggles */}
        <Text style={styles.sectionHeader}>SYSTEM</Text>
        <View style={styles.toggleList}>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Online / Offline Mode</Text>
            <Switch
              value={online}
              onValueChange={setOnline}
              trackColor={{ false: Colors.gy2, true: Colors.g }}
              thumbColor={Colors.w}
            />
          </View>
          <View style={[styles.toggleRow, styles.noBorder]}>
            <Text style={styles.toggleLabel}>Ghana DPA Consent</Text>
            <Switch
              value={dpaConsent}
              onValueChange={setDpaConsent}
              trackColor={{ false: Colors.gy2, true: Colors.g }}
              thumbColor={Colors.w}
            />
          </View>
        </View>

        {/* Help link */}
        <Pressable style={styles.helpRow} onPress={() => router.push('/(main)/help')}>
          <Text style={styles.helpText}>Help & Support</Text>
          <Text style={styles.helpArrow}>›</Text>
        </Pressable>

        {/* Footer */}
        <Text style={styles.footer}>SIKASEM V1.3.0 · Digitizing the African marketplace</Text>
      </SafeScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.gy },
  header: {
    backgroundColor: Colors.w, paddingHorizontal: Spacing.s4,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.gy2,
  },
  headerTitle: { ...Typography.titleSM, color: Colors.t },
  shopCard: {
    flexDirection: 'row', alignItems: 'center',
    margin: Spacing.s4, backgroundColor: Colors.w,
    borderRadius: Radius.lg, padding: Spacing.s4, ...Shadows.card,
  },
  shopLogo: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.g,
    alignItems: 'center', justifyContent: 'center', marginRight: Spacing.s3,
  },
  shopLogoText: { ...Typography.titleMD, color: Colors.w },
  shopInfo: { flex: 1 },
  shopName: { ...Typography.titleMD, color: Colors.t },
  shopLocation: { ...Typography.bodySM, color: Colors.t2, marginTop: 2 },
  editBtn: { marginHorizontal: 0, paddingVertical: 8, paddingHorizontal: 12, marginVertical: 0 },
  proCard: {
    margin: Spacing.s4, backgroundColor: Colors.g,
    borderRadius: Radius.xl, padding: Spacing.s5,
  },
  proHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.s3,
  },
  proSparkle: { fontSize: 16, color: 'rgba(255,255,255,0.6)' },
  proTitle: { ...Typography.titleMD, color: Colors.w, flex: 1 },
  proBullet: { ...Typography.bodyMD, color: 'rgba(255,255,255,0.85)', marginBottom: 4 },
  upgradeBtn: { marginHorizontal: 0, marginTop: Spacing.s3, marginVertical: 0 },
  sectionHeader: {
    ...Typography.label, color: Colors.t2,
    paddingHorizontal: Spacing.s4, paddingTop: Spacing.s4, paddingBottom: Spacing.s2,
  },
  staffList: {
    marginHorizontal: Spacing.s4, backgroundColor: Colors.w,
    borderRadius: Radius.lg, overflow: 'hidden', ...Shadows.card,
  },
  staffRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.s4, borderBottomWidth: 1, borderBottomColor: Colors.gy2,
  },
  noBorder: { borderBottomWidth: 0 },
  staffAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.g,
    alignItems: 'center', justifyContent: 'center', marginRight: Spacing.s3,
  },
  staffInitials: { ...Typography.badge, color: Colors.w, fontWeight: '700' },
  staffName: { ...Typography.bodyLG, color: Colors.t, flex: 1 },
  addStaffBtn: {
    padding: Spacing.s4, alignItems: 'center',
  },
  addStaffText: { ...Typography.bodyMD, color: Colors.g2, fontWeight: '600' },
  toggleList: {
    marginHorizontal: Spacing.s4, backgroundColor: Colors.w,
    borderRadius: Radius.lg, overflow: 'hidden', ...Shadows.card,
  },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.s4, borderBottomWidth: 1, borderBottomColor: Colors.gy2,
  },
  toggleLabel: { ...Typography.bodyLG, color: Colors.t },
  helpRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: Spacing.s4, marginTop: Spacing.s3,
    backgroundColor: Colors.w, borderRadius: Radius.lg,
    padding: Spacing.s4, ...Shadows.card,
  },
  helpText: { ...Typography.bodyLG, color: Colors.bt },
  helpArrow: { fontSize: 18, color: Colors.t2 },
  footer: {
    ...Typography.bodySM, color: Colors.t2,
    textAlign: 'center', margin: Spacing.s8,
  },
});
