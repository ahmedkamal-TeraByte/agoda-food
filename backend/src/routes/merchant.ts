import { Router, Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { Restaurant } from "@models/Restaurant";
import { MenuItem } from "@models/MenuItem";
import { Order } from "@models/Order";
import { Payment } from "@models/Payment";
import { requireMerchant } from "@middleware/auth";
import { getServiceDate } from "@lib/orderWindow";
import {
  decodeQrFromImage,
  isPromptPayPayload,
  renderQrDataUrl,
} from "@lib/promptPay";
import { getPrivateStorage, getPublicStorage } from "@lib/storage";
import { imageUpload } from "@lib/upload";

/**
 * Retention window for payment-proof files after their lifecycle terminates
 * (verified / rejected / canceled). Mirrors the constant in orders.ts.
 */
const PROOF_FILE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

const router = Router();

// All routes require merchant role
router.use(requireMerchant);

const SIGNED_URL_TTL_SECONDS = 5 * 60; // 5 minutes — long enough to view, short enough to be safe

/**
 * Helper: find the restaurant owned by the current user, or 404.
 */
async function getOwnedRestaurant(userId: string) {
  return Restaurant.findOne({ ownerUserId: userId });
}

// GET /api/merchant/restaurant
router.get("/restaurant", async (req: Request, res: Response) => {
  try {
    const restaurant = await getOwnedRestaurant(req.user!._id.toString());
    if (!restaurant) {
      res.status(404).json({ error: "No restaurant found for your account" });
      return;
    }
    res.json(restaurant);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch restaurant" });
  }
});

// PATCH /api/merchant/restaurant
router.patch("/restaurant", async (req: Request, res: Response) => {
  const allowed = [
    "name",
    "cuisine",
    "imageUrl",
    "logoUrl",
    "minOrder",
    "deliveryFee",
    "isOpen",
    "orderWindow",
    "deliveryTime",
    "tags",
    "categories",
  ];
  try {
    const restaurant = await getOwnedRestaurant(req.user!._id.toString());
    if (!restaurant) {
      res.status(404).json({ error: "No restaurant found for your account" });
      return;
    }

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (restaurant as any)[key] = req.body[key];
      }
    }
    await restaurant.save();
    res.json(restaurant);
  } catch (err) {
    res.status(500).json({ error: "Failed to update restaurant" });
  }
});

/**
 * Serializes a MenuItem document to a plain object, resolving `imageKey` into
 * a `imageUrl` on the fly so consumers are not coupled to the storage base URL.
 */
function serializeMenuItem(item: InstanceType<typeof MenuItem>) {
  const obj = item.toObject() as unknown as Record<string, unknown>;
  obj.imageUrl = obj.imageKey
    ? getPublicStorage().publicUrl(obj.imageKey as string)
    : undefined;
  return obj;
}

// GET /api/merchant/menu-items
router.get("/menu-items", async (req: Request, res: Response) => {
  try {
    const restaurant = await getOwnedRestaurant(req.user!._id.toString());
    if (!restaurant) {
      res.status(404).json({ error: "No restaurant found for your account" });
      return;
    }
    const menuItems = await MenuItem.find({
      restaurantId: restaurant._id,
    }).sort({ category: 1, createdAt: 1 });
    res.json(menuItems.map(serializeMenuItem));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch menu items" });
  }
});

// POST /api/merchant/menu-items
router.post("/menu-items", async (req: Request, res: Response) => {
  try {
    const restaurant = await getOwnedRestaurant(req.user!._id.toString());
    if (!restaurant) {
      res.status(404).json({ error: "No restaurant found for your account" });
      return;
    }

    const { name, description, price, imageKey, category, tags } = req.body;
    if (!name || !description || price === undefined) {
      res
        .status(400)
        .json({ error: "name, description, and price are required" });
      return;
    }

    const cleanCategory = typeof category === "string" ? category.trim() : "";
    if (cleanCategory && !restaurant.categories.includes(cleanCategory)) {
      res
        .status(400)
        .json({ error: `Category "${cleanCategory}" does not exist` });
      return;
    }

    const menuItem = await MenuItem.create({
      restaurantId: restaurant._id,
      name,
      description,
      price,
      imageKey,
      category: cleanCategory,
      tags: tags ?? [],
      isAvailable: true,
    });
    res.status(201).json(serializeMenuItem(menuItem));
  } catch (err) {
    res.status(500).json({ error: "Failed to create menu item" });
  }
});

