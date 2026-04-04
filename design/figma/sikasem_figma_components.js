// ═══════════════════════════════════════════════════════════
// SIKASEM — Figma Component Library Builder
// ═══════════════════════════════════════════════════════════
// 
// HOW TO USE:
// 1. Open your Figma file: https://www.figma.com/design/4lfprfagF9R6Yisgy3MZkL
// 2. Go to Plugins > Development > Open console
// 3. Paste this entire script and run it
// 4. It will create all components on the Design System page
//
// Components created:
// - Button (Primary, Secondary, Ghost, Danger)
// - Status Badge (Success, Warning, Error, Pending, Info, Accent)
// - KPI Card
// - Alert Card (Critical, High, Low)
// - Bottom Navigation Bar
// - Status Bar (Light + Dark)
// - Revenue Hero Card
// - Credit Card (Overdue, Due, Pending)
// - Product List Item
// - Quick Action Button
// - Payment Method Selector
// - Quantity Stepper
// - Filter Chip (Active, Inactive)
// - Section Header
// ═══════════════════════════════════════════════════════════

(async () => {

// ── Utilities ──
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
  white: "#FFFFFF", black: "#000000"
};

// Navigate to Design System page
const dsPage = figma.root.children[0];
await figma.setCurrentPageAsync(dsPage);

// Load fonts
await figma.loadFontAsync({ family: "Inter", style: "Bold" });
await figma.loadFontAsync({ family: "Inter", style: "Regular" });
await figma.loadFontAsync({ family: "Inter", style: "Semi Bold" });
await figma.loadFontAsync({ family: "Inter", style: "Medium" });

let yPos = 2000;

// ── Section Label Helper ──
function sectionLabel(text, y) {
  const t = figma.createText();
  t.fontName = { family: "Inter", style: "Bold" };
  t.characters = text;
  t.fontSize = 20;
  t.fills = [fill(C.text)];
  t.x = 0;
  t.y = y - 30;
}

// ═══════════════════════════════════════
// 1. BUTTON COMPONENT SET
// ═══════════════════════════════════════
sectionLabel("Buttons", yPos);

function makeBtn(variant, label, bgColor, textColor, borderColor, bgOpacity) {
  const btn = figma.createComponent();
  btn.name = `Variant=${variant}`;
  btn.resize(200, 48);
  btn.cornerRadius = 10;
  btn.fills = bgColor ? [fill(bgColor, bgOpacity)] : [];
  if (borderColor) { btn.strokes = [fill(borderColor)]; btn.strokeWeight = 1.5; }
  btn.layoutMode = "HORIZONTAL";
  btn.primaryAxisAlignItems = "CENTER";
  btn.counterAxisAlignItems = "CENTER";
  btn.paddingLeft = 24; btn.paddingRight = 24;
  const txt = figma.createText();
  txt.fontName = { family: "Inter", style: "Semi Bold" };
  txt.characters = label; txt.fontSize = 15;
  txt.fills = [fill(textColor)];
  btn.appendChild(txt);
  return btn;
}

const btns = [
  makeBtn("Primary", "Confirm sale →", C.primary, C.white),
  makeBtn("Secondary", "Update Stock", C.white, C.primary, C.primary),
  makeBtn("Ghost", "Cancel", C.white, C.textSec, C.border),
  makeBtn("Danger", "Write off", C.white, C.error, C.error),
];
const btnSet = figma.combineAsVariants(btns, figma.currentPage);
btnSet.name = "Button"; btnSet.x = 0; btnSet.y = yPos;
btnSet.layoutMode = "HORIZONTAL"; btnSet.itemSpacing = 16;
btnSet.counterAxisSizingMode = "AUTO"; btnSet.primaryAxisSizingMode = "AUTO";
btnSet.fills = [];
btnSet.description = "Button with 4 variants. Min 48px height for touch targets.";

yPos += 120;

// ═══════════════════════════════════════
// 2. STATUS BADGE COMPONENT SET
// ═══════════════════════════════════════
sectionLabel("Status Badges", yPos);

function makeBadge(variant, label, color) {
  const b = figma.createComponent();
  b.name = `Status=${variant}`;
  b.cornerRadius = 12;
  b.fills = [fill(color, 0.12)];
  b.layoutMode = "HORIZONTAL";
  b.primaryAxisAlignItems = "CENTER"; b.counterAxisAlignItems = "CENTER";
  b.primaryAxisSizingMode = "AUTO";
  b.paddingLeft = 10; b.paddingRight = 10; b.paddingTop = 4; b.paddingBottom = 4;
  const t = figma.createText();
  t.fontName = { family: "Inter", style: "Bold" };
  t.characters = label; t.fontSize = 10;
  t.letterSpacing = { value: 0.3, unit: "PIXELS" };
  t.fills = [fill(color)];
  b.appendChild(t);
  return b;
}

const bdgs = [
  makeBadge("Success", "MATCHED", C.success),
  makeBadge("Warning", "DUE TOMORROW", C.warning),
  makeBadge("Error", "OVERDUE 3D", C.error),
  makeBadge("Pending", "PENDING", C.textTer),
  makeBadge("Info", "AI SUGGESTION", C.info),
  makeBadge("Accent", "BEST PRICE", C.accent),
];
const bdgSet = figma.combineAsVariants(bdgs, figma.currentPage);
bdgSet.name = "Status Badge"; bdgSet.x = 0; bdgSet.y = yPos;
bdgSet.layoutMode = "HORIZONTAL"; bdgSet.itemSpacing = 12;
bdgSet.counterAxisSizingMode = "AUTO"; bdgSet.primaryAxisSizingMode = "AUTO";
bdgSet.fills = [];

yPos += 80;

// ═══════════════════════════════════════
// 3. KPI CARD
// ═══════════════════════════════════════
sectionLabel("KPI Card", yPos);

const kpi = figma.createComponent();
kpi.name = "KPI Card";
kpi.resize(175, 90); kpi.cornerRadius = 10;
kpi.fills = [fill(C.card)]; kpi.strokes = [fill(C.border)]; kpi.strokeWeight = 1;
kpi.effects = [shadow(0,0,0,0.04,0,1,3)];
kpi.layoutMode = "VERTICAL";
kpi.paddingTop = 14; kpi.paddingBottom = 14; kpi.paddingLeft = 16; kpi.paddingRight = 16;
kpi.itemSpacing = 4; kpi.primaryAxisSizingMode = "AUTO";
kpi.x = 0; kpi.y = yPos;

const kv = figma.createText();
kv.fontName = { family: "Inter", style: "Bold" }; kv.characters = "47";
kv.fontSize = 26; kv.fills = [fill(C.text)]; kv.name = "Value";
kpi.appendChild(kv);

const kl = figma.createText();
kl.fontName = { family: "Inter", style: "Medium" }; kl.characters = "Items sold today";
kl.fontSize = 12; kl.fills = [fill(C.textSec)]; kl.name = "Label";
kpi.appendChild(kl);

const ks = figma.createText();
ks.fontName = { family: "Inter", style: "Semi Bold" }; ks.characters = "▲ 8 vs yesterday";
ks.fontSize = 11; ks.fills = [fill(C.primary)]; ks.name = "Subtitle";
kpi.appendChild(ks);

yPos += 130;

// ═══════════════════════════════════════
// 4. ALERT CARD SET
// ═══════════════════════════════════════
sectionLabel("Alert Cards", yPos);

function makeAlert(variant, title, sub, color) {
  const a = figma.createComponent();
  a.name = `Severity=${variant}`;
  a.resize(358, 60); a.cornerRadius = 6;
  a.fills = [fill(color, 0.06)];
  a.layoutMode = "HORIZONTAL"; a.counterAxisAlignItems = "CENTER";
  a.itemSpacing = 12;
  a.paddingTop = 13; a.paddingBottom = 13; a.paddingLeft = 14; a.paddingRight = 14;
  a.primaryAxisSizingMode = "FIXED"; a.counterAxisSizingMode = "AUTO";

  const bar = figma.createRectangle();
  bar.resize(4, 34); bar.cornerRadius = 2; bar.fills = [fill(color)];
  a.appendChild(bar);

  const dot = figma.createEllipse();
  dot.resize(10, 10); dot.fills = [fill(color)];
  a.appendChild(dot);

  const tg = figma.createFrame();
  tg.layoutMode = "VERTICAL"; tg.itemSpacing = 2;
  tg.primaryAxisSizingMode = "AUTO"; tg.layoutGrow = 1; tg.fills = [];

  const tt = figma.createText();
  tt.fontName = { family: "Inter", style: "Bold" }; tt.characters = title;
  tt.fontSize = 13; tt.fills = [fill(C.text)]; tt.name = "Title";
  tg.appendChild(tt);

  const st = figma.createText();
  st.fontName = { family: "Inter", style: "Medium" }; st.characters = sub;
  st.fontSize = 11; st.fills = [fill(C.textSec)]; st.name = "Subtitle";
  tg.appendChild(st);

  a.appendChild(tg);
  return a;
}

const alts = [
  makeAlert("Critical", "Indomie 70g — OUT OF STOCK", "0 pcs · 9.2/day avg · Order 120 pcs", C.error),
  makeAlert("High", "Sachet Water — 2 bags left", "~1 day of stock · Suggest 10 bags", C.warning),
  makeAlert("Low", "Kofi Mensah — GHS 85 due TODAY", "MoMo sent · awaiting approval", C.accent),
];
const altSet = figma.combineAsVariants(alts, figma.currentPage);
altSet.name = "Alert Card"; altSet.x = 0; altSet.y = yPos;
altSet.layoutMode = "VERTICAL"; altSet.itemSpacing = 8;
altSet.counterAxisSizingMode = "AUTO"; altSet.primaryAxisSizingMode = "AUTO";
altSet.fills = [];

yPos += 240;

// ═══════════════════════════════════════
// 5. BOTTOM NAVIGATION
// ═══════════════════════════════════════
sectionLabel("Bottom Navigation", yPos);

const nav = figma.createComponent();
nav.name = "Bottom Navigation";
nav.resize(390, 60);
nav.fills = [fill(C.card)]; nav.strokes = [fill(C.border)]; nav.strokeWeight = 1;
nav.layoutMode = "HORIZONTAL"; nav.primaryAxisAlignItems = "SPACE_BETWEEN";
nav.counterAxisAlignItems = "CENTER";
nav.paddingLeft = 20; nav.paddingRight = 20;
nav.paddingTop = 6; nav.paddingBottom = 6;
nav.x = 0; nav.y = yPos;

const navLabels = [
  { l: "Home", active: true },
  { l: "Stock", active: false },
  { l: "＋", fab: true },
  { l: "Credit", active: false },
  { l: "More", active: false },
];

for (const item of navLabels) {
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
    const icon = figma.createFrame();
    icon.resize(22, 22); icon.cornerRadius = 4;
    icon.fills = [fill(item.active ? C.primary : C.textTer, 0.2)];
    ni.appendChild(icon);
    const lbl = figma.createText();
    lbl.fontName = { family: "Inter", style: item.active ? "Bold" : "Regular" };
    lbl.characters = item.l; lbl.fontSize = 10;
    lbl.fills = [fill(item.active ? C.primary : C.textTer)];
    ni.appendChild(lbl);
    nav.appendChild(ni);
  }
}

