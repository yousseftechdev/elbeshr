# Elbeshr E-Shop Frontend

A modern single-page frontend scaffold for an e-commerce flow designed to pair with a BaaS backend like Supabase.

## Included frontend features

- Login / signup page with client-side password hashing (demo behavior).
- Product browsing page with stock labels and add-to-cart.
- Cart page with remove-item and total calculations.
- Checkout form with **name, phone number, and address** and cash-on-delivery flow.
- Admin dashboard with:
  - Users overview
  - Products management (add/remove/toggle stock)
  - Orders table for placed orders

## Local run

Because this app is a static frontend, you can open `index.html` directly, or run a local server:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Demo admin credentials

- Email: `admin@elbeshr.shop`
- Password: `Admin123!`

## Supabase integration notes

Current code stores data in `localStorage` to enable full UI prototyping.
To connect to Supabase later, replace CRUD operations in `app.js` with:

- `auth.signUp`, `auth.signInWithPassword`
- `from('users')`, `from('products')`, `from('carts')`
- optional `orders` table for checkout records


## Supabase setup

A full step-by-step setup (schema + RLS + integration flow) is available in:

- [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md)
