/**
 * Product catalog.
 *
 *   GET  /api/v1/products   public, paginated
 *   POST /api/v1/products   sellers only
 */

import { Router } from 'express';
import { queryOne, queryRows } from '@boloshop/db';
import { z } from 'zod';

import { HttpError } from '../errors.js';
import { authenticate, requireRole, requireUser } from '../middleware/auth.js';
import { pkrAmountSchema, paginationSchema, parseOrThrow } from '../validation.js';

export const productsRouter: Router = Router();

const listQuerySchema = paginationSchema.extend({
  /** Hits idx_products_category. */
  category: z.string().trim().min(1).max(64).optional(),
  seller_id: z.uuid().optional(),
});

const createProductSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description_urdu: z.string().trim().max(4000).optional(),
  price_pkr: pkrAmountSchema,
  category: z.string().trim().min(1).max(64),
  stock_quantity: z.coerce.number().int().min(0).default(0),
});

interface ProductRow {
  id: string;
  seller_id: string;
  store_name: string;
  title: string;
  description_urdu: string | null;
  /** NUMERIC arrives as a string so no PKR value is rounded through a float. */
  price_pkr: string;
  category: string;
  stock_quantity: number;
  created_at: Date;
}

/**
 * GET /api/v1/products
 *
 * "Active" means in stock: a listing with zero stock is not buyable, so it
 * stays out of the feed rather than wasting a round trip on a slow connection.
 */
productsRouter.get('/', async (req, res) => {
  const { limit, offset, category, seller_id: sellerId } = parseOrThrow(
    listQuerySchema,
    req.query,
  );

  // Fetch one extra row instead of running a second COUNT(*) query — the
  // client only needs to know whether to render a "load more".
  const rows = await queryRows<ProductRow>(
    `SELECT p.id,
            p.seller_id,
            s.store_name,
            p.title,
            p.description_urdu,
            p.price_pkr,
            p.category,
            p.stock_quantity,
            p.created_at
       FROM products p
       JOIN sellers s ON s.id = p.seller_id
      WHERE p.stock_quantity > 0
        AND ($1::text IS NULL OR p.category = $1)
        AND ($2::uuid IS NULL OR p.seller_id = $2)
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT $3 OFFSET $4`,
    [category ?? null, sellerId ?? null, limit + 1, offset],
  );

  const hasMore = rows.length > limit;

  res.json({
    data: hasMore ? rows.slice(0, limit) : rows,
    pagination: {
      limit,
      offset,
      has_more: hasMore,
      next_offset: hasMore ? offset + limit : null,
    },
  });
});

/**
 * POST /api/v1/products
 *
 * Sellers only, and only for their own store: the seller_id comes from the
 * caller's token, never from the request body.
 */
productsRouter.post('/', authenticate, requireRole('seller'), async (req, res) => {
  const user = requireUser(req);
  const input = parseOrThrow(createProductSchema, req.body);

  const seller = await queryOne<{ id: string }>(
    'SELECT id FROM sellers WHERE user_id = $1',
    [user.id],
  );

  if (!seller) {
    throw HttpError.forbidden(
      'You do not have a seller profile yet. Complete seller onboarding first.',
    );
  }

  const product = await queryOne<ProductRow>(
    `WITH inserted AS (
       INSERT INTO products (seller_id, title, description_urdu, price_pkr, category, stock_quantity)
       VALUES ($1, $2, $3, $4::numeric, $5, $6)
       RETURNING *
     )
     SELECT i.id,
            i.seller_id,
            s.store_name,
            i.title,
            i.description_urdu,
            i.price_pkr,
            i.category,
            i.stock_quantity,
            i.created_at
       FROM inserted i
       JOIN sellers s ON s.id = i.seller_id`,
    [
      seller.id,
      input.title,
      input.description_urdu ?? null,
      input.price_pkr,
      input.category,
      input.stock_quantity,
    ],
  );

  res.status(201).json({ data: product });
});
