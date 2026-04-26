/**
 * Seed script — creates restaurants first, then dishes linked to them.
 * Run with: npm run seed
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import { Restaurant } from './models/Restaurant'
import { MenuItem, type MenuItemTag } from './models/MenuItem'
import { User } from './models/User'

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/agoda-food'

interface SeedMenuItem {
  name: string
  description: string
  price: number
  imageUrl: string
  category: string
  tags?: MenuItemTag[]
}

interface SeedOrderWindow {
  openHour: number
  closeHour: number
  deliveryHour: number
}

interface SeedRestaurant {
  name: string
  cuisine: string
  rating: number
  reviewCount: number
  deliveryTime: string
  deliveryFee: number
  minOrder: number
  imageUrl: string
  logoUrl: string
  tags: string[]
  isOpen: boolean
  status: 'active' | 'draft' | 'suspended'
  orderWindow: SeedOrderWindow
  menuItems: SeedMenuItem[]
}

const seedData: SeedRestaurant[] = [
  {
    name: 'Somtum Der',
    cuisine: 'Thai – Isaan',
    rating: 4.8,
    reviewCount: 312,
    deliveryTime: '15–25 min',
    deliveryFee: 0,
    minOrder: 150,
    imageUrl: 'https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=800&auto=format&fit=crop',
    logoUrl: 'https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=200&auto=format&fit=crop',
    tags: ['Isaan', 'Spicy', 'Popular'],
    isOpen: true,
    status: 'active',
    orderWindow: { openHour: 17, closeHour: 10, deliveryHour: 12 },
    menuItems: [
      {
        name: 'Som Tum Thai',
        description: 'Classic green papaya salad with dried shrimp, peanuts, and lime dressing',
        price: 89,
        imageUrl: 'https://images.unsplash.com/photo-1562802378-063ec186a863?w=400&auto=format&fit=crop',
        category: 'Salads',
        tags: ['Popular', 'Spicy'],
      },
      {
        name: 'Larb Moo',
        description: 'Minced pork salad with fresh herbs, toasted rice powder, and chili',
        price: 99,
        imageUrl: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&auto=format&fit=crop',
        category: 'Salads',
        tags: ['Popular', 'Spicy'],
      },
      {
        name: 'Sticky Rice',
        description: 'Steamed glutinous rice served in a traditional wicker basket',
        price: 25,
        imageUrl: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&auto=format&fit=crop',
        category: 'Sides',
        tags: ['Vegetarian', 'Vegan', 'GlutenFree'],
      },
      {
        name: 'Grilled Chicken (Gai Yang)',
        description: 'Marinated whole chicken grilled over charcoal with tamarind dipping sauce',
        price: 179,
        imageUrl: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=400&auto=format&fit=crop',
        category: 'Grills',
        tags: ['Popular'],
      },
      {
        name: 'Tom Saep',
        description: 'Spicy and sour Isaan-style pork rib soup with lemongrass and galangal',
        price: 129,
        imageUrl: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&auto=format&fit=crop',
        category: 'Soups',
        tags: ['Spicy'],
      },
    ],
  },
  {
    name: 'MK Gold',
    cuisine: 'Thai – Hot Pot',
    rating: 4.5,
    reviewCount: 198,
    deliveryTime: '20–35 min',
    deliveryFee: 30,
    minOrder: 300,
    imageUrl: 'https://images.unsplash.com/photo-1583778176476-4a8b02a64c01?w=800&auto=format&fit=crop',
    logoUrl: 'https://images.unsplash.com/photo-1583778176476-4a8b02a64c01?w=200&auto=format&fit=crop',
    tags: ['Hot Pot', 'Sharing', 'Premium'],
    isOpen: true,
    status: 'active',
    orderWindow: { openHour: 17, closeHour: 10, deliveryHour: 12 },
    menuItems: [
      {
        name: 'MK Sukiyaki Set (2 pax)',
        description: 'Premium hot pot set with broth, mixed vegetables, tofu, and dipping sauce',
        price: 449,
        imageUrl: 'https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=400&auto=format&fit=crop',
        category: 'Sets',
        tags: ['Popular'],
      },
      {
        name: 'Pork Slices',
        description: 'Thinly sliced premium pork loin (150g)',
        price: 129,
        imageUrl: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=400&auto=format&fit=crop',
        category: 'Meats',
      },
      {
        name: 'Mixed Seafood Plate',
        description: 'Shrimp, squid, mussels, and fish balls (200g)',
        price: 199,
        imageUrl: 'https://images.unsplash.com/photo-1580476262798-bddd9f4b7369?w=400&auto=format&fit=crop',
        category: 'Seafood',
        tags: ['Popular'],
      },
      {
        name: 'Noodle Bundle',
        description: 'Glass noodles, rice noodles, and egg noodles combo',
        price: 69,
        imageUrl: 'https://images.unsplash.com/photo-1555126634-323283e090fa?w=400&auto=format&fit=crop',
        category: 'Sides',
        tags: ['Vegetarian'],
      },
    ],
  },
  {
    name: 'Jay Fai',
    cuisine: 'Thai – Street Food',
    rating: 4.9,
    reviewCount: 521,
    deliveryTime: '25–40 min',
    deliveryFee: 50,
    minOrder: 200,
    imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop',
    logoUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200&auto=format&fit=crop',
    tags: ['Street Food', 'Michelin', 'Seafood'],
    isOpen: true,
    status: 'active',
    orderWindow: { openHour: 17, closeHour: 10, deliveryHour: 12 },
    menuItems: [
      {
        name: 'Crab Omelette (Kai Jeaw Poo)',
        description: 'Crispy jumbo omelette packed with fresh crab meat — the signature dish',
        price: 890,
        imageUrl: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400&auto=format&fit=crop',
        category: 'Signature',
        tags: ['Popular'],
      },
      {
        name: 'Drunken Noodles (Pad Kee Mao)',
        description: 'Wide rice noodles stir-fried with seafood, holy basil, and Thai chilies',
        price: 350,
        imageUrl: 'https://images.unsplash.com/photo-1562802378-063ec186a863?w=400&auto=format&fit=crop',
        category: 'Noodles',
        tags: ['Popular', 'Spicy'],
      },
      {
        name: 'Tom Yum Goong',
        description: 'Spicy and sour soup with river prawns, mushrooms, and lemongrass',
        price: 450,
        imageUrl: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&auto=format&fit=crop',
        category: 'Soups',
        tags: ['Spicy'],
      },
      {
        name: 'Pad Thai Goong',
        description: 'Stir-fried rice noodles with large prawns, egg, bean sprouts, and tamarind sauce',
        price: 280,
        imageUrl: 'https://images.unsplash.com/photo-1617093727343-374698b1b08d?w=400&auto=format&fit=crop',
        category: 'Noodles',
      },
    ],
  },
  {
    name: 'Pizza Company',
    cuisine: 'Italian-American',
    rating: 4.2,
    reviewCount: 87,
    deliveryTime: '30–45 min',
    deliveryFee: 40,
    minOrder: 250,
    imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&auto=format&fit=crop',
    logoUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=200&auto=format&fit=crop',
    tags: ['Pizza', 'Western', 'Family'],
    isOpen: false,
    status: 'active',
    orderWindow: { openHour: 17, closeHour: 10, deliveryHour: 12 },
    menuItems: [
      {
        name: 'Pepperoni Classic',
        description: 'Tomato sauce, mozzarella, and generous pepperoni on thin crust (10")',
        price: 299,
        imageUrl: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400&auto=format&fit=crop',
        category: 'Pizza',
        tags: ['Popular'],
      },
      {
        name: 'Margherita',
        description: 'San Marzano tomato, fresh mozzarella, basil, and extra-virgin olive oil',
        price: 259,
        imageUrl: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&auto=format&fit=crop',
        category: 'Pizza',
        tags: ['Vegetarian'],
      },
      {
        name: 'Garlic Bread (4 pcs)',
        description: 'Toasted ciabatta with garlic butter and parsley',
        price: 89,
        imageUrl: 'https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?w=400&auto=format&fit=crop',
        category: 'Sides',
        tags: ['Vegetarian'],
      },
    ],
  },
]

async function seed() {
  await mongoose.connect(MONGODB_URI)
  console.log('Connected to MongoDB')

  // Drop whole collections so stale indexes from older schemas (e.g. username)
  // don't linger. Ignore NamespaceNotFound on first run.
  async function safeDrop(name: string) {
    try {
      await mongoose.connection.db!.dropCollection(name)
    } catch (err) {
      const code = (err as { code?: number }).code
      if (code !== 26) throw err // 26 = NamespaceNotFound
    }
  }
  await Promise.all([
    safeDrop('restaurants'),
    safeDrop('menuitems'),
  ])
  console.log('Cleared restaurants and menu items (with indexes)')

  // Ensure a seed admin user exists to satisfy the required ownerUserId constraint.
  // Upsert by a stable lineUserId so re-runs don't create duplicates.
  const SEED_ADMIN_LINE_ID = 'seed_admin'
  let seedAdmin = await User.findOne({ lineUserId: SEED_ADMIN_LINE_ID })
  if (!seedAdmin) {
    seedAdmin = await User.create({
      lineUserId: SEED_ADMIN_LINE_ID,
      displayName: 'Seed Admin',
      role: 'admin',
      emailVerified: false,
    })
    console.log('  · Created seed admin user')
  }

  let totalMenuItems = 0
  for (const { menuItems, ...restaurantData } of seedData) {
    const categories = [...new Set(menuItems.map((m) => m.category).filter(Boolean))]
    const restaurant = await Restaurant.create({
      ...restaurantData,
      categories,
      ownerUserId: seedAdmin._id,
    })
    const menuItemsWithFk = menuItems.map((m) => ({ ...m, restaurantId: restaurant._id }))
    await MenuItem.insertMany(menuItemsWithFk)
    totalMenuItems += menuItems.length
    console.log(`  · ${restaurant.name} (${menuItems.length} menu items)`)
  }

  console.log(`Seeded ${seedData.length} restaurants and ${totalMenuItems} menu items`)

  await mongoose.disconnect()
  console.log('Done')
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
