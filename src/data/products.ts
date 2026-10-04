import type { Product } from '../types';

// Product photos live in /public/products/<slug>.jpg. Listings in the same cluster share one photo
// (they are the identical item). Missing files fall back to the emoji tile.
export const PHOTO_BY_CLUSTER: Record<string, string> = {
  CL_KURTI: 'floral-rayon-kurti',
  CL_SAREE: 'banarasi-silk-saree',
  CL_CROPTOP: 'ribbed-crop-top',
  CL_P08: 'printed-cotton-saree',
  CL_P09: 'anarkali-kurta-set',
  CL_P10: 'mens-cotton-shirt',
  CL_P11: 'georgette-dupatta',
  CL_P12: 'kids-kurta-pyjama',
  CL_BEDSHEET: 'cotton-double-bedsheet',
  CL_P15: 'blackout-door-curtains',
  CL_P16: 'jute-floor-rug',
  CL_P17: 'cushion-covers',
  CL_P18: 'fridge-top-cover',
  CL_P19: 'steel-dinner-set',
  CL_P20: 'nonstick-tawa',
  CL_P21: 'masala-box',
  CL_P22: 'kajal-lipstick-combo',
  CL_P23: 'aloe-vera-gel',
  CL_P24: 'herbal-hair-oil',
};

const DESCRIPTIONS: Record<Product['category'], string> = {
  fashion: 'Soft, breathable fabric with a comfortable regular fit. Colour may vary slightly due to lighting. Hand wash or gentle machine wash.',
  home: 'Durable everyday material that is easy to wash and quick to dry. Fits standard Indian homes.',
  kitchen: 'Food-grade, easy-to-clean material built for daily use in Indian kitchens.',
  beauty: 'Dermatologically tested. For external use only. Check the ingredient list before use.',
};

type P = Omit<Product, 'id' | 'ratingCount' | 'photo' | 'description'> & { id?: string; ratingCount?: number };
let n = 0;
const p = (x: P): Product => ({
  id: x.id ?? `P${String(++n).padStart(2, '0')}`,
  ratingCount: x.ratingCount ?? 120 + n * 37,
  photo: `/products/${PHOTO_BY_CLUSTER[x.clusterId]}.jpg`,
  description: DESCRIPTIONS[x.category],
  ...x,
});

