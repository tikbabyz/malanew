// src/services/api.js
// ✅ ใช้ dynamic host เพื่อรองรับทั้ง localhost และ mobile hotspot
const host = window.location.hostname; // จะเป็น localhost หรือ 172.20.10.3
// export const API_BASE = import.meta.env.VITE_API_BASE || `http://${host}:8000`;
export const API_BASE = `http://${host}:8000`;

export const API_PREFIX = `${API_BASE}/api`;

// ✅ Helper function สำหรับสร้าง URL รูปภาพ
export const getImageUrl = (imagePath) => {
  if (!imagePath) return null;

  const raw = String(imagePath).trim();
  if (!raw) return null;

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  if (raw.startsWith('/')) {
    return API_BASE + raw;
  }

  const normalized = raw.replace(/^\.\//, '');
  const lower = normalized.toLowerCase();

  if (lower.startsWith('api/')) {
    return API_BASE + '/' + normalized;
  }

  if (lower.startsWith('uploads/')) {
    return API_BASE + '/' + normalized;
  }

  const filename = normalized.split('/').pop();
  if (!filename) {
    return null;
  }

  if (lower.startsWith('products/')) {
    return API_BASE + '/api/products/images/' + filename;
  }

  if (lower.startsWith('qr/') || lower.startsWith('qr_codes/')) {
    return API_BASE + '/api/qr/images/' + filename;
  }

  if (lower.startsWith('slips/')) {
    return API_BASE + '/api/slips/' + filename;
  }

  if (filename.startsWith('qr_')) {
    return API_BASE + '/api/qr/images/' + filename;
  }

  if (filename.startsWith('slip_')) {
    return API_BASE + '/api/slips/' + filename;
  }

  return API_BASE + '/api/products/images/' + filename;
};

console.log('🔧 API Configuration:');
console.log('  API_BASE:', API_BASE);
console.log('  API_PREFIX:', API_PREFIX);
console.log('  Current hostname:', location.hostname);
console.log('  VITE_API_BASE from env:', import.meta.env.VITE_API_BASE);

// ทดสอบการเชื่อมต่อทันทีที่โหลด
(async () => {
  try {
    console.log('🔍 Testing backend connection...');
    const response = await fetch(`${API_PREFIX}/health`);
    console.log('✅ Backend connection test - Status:', response.status);
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Backend health check:', data);
    } else {
      console.warn('⚠️ Backend health check failed:', response.statusText);
    }
  } catch (error) {
    console.error('❌ Backend connection failed:', error.message);
    console.error('❌ This usually means backend is not running on', API_BASE);
  }
})();

async function http(path, opts = {}) {
  const fullUrl = `${API_PREFIX}${path}`;
  console.log('🌐 Making HTTP request to:', fullUrl);
  console.log('🔧 Request options:', { method: opts.method || 'GET', ...opts });
  
  try {
    const res = await fetch(fullUrl, {
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      ...opts,
    });

    console.log('📡 Response received:');
    console.log('  Status:', res.status, res.statusText);
    console.log('  URL:', res.url);
    console.log('  OK:', res.ok);
    
    const ct = res.headers.get('content-type') || '';
    console.log('📄 Response content-type:', ct);
    
    // Log all response headers for debugging
    console.log('📋 Response headers:');
    for (const [key, value] of res.headers.entries()) {
      console.log(`  ${key}: ${value}`);
    }
    
    // ถ้า response เป็น JSON ให้พยายามอ่าน JSON ก่อน (ไม่ว่าจะ success หรือ error)
    if (ct.includes('application/json')) {
      try {
        const data = await res.json();
        console.log('✅ Response JSON data:', data);
        
        if (!res.ok) {
          // ถ้าเป็น error response แต่เป็น JSON ให้ส่ง error message จาก JSON
          const errorMsg = data.error || data.message || `HTTP ${res.status}`;
          console.error('❌ API Error:', errorMsg);
          throw new Error(errorMsg);
        }
        return data;
      } catch (err) {
        // ถ้า parse JSON ไม่ได้ ให้ fallback ไปอ่าน text
        if (err.message.includes('HTTP ') || err.message.includes('รหัสผ่าน') || err.message.includes('บัญชี')) {
          throw err; // ส่ง error ที่เราสร้างไว้แล้ว
        }
        const text = await res.text().catch(() => '');
        console.error('❌ JSON Parse Error:', err.message, 'Response text:', text);
        throw new Error(`Bad JSON from ${API_PREFIX}${path}: ${text.slice(0,200)}`);
      }
    }

    // ถ้าไม่ใช่ JSON
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('❌ Non-JSON Error:', text);
      throw new Error(text || `HTTP ${res.status}`);
    }

    const text = await res.text().catch(() => '');
    console.error('❌ Unexpected content type:', ct);
    throw new Error(
      `Expected JSON from ${API_PREFIX}${path} but got ${ct} (status ${res.status}). ` +
      `First 200 chars: ${text.slice(0,200)}`
    );
    
  } catch (fetchError) {
    console.error('❌ Fetch Error Details:');
    console.error('  Message:', fetchError.message);
    console.error('  Name:', fetchError.name);
    console.error('  Stack:', fetchError.stack);
    
    // Check for common network errors
    if (fetchError.name === 'TypeError' && fetchError.message.includes('fetch')) {
      console.error('🚫 Network Error - Possible causes:');
      console.error('  1. Backend server is not running');
      console.error('  2. CORS policy blocking the request');
      console.error('  3. Wrong URL or port');
      console.error('  4. Firewall blocking the connection');
    }
    
    throw fetchError;
  }
}

