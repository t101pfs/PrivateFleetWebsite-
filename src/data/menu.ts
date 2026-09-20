import { CUISINES, OTHER_COURSE } from './cuisines';

// The catering menu, split into the four sections the client picks from.
// Starter content - the real menu (with photos) replaces these lists.
export type MenuSectionId = 'appetizer' | 'main' | 'dessert' | 'drink';

const APPETIZERS = [
  'Tabbouleh & Mezze',
  'Fattoush',
  'Kibbeh',
  'Meze Platter',
  'Greek Salad & Mezze',
  'Antipasti Platter',
  'Tapas Selection',
  'Spring Rolls',
  'Tempura',
  'Ceviche',
  'Harira Soup',
  'French Onion Soup',
  'Tom Yum Soup',
  'Hummus & Warm Pita',
  'Caesar Salad',
  'Smoked Salmon Canapés',
];

const DESSERTS = [
  'Mango Sticky Rice',
  'Kunafa',
  'Baklava Selection',
  'Um Ali',
  'Tiramisu',
  'Crème Brûlée',
  'Chocolate Fondant',
  'Fresh Fruit Platter',
  'Date & Nut Platter',
];

const DRINKS = [
  'Arabic Coffee',
  'Espresso',
  'Cappuccino',
  'Tea',
  'Mint Tea',
  'Fresh Orange Juice',
  'Fresh Juice Selection',
  'Smoothie',
  'Still Water',
  'Sparkling Water',
  'Soft Drinks',
  'Iced Tea',
];

const unique = (items: string[]) =>
  Array.from(new Map(items.map((item) => [item.toLowerCase(), item] as const)).values());
const sorted = (items: string[]) => [...items].sort((a, b) => a.localeCompare(b));

// Main courses: every dish from the old cuisine list, minus the ones that are
// really starters or desserts (they moved to their own sections).
const movedOut = new Set([...APPETIZERS, ...DESSERTS].map((d) => d.toLowerCase()));
const MAINS = unique(
  Object.values(CUISINES)
    .flat()
    .filter((dish) => dish !== OTHER_COURSE && !movedOut.has(dish.toLowerCase()))
);

export const MENU_SECTIONS: Array<{ id: MenuSectionId; label: string; items: string[] }> = [
  { id: 'appetizer', label: 'Appetizers', items: sorted(unique(APPETIZERS)) },
  { id: 'main', label: 'Main Course', items: sorted(MAINS) },
  { id: 'dessert', label: 'Dessert', items: sorted(unique(DESSERTS)) },
  { id: 'drink', label: 'Drinks', items: sorted(unique(DRINKS)) },
];
