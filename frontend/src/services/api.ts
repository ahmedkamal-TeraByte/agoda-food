import type {
  Restaurant,
  RestaurantWithMenu,
  MenuItem,
  MenuItemTag,
  Order,
  User,
  PromptPayQR,
  PaymentProof,
  PaymentProofView,
} from "../data/types";
import { MENU_ITEM_TAGS } from "../data/types";

const BASE = "/api";

let currentToken: string | null = null;

export function setAuthToken(token: string | null) {
  currentToken = token;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (currentToken) headers["Authorization"] = `Bearer ${currentToken}`;

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(
      body.error ?? `Request failed: ${res.status}`,
    ) as Error & {
      status?: number;
      code?: string;
    };
    err.status = res.status;
    err.code = body.code;
    throw err;
  }
  return res.json();
}

/**
 * Multipart upload — used for QR / payment-proof image uploads.
 * Don't set Content-Type; the browser fills in the correct boundary value.
 */
async function uploadFile<T>(
  path: string,
  file: File,
  fieldName = "image",
): Promise<T> {
  const headers: Record<string, string> = {};
  if (currentToken) headers["Authorization"] = `Bearer ${currentToken}`;

  const fd = new FormData();
  fd.append(fieldName, file);

  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers,
    body: fd,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(
      body.error ?? `Upload failed: ${res.status}`,
    ) as Error & {
      status?: number;
      code?: string;
    };
    err.status = res.status;
    err.code = body.code;
    throw err;
  }
  return res.json();
}

function toMenuItem(d: Record<string, unknown>): MenuItem {
  const rawTags = Array.isArray(d.tags) ? (d.tags as string[]) : [];
  const tags = rawTags.filter((t): t is MenuItemTag =>
    (MENU_ITEM_TAGS as readonly string[]).includes(t),
  );
  const rawCategory = typeof d.category === "string" ? d.category : "";
  return {
    id: d._id as string,
    restaurantId: d.restaurantId as string,
    name: d.name as string,
    description: d.description as string,
    price: d.price as number,
    imageKey: d.imageKey as string | undefined,
    imageUrl: d.imageUrl as string | undefined,
    category: rawCategory || undefined,
    tags,
    isAvailable: (d.isAvailable as boolean | undefined) ?? true,
  };
}

function toRestaurant(r: Record<string, unknown>): Restaurant {
  const ow = r.orderWindow as Record<string, number> | undefined;
  return {
    id: r._id as string,
    name: r.name as string,
    cuisine: r.cuisine as string,
    rating: r.rating as number,
    reviewCount: r.reviewCount as number,
    deliveryTime: r.deliveryTime as string,
    deliveryFee: r.deliveryFee as number,
    minOrder: r.minOrder as number,
    imageUrl: r.imageUrl as string,
    logoUrl: r.logoUrl as string,
    tags: r.tags as string[],
    categories: Array.isArray(r.categories) ? (r.categories as string[]) : [],
    isOpen: r.isOpen as boolean,
    status: r.status as Restaurant["status"],
    ownerUserId: r.ownerUserId as string,
    orderWindow: ow
      ? {
          openHour: ow.openHour,
          closeHour: ow.closeHour,
          deliveryHour: ow.deliveryHour,
        }
      : undefined,
    referral: r.referral as Restaurant["referral"],
    hasPromptPay: Boolean(r.promptPayPayload),
  };
}