async function httpForm(path, formData, opts = {}) {
  const res = await fetch(`${API_PREFIX}${path}`, { method: 'POST', body: formData, ...opts });
  const ct = res.headers.get('content-type') || '';
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }
  if (!ct.includes('application/json')) {
    const text = await res.text().catch(() => '');
    throw new Error(`Expected JSON but got ${ct}. ${text.slice(0,200)}`);
  }
  return res.json();
}

export const API = {
  paymentSettings: {
    get: () => http('/payment-settings'),
    set: (payload) => http('/payment-settings', { method: 'POST', body: JSON.stringify(payload) }),
  },
  health: () => http('/health'),
  detectImage: async (file, bbox) => {
    const fd = new FormData();
    fd.append('image', file);
    if (bbox) fd.append('bbox', [bbox.x1, bbox.y1, bbox.x2, bbox.y2].join(','));
    return httpForm('/detect', fd);
  },
  
  // Image upload for products
  uploadProductImage: async (file) => {
    const fd = new FormData();
    fd.append('image', file);
    return httpForm('/upload/image', fd);
  },
  
  // QR Code upload
  uploadQRCode: async (file) => {
    const fd = new FormData();
    fd.append('image', file);
    return httpForm('/upload/qr', fd);
  },
  
  login: (username, password) => {
    console.log('🔑 API.login called with:', { username, passwordLength: password.length });
    return http('/login', { method: 'POST', body: JSON.stringify({ username, password }) });
  },

  products: {
    list: () => http('/products'),
    create: (p) => http('/products', { method: 'POST', body: JSON.stringify(p) }),
    update: (id, p) => http(`/products/${id}`, { method: 'PUT', body: JSON.stringify(p) }),
    delete: (id) => http(`/products/${id}`, { method: 'DELETE' }),
  },

  colorPrices: {
    async get() {
      const data = await http('/color-prices');
      const normalized = {};
      Object.entries(data || {}).forEach(([color, payload]) => {
        const price = typeof payload === 'object' && payload !== null ? payload.price : payload;
        const stock = typeof payload === 'object' && payload !== null ? payload.stock : 0;
        const key = String(color || '').toLowerCase();
        normalized[key] = {
          price: Number(price ?? 0) || 0,
          stock: Number(stock ?? 0) || 0,
        };
      });
      return normalized;
    },
    async set(map) {
      const payload = {};
      Object.entries(map || {}).forEach(([color, value]) => {
        const key = String(color || '').toLowerCase();
        const entry = typeof value === 'object' && value !== null ? value : { price: value, stock: undefined };
        payload[key] = {
          price: Number(entry.price ?? 0) || 0,
          stock: entry.stock == null ? 0 : Number(entry.stock) || 0,
        };
      });
      return http('/color-prices', { method: 'PUT', body: JSON.stringify(payload) });
    },
  },

  orders: {
    list: () => http('/orders'),
    create: (payload) => http('/orders', { method: 'POST', body: JSON.stringify(payload) }),
    addPayment: (orderId, pay) =>
      http(`/orders/${orderId}/payments`, { method: 'POST', body: JSON.stringify(pay) }),
  },

  // ✅ Fallback ชั่วคราว: backend คุณยังไม่มี /api/announcements
  announcements: {
    list: () => http('/announcements'), // หรือ /announcements?active=1 ถ้าต้องการเฉพาะ active
    create: (a) => http('/announcements', { method: 'POST', body: JSON.stringify(a) }),
    update: (id, a) => http(`/announcements/${id}`, { method: 'PUT', body: JSON.stringify(a) }),
    delete: (id) => http(`/announcements/${id}`, { method: 'DELETE' }),
  },

  // ✅ Users API endpoints
  users: {
    list: () => http('/users'),
    create: (u) => http('/users', { method: 'POST', body: JSON.stringify(u) }),
    update: (id, u) => http(`/users/${id}`, { method: 'PUT', body: JSON.stringify(u) }),
    delete: (id) => http(`/users/${id}`, { method: 'DELETE' }),
  },
};

export default API;