yPos += 110;

// ═══════════════════════════════════════
// 6. REVENUE HERO CARD
// ═══════════════════════════════════════
sectionLabel("Revenue Hero", yPos);

const hero = figma.createComponent();
hero.name = "Revenue Hero";
hero.resize(358, 130); hero.cornerRadius = 14;
hero.fills = [{ type: "GRADIENT_LINEAR", gradientStops: [
  { position: 0, color: { ...hex(C.primary), a: 1 } },
  { position: 1, color: { ...hex(C.primaryDark), a: 1 } }
], gradientTransform: [[0.7,0.7,0],[-0.7,0.7,0.3]] }];
hero.layoutMode = "VERTICAL";
hero.paddingTop = 20; hero.paddingBottom = 18;
hero.paddingLeft = 20; hero.paddingRight = 20;
hero.itemSpacing = 4; hero.primaryAxisSizingMode = "AUTO";
hero.x = 0; hero.y = yPos;

const hl = figma.createText();
hl.fontName = { family: "Inter", style: "Semi Bold" };
hl.characters = "TODAY'S REVENUE"; hl.fontSize = 11;
hl.letterSpacing = { value: 0.8, unit: "PIXELS" };
hl.fills = [fill(C.white, 0.8)]; hl.name = "Label";
hero.appendChild(hl);