function toOrder(o: Record<string, unknown>): Order {
  const rawItems = (o.items as Record<string, unknown>[]) ?? [];
  const items = rawItems.map((item) => ({
    menuItemId: (item.menuItemId ?? item.dishId) as string,
    name: item.name as string,
    price: item.price as number,
    imageUrl: item.imageUrl as string | undefined,
    quantity: item.quantity as number,
    note: (item.note ?? "") as string,
  }));
  const rawCustomer = o.customer as Record<string, unknown> | undefined;
  const customer = rawCustomer
    ? {
        id: rawCustomer.id as string,
        displayName: rawCustomer.displayName as string,
        email: rawCustomer.email as string | undefined,
        phone: rawCustomer.phone as string | undefined,
        pictureUrl: rawCustomer.pictureUrl as string | undefined,
      }
    : undefined;
  const rawProof = o.paymentProof as Record<string, unknown> | undefined;
  const paymentProof: PaymentProof | undefined = rawProof?.fileKey
    ? {
        fileKey: rawProof.fileKey as string,
        contentType: rawProof.contentType as string,
        sizeBytes: rawProof.sizeBytes as number,
        uploadedAt: rawProof.uploadedAt as string,
        status: rawProof.status as PaymentProof["status"],
        reviewedAt: rawProof.reviewedAt as string | undefined,
        reviewerNote: rawProof.reviewerNote as string | undefined,
      }
    : undefined;
  return {
    id: o._id as string,
    userId: o.userId as string,
    restaurantId: o.restaurantId as string,
    restaurantName: o.restaurantName as string,
    items,
    subtotal: o.subtotal as number,
    deliveryFee: o.deliveryFee as number,
    total: o.total as number,
    status: o.status as Order["status"],
    paymentStatus: o.paymentStatus as Order["paymentStatus"],
    paymentProof,
    serviceDate: o.serviceDate as string | undefined,
    createdAt: o.createdAt as string,
    customer,
  };
}

function toUser(u: Record<string, unknown>): User {
  return {
    id: u._id as string,
    displayName: u.displayName as string,
    email: u.email as string | undefined,
    phone: u.phone as string | undefined,
    pictureUrl: u.pictureUrl as string | undefined,
    deliveryLocation: u.deliveryLocation as string | undefined,
    needsOnboarding: u.needsOnboarding as boolean | undefined,
    role: u.role as User["role"],
    emailVerified: u.emailVerified as boolean | undefined,
  };
}

// --- Restaurants ---

export async function fetchRestaurants(): Promise<Restaurant[]> {
  const data = await request<Record<string, unknown>[]>("/restaurants");
  return data.map(toRestaurant);
}

export async function fetchRestaurantWithMenu(
  id: string,
): Promise<RestaurantWithMenu> {
  const [restaurantRaw, menuItemsRaw] = await Promise.all([
    request<Record<string, unknown>>(`/restaurants/${id}`),
    request<Record<string, unknown>[]>(`/restaurants/${id}/menu`),
  ]);
  return { ...toRestaurant(restaurantRaw), menu: menuItemsRaw.map(toMenuItem) };
}

export interface ApplyRestaurantPayload {
  name: string;
  cuisine: string;
  referral: { name: string; email: string };
}

