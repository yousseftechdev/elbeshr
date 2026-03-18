# Supabase Setup Guide for Elbeshr E-Shop

This guide shows exactly how to connect the current frontend to Supabase and how to configure tables.

> **Important security note:** In Supabase, user password hashing/authentication should be managed by **Supabase Auth**, not by your own `hashed_password` column in a public table.

---

## 1) Create project + get keys

1. Create a project in Supabase dashboard.
2. Go to **Project Settings → API**.
3. Copy:
   - `Project URL` (looks like `https://xxxx.supabase.co`)
   - `anon public` key

Create a frontend config (example):

```js
// supabaseClient.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = 'YOUR_PROJECT_URL';
const supabaseAnonKey = 'YOUR_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

---

## 2) Recommended schema (secure production-ready)

Use **Supabase Auth** for credentials, and keep app data in your own tables:

- `profiles` (linked 1:1 with `auth.users`)
- `products`
- `carts`
- `cart_items` (instead of array, better relational design)
- `orders`
- `order_items`

### SQL (run in SQL Editor)

```sql
-- Optional helper extension for UUID generation in custom tables
create extension if not exists pgcrypto;

-- 1) profiles: app-level user info (no password hash here)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  email text not null unique,
  admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- 2) products
create table if not exists public.products (
  product_id uuid primary key default gen_random_uuid(),
  product_name text not null,
  price numeric(10,2) not null check (price >= 0),
  in_stock boolean not null default true,
  created_at timestamptz not null default now()
);

-- 3) carts (one active cart per user)
create table if not exists public.carts (
  cart_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  is_checked_out boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, is_checked_out)
);

-- 4) cart items (recommended over product_ids array)
create table if not exists public.cart_items (
  cart_item_id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(cart_id) on delete cascade,
  product_id uuid not null references public.products(product_id),
  qty integer not null default 1 check (qty > 0),
  unique (cart_id, product_id)
);

-- 5) orders
create table if not exists public.orders (
  order_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id),
  customer_name text not null,
  phone text not null,
  address text not null,
  status text not null default 'placed',
  total numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

-- 6) order items
create table if not exists public.order_items (
  order_item_id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(order_id) on delete cascade,
  product_id uuid not null references public.products(product_id),
  product_name text not null,
  price numeric(10,2) not null check (price >= 0),
  qty integer not null default 1 check (qty > 0)
);
```

---

## 3) If you strictly want your 3-table shape

If you *must* keep exactly:

- `users(user_id, username, email, hashed_password, admin)`
- `products(product_id, product_name, price, in_stock)`
- `carts(user_id, product_ids[])`

you can do it technically, but it is less secure/scalable.

**Strong recommendation:**
- keep passwords in Supabase Auth only,
- avoid `product_ids[]` in production (use `cart_items` table instead).

---

## 4) Enable Row-Level Security (RLS)

Run this after table creation:

```sql
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
```

### Starter policies

```sql
-- Profiles: user can view/update their own profile
create policy "profile_select_own"
on public.profiles for select
using (auth.uid() = user_id);

create policy "profile_update_own"
on public.profiles for update
using (auth.uid() = user_id);

-- Products: everyone authenticated can read
create policy "products_select_auth"
on public.products for select
to authenticated
using (true);

-- Products: only admins can change products
create policy "products_admin_write"
on public.products for all
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.admin = true
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.admin = true
  )
);

-- Carts/cart_items: user can manage own active cart
create policy "carts_own_all"
on public.carts for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "cart_items_own_all"
on public.cart_items for all
to authenticated
using (
  exists (
    select 1 from public.carts c
    where c.cart_id = cart_items.cart_id and c.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.carts c
    where c.cart_id = cart_items.cart_id and c.user_id = auth.uid()
  )
);

-- Orders: customer sees own orders
create policy "orders_select_own"
on public.orders for select
to authenticated
using (auth.uid() = user_id);

create policy "orders_insert_own"
on public.orders for insert
to authenticated
with check (auth.uid() = user_id);

-- Admin can view all orders
create policy "orders_admin_select_all"
on public.orders for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.admin = true
  )
);
```

---

## 5) Frontend wiring steps in this repo

1. Add Supabase client file.
2. Replace `localStorage` CRUD in `app.js` with Supabase queries.
3. Replace signup/login flow:
   - signup → `supabase.auth.signUp(...)`
   - login → `supabase.auth.signInWithPassword(...)`
4. On signup, insert user profile row into `public.profiles`.
5. Load products from `public.products`.
6. Persist cart in `carts + cart_items`.
7. On checkout:
   - create `orders` row,
   - create `order_items` rows,
   - clear cart items.

You already have all UI screens, so this is mostly replacing data functions.

---

## 6) Suggested migration path from current app

- Keep UI as-is.
- Introduce a small `dataService` layer in `app.js` (`getProducts`, `addToCart`, `placeOrder`, etc.).
- First implement that layer using current local state.
- Then swap those functions to Supabase calls without touching UI templates.

