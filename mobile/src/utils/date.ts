/**
 * Sikasem date helpers — Ghana/UK format (DD/MM/YYYY)
 * All formatters parse ISO strings manually — React Native's toLocaleDateString()
 * is inconsistent across JS engines and may return YYYY/MM/DD on some devices.
 */

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_LONG  = ['January','February','March','April','May','June',
                       'July','August','September','October','November','December'];

function pad(n: number) { return String(n).padStart(2, '0'); }

/** Parse "YYYY-MM-DD[T...]" safely. Returns null on failure. */
function parseIso(iso: string): { y: number; m: number; d: number; h: number; min: number } | null {
  if (!iso) return null;
  const clean = iso.slice(0, 19);                  // drop timezone suffix
  const [datePart = '', timePart = ''] = clean.split('T');
  const parts = datePart.split('-').map(Number);
  const timeParts = timePart.split(':').map(Number);
  const [y, m, d] = parts;
  const [h = 0, min = 0] = timeParts;
  if (!y || !m || !d) return null;
  return { y, m, d, h, min };
}

/** "14/04/2026" */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const p = parseIso(iso);
  return p ? `${pad(p.d)}/${pad(p.m)}/${p.y}` : iso;
}

/** "28 Mar 2026" — compact for tables/lists */
export function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  const p = parseIso(iso);
  return p ? `${p.d} ${MONTHS_SHORT[p.m - 1]} ${p.y}` : iso;
}

/** "14 April 2026" */
export function fmtDateLong(iso: string | null | undefined): string {
  if (!iso) return '—';
  const p = parseIso(iso);
  return p ? `${p.d} ${MONTHS_LONG[p.m - 1]} ${p.y}` : iso;
}

/** "14 Apr 2026 · 10:32" */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const p = parseIso(iso);
  return p ? `${p.d} ${MONTHS_SHORT[p.m - 1]} ${p.y} · ${pad(p.h)}:${pad(p.min)}` : iso;
}

/** "10:32" */
export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const p = parseIso(iso);
  return p ? `${pad(p.h)}:${pad(p.min)}` : iso;
}