// PATCH /api/merchant/menu-items/:menuItemId
router.patch("/menu-items/:menuItemId", async (req: Request, res: Response) => {
  try {
    const restaurant = await getOwnedRestaurant(req.user!._id.toString());
    if (!restaurant) {
      res.status(404).json({ error: "No restaurant found for your account" });
      return;
    }

    const menuItem = await MenuItem.findOne({
      _id: req.params.menuItemId,
      restaurantId: restaurant._id,
    });
    if (!menuItem) {
      res.status(404).json({ error: "Menu item not found" });
      return;
    }

    const allowed = [
      "name",
      "description",
      "price",
      "imageKey",
      "category",
      "tags",
      "isAvailable",
    ];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (menuItem as any)[key] = req.body[key];
      }
    }

    if (req.body.category !== undefined) {
      const cleanCategory =
        typeof req.body.category === "string" ? req.body.category.trim() : "";
      if (cleanCategory && !restaurant.categories.includes(cleanCategory)) {
        res
          .status(400)
          .json({ error: `Category "${cleanCategory}" does not exist` });
        return;
      }
      menuItem.category = cleanCategory;
    }

    await menuItem.save();
    res.json(serializeMenuItem(menuItem));
  } catch (err) {
    res.status(500).json({ error: "Failed to update menu item" });
  }
});

