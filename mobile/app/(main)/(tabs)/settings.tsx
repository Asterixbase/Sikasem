import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, Pressable, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api';
import { useAuthStore, ShopRole } from '@/store/auth';
import { useRole } from '@/hooks/useRole';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import { SafeScrollView, Button, Badge, SikasemLogo } from '@/components';
import { useThemeStore, useThemePalette, THEMES, ThemeId } from '@/store/theme';
import {
  useTierStore, TIER_CONFIG, LOGO_DESCRIPTIONS,
  type TierId, type LogoVariant,
} from '@/store/tier';

const ROLE_LABELS: Record<ShopRole, string> = {
  owner:     'Owner',
  manager:   'Manager',
  staff:     'Staff',
  superuser: 'Superuser',
};

const ROLE_PERMISSIONS: Record<ShopRole, string[]> = {
  owner:     ['Full access', 'Treasury & payouts', 'Team management', 'All reports'],
  manager:   ['Sales & inventory', 'Credit management', 'Reports', 'No treasury access'],
  staff:     ['Scan & sell only', 'No financial data', 'No team management'],
  superuser: ['All features unlocked', 'Bypass all role gates', 'Theme testing', 'Full admin access'],
};

function roleVariant(role: ShopRole): 'green' | 'blue' | 'amber' {
  if (role === 'owner' || role === 'superuser') return 'green';
  if (role === 'manager') return 'blue';
  return 'amber';
}

const TIER_ORDER: TierId[] = ['starter', 'growth', 'pro'];
const LOGO_VARIANTS: LogoVariant[] = ['A', 'B', 'C'];

