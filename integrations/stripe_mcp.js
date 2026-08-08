/**
 * Stripe MCP Integration — fully wired
 * Operations: listCustomers, createCustomer, getCustomer, deleteCustomer,
 *             createPaymentIntent, listProducts, getProduct, createProduct,
 *             listSubscriptions, cancelSubscription, listInvoices
 */
export class StripeMCP {
  constructor() {
    this._secretKey = null;
    this._baseUrl = 'https://api.stripe.com/v1';
    this._connected = false;

    this.operations = {
      listCustomers: (p) => this._listCustomers(p),
      createCustomer: (p) => this._createCustomer(p),
      getCustomer: (p) => this._getCustomer(p),
      deleteCustomer: (p) => this._deleteCustomer(p),
      createPaymentIntent: (p) => this._createPaymentIntent(p),
      listProducts: (p) => this._listProducts(p),
      getProduct: (p) => this._getProduct(p),
      createProduct: (p) => this._createProduct(p),
      listSubscriptions: (p) => this._listSubscriptions(p),
      cancelSubscription: (p) => this._cancelSubscription(p),
      listInvoices: (p) => this._listInvoices(p),
    };
  }

  async connect(config = {}) {
    const key = config.secretKey || process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('Stripe: secretKey required (config.secretKey or STRIPE_SECRET_KEY env var)');
    if (!key.startsWith('sk_')) throw new Error('Stripe: key must start with sk_ (secret key required, not publishable key)');
    this._secretKey = key;
    // Verify with a lightweight call
    await this._fetch('/customers?limit=1', 'GET');
    this._connected = true;
    return { connected: true, mode: key.startsWith('sk_live') ? 'live' : 'test' };
  }

  async disconnect() { this._secretKey = null; this._connected = false; }
  isConnected() { return this._connected; }

  async _listCustomers({ limit = 20, email, starting_after } = {}) {
    const p = new URLSearchParams({ limit: String(limit) });
    if (email) p.set('email', email);
    if (starting_after) p.set('starting_after', starting_after);
    return this._fetch(`/customers?${p}`, 'GET');
  }

  async _createCustomer({ email, name, phone, metadata = {} }) {
    if (!email) throw new Error('Stripe createCustomer: email required');
    return this._fetch('/customers', 'POST', { email, ...(name && { name }), ...(phone && { phone }), ...Object.fromEntries(Object.entries(metadata).map(([k, v]) => [`metadata[${k}]`, v])) });
  }

  async _getCustomer({ customer_id }) {
    if (!customer_id) throw new Error('Stripe getCustomer: customer_id required');
    return this._fetch(`/customers/${customer_id}`, 'GET');
  }

  async _deleteCustomer({ customer_id }) {
    if (!customer_id) throw new Error('Stripe deleteCustomer: customer_id required');
    return this._fetch(`/customers/${customer_id}`, 'DELETE');
  }

  async _createPaymentIntent({ amount, currency = 'usd', customer_id, metadata = {}, confirm = false }) {
    if (!amount) throw new Error('Stripe createPaymentIntent: amount required (in smallest currency unit)');
    const body = {
      amount: String(amount),
      currency,
      ...(customer_id && { customer: customer_id }),
      ...(confirm && { confirm: 'true' }),
      ...Object.fromEntries(Object.entries(metadata).map(([k, v]) => [`metadata[${k}]`, v])),
    };
    return this._fetch('/payment_intents', 'POST', body);
  }

  async _listProducts({ limit = 20, active } = {}) {
    const p = new URLSearchParams({ limit: String(limit) });
    if (active !== undefined) p.set('active', String(active));
    return this._fetch(`/products?${p}`, 'GET');
  }

  async _getProduct({ product_id }) {
    if (!product_id) throw new Error('Stripe getProduct: product_id required');
    return this._fetch(`/products/${product_id}`, 'GET');
  }

  async _createProduct({ name, description, metadata = {} }) {
    if (!name) throw new Error('Stripe createProduct: name required');
    return this._fetch('/products', 'POST', {
      name, ...(description && { description }),
      ...Object.fromEntries(Object.entries(metadata).map(([k, v]) => [`metadata[${k}]`, v])),
    });
  }

  async _listSubscriptions({ customer_id, status = 'active', limit = 20 } = {}) {
    const p = new URLSearchParams({ status, limit: String(limit) });
    if (customer_id) p.set('customer', customer_id);
    return this._fetch(`/subscriptions?${p}`, 'GET');
  }

  async _cancelSubscription({ subscription_id }) {
    if (!subscription_id) throw new Error('Stripe cancelSubscription: subscription_id required');
    return this._fetch(`/subscriptions/${subscription_id}`, 'DELETE');
  }

  async _listInvoices({ customer_id, status, limit = 20 } = {}) {
    const p = new URLSearchParams({ limit: String(limit) });
    if (customer_id) p.set('customer', customer_id);
    if (status) p.set('status', status);
    return this._fetch(`/invoices?${p}`, 'GET');
  }

  async _fetch(path, method, formBody) {
    const url = `${this._baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const init = {
        method, signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this._secretKey}`,
          'Stripe-Version': '2023-10-16',
        },
      };
      if (formBody) {
        init.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        init.body = new URLSearchParams(formBody).toString();
      }
      const res = await fetch(url, init);
      clearTimeout(timeout);
      const json = await res.json();
      if (!res.ok) throw new Error(`Stripe API ${method} ${path} => ${res.status}: ${json.error?.message || JSON.stringify(json)}`);
      return json;
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }
}

export default StripeMCP;