const ha = figma.createText();
ha.fontName = { family: "Inter", style: "Bold" };
ha.characters = "GHS 284.50"; ha.fontSize = 36;
ha.fills = [fill(C.white)]; ha.name = "Amount";
hero.appendChild(ha);

const hb = figma.createText();
hb.fontName = { family: "Inter", style: "Medium" };
hb.characters = "Cash 192.00 · MoMo 92.50"; hb.fontSize = 12;
hb.fills = [fill(C.white, 0.7)]; hb.name = "Breakdown";
hero.appendChild(hb);

yPos += 180;

// ═══════════════════════════════════════
// 7. CREDIT CARD SET
// ═══════════════════════════════════════
sectionLabel("Credit Cards", yPos);

function makeCreditCard(variant, name, ref, amount, due, statusLabel, statusColor) {
  const card = figma.createComponent();
  card.name = `Status=${variant}`;
  card.resize(358, 140); card.cornerRadius = 10;
  card.fills = [fill(C.card)]; card.strokes = [fill(C.border)]; card.strokeWeight = 1;
  card.effects = [shadow(0,0,0,0.04,0,1,3)];
  card.layoutMode = "VERTICAL"; card.itemSpacing = 12;
  card.paddingTop = 16; card.paddingBottom = 16;
  card.paddingLeft = 16; card.paddingRight = 16;
  card.primaryAxisSizingMode = "AUTO";

  // Top row
  const topRow = figma.createFrame();
  topRow.layoutMode = "HORIZONTAL"; topRow.fills = [];
  topRow.primaryAxisAlignItems = "SPACE_BETWEEN";
  topRow.counterAxisAlignItems = "MIN";
  topRow.resize(326, 50);
  topRow.primaryAxisSizingMode = "FIXED";
  topRow.counterAxisSizingMode = "AUTO";

  // Left: avatar + name
  const leftCol = figma.createFrame();
  leftCol.layoutMode = "HORIZONTAL"; leftCol.fills = [];
  leftCol.itemSpacing = 10; leftCol.counterAxisAlignItems = "CENTER";
  leftCol.primaryAxisSizingMode = "AUTO"; leftCol.counterAxisSizingMode = "AUTO";

  const avatar = figma.createEllipse();
  avatar.resize(42, 42);
  avatar.fills = [fill(statusColor, 0.15)];
  leftCol.appendChild(avatar);

  const nameCol = figma.createFrame();
  nameCol.layoutMode = "VERTICAL"; nameCol.fills = [];
  nameCol.itemSpacing = 2; nameCol.primaryAxisSizingMode = "AUTO";

  const nameT = figma.createText();
  nameT.fontName = { family: "Inter", style: "Bold" };
  nameT.characters = name; nameT.fontSize = 15; nameT.fills = [fill(C.text)];
  nameT.name = "Customer Name";
  nameCol.appendChild(nameT);

  const refT = figma.createText();
  refT.fontName = { family: "Inter", style: "Regular" };
  refT.characters = `INV #${ref}`; refT.fontSize = 11; refT.fills = [fill(C.textTer)];
  nameCol.appendChild(refT);

  leftCol.appendChild(nameCol);
  topRow.appendChild(leftCol);

  // Right: amount + badge
  const rightCol = figma.createFrame();
  rightCol.layoutMode = "VERTICAL"; rightCol.fills = [];
  rightCol.itemSpacing = 4; rightCol.primaryAxisSizingMode = "AUTO";
  rightCol.counterAxisAlignItems = "MAX";

  const amtT = figma.createText();
  amtT.fontName = { family: "Inter", style: "Bold" };
  amtT.characters = amount; amtT.fontSize = 17; amtT.fills = [fill(C.text)];
  amtT.name = "Amount";
  rightCol.appendChild(amtT);

  const badgeFrame = figma.createFrame();
  badgeFrame.cornerRadius = 10; badgeFrame.fills = [fill(statusColor, 0.12)];
  badgeFrame.layoutMode = "HORIZONTAL";
  badgeFrame.primaryAxisAlignItems = "CENTER"; badgeFrame.counterAxisAlignItems = "CENTER";
  badgeFrame.paddingLeft = 8; badgeFrame.paddingRight = 8;
  badgeFrame.paddingTop = 3; badgeFrame.paddingBottom = 3;
  badgeFrame.primaryAxisSizingMode = "AUTO";

  const badgeT = figma.createText();
  badgeT.fontName = { family: "Inter", style: "Bold" };
  badgeT.characters = statusLabel; badgeT.fontSize = 9;
  badgeT.fills = [fill(statusColor)];
  badgeFrame.appendChild(badgeT);
  rightCol.appendChild(badgeFrame);

  topRow.appendChild(rightCol);
  card.appendChild(topRow);

  // Divider + bottom row
  const divider = figma.createRectangle();
  divider.resize(326, 1); divider.fills = [fill(C.border)];
  card.appendChild(divider);

  const bottomRow = figma.createFrame();
  bottomRow.layoutMode = "HORIZONTAL"; bottomRow.fills = [];
  bottomRow.primaryAxisAlignItems = "SPACE_BETWEEN";
  bottomRow.counterAxisAlignItems = "CENTER";
  bottomRow.resize(326, 20);
  bottomRow.primaryAxisSizingMode = "FIXED";

  const dueT = figma.createText();
  dueT.fontName = { family: "Inter", style: "Medium" };
  dueT.characters = `Due: ${due}`; dueT.fontSize = 12; dueT.fills = [fill(C.textSec)];
  bottomRow.appendChild(dueT);

  const detailT = figma.createText();
  detailT.fontName = { family: "Inter", style: "Bold" };
  detailT.characters = "Details →"; detailT.fontSize = 13; detailT.fills = [fill(C.primary)];
  bottomRow.appendChild(detailT);

  card.appendChild(bottomRow);
  return card;
}

