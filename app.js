const STORAGE_KEY = 'elbeshr_shop_v1';

const state = {
  route: 'shop',
  authMode: 'login',
  message: null,
  sessionUserId: null,
};

const defaultData = {
  users: [],
  products: [
    { id: crypto.randomUUID(), name: 'Fresh Chicken - 1kg', price: 8.5, inStock: true },
    { id: crypto.randomUUID(), name: 'Whole Duck', price: 13.0, inStock: false },
    { id: crypto.randomUUID(), name: 'Turkey Breast', price: 10.75, inStock: true },
  ],
  carts: [],
  orders: [],
};

const app = document.getElementById('app');
let db = hydrate();

bootstrapAdminUser().then(render);

window.addEventListener('hashchange', () => {
  state.route = (window.location.hash.replace('#', '') || 'shop').toLowerCase();
  render();
});

function hydrate() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return structuredClone(defaultData);
    }
  }
  return structuredClone(defaultData);
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

async function hashPassword(password) {
  const msgUint8 = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function bootstrapAdminUser() {
  if (db.users.some((u) => u.admin)) return;
  db.users.push({
    id: crypto.randomUUID(),
    username: 'admin',
    email: 'admin@elbeshr.shop',
    passwordHash: await hashPassword('Admin123!'),
    admin: true,
  });
  persist();
}

function setMessage(text, type = 'success') {
  state.message = { text, type };
  setTimeout(() => {
    if (state.message?.text === text) {
      state.message = null;
      render();
    }
  }, 3500);
}

function currentUser() {
  return db.users.find((u) => u.id === state.sessionUserId) || null;
}

function userCart(userId) {
  let cart = db.carts.find((c) => c.userId === userId);
  if (!cart) {
    cart = { userId, productIds: [] };
    db.carts.push(cart);
  }
  return cart;
}

function routeTo(next) {
  window.location.hash = next;
}

function navButton(route, label) {
  const active = state.route === route ? 'active' : '';
  return `<button class="${active}" data-route="${route}">${label}</button>`;
}

function render() {
  const user = currentUser();
  if (!window.location.hash) {
    routeTo('shop');
  }

  app.innerHTML = `
    <header class="nav">
      <div class="brand">
        <div class="brand-logo"></div>
        <span>Elbeshr E-Shop</span>
      </div>
      <div class="nav-links">
        ${navButton('shop', 'Shop')}
        ${navButton('cart', 'Cart')}
        ${user?.admin ? navButton('admin', 'Admin Dashboard') : ''}
        ${!user ? navButton('auth', 'Login / Signup') : `<button data-action="logout">Logout (${escapeHtml(user.username)})</button>`}
      </div>
    </header>

    <main class="main-card">
      ${state.message ? `<div class="notice ${state.message.type}">${escapeHtml(state.message.text)}</div>` : ''}
      ${viewForRoute()}
    </main>
  `;

  bindGlobalEvents();
}

function viewForRoute() {
  const user = currentUser();
  switch (state.route) {
    case 'auth':
      return authView();
    case 'cart':
      return user ? cartView(user) : guardedView('Please login first to manage your cart.');
    case 'admin':
      return user?.admin ? adminView() : guardedView('Admin access only.');
    case 'shop':
    default:
      return shopView(user);
  }
}

function guardedView(message) {
  return `
    <h2>Restricted</h2>
    <p class="muted">${escapeHtml(message)}</p>
    <button class="btn btn-primary" data-route="auth">Go to Login</button>
  `;
}

function authView() {
  return `
    <section>
      <h2>${state.authMode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
      <p class="muted">Frontend is ready for Supabase integration. Passwords are hashed client-side in this demo only.</p>
      <form id="auth-form" class="form">
        ${state.authMode === 'signup' ? `<label>Username<input required name="username" minlength="3"/></label>` : ''}
        <label>Email<input required type="email" name="email"/></label>
        <label>Password<input required type="password" name="password" minlength="6"/></label>
        <button class="btn btn-primary" type="submit">${state.authMode === 'login' ? 'Login' : 'Sign up'}</button>
      </form>
      <div class="row" style="margin-top: 10px;">
        <button class="btn btn-secondary" data-action="toggle-auth">
          ${state.authMode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Login'}
        </button>
      </div>
      <p class="muted" style="margin-top:12px;">Demo admin account: admin@elbeshr.shop / Admin123!</p>
    </section>
  `;
}

function shopView(user) {
  const cards = db.products
    .map(
      (product) => `
      <article class="card">
        <h3>${escapeHtml(product.name)}</h3>
        <p><strong>$${product.price.toFixed(2)}</strong></p>
        <p>
          <span class="badge ${product.inStock ? 'ok' : 'out'}">
            ${product.inStock ? 'In Stock' : 'Out of Stock'}
          </span>
        </p>
        <button class="btn btn-accent" data-action="add-to-cart" data-product-id="${product.id}" ${!product.inStock || !user ? 'disabled' : ''}>
          ${user ? 'Add to cart' : 'Login to buy'}
        </button>
      </article>
    `,
    )
    .join('');

  return `
    <section class="hero">
      <h1>Sleek poultry & seafood shopping experience</h1>
      <p class="muted">Browse products, add to cart, and place delivery orders with cash on delivery checkout.</p>
    </section>
    <section class="grid">
      ${cards || '<p>No products available.</p>'}
    </section>
  `;
}

function cartView(user) {
  const cart = userCart(user.id);
  const lines = cart.productIds
    .map((id) => db.products.find((p) => p.id === id))
    .filter(Boolean);

  const total = lines.reduce((sum, p) => sum + p.price, 0);

  return `
    <section>
      <h2>Your Cart</h2>
      ${
        lines.length
          ? `
            <table class="table">
              <thead><tr><th>Product</th><th>Price</th><th></th></tr></thead>
              <tbody>
                ${lines
                  .map(
                    (p, idx) => `
                  <tr>
                    <td>${escapeHtml(p.name)}</td>
                    <td>$${p.price.toFixed(2)}</td>
                    <td><button class="btn btn-secondary" data-action="remove-cart-item" data-index="${idx}">Remove</button></td>
                  </tr>`,
                  )
                  .join('')}
              </tbody>
            </table>
            <h3>Total: $${total.toFixed(2)}</h3>
            ${checkoutForm()}
          `
          : '<p class="muted">Your cart is empty.</p>'
      }
    </section>
  `;
}

function checkoutForm() {
  return `
    <section style="margin-top: 20px;">
      <h3>Checkout (Cash on Delivery)</h3>
      <form id="checkout-form" class="form">
        <label>Full Name<input required name="name" minlength="3"/></label>
        <label>Phone Number<input required name="phone" minlength="8"/></label>
        <label>Address<textarea required name="address" rows="3"></textarea></label>
        <button class="btn btn-primary" type="submit">Place Order</button>
      </form>
    </section>
  `;
}

function adminView() {
  const usersRows = db.users
    .map(
      (u) => `
      <tr>
        <td>${escapeHtml(u.username)}</td>
        <td>${escapeHtml(u.email)}</td>
        <td>${u.admin ? 'Admin' : 'Customer'}</td>
      </tr>
    `,
    )
    .join('');

  const productsRows = db.products
    .map(
      (p) => `
      <tr>
        <td>${escapeHtml(p.name)}</td>
        <td>$${p.price.toFixed(2)}</td>
        <td>${p.inStock ? 'In Stock' : 'Out of Stock'}</td>
        <td class="row">
          <button class="btn btn-secondary" data-action="toggle-stock" data-product-id="${p.id}">Toggle Stock</button>
          <button class="btn btn-danger" data-action="remove-product" data-product-id="${p.id}">Delete</button>
        </td>
      </tr>
    `,
    )
    .join('');

  const ordersRows = db.orders
    .map(
      (o) => `
      <tr>
        <td>${new Date(o.createdAt).toLocaleString()}</td>
        <td>${escapeHtml(o.customerName)}</td>
        <td>${escapeHtml(o.phone)}</td>
        <td>${escapeHtml(o.address)}</td>
        <td>${o.items.length}</td>
        <td>$${o.total.toFixed(2)}</td>
      </tr>
    `,
    )
    .join('');

  return `
    <section>
      <h2>Admin Dashboard</h2>
      <div class="kpis">
        <div class="kpi"><h4>Users</h4><strong>${db.users.length}</strong></div>
        <div class="kpi"><h4>Products</h4><strong>${db.products.length}</strong></div>
        <div class="kpi"><h4>Orders</h4><strong>${db.orders.length}</strong></div>
      </div>

      <h3 style="margin-top:20px;">Add Product</h3>
      <form id="product-form" class="form">
        <label>Product Name<input required name="name" /></label>
        <label>Price<input required type="number" min="0.1" step="0.01" name="price" /></label>
        <label>In stock?
          <select name="inStock">
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
        <button class="btn btn-primary" type="submit">Add Product</button>
      </form>

      <h3 style="margin-top:20px;">Users</h3>
      <table class="table">
        <thead><tr><th>Username</th><th>Email</th><th>Role</th></tr></thead>
        <tbody>${usersRows || '<tr><td colspan="3">No users.</td></tr>'}</tbody>
      </table>

      <h3 style="margin-top:20px;">Products & Stock</h3>
      <table class="table">
        <thead><tr><th>Name</th><th>Price</th><th>Stock</th><th>Actions</th></tr></thead>
        <tbody>${productsRows || '<tr><td colspan="4">No products.</td></tr>'}</tbody>
      </table>

      <h3 style="margin-top:20px;">Orders Placed</h3>
      <table class="table">
        <thead><tr><th>Date</th><th>Name</th><th>Phone</th><th>Address</th><th># Items</th><th>Total</th></tr></thead>
        <tbody>${ordersRows || '<tr><td colspan="6">No orders yet.</td></tr>'}</tbody>
      </table>
    </section>
  `;
}

function bindGlobalEvents() {
  app.querySelectorAll('[data-route]').forEach((el) => {
    el.addEventListener('click', () => routeTo(el.dataset.route));
  });

  app.querySelector('[data-action="logout"]')?.addEventListener('click', () => {
    state.sessionUserId = null;
    setMessage('Logged out.', 'success');
    routeTo('shop');
  });

  app.querySelector('[data-action="toggle-auth"]')?.addEventListener('click', () => {
    state.authMode = state.authMode === 'login' ? 'signup' : 'login';
    render();
  });

  app.querySelectorAll('[data-action="add-to-cart"]').forEach((el) => {
    el.addEventListener('click', () => {
      const user = currentUser();
      if (!user) return setMessage('Please login first.', 'error');
      const product = db.products.find((p) => p.id === el.dataset.productId);
      if (!product?.inStock) return setMessage('Product is out of stock.', 'error');
      const cart = userCart(user.id);
      cart.productIds.push(product.id);
      persist();
      setMessage('Added to cart.');
      render();
    });
  });

  app.querySelectorAll('[data-action="remove-cart-item"]').forEach((el) => {
    el.addEventListener('click', () => {
      const user = currentUser();
      if (!user) return;
      const cart = userCart(user.id);
      cart.productIds.splice(Number(el.dataset.index), 1);
      persist();
      setMessage('Item removed from cart.');
      render();
    });
  });

  app.querySelector('[data-action="toggle-stock"]')?.closest('table');
  app.querySelectorAll('[data-action="toggle-stock"]').forEach((el) => {
    el.addEventListener('click', () => {
      const p = db.products.find((x) => x.id === el.dataset.productId);
      if (!p) return;
      p.inStock = !p.inStock;
      persist();
      setMessage(`Stock status changed for ${p.name}.`);
      render();
    });
  });

  app.querySelectorAll('[data-action="remove-product"]').forEach((el) => {
    el.addEventListener('click', () => {
      db.products = db.products.filter((p) => p.id !== el.dataset.productId);
      db.carts.forEach((cart) => {
        cart.productIds = cart.productIds.filter((pid) => pid !== el.dataset.productId);
      });
      persist();
      setMessage('Product removed.', 'success');
      render();
    });
  });

  app.querySelector('#product-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    db.products.push({
      id: crypto.randomUUID(),
      name: form.get('name').toString().trim(),
      price: Number(form.get('price')),
      inStock: form.get('inStock') === 'true',
    });
    persist();
    setMessage('Product added.');
    e.target.reset();
    render();
  });

  app.querySelector('#auth-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const email = form.get('email').toString().trim().toLowerCase();
    const passwordHash = await hashPassword(form.get('password').toString());

    if (state.authMode === 'signup') {
      const username = form.get('username').toString().trim();
      if (db.users.some((u) => u.email === email)) {
        setMessage('Email already exists.', 'error');
        return render();
      }
      const user = {
        id: crypto.randomUUID(),
        username,
        email,
        passwordHash,
        admin: false,
      };
      db.users.push(user);
      state.sessionUserId = user.id;
      persist();
      setMessage('Signup successful.');
      routeTo('shop');
      return;
    }

    const user = db.users.find((u) => u.email === email && u.passwordHash === passwordHash);
    if (!user) {
      setMessage('Invalid credentials.', 'error');
      return render();
    }

    state.sessionUserId = user.id;
    setMessage(`Welcome, ${user.username}!`);
    routeTo('shop');
  });

  app.querySelector('#checkout-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const user = currentUser();
    if (!user) return;
    const cart = userCart(user.id);
    const items = cart.productIds.map((id) => db.products.find((p) => p.id === id)).filter(Boolean);
    if (!items.length) {
      setMessage('Cart is empty.', 'error');
      return render();
    }

    const form = new FormData(e.target);
    const order = {
      id: crypto.randomUUID(),
      userId: user.id,
      customerName: form.get('name').toString().trim(),
      phone: form.get('phone').toString().trim(),
      address: form.get('address').toString().trim(),
      items: items.map((item) => ({ id: item.id, name: item.name, price: item.price })),
      total: items.reduce((sum, item) => sum + item.price, 0),
      createdAt: new Date().toISOString(),
      status: 'placed',
    };

    db.orders.unshift(order);
    cart.productIds = [];
    persist();
    setMessage('Order placed successfully. Payment: Cash on Delivery.');
    routeTo('shop');
  });
}

function escapeHtml(v) {
  return v
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
