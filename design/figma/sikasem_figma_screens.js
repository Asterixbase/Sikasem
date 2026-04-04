// ═══════════════════════════════════════════════════════════
// SIKASEM — Screen Assembly Script (Run AFTER components script)
// ═══════════════════════════════════════════════════════════
// 
// HOW TO USE:
// 1. First run sikasem_figma_components.js
// 2. Then paste and run this script
// 3. It builds full screens on the "Screens — Light (Var B)" page
// ═══════════════════════════════════════════════════════════

(async () => {

function hex(h) {
  return { r: parseInt(h.slice(1,3),16)/255, g: parseInt(h.slice(3,5),16)/255, b: parseInt(h.slice(5,7),16)/255 };
}
function fill(h, o) { return { type: "SOLID", color: hex(h), opacity: o !== undefined ? o : 1 }; }
function shadow(r,g,b,a,ox,oy,blur) {
  return { type: "DROP_SHADOW", color: {r,g,b,a}, offset:{x:ox,y:oy}, radius:blur, spread:0, visible:true, blendMode:"NORMAL" };
}

const C = {
  primary: "#0F766E", primaryLight: "#F0FDFA", primaryDark: "#0A5048",
  accent: "#F59E0B", success: "#059669", warning: "#D97706", error: "#E11D48", info: "#0284C7",
  bg: "#F8FAFC", card: "#FFFFFF", surface: "#F1F5F9",
  text: "#0F172A", textSec: "#475569", textTer: "#94A3B8", border: "#E2E8F0",
  white: "#FFFFFF"
};

// Navigate to Light screens page
const lightPage = figma.root.children.find(p => p.name.includes("Light"));
if (!lightPage) { figma.notify("❌ Cannot find Light screens page"); return; }
await figma.setCurrentPageAsync(lightPage);

await figma.loadFontAsync({ family: "Inter", style: "Bold" });
await figma.loadFontAsync({ family: "Inter", style: "Regular" });
await figma.loadFontAsync({ family: "Inter", style: "Semi Bold" });
await figma.loadFontAsync({ family: "Inter", style: "Medium" });

// Clear existing content on this page
for (const child of [...lightPage.children]) { child.remove(); }

// ── Phone Frame Factory ──
function createPhone(name, x) {
  const phone = figma.createFrame();
  phone.name = name;
  phone.resize(390, 844);
  phone.x = x; phone.y = 80;
  phone.cornerRadius = 44;
  phone.fills = [fill(C.bg)];
  phone.clipsContent = true;
  phone.effects = [shadow(0,0,0,0.08,0,8,32)];
  phone.layoutMode = "VERTICAL";
  phone.primaryAxisSizingMode = "FIXED";
  phone.counterAxisSizingMode = "FIXED";
  return phone;
}

function addLabel(text, x) {
  const t = figma.createText();
  t.fontName = { family: "Inter", style: "Semi Bold" };
  t.characters = text; t.fontSize = 14;
  t.fills = [fill("#64748B")]; t.x = x; t.y = 48;
}

function addSunScore(score, grade, x) {
  const f = figma.createFrame();
  f.resize(140, 28); f.cornerRadius = 14;
  f.fills = [fill(grade.startsWith("A") ? "#D1FAE5" : "#FEF3C7")];
  f.x = x + 125; f.y = 940;
  f.layoutMode = "HORIZONTAL";
  f.primaryAxisAlignItems = "CENTER"; f.counterAxisAlignItems = "CENTER";
  f.paddingLeft = 10; f.paddingRight = 10;
  const t = figma.createText();
  t.fontName = { family: "Inter", style: "Semi Bold" };
  t.characters = `☀️ ${score}/100 (${grade})`; t.fontSize = 11;
  t.fills = [fill(grade.startsWith("A") ? "#059669" : "#D97706")];
  f.appendChild(t);
}

// ── Status Bar ──
function statusBar() {
  const bar = figma.createFrame();
  bar.name = "Status Bar"; bar.resize(390, 44);
  bar.fills = [fill(C.card)];
  bar.layoutMode = "HORIZONTAL";
  bar.primaryAxisAlignItems = "SPACE_BETWEEN";
  bar.counterAxisAlignItems = "CENTER";
  bar.paddingLeft = 24; bar.paddingRight = 24;
  bar.paddingTop = 12; bar.paddingBottom = 4;
  bar.layoutSizingHorizontal = "FILL";

  const time = figma.createText();
  time.fontName = { family: "Inter", style: "Semi Bold" };
  time.characters = "9:41"; time.fontSize = 15; time.fills = [fill(C.text)];
  bar.appendChild(time);
  const r = figma.createText();
  r.fontName = { family: "Inter", style: "Semi Bold" };
  r.characters = "●●● GHS"; r.fontSize = 13; r.fills = [fill(C.text)];
  bar.appendChild(r);
  return bar;
}

// ── Header ──
function header(title, subtitle, hasBack) {
  const h = figma.createFrame();
  h.name = "Header"; h.resize(390, subtitle ? 56 : 48);
  h.fills = [fill(C.card)];
  h.layoutMode = "HORIZONTAL";
  h.counterAxisAlignItems = "CENTER";
  h.itemSpacing = 10;
  h.paddingLeft = hasBack ? 8 : 16; h.paddingRight = 16;
  h.paddingTop = 8; h.paddingBottom = 8;
  h.layoutSizingHorizontal = "FILL";

  if (hasBack) {
    const back = figma.createFrame();
    back.resize(44, 44); back.cornerRadius = 8; back.fills = [];
    back.layoutMode = "HORIZONTAL";
    back.primaryAxisAlignItems = "CENTER"; back.counterAxisAlignItems = "CENTER";
    const bt = figma.createText();
    bt.fontName = { family: "Inter", style: "Regular" };
    bt.characters = "←"; bt.fontSize = 22; bt.fills = [fill(C.text)];
    back.appendChild(bt);
    h.appendChild(back);
  }

  const titleGroup = figma.createFrame();
  titleGroup.layoutMode = "VERTICAL"; titleGroup.fills = [];
  titleGroup.itemSpacing = 1; titleGroup.primaryAxisSizingMode = "AUTO";
  titleGroup.layoutGrow = 1;

  const tt = figma.createText();
  tt.fontName = { family: "Inter", style: "Bold" };
  tt.characters = title; tt.fontSize = 17; tt.fills = [fill(C.text)];
  titleGroup.appendChild(tt);

  if (subtitle) {
    const st = figma.createText();
    st.fontName = { family: "Inter", style: "Regular" };
    st.characters = subtitle; st.fontSize = 12; st.fills = [fill(C.textSec)];
    titleGroup.appendChild(st);
  }

  h.appendChild(titleGroup);
  return h;
}

// ── Bottom Nav ──
function bottomNav() {
  const nav = figma.createFrame();
  nav.name = "Bottom Nav"; nav.resize(390, 60);
  nav.fills = [fill(C.card)]; nav.strokes = [fill(C.border)]; nav.strokeWeight = 1;
  nav.layoutMode = "HORIZONTAL";
  nav.primaryAxisAlignItems = "SPACE_BETWEEN";
  nav.counterAxisAlignItems = "CENTER";
  nav.paddingLeft = 24; nav.paddingRight = 24;
  nav.paddingTop = 6; nav.paddingBottom = 6;
  nav.layoutSizingHorizontal = "FILL";

  const items = [
    { l: "Home", active: true },
    { l: "Stock", active: false },
    { l: "＋", fab: true },
    { l: "Credit", active: false },
    { l: "More", active: false },
  ];

  for (const item of items) {
    if (item.fab) {
      const fab = figma.createFrame();
      fab.resize(52, 52); fab.cornerRadius = 26;
      fab.fills = [fill(C.primary)];
      fab.effects = [shadow(0.059,0.463,0.431,0.3,0,4,12)];
      fab.layoutMode = "HORIZONTAL";
      fab.primaryAxisAlignItems = "CENTER"; fab.counterAxisAlignItems = "CENTER";
      const ft = figma.createText();
      ft.fontName = { family: "Inter", style: "Bold" };
      ft.characters = "＋"; ft.fontSize = 22; ft.fills = [fill(C.white)];
      fab.appendChild(ft);
      nav.appendChild(fab);
    } else {
      const ni = figma.createFrame();
      ni.resize(48, 44); ni.fills = [];
      ni.layoutMode = "VERTICAL";
      ni.primaryAxisAlignItems = "CENTER"; ni.counterAxisAlignItems = "CENTER";
      ni.itemSpacing = 3;
      const ic = figma.createFrame();
      ic.resize(22, 22); ic.cornerRadius = 4;
      ic.fills = [fill(item.active ? C.primary : C.textTer, 0.2)];
      ni.appendChild(ic);
      const lb = figma.createText();
      lb.fontName = { family: "Inter", style: item.active ? "Bold" : "Regular" };
      lb.characters = item.l; lb.fontSize = 10;
      lb.fills = [fill(item.active ? C.primary : C.textTer)];
      ni.appendChild(lb);
      nav.appendChild(ni);
    }
  }
  return nav;
}

// ─────────────────────────────────────
// SCREEN 1: DASHBOARD (Full Detail)
// ─────────────────────────────────────
addLabel("01 Dashboard", 0);
addSunScore(92, "A", 0);

const dash = createPhone("01 Dashboard", 0);
dash.appendChild(statusBar());

// Profile header
const profileRow = figma.createFrame();
profileRow.name = "Profile"; profileRow.resize(390, 52);
profileRow.fills = [fill(C.card)];
profileRow.layoutMode = "HORIZONTAL";
profileRow.primaryAxisAlignItems = "SPACE_BETWEEN";
profileRow.counterAxisAlignItems = "CENTER";
profileRow.paddingLeft = 16; profileRow.paddingRight = 16;
profileRow.paddingTop = 8; profileRow.paddingBottom = 4;
profileRow.layoutSizingHorizontal = "FILL";

const profileLeft = figma.createFrame();
profileLeft.layoutMode = "VERTICAL"; profileLeft.fills = [];
profileLeft.itemSpacing = 1; profileLeft.primaryAxisSizingMode = "AUTO";
const pName = figma.createText();
pName.fontName = { family: "Inter", style: "Bold" };
pName.characters = "Sikasem"; pName.fontSize = 20; pName.fills = [fill(C.text)];
profileLeft.appendChild(pName);
const pSub = figma.createText();
pSub.fontName = { family: "Inter", style: "Medium" };
pSub.characters = "Ama's Provision Store"; pSub.fontSize = 12; pSub.fills = [fill(C.textSec)];
profileLeft.appendChild(pSub);
profileRow.appendChild(profileLeft);

const avatar = figma.createEllipse();
avatar.resize(38, 38);
avatar.fills = [fill(C.primary)];
profileRow.appendChild(avatar);

dash.appendChild(profileRow);

// Revenue Hero
const revHero = figma.createFrame();
revHero.name = "Revenue Hero"; revHero.resize(358, 130);
revHero.cornerRadius = 14;
revHero.fills = [{ type: "GRADIENT_LINEAR", gradientStops: [
  { position: 0, color: { ...hex(C.primary), a: 1 } },
  { position: 1, color: { ...hex(C.primaryDark), a: 1 } }
], gradientTransform: [[0.7,0.7,0],[-0.7,0.7,0.3]] }];
revHero.layoutMode = "VERTICAL";
revHero.paddingTop = 20; revHero.paddingBottom = 18;
revHero.paddingLeft = 20; revHero.paddingRight = 20;
revHero.itemSpacing = 4; revHero.primaryAxisSizingMode = "AUTO";

const rhLabel = figma.createText();
rhLabel.fontName = { family: "Inter", style: "Semi Bold" };
rhLabel.characters = "TODAY'S REVENUE"; rhLabel.fontSize = 11;
rhLabel.letterSpacing = { value: 0.8, unit: "PIXELS" };
rhLabel.fills = [fill(C.white, 0.8)];
revHero.appendChild(rhLabel);

const rhAmt = figma.createText();
rhAmt.fontName = { family: "Inter", style: "Bold" };
rhAmt.characters = "GHS 284.50"; rhAmt.fontSize = 36; rhAmt.fills = [fill(C.white)];
revHero.appendChild(rhAmt);

const rhRow = figma.createFrame();
rhRow.layoutMode = "HORIZONTAL"; rhRow.fills = [];
rhRow.primaryAxisAlignItems = "SPACE_BETWEEN";
rhRow.counterAxisAlignItems = "CENTER";
rhRow.resize(318, 24); rhRow.primaryAxisSizingMode = "FIXED";

const rhBreak = figma.createText();
rhBreak.fontName = { family: "Inter", style: "Medium" };
rhBreak.characters = "Cash 192.00 · MoMo 92.50"; rhBreak.fontSize = 12;
rhBreak.fills = [fill(C.white, 0.7)];
rhRow.appendChild(rhBreak);

const rhBadge = figma.createFrame();
rhBadge.cornerRadius = 20; rhBadge.fills = [fill(C.white, 0.2)];
rhBadge.layoutMode = "HORIZONTAL";
rhBadge.primaryAxisAlignItems = "CENTER"; rhBadge.counterAxisAlignItems = "CENTER";
rhBadge.paddingLeft = 10; rhBadge.paddingRight = 10; rhBadge.paddingTop = 3; rhBadge.paddingBottom = 3;
rhBadge.primaryAxisSizingMode = "AUTO";
const rhBt = figma.createText();
rhBt.fontName = { family: "Inter", style: "Bold" };
rhBt.characters = "▲ 12%"; rhBt.fontSize = 12; rhBt.fills = [fill(C.white)];
rhBadge.appendChild(rhBt);
rhRow.appendChild(rhBadge);

revHero.appendChild(rhRow);

// Wrap hero in a padded container
const heroWrap = figma.createFrame();
heroWrap.name = "Hero Wrap"; heroWrap.resize(390, 146);
heroWrap.fills = []; heroWrap.paddingLeft = 16; heroWrap.paddingRight = 16;
heroWrap.paddingTop = 8; heroWrap.paddingBottom = 8;
heroWrap.layoutMode = "VERTICAL"; heroWrap.layoutSizingHorizontal = "FILL";
heroWrap.primaryAxisSizingMode = "AUTO";
heroWrap.appendChild(revHero);
dash.appendChild(heroWrap);

// KPI Grid
const kpiGrid = figma.createFrame();
kpiGrid.name = "KPI Grid"; kpiGrid.resize(390, 200);
kpiGrid.fills = []; kpiGrid.paddingLeft = 16; kpiGrid.paddingRight = 16;
kpiGrid.paddingTop = 4; kpiGrid.paddingBottom = 8;
kpiGrid.layoutMode = "VERTICAL"; kpiGrid.itemSpacing = 8;
kpiGrid.layoutSizingHorizontal = "FILL";
kpiGrid.primaryAxisSizingMode = "AUTO";

function kpiCard(value, label, sub, color) {
  const k = figma.createFrame();
  k.resize(175, 85); k.cornerRadius = 10;
  k.fills = [fill(C.card)]; k.strokes = [fill(C.border)]; k.strokeWeight = 1;
  k.effects = [shadow(0,0,0,0.04,0,1,3)];
  k.layoutMode = "VERTICAL";
  k.paddingTop = 14; k.paddingBottom = 12;
  k.paddingLeft = 16; k.paddingRight = 16;
  k.itemSpacing = 3; k.primaryAxisSizingMode = "AUTO";

  const v = figma.createText();
  v.fontName = { family: "Inter", style: "Bold" }; v.characters = value;
  v.fontSize = 26; v.fills = [fill(color || C.text)];
  k.appendChild(v);
  const l = figma.createText();
  l.fontName = { family: "Inter", style: "Medium" }; l.characters = label;
  l.fontSize = 12; l.fills = [fill(C.textSec)];
  k.appendChild(l);
  const s = figma.createText();
  s.fontName = { family: "Inter", style: "Semi Bold" }; s.characters = sub;
  s.fontSize = 11; s.fills = [fill(C.primary)];
  k.appendChild(s);
  return k;
}

const kpiRow1 = figma.createFrame();
kpiRow1.layoutMode = "HORIZONTAL"; kpiRow1.itemSpacing = 8;
kpiRow1.fills = []; kpiRow1.primaryAxisSizingMode = "AUTO"; kpiRow1.counterAxisSizingMode = "AUTO";
kpiRow1.appendChild(kpiCard("47", "Items sold today", "▲ 8 vs yesterday"));
kpiRow1.appendChild(kpiCard("6", "Low stock alerts", "Tap to review", C.error));
kpiGrid.appendChild(kpiRow1);

const kpiRow2 = figma.createFrame();
kpiRow2.layoutMode = "HORIZONTAL"; kpiRow2.itemSpacing = 8;
kpiRow2.fills = []; kpiRow2.primaryAxisSizingMode = "AUTO"; kpiRow2.counterAxisSizingMode = "AUTO";
kpiRow2.appendChild(kpiCard("31%", "Avg profit margin", "View details"));
kpiRow2.appendChild(kpiCard("142", "Total SKUs", "+3 this week"));
kpiGrid.appendChild(kpiRow2);

dash.appendChild(kpiGrid);

// Alerts section
const alertSection = figma.createFrame();
alertSection.name = "Alerts Section"; alertSection.resize(390, 240);
alertSection.fills = []; alertSection.paddingLeft = 16; alertSection.paddingRight = 16;
alertSection.layoutMode = "VERTICAL"; alertSection.itemSpacing = 6;
alertSection.layoutSizingHorizontal = "FILL";
alertSection.primaryAxisSizingMode = "AUTO";

// Section header
const alertHeader = figma.createFrame();
alertHeader.layoutMode = "HORIZONTAL"; alertHeader.fills = [];
alertHeader.primaryAxisAlignItems = "SPACE_BETWEEN";
alertHeader.counterAxisAlignItems = "CENTER";
alertHeader.resize(358, 24); alertHeader.primaryAxisSizingMode = "FIXED";
alertHeader.paddingBottom = 4;

const ahTitle = figma.createText();
ahTitle.fontName = { family: "Inter", style: "Bold" };
ahTitle.characters = "Urgent alerts"; ahTitle.fontSize = 15; ahTitle.fills = [fill(C.text)];
alertHeader.appendChild(ahTitle);
const ahAction = figma.createText();
ahAction.fontName = { family: "Inter", style: "Bold" };
ahAction.characters = "See all"; ahAction.fontSize = 13; ahAction.fills = [fill(C.primary)];
alertHeader.appendChild(ahAction);
alertSection.appendChild(alertHeader);

// Alert cards
function alertCard(title, sub, color) {
  const a = figma.createFrame();
  a.resize(358, 58); a.cornerRadius = 6;
  a.fills = [fill(color, 0.06)];
  a.layoutMode = "HORIZONTAL"; a.counterAxisAlignItems = "CENTER";
  a.itemSpacing = 12;
  a.paddingTop = 12; a.paddingBottom = 12;
  a.paddingLeft = 14; a.paddingRight = 14;

  const bar = figma.createRectangle();
  bar.resize(4, 34); bar.cornerRadius = 2; bar.fills = [fill(color)];
  a.appendChild(bar);

  const dot = figma.createEllipse();
  dot.resize(10, 10); dot.fills = [fill(color)];
  a.appendChild(dot);

  const tg = figma.createFrame();
  tg.layoutMode = "VERTICAL"; tg.fills = [];
  tg.itemSpacing = 2; tg.primaryAxisSizingMode = "AUTO"; tg.layoutGrow = 1;

  const tt = figma.createText();
  tt.fontName = { family: "Inter", style: "Bold" }; tt.characters = title;
  tt.fontSize = 13; tt.fills = [fill(C.text)];
  tg.appendChild(tt);
  const st = figma.createText();
  st.fontName = { family: "Inter", style: "Medium" }; st.characters = sub;
  st.fontSize = 11; st.fills = [fill(C.textSec)];
  tg.appendChild(st);
  a.appendChild(tg);
  return a;
}

alertSection.appendChild(alertCard("Indomie 70g — OUT OF STOCK", "0 pcs · 9.2/day avg · Order 120 pcs", C.error));
alertSection.appendChild(alertCard("Sachet Water — 2 bags left", "~1 day of stock · Suggest 10 bags", C.warning));
alertSection.appendChild(alertCard("Kofi Mensah — GHS 85 due TODAY", "MoMo sent · awaiting approval", C.accent));

dash.appendChild(alertSection);

// Quick actions
const qaSection = figma.createFrame();
qaSection.name = "Quick Actions"; qaSection.resize(390, 90);
qaSection.fills = []; qaSection.paddingLeft = 16; qaSection.paddingRight = 16;
qaSection.paddingTop = 8;
qaSection.layoutMode = "VERTICAL"; qaSection.itemSpacing = 8;
qaSection.layoutSizingHorizontal = "FILL";
qaSection.primaryAxisSizingMode = "AUTO";

const qaLabel = figma.createText();
qaLabel.fontName = { family: "Inter", style: "Bold" };
qaLabel.characters = "Quick actions"; qaLabel.fontSize = 14; qaLabel.fills = [fill(C.text)];
qaSection.appendChild(qaLabel);

const qaRow = figma.createFrame();
qaRow.layoutMode = "HORIZONTAL"; qaRow.itemSpacing = 8;
qaRow.fills = []; qaRow.primaryAxisSizingMode = "AUTO"; qaRow.counterAxisSizingMode = "AUTO";

function qaBtn(label, emoji, color) {
  const b = figma.createFrame();
  b.resize(84, 52); b.cornerRadius = 10;
  b.fills = [fill(color, 0.1)];
  b.strokes = [fill(color, 0.2)]; b.strokeWeight = 1;
  b.layoutMode = "VERTICAL";
  b.primaryAxisAlignItems = "CENTER"; b.counterAxisAlignItems = "CENTER";
  b.itemSpacing = 2;

  const e = figma.createText();
  e.fontName = { family: "Inter", style: "Regular" };
  e.characters = emoji; e.fontSize = 18;
  b.appendChild(e);
  const l = figma.createText();
  l.fontName = { family: "Inter", style: "Bold" };
  l.characters = label; l.fontSize = 12; l.fills = [fill(color)];
  b.appendChild(l);
  return b;
}

qaRow.appendChild(qaBtn("Scan", "📷", C.primary));
qaRow.appendChild(qaBtn("Sell", "⚡", C.success));
qaRow.appendChild(qaBtn("Tax", "📋", C.info));
qaRow.appendChild(qaBtn("Credit", "💰", C.accent));
qaSection.appendChild(qaRow);
dash.appendChild(qaSection);
dash.appendChild(bottomNav());

// ─────────────────────────────────────
// SCREEN 2: QUICK SALE (Full Detail)
// ─────────────────────────────────────
addLabel("02 Quick Sale", 450);
addSunScore(95, "A+", 450);

const sale = createPhone("02 Quick Sale", 450);
sale.appendChild(statusBar());
sale.appendChild(header("Quick sale", null, true));

// Cart content area
const cart = figma.createFrame();
cart.name = "Cart"; cart.resize(390, 520);
cart.fills = [fill(C.bg)];
cart.layoutMode = "VERTICAL"; cart.paddingLeft = 16; cart.paddingRight = 16;
cart.paddingTop = 8;
cart.layoutSizingHorizontal = "FILL";
cart.primaryAxisSizingMode = "AUTO";

function cartItem(name, emoji, price, qty) {
  const row = figma.createFrame();
  row.resize(358, 60); row.fills = [];
  row.layoutMode = "HORIZONTAL"; row.counterAxisAlignItems = "CENTER";
  row.itemSpacing = 12;
  row.paddingTop = 14; row.paddingBottom = 14;
  row.strokes = [fill(C.border)]; row.strokeWeight = 1;
  row.strokeAlign = "INSIDE";
  // Only bottom border (approximate with bottom padding)

  const icon = figma.createFrame();
  icon.resize(44, 44); icon.cornerRadius = 8; icon.fills = [fill(C.surface)];
  icon.layoutMode = "HORIZONTAL";
  icon.primaryAxisAlignItems = "CENTER"; icon.counterAxisAlignItems = "CENTER";
  const em = figma.createText();
  em.fontName = { family: "Inter", style: "Regular" };
  em.characters = emoji; em.fontSize = 22;
  icon.appendChild(em);
  row.appendChild(icon);

  const info = figma.createFrame();
  info.layoutMode = "VERTICAL"; info.fills = [];
  info.itemSpacing = 2; info.primaryAxisSizingMode = "AUTO"; info.layoutGrow = 1;
  const n = figma.createText();
  n.fontName = { family: "Inter", style: "Bold" };
  n.characters = name; n.fontSize = 15; n.fills = [fill(C.text)];
  info.appendChild(n);
  const p = figma.createText();
  p.fontName = { family: "Inter", style: "Medium" };
  p.characters = `GHS ${price.toFixed(2)}`; p.fontSize = 13; p.fills = [fill(C.textSec)];
  info.appendChild(p);
  row.appendChild(info);

  // Stepper
  const stepper = figma.createFrame();
  stepper.layoutMode = "HORIZONTAL"; stepper.fills = [];
  stepper.counterAxisAlignItems = "CENTER";

  const minus = figma.createFrame();
  minus.resize(36, 36); minus.cornerRadius = 18;
  minus.fills = [fill(C.surface)]; minus.strokes = [fill(C.border)]; minus.strokeWeight = 1;
  minus.layoutMode = "HORIZONTAL";
  minus.primaryAxisAlignItems = "CENTER"; minus.counterAxisAlignItems = "CENTER";
  const mt = figma.createText();
  mt.fontName = { family: "Inter", style: "Bold" }; mt.characters = "−";
  mt.fontSize = 16; mt.fills = [fill(C.text)];
  minus.appendChild(mt);
  stepper.appendChild(minus);

  const qv = figma.createText();
  qv.fontName = { family: "Inter", style: "Bold" }; qv.characters = String(qty);
  qv.fontSize = 17; qv.fills = [fill(C.text)];
  qv.textAlignHorizontal = "CENTER"; qv.resize(36, 24);
  stepper.appendChild(qv);

  const plus = figma.createFrame();
  plus.resize(36, 36); plus.cornerRadius = 18;
  plus.fills = [fill(C.primaryLight)]; plus.strokes = [fill(C.primary)]; plus.strokeWeight = 1;
  plus.layoutMode = "HORIZONTAL";
  plus.primaryAxisAlignItems = "CENTER"; plus.counterAxisAlignItems = "CENTER";
  const pt = figma.createText();
  pt.fontName = { family: "Inter", style: "Bold" }; pt.characters = "+";
  pt.fontSize = 16; pt.fills = [fill(C.primary)];
  plus.appendChild(pt);
  stepper.appendChild(plus);

  row.appendChild(stepper);

  const total = figma.createText();
  total.fontName = { family: "Inter", style: "Bold" };
  total.characters = `GHS ${(price * qty).toFixed(2)}`; total.fontSize = 15;
  total.fills = [fill(C.text)]; total.textAlignHorizontal = "RIGHT";
  total.resize(72, 20);
  row.appendChild(total);

  return row;
}

cart.appendChild(cartItem("Indomie 70g", "🍜", 2.50, 3));
cart.appendChild(cartItem("Sachet Water", "💧", 10.00, 1));

const addMore = figma.createText();
addMore.fontName = { family: "Inter", style: "Bold" };
addMore.characters = "＋ Add more items"; addMore.fontSize = 14;
addMore.fills = [fill(C.primary)];
const addWrap = figma.createFrame();
addWrap.fills = []; addWrap.paddingTop = 16; addWrap.paddingBottom = 16;
addWrap.layoutMode = "HORIZONTAL"; addWrap.primaryAxisSizingMode = "AUTO";
addWrap.appendChild(addMore);
cart.appendChild(addWrap);

sale.appendChild(cart);

// Checkout footer
const checkout = figma.createFrame();
checkout.name = "Checkout Footer"; checkout.resize(390, 160);
checkout.fills = [fill(C.card)]; checkout.strokes = [fill(C.border)]; checkout.strokeWeight = 1;
checkout.layoutMode = "VERTICAL";
checkout.paddingTop = 16; checkout.paddingBottom = 16;
checkout.paddingLeft = 16; checkout.paddingRight = 16;
checkout.itemSpacing = 14;
checkout.layoutSizingHorizontal = "FILL";
checkout.primaryAxisSizingMode = "AUTO";

// Total row
const totalRow = figma.createFrame();
totalRow.layoutMode = "HORIZONTAL"; totalRow.fills = [];
totalRow.primaryAxisAlignItems = "SPACE_BETWEEN";
totalRow.counterAxisAlignItems = "MAX";
totalRow.resize(358, 36); totalRow.primaryAxisSizingMode = "FIXED";

const totalLabel = figma.createText();
totalLabel.fontName = { family: "Inter", style: "Medium" };
totalLabel.characters = "Total"; totalLabel.fontSize = 14; totalLabel.fills = [fill(C.textSec)];
totalRow.appendChild(totalLabel);
const totalVal = figma.createText();
totalVal.fontName = { family: "Inter", style: "Bold" };
totalVal.characters = "GHS 17.50"; totalVal.fontSize = 28; totalVal.fills = [fill(C.text)];
totalRow.appendChild(totalVal);
checkout.appendChild(totalRow);

// Payment methods
const payRow = figma.createFrame();
payRow.layoutMode = "HORIZONTAL"; payRow.itemSpacing = 8;
payRow.fills = []; payRow.primaryAxisSizingMode = "AUTO"; payRow.counterAxisSizingMode = "AUTO";

function payBtn(label, active) {
  const b = figma.createFrame();
  b.resize(114, 48); b.cornerRadius = 10;
  b.fills = active ? [fill(C.primary)] : [];
  b.strokes = active ? [] : [fill(C.border)]; b.strokeWeight = 2;
  b.layoutMode = "HORIZONTAL";
  b.primaryAxisAlignItems = "CENTER"; b.counterAxisAlignItems = "CENTER";
  const t = figma.createText();
  t.fontName = { family: "Inter", style: "Bold" };
  t.characters = label; t.fontSize = 14;
  t.fills = [fill(active ? C.white : C.text)];
  b.appendChild(t);
  return b;
}

payRow.appendChild(payBtn("Cash", true));
payRow.appendChild(payBtn("MoMo", false));
payRow.appendChild(payBtn("Credit", false));
checkout.appendChild(payRow);

// Confirm button
const confirmBtn = figma.createFrame();
confirmBtn.resize(358, 48); confirmBtn.cornerRadius = 10;
confirmBtn.fills = [fill(C.primary)];
confirmBtn.effects = [shadow(0.059,0.463,0.431,0.25,0,4,12)];
confirmBtn.layoutMode = "HORIZONTAL";
confirmBtn.primaryAxisAlignItems = "CENTER"; confirmBtn.counterAxisAlignItems = "CENTER";
const cbText = figma.createText();
cbText.fontName = { family: "Inter", style: "Bold" };
cbText.characters = "Confirm sale →"; cbText.fontSize = 16; cbText.fills = [fill(C.white)];
confirmBtn.appendChild(cbText);
checkout.appendChild(confirmBtn);

sale.appendChild(checkout);

// ─────────────────────────────────────
// SCREEN 3: LOW STOCK (Full Detail)
// ─────────────────────────────────────
addLabel("03 Low Stock Alerts", 900);
addSunScore(93, "A+", 900);

const lowStock = createPhone("03 Low Stock Alerts", 900);
lowStock.appendChild(statusBar());
lowStock.appendChild(header("Low stock alerts", "6 items need attention", true));

// Filter chips
const filterRow = figma.createFrame();
filterRow.name = "Filters"; filterRow.resize(390, 52);
filterRow.fills = []; filterRow.paddingLeft = 16; filterRow.paddingRight = 16;
filterRow.paddingTop = 8; filterRow.paddingBottom = 4;
filterRow.layoutMode = "HORIZONTAL"; filterRow.itemSpacing = 6;
filterRow.layoutSizingHorizontal = "FILL";
filterRow.counterAxisSizingMode = "AUTO";

function chipBtn(label, active, color) {
  const c = figma.createFrame();
  c.cornerRadius = 20;
  c.fills = active ? [fill(color || C.primary)] : [];
  c.strokes = active ? [] : [fill(C.border)]; c.strokeWeight = 1.5;
  c.layoutMode = "HORIZONTAL";
  c.primaryAxisAlignItems = "CENTER"; c.counterAxisAlignItems = "CENTER";
  c.primaryAxisSizingMode = "AUTO";
  c.paddingLeft = 14; c.paddingRight = 14;
  c.paddingTop = 9; c.paddingBottom = 9;
  c.itemSpacing = 6;

  if (color && !active) {
    const dot = figma.createEllipse();
    dot.resize(8, 8); dot.fills = [fill(color)];
    c.appendChild(dot);
  }

  const t = figma.createText();
  t.fontName = { family: "Inter", style: "Bold" };
  t.characters = label; t.fontSize = 12;
  t.fills = [fill(active ? C.white : C.textSec)];
  c.appendChild(t);
  return c;
}

filterRow.appendChild(chipBtn("All (6)", true));
filterRow.appendChild(chipBtn("Critical (3)", false, C.error));
filterRow.appendChild(chipBtn("High (2)", false, C.warning));
filterRow.appendChild(chipBtn("Low (1)", false, C.accent));
lowStock.appendChild(filterRow);

// Stock items
const stockList = figma.createFrame();
stockList.name = "Stock List"; stockList.resize(390, 480);
stockList.fills = []; stockList.paddingLeft = 16; stockList.paddingRight = 16;
stockList.layoutMode = "VERTICAL"; stockList.itemSpacing = 8;
stockList.layoutSizingHorizontal = "FILL";
stockList.primaryAxisSizingMode = "AUTO";

function stockItem(name, info, sev, color, emoji, checked) {
  const row = figma.createFrame();
  row.resize(358, 66); row.cornerRadius = 10;
  row.fills = checked ? [fill(C.primaryLight)] : [fill(C.card)];
  row.strokes = [fill(checked ? C.primary : C.border, checked ? 0.5 : 1)]; row.strokeWeight = 1.5;
  row.layoutMode = "HORIZONTAL"; row.counterAxisAlignItems = "CENTER";
  row.itemSpacing = 10;
  row.paddingTop = 14; row.paddingBottom = 14;
  row.paddingLeft = 14; row.paddingRight = 14;

  // Checkbox
  const cb = figma.createFrame();
  cb.resize(28, 28); cb.cornerRadius = 8;
  cb.fills = checked ? [fill(C.primary)] : [];
  cb.strokes = checked ? [] : [fill(C.border)]; cb.strokeWeight = 2.5;
  if (checked) {
    cb.layoutMode = "HORIZONTAL";
    cb.primaryAxisAlignItems = "CENTER"; cb.counterAxisAlignItems = "CENTER";
    const ck = figma.createText();
    ck.fontName = { family: "Inter", style: "Bold" }; ck.characters = "✓";
    ck.fontSize = 16; ck.fills = [fill(C.white)];
    cb.appendChild(ck);
  }
  row.appendChild(cb);

  // Emoji
  const em = figma.createText();
  em.fontName = { family: "Inter", style: "Regular" };
  em.characters = emoji; em.fontSize = 22;
  row.appendChild(em);

  // Info
  const infoCol = figma.createFrame();
  infoCol.layoutMode = "VERTICAL"; infoCol.fills = [];
  infoCol.itemSpacing = 2; infoCol.primaryAxisSizingMode = "AUTO"; infoCol.layoutGrow = 1;

  const n = figma.createText();
  n.fontName = { family: "Inter", style: "Bold" }; n.characters = name;
  n.fontSize = 14; n.fills = [fill(C.text)];
  infoCol.appendChild(n);
  const m = figma.createText();
  m.fontName = { family: "Inter", style: "Medium" }; m.characters = info;
  m.fontSize = 12; m.fills = [fill(C.textSec)];
  infoCol.appendChild(m);
  row.appendChild(infoCol);

  // Severity (shape+color)
  const sevCol = figma.createFrame();
  sevCol.layoutMode = "VERTICAL"; sevCol.fills = [];
  sevCol.counterAxisAlignItems = "CENTER"; sevCol.itemSpacing = 2;
  sevCol.primaryAxisSizingMode = "AUTO";

  const sevDot = sev === "low" ? figma.createRectangle() : figma.createEllipse();
  sevDot.resize(sev === "critical" ? 10 : 8, sev === "critical" ? 10 : 8);
  if (sev === "low") sevDot.cornerRadius = 2;
  sevDot.fills = [fill(color)];
  if (sev === "critical") {
    sevDot.effects = [shadow(hex(color).r, hex(color).g, hex(color).b, 0.25, 0, 0, 6)];
  }
  sevCol.appendChild(sevDot);

  const sevText = figma.createText();
  sevText.fontName = { family: "Inter", style: "Bold" }; sevText.characters = sev;
  sevText.fontSize = 10; sevText.fills = [fill(color)];
  sevText.textCase = "UPPER";
  sevCol.appendChild(sevText);
  row.appendChild(sevCol);

  return row;
}

stockList.appendChild(stockItem("Indomie 70g Chicken", "OUT · 9.2/day · need 120 pcs", "critical", C.error, "🍜", true));
stockList.appendChild(stockItem("Sachet Water Voltic", "2 bags · 2.3/day · ~1 day", "critical", C.error, "💧", true));
stockList.appendChild(stockItem("Peak Milk Sachet 32g", "8 pcs · 4.0/day · ~2 days", "critical", C.error, "🥛", true));
stockList.appendChild(stockItem("Maggi Chicken Cube", "18 pks · 1.0/day · ~3 days", "high", C.warning, "🧂", true));
stockList.appendChild(stockItem("Frytol Oil 1L", "4 btls · 0.9/day · ~4 days", "high", C.warning, "🫒", false));
stockList.appendChild(stockItem("Key Soap 250g", "4 pcs · 0.3/day · ~13 days", "low", C.accent, "🧼", false));

lowStock.appendChild(stockList);

// Bottom CTA
const ctaWrap = figma.createFrame();
ctaWrap.name = "CTA"; ctaWrap.resize(390, 90);
ctaWrap.fills = [fill(C.card)]; ctaWrap.strokes = [fill(C.border)]; ctaWrap.strokeWeight = 1;
ctaWrap.paddingLeft = 16; ctaWrap.paddingRight = 16;
ctaWrap.paddingTop = 12; ctaWrap.paddingBottom = 12;
ctaWrap.layoutMode = "VERTICAL"; ctaWrap.itemSpacing = 8;
ctaWrap.layoutSizingHorizontal = "FILL";
ctaWrap.primaryAxisSizingMode = "AUTO";

const ctaInfo = figma.createText();
ctaInfo.fontName = { family: "Inter", style: "Semi Bold" };
ctaInfo.characters = "4 items selected · Est. GHS 631"; ctaInfo.fontSize = 13;
ctaInfo.fills = [fill(C.textSec)];
ctaWrap.appendChild(ctaInfo);

const ctaBtn = figma.createFrame();
ctaBtn.resize(358, 48); ctaBtn.cornerRadius = 10;
ctaBtn.fills = [fill(C.primary)];
ctaBtn.effects = [shadow(0.059,0.463,0.431,0.25,0,4,12)];
ctaBtn.layoutMode = "HORIZONTAL";
ctaBtn.primaryAxisAlignItems = "CENTER"; ctaBtn.counterAxisAlignItems = "CENTER";
const ctaT = figma.createText();
ctaT.fontName = { family: "Inter", style: "Bold" };
ctaT.characters = "Review & order selected →"; ctaT.fontSize = 15; ctaT.fills = [fill(C.white)];
ctaBtn.appendChild(ctaT);
ctaWrap.appendChild(ctaBtn);
lowStock.appendChild(ctaWrap);

// Page title
const pageTitle = figma.createText();
pageTitle.fontName = { family: "Inter", style: "Bold" };
pageTitle.characters = "Variation B — Light Screens (Sunlight Optimized)";
pageTitle.fontSize = 24; pageTitle.fills = [fill(C.text)];
pageTitle.x = 0; pageTitle.y = 10;

figma.notify("✅ 3 detailed screens built: Dashboard, Quick Sale, Low Stock Alerts — all with full content!");

})();