const creditCards = [
  makeCreditCard("Overdue", "Kofi Mensah Ent.", "CK-902", "₵8,400.00", "Oct 24, 2023", "OVERDUE 3D", C.error),
  makeCreditCard("Due", "Ama Serwaa Boutique", "CK-914", "₵12,250.00", "Oct 28, 2023", "DUE TOMORROW", C.warning),
  makeCreditCard("Pending", "Daniel Owusu", "CK-918", "₵5,500.00", "Nov 05, 2023", "PENDING", C.textTer),
];
const ccSet = figma.combineAsVariants(creditCards, figma.currentPage);
ccSet.name = "Credit Card"; ccSet.x = 0; ccSet.y = yPos;
ccSet.layoutMode = "VERTICAL"; ccSet.itemSpacing = 12;
ccSet.counterAxisSizingMode = "AUTO"; ccSet.primaryAxisSizingMode = "AUTO";
ccSet.fills = [];

yPos += 520;

// ═══════════════════════════════════════
// 8. PRODUCT LIST ITEM
// ═══════════════════════════════════════
sectionLabel("Product List Item", yPos);

const prodItem = figma.createComponent();
prodItem.name = "Product List Item";
prodItem.resize(358, 60);
prodItem.fills = [];
prodItem.layoutMode = "HORIZONTAL";
prodItem.counterAxisAlignItems = "CENTER";
prodItem.itemSpacing = 12;
prodItem.paddingTop = 14; prodItem.paddingBottom = 14;
prodItem.x = 0; prodItem.y = yPos;
prodItem.primaryAxisSizingMode = "FIXED";
prodItem.counterAxisSizingMode = "AUTO";

