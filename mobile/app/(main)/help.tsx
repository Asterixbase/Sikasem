import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Linking, Alert } from 'react-native';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import { ScreenHeader, SafeScrollView, Button } from '@/components';

interface FAQ {
  question: string;
  answer: string;
}

const FAQS: FAQ[] = [
  {
    question: 'How do I scan a barcode?',
    answer: 'Tap the Scan button on the dashboard or the camera icon. Point your phone at any EAN-13, EAN-8, UPC-A, Code 128, or QR barcode. The scanner will automatically detect and look up the product.',
  },
  {
    question: 'How does VAT calculation work?',
    answer: 'Sikasem calculates Ghana Standard Rate VAT at 15%, NHIL at 2.5%, and GETFund levy at 2.5% on the taxable amount. All calculations follow GRA guidelines for VAT-registered businesses.',
  },
  {
    question: 'How to set up MoMo collection?',
    answer: 'Go to Vault → MoMo Payout to configure your payout details. For collection, ensure your shop is registered with an MTN MoMo or Telecel merchant account, then link it in Settings → Shop Profile.',
  },
];

const CATEGORIES = [
  { icon: '📦', label: 'Inventory' },
  { icon: '🧾', label: 'Tax Compliance' },
  { icon: '💳', label: 'Payments' },
  { icon: '📷', label: 'Hardware' },
];

export default function HelpScreen() {
  const [search, setSearch] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  return (
    <View style={styles.root}>
      <ScreenHeader title="Help & Support" />
      <SafeScrollView>
        {/* Search */}
        <View style={styles.searchWrapper}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search help articles…"
            placeholderTextColor={Colors.t2}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* Quick category tiles */}
        <Text style={styles.sectionHeader}>BROWSE BY TOPIC</Text>
        <View style={styles.catGrid}>
          {CATEGORIES.map(cat => (
            <Pressable
              key={cat.label}
              style={[styles.catTile, activeCategory === cat.label && styles.catTileActive]}
              onPress={() => setActiveCategory(activeCategory === cat.label ? null : cat.label)}
            >
              <Text style={styles.catIcon}>{cat.icon}</Text>
              <Text style={[styles.catLabel, activeCategory === cat.label && styles.catLabelActive]}>
                {cat.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Human help CTA */}
        <View style={styles.humanCard}>
          <Text style={styles.humanTitle}>Need direct human help?</Text>
          <Text style={styles.humanSub}>Our support team is available Mon–Sat, 8AM–6PM GMT</Text>
          <View style={styles.humanBtnRow}>
            <Button
              label="Chat on WhatsApp"
              variant="whatsapp"
              style={styles.halfBtn}
              onPress={() => Linking.openURL('https://wa.me/233200000000?text=Hi%2C%20I%20need%20help%20with%20Sikasem')}
            />
            <Button
              label="Call Support"
              variant="secondary"
              style={[styles.halfBtn, styles.callBtn]}
              onPress={() => Linking.openURL('tel:+233200000000')}
            />
          </View>
        </View>

        {/* FAQ accordion */}
        <Text style={styles.sectionHeader}>FREQUENTLY ASKED QUESTIONS</Text>
        <View style={styles.faqList}>
          {FAQS.map((faq, idx) => (
            <View key={idx}>
              <Pressable
                style={[styles.faqRow, idx === FAQS.length - 1 && openFaq !== idx && styles.noBorder]}
                onPress={() => setOpenFaq(openFaq === idx ? null : idx)}
              >
                <Text style={styles.faqQuestion} numberOfLines={openFaq === idx ? undefined : 2}>
                  {faq.question}
                </Text>
                <Text style={styles.faqChevron}>{openFaq === idx ? '∧' : '∨'}</Text>
              </Pressable>
              {openFaq === idx && (
                <View style={[styles.faqAnswer, idx === FAQS.length - 1 && styles.noBorder]}>
                  <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Community card */}
        <Pressable
          style={styles.communityCard}
          onPress={() => Linking.openURL('https://community.sikasem.com')}
        >
          <Text style={styles.communityTitle}>Sikasem Community</Text>
          <Text style={styles.communitySub}>
            Join thousands of Ghanaian merchants sharing tips, asking questions, and growing together.
          </Text>
          <Text style={styles.communityLink}>Visit community.sikasem.com →</Text>
        </Pressable>
      </SafeScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.gy },
  searchWrapper: {
    flexDirection: 'row', alignItems: 'center',
    margin: Spacing.s4, backgroundColor: Colors.w,
    borderRadius: Radius.lg, paddingHorizontal: Spacing.s3,
    borderBottomWidth: 2, borderBottomColor: Colors.g,
    ...Shadows.card,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, ...Typography.bodyLG, color: Colors.t, paddingVertical: 10 },
  sectionHeader: {
    ...Typography.label, color: Colors.t2,
    paddingHorizontal: Spacing.s4, paddingTop: Spacing.s4, paddingBottom: Spacing.s2,
  },
  catGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: Spacing.s4, gap: 10,
  },
  catTile: {
    width: '47%', backgroundColor: Colors.w,
    borderRadius: Radius.lg, padding: Spacing.s4,
    alignItems: 'center', ...Shadows.card,
    borderWidth: 2, borderColor: 'transparent',
  },
  catTileActive: { borderColor: Colors.g },
  catIcon: { fontSize: 28, marginBottom: 6 },
  catLabel: { ...Typography.bodyLG, color: Colors.t },
  catLabelActive: { color: Colors.g2 },
  humanCard: {
    margin: Spacing.s4, backgroundColor: Colors.g,
    borderRadius: Radius.xl, padding: Spacing.s5,
  },
  humanTitle: { ...Typography.titleMD, color: Colors.w, marginBottom: 4 },
  humanSub: { ...Typography.bodyMD, color: 'rgba(255,255,255,0.8)', marginBottom: Spacing.s3 },
  humanBtnRow: { flexDirection: 'row', gap: 8 },
  halfBtn: { flex: 1, marginHorizontal: 0, marginVertical: 0 },
  callBtn: { backgroundColor: 'rgba(255,255,255,0.15)' },
  faqList: {
    marginHorizontal: Spacing.s4, backgroundColor: Colors.w,
    borderRadius: Radius.lg, overflow: 'hidden', ...Shadows.card,
  },
  faqRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: Spacing.s4, borderBottomWidth: 1, borderBottomColor: Colors.gy2,
  },
  faqQuestion: { ...Typography.bodyLG, color: Colors.t, flex: 1, marginRight: 8 },
  faqChevron: { fontSize: 14, color: Colors.t2, marginTop: 2 },
  faqAnswer: {
    paddingHorizontal: Spacing.s4, paddingBottom: Spacing.s4,
    borderBottomWidth: 1, borderBottomColor: Colors.gy2,
    backgroundColor: Colors.gx,
  },
  faqAnswerText: { ...Typography.bodyMD, color: Colors.t, lineHeight: 20 },
  noBorder: { borderBottomWidth: 0 },
  communityCard: {
    margin: Spacing.s4, backgroundColor: Colors.w,
    borderRadius: Radius.lg, padding: Spacing.s5, ...Shadows.card,
  },
  communityTitle: { ...Typography.titleMD, color: Colors.t, marginBottom: 4 },
  communitySub: { ...Typography.bodyMD, color: Colors.t2, lineHeight: 18, marginBottom: 8 },
  communityLink: { ...Typography.bodyLG, color: Colors.bt },
});