// 24 products: 12 fashion, 6 home, 3 kitchen, 3 beauty. 4 identical-product clusters (CL_*).
export const PRODUCTS: Product[] = [
  // Cluster: Floral Rayon Kurti (3 sellers)
  p({ title: 'Floral Rayon Kurti', category: 'fashion', image: '👚', tint: '#FDE7EF', clusterId: 'CL_KURTI', price: 549, mrp: 999, sellerId: 'S_ANJALI', sellerName: 'Anjali Fashions', rating: 4.1, openBoxCategory: true }),
  p({ title: 'Floral Rayon Kurti', category: 'fashion', image: '👚', tint: '#FDE7EF', clusterId: 'CL_KURTI', price: 499, mrp: 999, sellerId: 'S_SHREE', sellerName: 'Shree Textiles', rating: 4.0, openBoxCategory: true }),
  p({ title: 'Floral Rayon Kurti', category: 'fashion', image: '👚', tint: '#FDE7EF', clusterId: 'CL_KURTI', price: 469, mrp: 999, sellerId: 'S_JAIPURI', sellerName: 'Jaipuri Kraft', rating: 4.2, openBoxCategory: true }),
  // Cluster: Banarasi Art Silk Saree (2 sellers)
  p({ title: 'Banarasi Art Silk Saree', category: 'fashion', image: '🥻', tint: '#FFF1D6', clusterId: 'CL_SAREE', price: 689, mrp: 1799, sellerId: 'S_VARANASI', sellerName: 'Varanasi Weaves', rating: 4.3, openBoxCategory: true }),
  p({ title: 'Banarasi Art Silk Saree', category: 'fashion', image: '🥻', tint: '#FFF1D6', clusterId: 'CL_SAREE', price: 729, mrp: 1799, sellerId: 'S_KASHI', sellerName: 'Kashi Silk House', rating: 4.4, openBoxCategory: true }),
  // Cluster: Ribbed Crop Top (2 sellers)
  p({ title: 'Ribbed Crop Top', category: 'fashion', image: '👕', tint: '#E3F2FD', clusterId: 'CL_CROPTOP', price: 249, mrp: 599, sellerId: 'S_URBAN', sellerName: 'Urban Threads', rating: 3.9, openBoxCategory: true }),
  p({ title: 'Ribbed Crop Top', category: 'fashion', image: '👕', tint: '#E3F2FD', clusterId: 'CL_CROPTOP', price: 279, mrp: 599, sellerId: 'S_TRENDZ', sellerName: 'Trendz Hub', rating: 4.1, openBoxCategory: true }),
  // Singles — fashion
  p({ title: 'Printed Cotton Saree', category: 'fashion', image: '🥻', tint: '#E8F5E9', clusterId: 'CL_P08', price: 599, mrp: 1499, sellerId: 'S_KASHI', sellerName: 'Kashi Silk House', rating: 4.2, openBoxCategory: true }),
  p({ title: 'Anarkali Printed Kurta Set', category: 'fashion', image: '👗', tint: '#F3E5F5', clusterId: 'CL_P09', price: 649, mrp: 1599, sellerId: 'S_ANJALI', sellerName: 'Anjali Fashions', rating: 4.0, openBoxCategory: true }),
  p({ title: "Men's Cotton Shirt", category: 'fashion', image: '👔', tint: '#E0F7FA', clusterId: 'CL_P10', price: 349, mrp: 899, sellerId: 'S_URBAN', sellerName: 'Urban Threads', rating: 3.8, openBoxCategory: true }),
  p({ title: 'Georgette Dupatta', category: 'fashion', image: '🧣', tint: '#FCE4EC', clusterId: 'CL_P11', price: 199, mrp: 499, sellerId: 'S_JAIPURI', sellerName: 'Jaipuri Kraft', rating: 4.1, openBoxCategory: true }),
  p({ title: 'Kids Ethnic Kurta Pyjama', category: 'fashion', image: '🧒', tint: '#FFF8E1', clusterId: 'CL_P12', price: 399, mrp: 899, sellerId: 'S_TRENDZ', sellerName: 'Trendz Hub', rating: 4.3, openBoxCategory: true }),
  // Cluster: Cotton Double Bedsheet (2 sellers)
  p({ title: 'Cotton Double Bedsheet + 2 Pillow Covers', category: 'home', image: '🛏️', tint: '#E8EAF6', clusterId: 'CL_BEDSHEET', price: 399, mrp: 1199, sellerId: 'S_HOMELY', sellerName: 'Homely Decor', rating: 4.1, openBoxCategory: true }),
  p({ title: 'Cotton Double Bedsheet + 2 Pillow Covers', category: 'home', image: '🛏️', tint: '#E8EAF6', clusterId: 'CL_BEDSHEET', price: 379, mrp: 1199, sellerId: 'S_PANIPAT', sellerName: 'Panipat Home Mills', rating: 3.9, openBoxCategory: true }),
  // Singles — home
  p({ title: 'Blackout Door Curtains (Set of 2)', category: 'home', image: '🪟', tint: '#EDE7F6', clusterId: 'CL_P15', price: 459, mrp: 1299, sellerId: 'S_HOMELY', sellerName: 'Homely Decor', rating: 4.0, openBoxCategory: true }),
  p({ title: 'Jute Floor Rug', category: 'home', image: '🧶', tint: '#EFEBE9', clusterId: 'CL_P16', price: 299, mrp: 799, sellerId: 'S_PANIPAT', sellerName: 'Panipat Home Mills', rating: 3.8, openBoxCategory: true }),
  p({ title: 'Cushion Covers (Set of 5)', category: 'home', image: '🛋️', tint: '#FBE9E7', clusterId: 'CL_P17', price: 249, mrp: 699, sellerId: 'S_HOMELY', sellerName: 'Homely Decor', rating: 4.2, openBoxCategory: true }),
  p({ title: 'Fridge Top Cover', category: 'home', image: '🧊', tint: '#E1F5FE', clusterId: 'CL_P18', price: 149, mrp: 399, sellerId: 'S_PANIPAT', sellerName: 'Panipat Home Mills', rating: 3.7, openBoxCategory: true }),
  // Kitchen
  p({ title: 'Stainless Steel Dinner Set (24 pc)', category: 'kitchen', image: '🍽️', tint: '#ECEFF1', clusterId: 'CL_P19', price: 899, mrp: 2199, sellerId: 'S_STEELKING', sellerName: 'Steel King', rating: 4.2, openBoxCategory: false }),
  p({ title: 'Non-stick Tawa 28 cm', category: 'kitchen', image: '🍳', tint: '#F5F5F5', clusterId: 'CL_P20', price: 329, mrp: 899, sellerId: 'S_STEELKING', sellerName: 'Steel King', rating: 4.0, openBoxCategory: false }),
  p({ title: 'Airtight Masala Box', category: 'kitchen', image: '🫙', tint: '#FFF3E0', clusterId: 'CL_P21', price: 279, mrp: 699, sellerId: 'S_STEELKING', sellerName: 'Steel King', rating: 4.1, openBoxCategory: false }),
  // Beauty — never open-box
  p({ title: 'Kajal + Lipstick Combo', category: 'beauty', image: '💄', tint: '#FCE4EC', clusterId: 'CL_P22', price: 199, mrp: 499, sellerId: 'S_GLOW', sellerName: 'Glow Beauty', rating: 3.9, openBoxCategory: false }),
  p({ title: 'Aloe Vera Face Gel', category: 'beauty', image: '🧴', tint: '#E8F5E9', clusterId: 'CL_P23', price: 149, mrp: 349, sellerId: 'S_GLOW', sellerName: 'Glow Beauty', rating: 4.0, openBoxCategory: false }),
  p({ title: 'Herbal Hair Oil 200 ml', category: 'beauty', image: '🌿', tint: '#F1F8E9', clusterId: 'CL_P24', price: 179, mrp: 399, sellerId: 'S_GLOW', sellerName: 'Glow Beauty', rating: 4.1, openBoxCategory: false }),
];
