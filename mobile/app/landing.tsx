/**
 * Sikasem Landing Screen
 * First screen new users see. Lets them:
 *   1. Choose a logo variant (A / B / C) so we can drop the cedi symbol
 *   2. Select their subscription tier (Starter / Growth / Pro)
 * Selections persist via the tier store. After confirming, the user
 * is routed to the OTP login screen.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import { SikasemLogo } from '@/components';
import {
  useTierStore, TIER_CONFIG, LOGO_DESCRIPTIONS,
  type TierId, type LogoVariant,
} from '@/store/tier';

const TIER_ORDER: TierId[] = ['starter', 'growth', 'pro'];
const LOGO_VARIANTS: LogoVariant[] = ['A', 'B', 'C'];

export default function LandingScreen() {
  const { tier, logoVariant, setTier, setLogoVariant, markChosen } = useTierStore();

  const [selectedTier, setSelectedTier] = useState<TierId>(tier);
  const [selectedLogo, setSelectedLogo] = useState<LogoVariant>(logoVariant);

  const handleContinue = () => {
    setTier(selectedTier);
    setLogoVariant(selectedLogo);
    markChosen();
    router.replace('/otp-verify');
  };

  const cfg = TIER_CONFIG[selectedTier];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.welcome}>Welcome to</Text>
          <SikasemLogo size="lg" layout="column" showTagline variant={selectedLogo} />
          <Text style={styles.subtitle}>
            Digitizing the African marketplace — choose your plan to get started.
          </Text>
        </View>

        {/* ── Logo picker ── */}
        <Text style={styles.sectionLabel}>CHOOSE YOUR APP LOGO</Text>
        <View style={styles.logoRow}>
          {LOGO_VARIANTS.map(v => {
            const active = selectedLogo === v;
            const desc = LOGO_DESCRIPTIONS[v];
            return (
              <Pressable
                key={v}
                style={[styles.logoCard, active && styles.logoCardActive]}
                onPress={() => setSelectedLogo(v)}
              >
                <SikasemLogo size="sm" layout="column" showTagline={false} variant={v} />
                <Text style={[styles.logoVariantLabel, active && styles.logoVariantLabelActive]}>
                  {desc.title}
                </Text>
                {active && <Text style={styles.logoCheck}>✓ Selected</Text>}
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.logoHint}>
          {LOGO_DESCRIPTIONS[selectedLogo].desc}
        </Text>

        {/* ── Tier cards ── */}
        <Text style={styles.sectionLabel}>CHOOSE YOUR PLAN</Text>
        {TIER_ORDER.map(id => {
          const t = TIER_CONFIG[id];
          const active = selectedTier === id;
          return (
            <Pressable
              key={id}
              style={[
                styles.tierCard,
                active && { borderColor: t.color, borderWidth: 2.5 },
              ]}
              onPress={() => setSelectedTier(id)}
            >
              {/* Card header */}
              <View style={styles.tierHeader}>
                <View style={[styles.tierEmojiBadge, { backgroundColor: t.color + '18' }]}>
                  <Text style={styles.tierEmoji}>{t.emoji}</Text>
                </View>
                <View style={styles.tierTitleBlock}>
                  <View style={styles.tierTitleRow}>
                    <Text style={[styles.tierLabel, active && { color: t.color }]}>
                      {t.label}
                    </Text>
                    {id === 'growth' && (
                      <View style={[styles.popularBadge, { backgroundColor: t.color }]}>
                        <Text style={styles.popularText}>POPULAR</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.tierTagline}>{t.tagline}</Text>
                </View>
                <Text style={[styles.tierPrice, active && { color: t.color }]}>{t.price}</Text>
              </View>

              {/* Features */}
              <View style={styles.tierFeatures}>
                {t.features.map(f => (
                  <View key={f} style={styles.featureRow}>
                    <Text style={[styles.featureCheck, { color: t.color }]}>✓</Text>
                    <Text style={styles.featureText}>{f}</Text>
                  </View>
                ))}
                {t.notIncluded.length > 0 && t.notIncluded.map(f => (
                  <View key={f} style={styles.featureRow}>
                    <Text style={styles.featureX}>—</Text>
                    <Text style={styles.featureTextOff}>{f}</Text>
                  </View>
                ))}
              </View>

              {active && (
                <View style={[styles.tierSelected, { backgroundColor: t.color }]}>
                  <Text style={styles.tierSelectedText}>Selected · {t.label}</Text>
                </View>
              )}
            </Pressable>
          );
        })}

        <Text style={styles.trialNote}>
          You can upgrade or switch plans anytime from Settings. All plans include a 14-day free trial.
        </Text>

        {/* ── CTA ── */}
        <Pressable
          style={[styles.ctaBtn, { backgroundColor: cfg.color }]}
          onPress={handleContinue}
        >
          <Text style={styles.ctaText}>
            {cfg.emoji}  Get Started with {cfg.label}
          </Text>
        </Pressable>

        <Text style={styles.footer}>
          🔒 No credit card required · Cancel anytime · Ghana DPA compliant
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.gy },
  scroll: { paddingHorizontal: Spacing.s4, paddingBottom: 48, paddingTop: Spacing.s4 },

  // Header
  header: { alignItems: 'center', marginBottom: Spacing.s6 },
  welcome: { ...Typography.bodyLG, color: Colors.t2, marginBottom: Spacing.s3 },
  subtitle: {
    ...Typography.bodyMD, color: Colors.t2, textAlign: 'center',
    marginTop: Spacing.s4, lineHeight: 20,
  },

  sectionLabel: {
    ...Typography.label, color: Colors.t2,
    marginTop: Spacing.s5, marginBottom: Spacing.s3,
  },

  // Logo picker
  logoRow: { flexDirection: 'row', gap: Spacing.s2, marginBottom: Spacing.s2 },
  logoCard: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing.s3,
    backgroundColor: Colors.w, borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: Colors.gy2,
    gap: Spacing.s2, ...Shadows.card,
  },
  logoCardActive: { borderColor: Colors.g, backgroundColor: Colors.gl },
  logoVariantLabel: { ...Typography.badge, color: Colors.t2, textAlign: 'center', fontSize: 10 },
  logoVariantLabelActive: { color: Colors.g, fontWeight: '700' },
  logoCheck: { ...Typography.badge, color: Colors.g, fontSize: 10 },
  logoHint: { ...Typography.bodySM, color: Colors.t2, textAlign: 'center', marginBottom: Spacing.s2 },

  // Tier cards
  tierCard: {
    backgroundColor: Colors.w, borderRadius: Radius.xl,
    marginBottom: Spacing.s3, overflow: 'hidden',
    borderWidth: 1.5, borderColor: Colors.gy2,
    ...Shadows.card,
  },
  tierHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.s4, gap: Spacing.s3,
  },
  tierEmojiBadge: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  tierEmoji: { fontSize: 22 },
  tierTitleBlock: { flex: 1 },
  tierTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.s2 },
  tierLabel: { ...Typography.titleSM, color: Colors.t },
  tierTagline: { ...Typography.bodySM, color: Colors.t2, marginTop: 2 },
  tierPrice: { ...Typography.titleSM, color: Colors.t, fontWeight: '800' },
  popularBadge: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.full,
  },
  popularText: { ...Typography.badge, color: Colors.w, fontSize: 9 },
  tierFeatures: { paddingHorizontal: Spacing.s4, paddingBottom: Spacing.s4, gap: 6 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.s2 },
  featureCheck: { fontWeight: '700', fontSize: 14, width: 16 },
  featureText: { ...Typography.bodyMD, color: Colors.t, flex: 1 },
  featureX: { fontSize: 14, color: Colors.t3, width: 16, textAlign: 'center' },
  featureTextOff: { ...Typography.bodyMD, color: Colors.t3, flex: 1 },
  tierSelected: {
    paddingVertical: Spacing.s2, alignItems: 'center',
  },
  tierSelectedText: { ...Typography.badge, color: Colors.w },

  trialNote: {
    ...Typography.bodySM, color: Colors.t2,
    textAlign: 'center', marginTop: Spacing.s2, marginBottom: Spacing.s4, lineHeight: 18,
  },

  // CTA
  ctaBtn: {
    borderRadius: Radius.xl, paddingVertical: 16,
    alignItems: 'center', marginBottom: Spacing.s3,
    ...Shadows.card,
  },
  ctaText: { ...Typography.titleSM, color: Colors.w, fontWeight: '700' },

  footer: {
    ...Typography.bodySM, color: Colors.t2,
    textAlign: 'center', lineHeight: 18,
  },
});
