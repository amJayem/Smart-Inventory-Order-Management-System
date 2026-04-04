import 'dotenv/config';
import { Client } from 'pg';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: false });
  await client.connect();
  console.log('Connected to database.');

  try {
    const hashedPassword = await bcrypt.hash('demo1234', 10);

    // Demo admin user
    const userCheck = await client.query(`SELECT id FROM users WHERE email = 'demo@admin.com'`);
    if (userCheck.rows.length === 0) {
      await client.query(`
        INSERT INTO users (id, name, email, password, role, "isDemo", "createdAt", "updatedAt")
        VALUES ($1, 'Demo Admin', 'demo@admin.com', $2, 'ADMIN', true, NOW(), NOW())
      `, [randomUUID(), hashedPassword]);
      console.log('✓ Demo admin created');
    } else {
      console.log('✓ Demo admin already exists');
    }

    // Categories
    const categories = [
      { name: 'Electronics', description: 'Electronic devices and accessories' },
      { name: 'Clothing', description: 'Apparel and fashion items' },
      { name: 'Grocery', description: 'Food and daily essentials' },
    ];

    for (const cat of categories) {
      const check = await client.query(`SELECT id FROM categories WHERE name = $1`, [cat.name]);
      if (check.rows.length === 0) {
        await client.query(`
          INSERT INTO categories (id, name, description, "createdAt", "updatedAt")
          VALUES ($1, $2, $3, NOW(), NOW())
        `, [randomUUID(), cat.name, cat.description]);
      }
    }
    console.log('✓ Categories created');

    // Get category IDs
    const cats = await client.query(`SELECT id, name FROM categories WHERE name = ANY($1)`, [['Electronics', 'Clothing', 'Grocery']]);
    const catMap: Record<string, string> = {};
    cats.rows.forEach((r: any) => { catMap[r.name] = r.id; });

    // Products
    const products = [
      { name: 'iPhone 13', cat: 'Electronics', price: 799.99, stock: 3, threshold: 5, status: 'ACTIVE' },
      { name: 'Wireless Headphones', cat: 'Electronics', price: 149.99, stock: 15, threshold: 5, status: 'ACTIVE' },
      { name: 'T-Shirt', cat: 'Clothing', price: 19.99, stock: 20, threshold: 10, status: 'ACTIVE' },
      { name: 'Running Shoes', cat: 'Clothing', price: 89.99, stock: 0, threshold: 5, status: 'OUT_OF_STOCK' },
      { name: 'Organic Coffee', cat: 'Grocery', price: 12.99, stock: 50, threshold: 20, status: 'ACTIVE' },
    ];

    for (const p of products) {
      const check = await client.query(`SELECT id FROM products WHERE name = $1`, [p.name]);
      if (check.rows.length === 0) {
        await client.query(`
          INSERT INTO products (id, name, "categoryId", price, stock, "minStockThreshold", status, "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        `, [randomUUID(), p.name, catMap[p.cat], p.price, p.stock, p.threshold, p.status]);
      }
    }
    console.log('✓ Products created');

    console.log('Seeding complete.');
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