// DELETE /api/merchant/menu-items/:menuItemId
router.delete(
  "/menu-items/:menuItemId",
  async (req: Request, res: Response) => {
    try {
      const restaurant = await getOwnedRestaurant(req.user!._id.toString());
      if (!restaurant) {
        res.status(404).json({ error: "No restaurant found for your account" });
        return;
      }

      const menuItem = await MenuItem.findOneAndDelete({
        _id: req.params.menuItemId,
        restaurantId: restaurant._id,
      });
      if (!menuItem) {
        res.status(404).json({ error: "Menu item not found" });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete menu item" });
    }
  },
);

// GET /api/merchant/categories
router.get("/categories", async (req: Request, res: Response) => {
  try {
    const restaurant = await getOwnedRestaurant(req.user!._id.toString());
    if (!restaurant) {
      res.status(404).json({ error: "No restaurant found for your account" });
      return;
    }
    res.json(restaurant.categories);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// POST /api/merchant/categories — body { name }
router.post("/categories", async (req: Request, res: Response) => {
  try {
    const restaurant = await getOwnedRestaurant(req.user!._id.toString());
    if (!restaurant) {
      res.status(404).json({ error: "No restaurant found for your account" });
      return;
    }

    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    if (restaurant.categories.includes(name)) {
      res.status(409).json({ error: "Category already exists" });
      return;
    }

    restaurant.categories.push(name);
    await restaurant.save();
    res.status(201).json(restaurant.categories);
  } catch (err) {
    res.status(500).json({ error: "Failed to create category" });
  }
});

// PATCH /api/merchant/categories/:name — body { name: newName }
// Renames the category and rewrites all menu items that referenced it.
router.patch("/categories/:name", async (req: Request, res: Response) => {
  try {
    const restaurant = await getOwnedRestaurant(req.user!._id.toString());
    if (!restaurant) {
      res.status(404).json({ error: "No restaurant found for your account" });
      return;
    }

    const oldName = req.params.name;
    const newName =
      typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!newName) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const idx = restaurant.categories.indexOf(oldName);
    if (idx === -1) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    if (oldName !== newName && restaurant.categories.includes(newName)) {
      res
        .status(409)
        .json({ error: "Another category with that name already exists" });
      return;
    }

    restaurant.categories[idx] = newName;
    await restaurant.save();
    if (oldName !== newName) {
      await MenuItem.updateMany(
        { restaurantId: restaurant._id, category: oldName },
        { $set: { category: newName } },
      );
    }
    res.json(restaurant.categories);
  } catch (err) {
    res.status(500).json({ error: "Failed to rename category" });
  }
});

// DELETE /api/merchant/categories/:name
// Removes the category and unsets it on any menu items that referenced it.
router.delete("/categories/:name", async (req: Request, res: Response) => {
  try {
    const restaurant = await getOwnedRestaurant(req.user!._id.toString());
    if (!restaurant) {
      res.status(404).json({ error: "No restaurant found for your account" });
      return;
    }

    const name = req.params.name;
    const idx = restaurant.categories.indexOf(name);
    if (idx === -1) {
      res.status(404).json({ error: "Category not found" });
      return;
    }

    restaurant.categories.splice(idx, 1);
    await restaurant.save();
    await MenuItem.updateMany(
      { restaurantId: restaurant._id, category: name },
      { $set: { category: "" } },
    );
    res.json(restaurant.categories);
  } catch (err) {
    res.status(500).json({ error: "Failed to delete category" });
  }
});

const BANGKOK_DATE_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function isValidServiceDateStr(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// GET /api/merchant/orders?serviceDate=YYYY-MM-DD
// Returns { serviceDate, orders } so the client can sync its picker to the
// date the server actually queried (important when no serviceDate is sent
// and the server picks the next upcoming delivery day).
router.get("/orders", async (req: Request, res: Response) => {
  try {
    const restaurant = await getOwnedRestaurant(req.user!._id.toString());
    if (!restaurant) {
      res.status(404).json({ error: "No restaurant found for your account" });
      return;
    }

    let serviceDateStr: string;
    if (req.query.serviceDate && typeof req.query.serviceDate === "string") {
      if (!isValidServiceDateStr(req.query.serviceDate)) {
        res.status(400).json({ error: "serviceDate must be YYYY-MM-DD" });
        return;
      }
      serviceDateStr = req.query.serviceDate;
    } else {
      // Default: the next upcoming delivery day for this restaurant's window,
      // or today (Bangkok) if ordering is currently closed.
      const next = getServiceDate(restaurant.orderWindow) ?? new Date();
      serviceDateStr = BANGKOK_DATE_FMT.format(next);
    }

    // Query orders whose serviceDate falls on the requested Bangkok calendar
    // day, i.e. [00:00, +24h) in Asia/Bangkok converted to UTC.
    const dayStart = new Date(`${serviceDateStr}T00:00:00+07:00`);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const orders = await Order.find({
      restaurantId: restaurant._id,
      serviceDate: { $gte: dayStart, $lt: dayEnd },
    })
      .sort({ createdAt: 1 })
      .populate("userId", "displayName email phone pictureUrl");

    // Re-shape so the populated user is exposed as `customer` and `userId`
    // remains the raw ObjectId for the client.
    const enriched = orders.map((o) => {
      const obj = o.toObject() as unknown as Record<string, unknown>;
      const populated = obj.userId as Record<string, unknown> | string | null;
      if (populated && typeof populated === "object" && "_id" in populated) {
        obj.customer = {
          id: String(populated._id),
          displayName: populated.displayName,
          email: populated.email,
          phone: populated.phone,
          pictureUrl: populated.pictureUrl,
        };
        obj.userId = String(populated._id);
      }
      return obj;
    });

    res.json({ serviceDate: serviceDateStr, orders: enriched });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// ---------------------------------------------------------------------------
// PromptPay QR — restaurant uploads their own QR; we decode the EMV payload
// out of it, store the string only, and re-render the QR per-customer at
// order time.
// ---------------------------------------------------------------------------

// GET /api/merchant/promptpay-qr — returns whether one is configured + a
// preview QR (regenerated from the stored payload) for the merchant's UI.
router.get("/promptpay-qr", async (req: Request, res: Response) => {
  try {
    const restaurant = await getOwnedRestaurant(req.user!._id.toString());
    if (!restaurant) {
      res.status(404).json({ error: "No restaurant found for your account" });
      return;
    }
    const payload = restaurant.promptPayPayload ?? "";
    if (!payload) {
      res.json({ configured: false });
      return;
    }
    const qrImageUrl = await renderQrDataUrl(payload);
    res.json({ configured: true, qrImageUrl });
  } catch (err) {
    console.error("[merchant] promptpay-qr GET failed:", err);
    res.status(500).json({ error: "Failed to fetch PromptPay QR" });
  }
});

// POST /api/merchant/promptpay-qr — multipart form, field name "image".
// Decodes the QR, validates the EMV payload, stores the string.
router.post(
  "/promptpay-qr",
  imageUpload.single("image"),
  async (req: Request, res: Response) => {
    try {
      const restaurant = await getOwnedRestaurant(req.user!._id.toString());
      if (!restaurant) {
        res.status(404).json({ error: "No restaurant found for your account" });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: "image file is required" });
        return;
      }

      const payload = await decodeQrFromImage(req.file.buffer);
      if (!payload) {
        res
          .status(400)
          .json({
            error:
              "Couldn't read a QR code from that image. Try a clearer photo.",
          });
        return;
      }
      if (!isPromptPayPayload(payload)) {
        res.status(400).json({
          error:
            "That QR doesn't look like a PromptPay code. Please upload your bank's PromptPay QR.",
        });
        return;
      }

      restaurant.promptPayPayload = payload;
      await restaurant.save();

      const qrImageUrl = await renderQrDataUrl(payload);
      res.json({ configured: true, qrImageUrl });
    } catch (err) {
      console.error("[merchant] promptpay-qr POST failed:", err);
      res.status(500).json({ error: "Failed to process the QR upload" });
    }
  },
);

// DELETE /api/merchant/promptpay-qr — clears the stored payload. New orders
// will be blocked until the merchant uploads a new QR.
router.delete("/promptpay-qr", async (req: Request, res: Response) => {
  try {
    const restaurant = await getOwnedRestaurant(req.user!._id.toString());
    if (!restaurant) {
      res.status(404).json({ error: "No restaurant found for your account" });
      return;
    }
    restaurant.promptPayPayload = "";
    await restaurant.save();
    res.json({ configured: false });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove PromptPay QR" });
  }
});

// ---------------------------------------------------------------------------
// Payment proof review — merchant reviews a screenshot uploaded by a customer
// and either confirms the payment or rejects with a chosen mode.
// ---------------------------------------------------------------------------

// Helper: load an order belonging to the merchant's restaurant, or send 404.
async function loadOwnedOrder(req: Request, res: Response) {
  const restaurant = await getOwnedRestaurant(req.user!._id.toString());
  if (!restaurant) {
    res.status(404).json({ error: "No restaurant found for your account" });
    return null;
  }
  const order = await Order.findById(req.params.id);
  if (!order || order.restaurantId.toString() !== restaurant._id.toString()) {
    res.status(404).json({ error: "Order not found" });
    return null;
  }
  return { order, restaurant };
}

// GET /api/merchant/orders/:id/payment-proof — returns a short-lived signed
// URL the merchant can use to view the screenshot.
router.get("/orders/:id/payment-proof", async (req: Request, res: Response) => {
  try {
    const result = await loadOwnedOrder(req, res);
    if (!result) return;
    const { order } = result;
    if (!order.paymentProof?.fileKey) {
      res.status(404).json({ error: "No payment proof on this order" });
      return;
    }
    const signedUrl = await getPrivateStorage().getSignedUrl(
      order.paymentProof.fileKey,
      SIGNED_URL_TTL_SECONDS,
    );
    res.json({
      signedUrl,
      expiresAt: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000),
      uploadedAt: order.paymentProof.uploadedAt,
      contentType: order.paymentProof.contentType,
      sizeBytes: order.paymentProof.sizeBytes,
      status: order.paymentProof.status,
    });
  } catch (err) {
    console.error("[merchant] get payment-proof failed:", err);
    res.status(500).json({ error: "Failed to load payment proof" });
  }
});

// POST /api/merchant/orders/:id/verify-payment
// Body: { action: 'confirm' } | { action: 'reject', mode: 'request_new' | 'cancel', reason? }
router.post(
  "/orders/:id/verify-payment",
  async (req: Request, res: Response) => {
    try {
      const result = await loadOwnedOrder(req, res);
      if (!result) return;
      const { order } = result;

      if (order.status !== "pending_verification") {
        res.status(409).json({ error: "Order is not awaiting verification" });
        return;
      }
      if (!order.paymentProof) {
        res.status(409).json({ error: "Order has no payment proof to review" });
        return;
      }

      const { action, mode, reason } = (req.body ?? {}) as {
        action?: "confirm" | "reject";
        mode?: "request_new" | "cancel";
        reason?: string;
      };

      const fileKey = order.paymentProof.fileKey;
      const now = new Date();
      const expireFileAt = new Date(now.getTime() + PROOF_FILE_RETENTION_MS);

      if (action === "confirm") {
        // Authoritative audit row in the Payment collection.
        await Payment.updateOne(
          {
            orderId: order._id,
            provider: "promptpay_byo",
            fileKey,
            status: "pending",
          },
          {
            $set: {
              status: "paid",
              reviewedAt: now,
              paidAt: now,
              reviewerNote: "",
              expireFileAt,
            },
          },
        );

        // Denormalised snapshot on the order — what the customer's UI reads.
        order.status = "confirmed";
        order.paymentStatus = "paid";
        order.paymentProof.status = "verified";
        order.paymentProof.reviewedAt = now;
        order.paymentProof.reviewerNote = "";
        await order.save();
        res.json(order);
        return;
      }

      if (action === "reject") {
        if (mode !== "request_new" && mode !== "cancel") {
          res
            .status(400)
            .json({ error: "mode must be 'request_new' or 'cancel'" });
          return;
        }

        const trimmedReason =
          typeof reason === "string" ? reason.trim().slice(0, 500) : "";

        await Payment.updateOne(
          {
            orderId: order._id,
            provider: "promptpay_byo",
            fileKey,
            status: "pending",
          },
          {
            $set: {
              status: "rejected",
              reviewedAt: now,
              reviewerNote: trimmedReason,
              expireFileAt,
            },
          },
        );

        // Denormalised snapshot — drives the customer's rejection banner.
        order.paymentProof.status = "rejected";
        order.paymentProof.reviewedAt = now;
        order.paymentProof.reviewerNote = trimmedReason;

        if (mode === "cancel") {
          order.status = "cancelled";
        } else {
          // Customer can upload a new screenshot. The current snapshot stays
          // on the order (status='rejected') until they upload a fresh one,
          // at which point orders.ts overwrites it.
          order.status = "awaiting_payment";
        }
        await order.save();

        // NOTE: we no longer delete the file here. The Payment row above carries
        // `expireFileAt = now + 30d`; a cleanup job (TBD) scans
        //   { provider: 'promptpay_byo', fileDeletedAt: null,
        //     expireFileAt: { $lte: <now> } }
        // and unlinks the file from object storage, then stamps `fileDeletedAt`.

        res.json(order);
        return;
      }

      res.status(400).json({ error: "action must be 'confirm' or 'reject'" });
    } catch (err) {
      console.error("[merchant] verify-payment failed:", err);
      res.status(500).json({ error: "Failed to verify payment" });
    }
  },
);

// ---------------------------------------------------------------------------
// Public photo uploads — restaurant cover, restaurant logo, menu item photos.
// Stored in R2 under a public-readable prefix so the proxy at `/api/images/...`
// can stream them back. Returns the public URL the client should save to its
// own form state (and ultimately to the Restaurant / MenuItem record).
// ---------------------------------------------------------------------------

type ImageUploadKind = "restaurant-cover" | "restaurant-logo" | "menu-item";

interface KindConfig {
  prefix: "restaurant-photos/" | "menu-photos/";
  // Long-edge cap fed to sharp; smaller for logos.
  maxEdge: number;
  quality: number;
}

const UPLOAD_KIND_CONFIG: Record<ImageUploadKind, KindConfig> = {
  "restaurant-cover": {
    prefix: "restaurant-photos/",
    maxEdge: 1600,
    quality: 85,
  },
  "restaurant-logo": { prefix: "restaurant-photos/", maxEdge: 512, quality: 90 },
  "menu-item": { prefix: "menu-photos/", maxEdge: 1200, quality: 85 },
};

function isImageUploadKind(v: unknown): v is ImageUploadKind {
  return v === "restaurant-cover" || v === "restaurant-logo" || v === "menu-item";
}

// POST /api/merchant/uploads/image?kind=restaurant-cover|restaurant-logo|menu-item
// multipart field name: "image"
router.post(
  "/uploads/image",
  imageUpload.single("image"),
  async (req: Request, res: Response) => {
    try {
      const restaurant = await getOwnedRestaurant(req.user!._id.toString());
      if (!restaurant) {
        res.status(404).json({ error: "No restaurant found for your account" });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: "image file is required" });
        return;
      }
      const kind = req.query.kind;
      if (!isImageUploadKind(kind)) {
        res.status(400).json({
          error:
            "kind must be one of: restaurant-cover, restaurant-logo, menu-item",
        });
        return;
      }

      const { prefix, maxEdge, quality } = UPLOAD_KIND_CONFIG[kind];

      // Re-encode through sharp: strips EXIF, normalises orientation, caps
      // dimensions, and recompresses to JPEG so file sizes stay predictable.
      const processed = await sharp(req.file.buffer)
        .rotate()
        .resize({
          width: maxEdge,
          height: maxEdge,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();

      const fileKey = `${prefix}${restaurant._id}/${randomUUID()}.jpg`;
      await getPublicStorage().put(fileKey, processed, "image/jpeg");

      // Stable absolute URL the browser fetches directly from R2 (or the
      // local-fs static handler in dev). For Restaurant.imageUrl / .logoUrl the
      // caller persists this URL directly. For MenuItem the caller persists only
      // `fileKey` (as `imageKey`) and the server reconstructs the URL on read.
      const imageUrl = getPublicStorage().publicUrl(fileKey);
      res.json({ imageUrl, fileKey, sizeBytes: processed.length });
    } catch (err) {
      console.error("[merchant] uploads/image failed:", err);
      res.status(500).json({ error: "Failed to upload image" });
    }
  },
);

// Multer error handler — must come AFTER the upload routes so the typed
// error shape from multer can be translated to a clean 4xx response.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
router.use(
  (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err && typeof err === "object" && "code" in err) {
      const code = (err as { code: string }).code;
      if (code === "LIMIT_FILE_SIZE") {
        res.status(413).json({ error: "File is too large (max 8 MB)" });
        return;
      }
    }
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: "Upload failed" });
  },
);

export default router;
