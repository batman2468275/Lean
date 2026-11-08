/* Order lines -> what the print shop needs. Pure functions (unit-tested).
   A bag line: { variant, color, magsafe, phone, mode, text, place, size, qty }. */
import { variantOf, addonOf } from './pricing.js';

/** The STL to print for a line: lean-regular.stl, lean-cutout.stl, or lean-<model>-magsafe-<small|medium|large>.stl */
export function stlFile(cfg, line) {
  const v = variantOf(cfg, line.variant);
  if (!line.magsafe) return `lean-${v.file}.stl`;
  const size = cfg.phoneSizes.find((p) => p.id === line.phone);
  if (!size) throw new Error('MagSafe needs a phone size, got: ' + line.phone);
  return `lean-${v.file}-magsafe-${size.id}.stl`;
}

/** Human-readable name of the MagSafe option on a line, or ''. */
export function magsafeLabel(cfg, line) {
  if (!line.magsafe) return '';
  const size = cfg.phoneSizes.find((p) => p.id === line.phone);
  return `${addonOf(cfg, 'magsafe').name}, ${size.name} (${size.phones})`;
}

/** Fulfilment ticket for one bag line. */
export function ticket(cfg, line) {
  const color = cfg.colors.find((c) => c.id === line.color);
  const t = {
    model: variantOf(cfg, line.variant).name,
    stl: stlFile(cfg, line),
    color: color.name,
    magsafe: !!line.magsafe,
    logo: line.mode === 'none' ? 'none' : line.mode === 'brand' ? 'Lean logo' : `text: ${line.text}`,
    placement: line.mode === 'none' ? null : line.place,
    qty: line.qty,
  };
  if (line.magsafe) {
    t.phoneSize = line.phone;
    t.magnets = '5 x N52 6 x 2 mm discs, alternating polarity N,S,N,S,N facing the phone (docs/magsafe.md)';
  }
  return t;
}