export default function SettingsScreen() {
  const { shopId, role } = useAuthStore();
  const { isOwner, isSuperuser } = useRole();
  const [online, setOnline] = useState(true);
  const [dpaConsent, setDpaConsent] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const theme = useThemePalette();

  const {
    tier, activeTier, logoVariant,
    setActiveTier, setLogoVariant,
  } = useTierStore();

  const handleSeedDemo = () => {
    Alert.alert(
      'Load Demo Data',
      'This will replace ALL existing products, sales and credit data with 14 days of realistic demo data. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Load Demo Data',
          style: 'destructive',
          onPress: async () => {
            setSeeding(true);
            try {
              await api.post('/admin/seed-demo');
              Alert.alert('Done', '31 products, 14 days of sales, 5 credit customers loaded. Pull to refresh any screen.');
            } catch {
              Alert.alert('Error', 'Could not seed demo data. Please try again.');
            } finally {
              setSeeding(false);
            }
          },
        },
      ]
    );
  };
  const { themeId, setTheme } = useThemeStore();

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
          <View style={[styles.shopLogo, { backgroundColor: theme.primary }]}>
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
        <View style={[styles.proCard, { backgroundColor: theme.primary }]}>
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

        {/* My Role */}
        <Text style={styles.sectionHeader}>MY ROLE</Text>
        <View style={styles.myRoleCard}>
          <View style={styles.myRoleRow}>
            <View style={styles.roleIconWrap}>
              <Text style={styles.roleIcon}>{role === 'owner' ? '👑' : role === 'manager' ? '🗂️' : '🛒'}</Text>
            </View>
            <View style={styles.roleInfo}>
              <View style={styles.roleTitleRow}>
                <Text style={styles.roleName}>{ROLE_LABELS[role as ShopRole] ?? 'Staff'}</Text>
                <Badge label={ROLE_LABELS[role as ShopRole] ?? 'STAFF'} variant={roleVariant(role as ShopRole)} />
              </View>
              <Text style={styles.rolePermSummary}>
                {(ROLE_PERMISSIONS[role as ShopRole] ?? ROLE_PERMISSIONS.staff).join(' · ')}
              </Text>
            </View>
          </View>
        </View>

        {/* Superuser: tier testing + logo picker */}
        {isSuperuser && (
          <>
            <View style={styles.superuserBanner}>
              <Text style={styles.superuserIcon}>⚡</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.superuserTitle}>Superuser Mode Active</Text>
                <Text style={styles.superuserSub}>All role gates bypassed · Full feature access enabled</Text>
              </View>
            </View>

            {/* Tier override — simulate what each tier user sees */}
            <Text style={styles.sectionHeader}>TEST TIER VIEW</Text>
            <View style={styles.tierOverrideCard}>
              <Text style={styles.tierOverrideHint}>
                Select a tier to preview the app as that user would see it.
                {activeTier ? ` Currently testing as ${TIER_CONFIG[activeTier].label}.` : ' Currently showing full access.'}
              </Text>
              <View style={styles.tierPillRow}>
                {TIER_ORDER.map(id => {
                  const t = TIER_CONFIG[id];
                  const active = activeTier === id;
                  return (
                    <Pressable
                      key={id}
                      style={[styles.tierPill, active && { backgroundColor: t.color, borderColor: t.color }]}
                      onPress={() => setActiveTier(activeTier === id ? null : id)}
                    >
                      <Text style={[styles.tierPillText, active && { color: Colors.w }]}>
                        {t.emoji} {t.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {activeTier && (
                <Pressable style={styles.resetTierBtn} onPress={() => setActiveTier(null)}>
                  <Text style={styles.resetTierText}>✕ Exit tier test — restore full access</Text>
                </Pressable>
              )}
            </View>

            {/* Logo variant picker */}
            <Text style={styles.sectionHeader}>APP LOGO VARIANT</Text>
            <View style={styles.logoPickCard}>
              <Text style={styles.logoPickHint}>Choose which logo mark to display across the app.</Text>
              <View style={styles.logoPickRow}>
                {LOGO_VARIANTS.map(v => {
                  const active = logoVariant === v;
                  return (
                    <Pressable
                      key={v}
                      style={[styles.logoPickOption, active && { borderColor: theme.primary, backgroundColor: theme.bgLight }]}
                      onPress={() => setLogoVariant(v)}
                    >
                      <SikasemLogo size="sm" layout="column" showTagline={false} variant={v} color={theme.primary} />
                      <Text style={[styles.logoPickLabel, active && { color: theme.primary, fontWeight: '700' }]}>
                        {LOGO_DESCRIPTIONS[v].title}
                      </Text>
                      {active && <Text style={[styles.logoPickCheck, { color: theme.primary }]}>✓</Text>}
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.logoPickDesc}>{LOGO_DESCRIPTIONS[logoVariant].desc}</Text>
            </View>
          </>
        )}

        {/* Theme picker */}
        <Text style={styles.sectionHeader}>APP THEME</Text>
        <View style={styles.themeCard}>
          <Text style={styles.themeHint}>Choose a colour theme to test</Text>
          <View style={styles.themeRow}>
            {(Object.values(THEMES) as typeof THEMES[ThemeId][]).map(t => {
              const isActive = themeId === t.id;
              return (
                <Pressable
                  key={t.id}
                  style={[styles.themeSwatch, isActive && { borderColor: t.swatch, backgroundColor: t.swatch + '18' }]}
                  onPress={() => setTheme(t.id)}
                >
                  <View style={[styles.swatchDot, { backgroundColor: t.swatch }]} />
                  <Text style={[styles.swatchLabel, isActive && { color: t.swatch, fontWeight: '700' }]}>
                    {t.label}
                  </Text>
                  {isActive && <Text style={[styles.swatchCheck, { color: t.swatch }]}>✓</Text>}
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.themeNote}>
            Theme colours apply to buttons, cards and the hero. Restart the app if needed.
          </Text>
        </View>

        {/* Team Members — owner only, Pro tier to manage */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>TEAM MEMBERS</Text>
          {isOwner && <Badge label="PRO" variant="green" />}
        </View>
        {isOwner ? (
          <View style={styles.staffList}>
            <View style={styles.teamsProBanner}>
              <Text style={styles.teamsProText}>
                🔐 Invite staff and assign roles to control what each person can see and do.
              </Text>
              <Button
                label="Invite Team Member"
                variant="primary"
                style={styles.inviteBtn}
                onPress={() => Alert.alert('Team Members', 'Staff invitation is coming in the next update.')}
              />
            </View>
          </View>
        ) : (
          <View style={styles.staffList}>
            <View style={styles.nonOwnerTeams}>
              <Text style={styles.nonOwnerTeamsText}>
                🔒 Team management is only available to the shop owner.
              </Text>
            </View>
          </View>
        )}

        {/* System toggles */}
        <Text style={styles.sectionHeader}>SYSTEM</Text>
        <View style={styles.toggleList}>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Online / Offline Mode</Text>
            <Switch
              value={online}
              onValueChange={setOnline}
              trackColor={{ false: Colors.gy2, true: theme.primary }}
              thumbColor={Colors.w}
            />
          </View>
          <View style={[styles.toggleRow, styles.noBorder]}>
            <Text style={styles.toggleLabel}>Ghana DPA Consent</Text>
            <Switch
              value={dpaConsent}
              onValueChange={setDpaConsent}
              trackColor={{ false: Colors.gy2, true: theme.primary }}
              thumbColor={Colors.w}
            />
          </View>
        </View>

        {/* Demo Data — owner / superuser only */}
        {(isOwner || isSuperuser) && (
          <>
            <Text style={styles.sectionHeader}>DEVELOPER TOOLS</Text>
            <Pressable
              style={[styles.seedBtn, { backgroundColor: theme.primary }, seeding && { opacity: 0.6 }]}
              onPress={handleSeedDemo}
              disabled={seeding}
            >
              {seeding
                ? <ActivityIndicator color={Colors.w} size="small" style={{ marginRight: 8 }} />
                : <Text style={styles.seedIcon}>🌱</Text>}
              <Text style={styles.seedText}>
                {seeding ? 'Loading demo data…' : 'Load Demo Data'}
              </Text>
            </Pressable>
          </>
        )}

        {/* Help link */}
        <Pressable style={styles.helpRow} onPress={() => router.push('/(main)/help')}>
          <Text style={styles.helpText}>Help & Support</Text>
          <Text style={styles.helpArrow}>›</Text>
        </Pressable>

        {/* Log out */}
        <Pressable
          style={styles.logoutBtn}
          onPress={() =>
            Alert.alert('Log Out', 'Are you sure you want to log out?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Log Out', style: 'destructive', onPress: () => useAuthStore.getState().logout() },
            ])
          }
        >
          <Text style={styles.logoutText}>Log Out</Text>
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
    width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.g, // overridden inline with theme.primary
    alignItems: 'center', justifyContent: 'center', marginRight: Spacing.s3,
  },
  shopLogoText: { ...Typography.titleMD, color: Colors.w },
  shopInfo: { flex: 1 },
  shopName: { ...Typography.titleMD, color: Colors.t },
  shopLocation: { ...Typography.bodySM, color: Colors.t2, marginTop: 2 },
  editBtn: { marginHorizontal: 0, paddingVertical: 8, paddingHorizontal: 12, marginVertical: 0 },
  proCard: {
    margin: Spacing.s4, backgroundColor: Colors.g, // overridden inline
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
  myRoleCard: {
    marginHorizontal: Spacing.s4, backgroundColor: Colors.w,
    borderRadius: Radius.lg, padding: Spacing.s4, ...Shadows.card,
  },
  myRoleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  roleIconWrap: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.gy,
    alignItems: 'center', justifyContent: 'center', marginRight: Spacing.s3,
  },
  roleIcon: { fontSize: 22 },
  roleInfo: { flex: 1 },
  roleTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  roleName: { ...Typography.titleSM, color: Colors.t },
  rolePermSummary: { ...Typography.bodySM, color: Colors.t2, lineHeight: 18 },
  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: Spacing.s4, paddingTop: Spacing.s4, paddingBottom: Spacing.s2,
  },
  staffList: {
    marginHorizontal: Spacing.s4, backgroundColor: Colors.w,
    borderRadius: Radius.lg, overflow: 'hidden', ...Shadows.card,
  },
  teamsProBanner: { padding: Spacing.s4 },
  teamsProText: { ...Typography.bodyMD, color: Colors.t2, lineHeight: 20, marginBottom: Spacing.s3 },
  inviteBtn: { marginHorizontal: 0, marginVertical: 0 },
  nonOwnerTeams: { padding: Spacing.s4 },
  nonOwnerTeamsText: { ...Typography.bodyMD, color: Colors.t2, lineHeight: 20 },
  noBorder: { borderBottomWidth: 0 },
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
  seedBtn: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: Spacing.s4, marginBottom: Spacing.s3,
    backgroundColor: Colors.g, // overridden inline with theme.primary
    borderRadius: Radius.lg,
    padding: Spacing.s4, gap: Spacing.s2,
  },
  seedIcon: { fontSize: 18 },
  seedText: { ...Typography.titleSM, color: Colors.w },

  logoutBtn: {
    marginHorizontal: Spacing.s4, marginTop: Spacing.s3,
    backgroundColor: Colors.w, borderRadius: Radius.lg,
    padding: Spacing.s4, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.rt,
  },
  logoutText: { ...Typography.bodyLG, color: Colors.rt, fontWeight: '700' },

  footer: {
    ...Typography.bodySM, color: Colors.t2,
    textAlign: 'center', margin: Spacing.s8,
  },

  // Tier override panel
  tierOverrideCard: {
    marginHorizontal: Spacing.s4, backgroundColor: Colors.w,
    borderRadius: Radius.lg, padding: Spacing.s4, ...Shadows.card,
  },
  tierOverrideHint: { ...Typography.bodyMD, color: Colors.t2, marginBottom: Spacing.s3, lineHeight: 18 },
  tierPillRow: { flexDirection: 'row', gap: Spacing.s2, flexWrap: 'wrap', marginBottom: Spacing.s2 },
  tierPill: {
    paddingHorizontal: Spacing.s3, paddingVertical: Spacing.s2,
    borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.gy2,
    backgroundColor: Colors.gy,
  },
  tierPillText: { ...Typography.badge, color: Colors.t2, fontWeight: '600' },
  resetTierBtn: {
    marginTop: Spacing.s2, alignSelf: 'flex-start',
    paddingHorizontal: Spacing.s3, paddingVertical: 6,
    backgroundColor: Colors.r, borderRadius: Radius.md,
  },
  resetTierText: { ...Typography.badge, color: Colors.rt, fontWeight: '700' },

  // Logo picker
  logoPickCard: {
    marginHorizontal: Spacing.s4, backgroundColor: Colors.w,
    borderRadius: Radius.lg, padding: Spacing.s4, ...Shadows.card,
  },
  logoPickHint: { ...Typography.bodyMD, color: Colors.t2, marginBottom: Spacing.s3 },
  logoPickRow: { flexDirection: 'row', gap: Spacing.s2, marginBottom: Spacing.s2 },
  logoPickOption: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing.s3,
    borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.gy2, gap: 6,
  },
  logoPickOptionActive: { borderColor: Colors.g, backgroundColor: Colors.gl },
  logoPickLabel: { ...Typography.badge, color: Colors.t2, textAlign: 'center', fontSize: 10 },
  logoPickLabelActive: { color: Colors.g, fontWeight: '700' },
  logoPickCheck: { fontSize: 11, color: Colors.g, fontWeight: '700' },
  logoPickDesc: { ...Typography.bodySM, color: Colors.t2, textAlign: 'center' },

  // Superuser banner
  superuserBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.s3,
    marginHorizontal: Spacing.s4, marginTop: Spacing.s4,
    backgroundColor: '#1e1b4b', borderRadius: Radius.lg,
    padding: Spacing.s4,
  },
  superuserIcon: { fontSize: 24 },
  superuserTitle: { ...Typography.titleSM, color: '#c4b5fd', marginBottom: 2 },
  superuserSub: { ...Typography.bodySM, color: '#a5b4fc' },

  // Theme picker
  themeCard: {
    marginHorizontal: Spacing.s4, backgroundColor: Colors.w,
    borderRadius: Radius.lg, padding: Spacing.s4, ...Shadows.card,
  },
  themeHint: { ...Typography.bodyMD, color: Colors.t2, marginBottom: Spacing.s3 },
  themeRow: { flexDirection: 'row', gap: Spacing.s2, marginBottom: Spacing.s3 },
  themeSwatch: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing.s3,
    borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.gy2,
    gap: 4,
  },
  themeSwatchActive: { borderColor: Colors.g, backgroundColor: Colors.gl },
  swatchDot: { width: 22, height: 22, borderRadius: 11 },
  swatchLabel: { ...Typography.badge, color: Colors.t2 },
  swatchLabelActive: { color: Colors.g, fontWeight: '700' },
  swatchCheck: { fontSize: 11, color: Colors.g, fontWeight: '700' },
  themeNote: { ...Typography.bodySM, color: Colors.t3, lineHeight: 18 },
});