const prodIcon = figma.createFrame();
prodIcon.name = "Icon"; prodIcon.resize(44, 44);
prodIcon.cornerRadius = 8; prodIcon.fills = [fill(C.surface)];
prodIcon.layoutMode = "HORIZONTAL";
prodIcon.primaryAxisAlignItems = "CENTER"; prodIcon.counterAxisAlignItems = "CENTER";
const prodEmoji = figma.createText();
prodEmoji.fontName = { family: "Inter", style: "Regular" };
prodEmoji.characters = "🍜"; prodEmoji.fontSize = 22;
prodIcon.appendChild(prodEmoji);
prodItem.appendChild(prodIcon);

const prodInfo = figma.createFrame();
prodInfo.layoutMode = "VERTICAL"; prodInfo.fills = [];
prodInfo.itemSpacing = 2; prodInfo.primaryAxisSizingMode = "AUTO";
prodInfo.layoutGrow = 1;

const prodName = figma.createText();
prodName.fontName = { family: "Inter", style: "Bold" };
prodName.characters = "Indomie 70g Chicken"; prodName.fontSize = 14;
prodName.fills = [fill(C.text)]; prodName.name = "Name";
prodInfo.appendChild(prodName);

const prodMeta = figma.createText();
prodMeta.fontName = { family: "Inter", style: "Medium" };
prodMeta.characters = "23 units · 18 txns · Noodles"; prodMeta.fontSize = 11;
prodMeta.fills = [fill(C.textSec)]; prodMeta.name = "Meta";
prodInfo.appendChild(prodMeta);

