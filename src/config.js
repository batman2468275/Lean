/* ====================================================================
   CONFIG: every name, colour and price on the site comes from here.
   Never type a price or a product/colour name into markup or other code.
   Prices are in dollars here; the maths in pricing.js works in cents.
   ==================================================================== */
export const CONFIG = {
  currency: '$',

  /* Crossed-out "list" prices. Switch this off to show only the current price everywhere (hero, cards, studio, buy, bag).
     HONESTY NOTE: a crossed-out price is only honest if the list price is a real price the product is (or was) genuinely sold at.
     Before launch, confirm that $9.99 is a real price for the With cutout model. If it is not, set showListPrice to false
     or delete listPrice below. The discount is labelled "Launch price", never "limited time". */
  showListPrice: true,
  launchLabel: 'Launch price',

  variants: [
    { id: 'plain',  name: 'Regular',     file: 'regular', price: 5.99, base: 'Solid', cable: false, note: 'Solid base. Stands your phone up.' },
    { id: 'cutout', name: 'With cutout', file: 'cutout',  price: 8.49, listPrice: 9.99, base: 'Slot, 16 × 9 mm', cable: true, note: 'Cable passes through the base. Charge while it stands.' },
  ],

  /* Optional extras, priced on top of either model. Add-ons are never discounted. */
  addons: [
    { id: 'magsafe', name: 'MagSafe', price: 1.5, note: 'Five magnets that hold a MagSafe iPhone to the stand. They hold the phone; they do not charge it.' },
  ],

  /* MagSafe is made in three phone sizes: the magnets sit where that phone's MagSafe ring lands on the slope (see docs/magsafe.md).
     Ids match tools/magsafe_params.json; a test checks they stay in step. */
  phoneSizes: [
    { id: 'small',  name: 'Small',  short: 'iPhone mini', phones: 'iPhone 12 mini, 13 mini' },
    { id: 'medium', name: 'Medium', short: '6.1 inch',    phones: 'iPhone 12 to 15 and Pro (6.1 inch)' },
    { id: 'large',  name: 'Large',  short: 'Pro Max, Plus', phones: 'Pro Max and Plus (6.7 inch)' },
  ],
  defaultPhoneSize: 'medium',

  /* Exactly five colours. No custom colour and no mixing.
     `look: 'black'` marks a colour whose product images are rendered with a real dark material (tools/render_views.cjs, TAG=-black)
     instead of the white render the page tints, because multiplying a white render by near-black flattens the ribs. */
  colors: [
    { id: 'mistletoe', name: 'Mistletoe Green', hex: '#5F7F3B' },   // tuned by eye on the rendered stand (the brief's starting #6E9A5C read slightly minty)
    { id: 'black',     name: 'Black',           hex: '#17181a', look: 'black' },
    { id: 'arctic',    name: 'Arctic White',    hex: '#e8eaec' },
    { id: 'sky',       name: 'Sky Blue',        hex: '#7EC8F2' },
    { id: 'orange',    name: 'Signal Orange',   hex: '#ff6a2b' },
  ],
  defaultColor: 'mistletoe',
  cycle: ['black', 'arctic', 'sky', 'orange', 'mistletoe'], // order shown while scrolling the Colors story
};