export async function applyForRestaurant(
  payload: ApplyRestaurantPayload,
): Promise<Restaurant> {
  const data = await request<Record<string, unknown>>("/restaurants/apply", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return toRestaurant(data);
}

export async function verifyReferral(
  restaurantId: string,
  code: string,
): Promise<{ restaurant: Restaurant; user: User }> {
  const data = await request<{
    restaurant: Record<string, unknown>;
    user: Record<string, unknown>;
  }>(`/restaurants/${restaurantId}/verify-referral`, {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  return { restaurant: toRestaurant(data.restaurant), user: toUser(data.user) };
}

// --- Orders ---

export interface PlaceOrderPayload {
  restaurantId: string;
  items: { menuItemId: string; quantity: number; note?: string }[];
}

export async function placeOrder(payload: PlaceOrderPayload): Promise<Order> {
  const data = await request<Record<string, unknown>>("/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return toOrder(data);
}

export async function fetchOrder(id: string): Promise<Order> {
  const data = await request<Record<string, unknown>>(`/orders/${id}`);
  return toOrder(data);
}

export async function payOrder(orderId: string): Promise<PromptPayQR> {
  return request<PromptPayQR>(`/orders/${orderId}/pay`, { method: "POST" });
}

export async function fetchOrderPayment(orderId: string): Promise<PromptPayQR> {
  return request<PromptPayQR>(`/orders/${orderId}/payment`);
}

/** Customer uploads a screenshot proving they paid. */
export async function uploadPaymentProof(
  orderId: string,
  file: File,
): Promise<Order> {
  const data = await uploadFile<Record<string, unknown>>(
    `/orders/${orderId}/payment-proof`,
    file,
  );
  return toOrder(data);
}

export async function cancelOrder(orderId: string): Promise<Order> {
  const data = await request<Record<string, unknown>>(
    `/orders/${orderId}/cancel`,
    { method: "POST" },
  );
  return toOrder(data);
}

// --- Auth ---

export interface LineAuthResponse {
  token: string;
  user: User;
  needsOnboarding: boolean;
  redirectAfterLogin?: string;
}

function toLineAuthResponse(raw: Record<string, unknown>): LineAuthResponse {
  return {
    token: raw.token as string,
    user: toUser(raw.user as Record<string, unknown>),
    needsOnboarding: raw.needsOnboarding as boolean,
    redirectAfterLogin: raw.redirectAfterLogin as string | undefined,
  };
}

export async function exchangeLineCode(payload: {
  code: string;
  state: string;
}): Promise<LineAuthResponse> {
  const raw = await request<Record<string, unknown>>("/auth/line/exchange", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return toLineAuthResponse(raw);
}

export async function verifyLiffToken(
  idToken: string,
): Promise<LineAuthResponse> {
  const raw = await request<Record<string, unknown>>("/auth/line/liff", {
    method: "POST",
    body: JSON.stringify({ idToken }),
  });
  return toLineAuthResponse(raw);
}

// --- Email OTP ---

export async function sendOtp(
  email: string,
  purpose: "user_verify" | "referral_verify",
): Promise<void> {
  await request("/auth/email/send-otp", {
    method: "POST",
    body: JSON.stringify({ email, purpose }),
  });
}

export async function verifyOtp(
  email: string,
  purpose: "user_verify" | "referral_verify",
  code: string,
): Promise<{ ok: boolean; user: User }> {
  const data = await request<{ ok: boolean; user: Record<string, unknown> }>(
    "/auth/email/verify-otp",
    {
      method: "POST",
      body: JSON.stringify({ email, purpose, code }),
    },
  );
  return { ok: data.ok, user: toUser(data.user) };
}

// --- User ---

export async function fetchMe(): Promise<User> {
  const data = await request<Record<string, unknown>>("/users/me");
  return toUser(data);
}

export interface UpdateProfilePayload {
  displayName?: string;
  email?: string;
  phone?: string;
  deliveryLocation?: string;
}

export async function updateMe(payload: UpdateProfilePayload): Promise<User> {
  const data = await request<Record<string, unknown>>("/users/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return toUser(data);
}

export async function fetchMyOrders(): Promise<Order[]> {
  const data = await request<Record<string, unknown>[]>("/users/me/orders");
  return data.map(toOrder);
}

// --- Merchant ---

export async function fetchMerchantRestaurant(): Promise<Restaurant> {
  const data = await request<Record<string, unknown>>("/merchant/restaurant");
  return toRestaurant(data);
}

export async function updateMerchantRestaurant(
  payload: Partial<Restaurant>,
): Promise<Restaurant> {
  const data = await request<Record<string, unknown>>("/merchant/restaurant", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return toRestaurant(data);
}

export async function fetchMerchantMenuItems(): Promise<MenuItem[]> {
  const data = await request<Record<string, unknown>[]>("/merchant/menu-items");
  return data.map(toMenuItem);
}

export async function createMerchantMenuItem(
  payload: Partial<MenuItem>,
): Promise<MenuItem> {
  const data = await request<Record<string, unknown>>("/merchant/menu-items", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return toMenuItem(data);
}

export async function updateMerchantMenuItem(
  menuItemId: string,
  payload: Partial<MenuItem>,
): Promise<MenuItem> {
  const data = await request<Record<string, unknown>>(
    `/merchant/menu-items/${menuItemId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
  return toMenuItem(data);
}

export async function deleteMerchantMenuItem(
  menuItemId: string,
): Promise<void> {
  await request(`/merchant/menu-items/${menuItemId}`, { method: "DELETE" });
}

export async function fetchMerchantCategories(): Promise<string[]> {
  return request<string[]>("/merchant/categories");
}

export async function createMerchantCategory(name: string): Promise<string[]> {
  return request<string[]>("/merchant/categories", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function renameMerchantCategory(
  oldName: string,
  newName: string,
): Promise<string[]> {
  return request<string[]>(
    `/merchant/categories/${encodeURIComponent(oldName)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ name: newName }),
    },
  );
}

export async function deleteMerchantCategory(name: string): Promise<string[]> {
  return request<string[]>(`/merchant/categories/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
}

export async function fetchMerchantOrders(
  serviceDate?: string,
): Promise<{ serviceDate: string; orders: Order[] }> {
  const qs = serviceDate ? `?serviceDate=${serviceDate}` : "";
  const data = await request<{
    serviceDate: string;
    orders: Record<string, unknown>[];
  }>(`/merchant/orders${qs}`);
  return { serviceDate: data.serviceDate, orders: data.orders.map(toOrder) };
}

export async function updateOrderStatus(
  orderId: string,
  status: string,
): Promise<Order> {
  const data = await request<Record<string, unknown>>(
    `/orders/${orderId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
  );
  return toOrder(data);
}

// --- Merchant: PromptPay QR onboarding ---

export interface PromptPayQrConfig {
  configured: boolean;
  qrImageUrl?: string;
}

export async function fetchMerchantPromptPayQr(): Promise<PromptPayQrConfig> {
  return request<PromptPayQrConfig>("/merchant/promptpay-qr");
}

export async function uploadMerchantPromptPayQr(
  file: File,
): Promise<PromptPayQrConfig> {
  return uploadFile<PromptPayQrConfig>("/merchant/promptpay-qr", file);
}

export async function deleteMerchantPromptPayQr(): Promise<PromptPayQrConfig> {
  return request<PromptPayQrConfig>("/merchant/promptpay-qr", {
    method: "DELETE",
  });
}

// --- Merchant: photo uploads (cover, logo, menu item) ---

export type MerchantImageKind =
  | "restaurant-cover"
  | "restaurant-logo"
  | "menu-item";

export interface MerchantImageUploadResponse {
  imageUrl: string;
  fileKey: string;
  sizeBytes: number;
}

/**
 * Uploads a photo to R2 via the backend, which re-encodes via sharp and
 * returns a same-origin URL (`/api/images/...`) the caller can persist into
 * Restaurant.imageUrl / .logoUrl or MenuItem.imageUrl.
 */
export async function uploadMerchantImage(
  file: File,
  kind: MerchantImageKind,
): Promise<MerchantImageUploadResponse> {
  return uploadFile<MerchantImageUploadResponse>(
    `/merchant/uploads/image?kind=${kind}`,
    file,
  );
}

// --- Merchant: payment-proof review ---

export async function fetchMerchantPaymentProof(
  orderId: string,
): Promise<PaymentProofView> {
  return request<PaymentProofView>(`/merchant/orders/${orderId}/payment-proof`);
}

export async function confirmMerchantPayment(orderId: string): Promise<Order> {
  const data = await request<Record<string, unknown>>(
    `/merchant/orders/${orderId}/verify-payment`,
    {
      method: "POST",
      body: JSON.stringify({ action: "confirm" }),
    },
  );
  return toOrder(data);
}

export async function rejectMerchantPayment(
  orderId: string,
  mode: "request_new" | "cancel",
  reason?: string,
): Promise<Order> {
  const data = await request<Record<string, unknown>>(
    `/merchant/orders/${orderId}/verify-payment`,
    {
      method: "POST",
      body: JSON.stringify({ action: "reject", mode, reason }),
    },
  );
  return toOrder(data);
}