prodItem.appendChild(prodInfo);

const prodRight = figma.createFrame();
prodRight.layoutMode = "VERTICAL"; prodRight.fills = [];
prodRight.counterAxisAlignItems = "MAX"; prodRight.itemSpacing = 2;
prodRight.primaryAxisSizingMode = "AUTO";

const prodAmt = figma.createText();
prodAmt.fontName = { family: "Inter", style: "Bold" };
prodAmt.characters = "GHS 57.50"; prodAmt.fontSize = 15;
prodAmt.fills = [fill(C.text)]; prodAmt.name = "Amount";
prodRight.appendChild(prodAmt);

const prodMargin = figma.createText();
prodMargin.fontName = { family: "Inter", style: "Bold" };
prodMargin.characters = "28% margin"; prodMargin.fontSize = 11;
prodMargin.fills = [fill(C.success)]; prodMargin.name = "Margin";
prodRight.appendChild(prodMargin);

prodItem.appendChild(prodRight);

yPos += 110;

// ═══════════════════════════════════════
// 9. QUANTITY STEPPER
// ═══════════════════════════════════════
sectionLabel("Quantity Stepper", yPos);

const stepper = figma.createComponent();
stepper.name = "Quantity Stepper";
stepper.resize(180, 48);
stepper.fills = [];
stepper.layoutMode = "HORIZONTAL";
stepper.counterAxisAlignItems = "CENTER";
stepper.itemSpacing = 0;
stepper.x = 0; stepper.y = yPos;

const minusBtn = figma.createFrame();
minusBtn.resize(48, 48); minusBtn.cornerRadius = 24;
minusBtn.fills = [fill(C.surface)]; minusBtn.strokes = [fill(C.border)]; minusBtn.strokeWeight = 1.5;
minusBtn.layoutMode = "HORIZONTAL";
minusBtn.primaryAxisAlignItems = "CENTER"; minusBtn.counterAxisAlignItems = "CENTER";
const minusT = figma.createText();
minusT.fontName = { family: "Inter", style: "Bold" }; minusT.characters = "−";
minusT.fontSize = 20; minusT.fills = [fill(C.text)];
minusBtn.appendChild(minusT);
stepper.appendChild(minusBtn);

