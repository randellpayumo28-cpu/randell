// Your original PRODUCTS array — unchanged, just moved into its own file
// so components can import it instead of relying on a global variable.
export const PRODUCTS = [
  {
    id: "tote-01",
    name: "The Field Tote",
    material: "Waxed canvas",
    price: 68,
    badge: "Bestseller",
    category: "Totes",
    img: "https://images.unsplash.com/photo-1591561954557-26941169b49e?w=600&q=80"
  },
  {
    id: "cross-01",
    name: "Harbor Crossbody",
    material: "Full-grain leather",
    price: 94,
    badge: null,
    category: "Crossbody",
    img: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80"
  },
  {
    id: "duffel-01",
    name: "Weekender Duffel",
    material: "Ripstop nylon",
    price: 120,
    badge: "New",
    category: "Duffels",
    img: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80"
  },
  {
    id: "pouch-01",
    name: "Utility Pouch",
    material: "Recycled canvas",
    price: 28,
    badge: null,
    category: "Pouches",
    img: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&q=80"
  },
  {
    id: "backpack-01",
    name: "Rover Backpack",
    material: "Waxed canvas & leather",
    price: 138,
    badge: null,
    category: "Backpacks",
    img: "https://images.unsplash.com/photo-1547949003-9792a18a2601?w=600&q=80"
  }
];

export function money(amount) {
  return `$${amount.toFixed(2)}`;
}