const qtyVal = figma.createText();
qtyVal.fontName = { family: "Inter", style: "Bold" }; qtyVal.characters = "24";
qtyVal.fontSize = 28; qtyVal.fills = [fill(C.text)];
qtyVal.textAlignHorizontal = "CENTER";
qtyVal.resize(84, 36);
qtyVal.name = "Value";
stepper.appendChild(qtyVal);

const plusBtn = figma.createFrame();
plusBtn.resize(48, 48); plusBtn.cornerRadius = 24;
plusBtn.fills = [fill(C.primaryLight)]; plusBtn.strokes = [fill(C.primary)]; plusBtn.strokeWeight = 1.5;
plusBtn.layoutMode = "HORIZONTAL";
plusBtn.primaryAxisAlignItems = "CENTER"; plusBtn.counterAxisAlignItems = "CENTER";
const plusT = figma.createText();
plusT.fontName = { family: "Inter", style: "Bold" }; plusT.characters = "+";
plusT.fontSize = 20; plusT.fills = [fill(C.primary)];
plusBtn.appendChild(plusT);
stepper.appendChild(plusBtn);

yPos += 100;

// ═══════════════════════════════════════
// 10. FILTER CHIP SET
// ═══════════════════════════════════════
sectionLabel("Filter Chips", yPos);

function makeChip(variant, label, active) {
  const chip = figma.createComponent();
  chip.name = `State=${variant}`;
  chip.cornerRadius = 20;
  chip.fills = active ? [fill(C.primary)] : [];
  chip.strokes = active ? [] : [fill(C.border)]; chip.strokeWeight = 1.5;
  chip.layoutMode = "HORIZONTAL";
  chip.primaryAxisAlignItems = "CENTER"; chip.counterAxisAlignItems = "CENTER";
  chip.primaryAxisSizingMode = "AUTO";
  chip.paddingLeft = 16; chip.paddingRight = 16;
  chip.paddingTop = 9; chip.paddingBottom = 9;
  // Min 40px height for sunlight touch targets

  const t = figma.createText();
  t.fontName = { family: "Inter", style: "Semi Bold" };
  t.characters = label; t.fontSize = 13;
  t.fills = [fill(active ? C.white : C.textSec)];
  chip.appendChild(t);
  return chip;
}

const chips = [
  makeChip("Active", "All (6)", true),
  makeChip("Inactive", "Critical (3)", false),
];
const chipSet = figma.combineAsVariants(chips, figma.currentPage);
chipSet.name = "Filter Chip"; chipSet.x = 0; chipSet.y = yPos;
chipSet.layoutMode = "HORIZONTAL"; chipSet.itemSpacing = 8;
chipSet.counterAxisSizingMode = "AUTO"; chipSet.primaryAxisSizingMode = "AUTO";
chipSet.fills = [];

yPos += 80;

// ═══════════════════════════════════════
// 11. SECTION HEADER
// ═══════════════════════════════════════
sectionLabel("Section Header", yPos);

const secHeader = figma.createComponent();
secHeader.name = "Section Header";
secHeader.resize(358, 24);
secHeader.fills = [];
secHeader.layoutMode = "HORIZONTAL";
secHeader.primaryAxisAlignItems = "SPACE_BETWEEN";
secHeader.counterAxisAlignItems = "CENTER";
secHeader.primaryAxisSizingMode = "FIXED";
secHeader.x = 0; secHeader.y = yPos;

const secTitle = figma.createText();
secTitle.fontName = { family: "Inter", style: "Bold" };
secTitle.characters = "Urgent alerts"; secTitle.fontSize = 15;
secTitle.fills = [fill(C.text)]; secTitle.name = "Title";
secHeader.appendChild(secTitle);

const secAction = figma.createText();
secAction.fontName = { family: "Inter", style: "Bold" };
secAction.characters = "See all"; secAction.fontSize = 13;
secAction.fills = [fill(C.primary)]; secAction.name = "Action";
secHeader.appendChild(secAction);

figma.notify("✅ 11 component sets created successfully! Components: Button(4), Badge(6), KPI, Alert(3), Nav, Hero, Credit(3), Product Item, Stepper, Chip(2), Section Header");

})();
