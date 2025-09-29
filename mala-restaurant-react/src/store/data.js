// src/store/data.js
import { create } from "zustand";
import dayjs from "dayjs";
import API from "@services/api";

const KEY = "mala_data_v1";

/* ----------------------------
   โปรไฟล์ร้าน + ค่ามาตรฐานของออเดอร์
---------------------------- */
const STORE_PROFILE = {
  name: "ร้านหม่าล่า",
  address: "…",
  phone: "…",
  taxId: "…",
  branch: "00000",
};

const DEFAULT_ORDER_META = {
  splitMode: "NONE",
  payments: [],
  paid: false,
  channel: "หน้าร้าน",
  store: STORE_PROFILE,
};

/* ----------------------------
   ตัวช่วยคำนวณยอดรวม (ไม่มีส่วนลด/เซอร์วิส/VAT)
---------------------------- */
function computeTotalsDetailed(items = []) {
  const subtotal = (items || []).reduce(
    (s, it) => s + Number(it.price || 0) * Number(it.qty || 0),
    0
  );
  const total = +subtotal.toFixed(2);
  return { subtotal: total, discount: 0, service: 0, vat: 0, total };
}

/* ----------------------------
   ข้อมูลเริ่มต้นที่จำเป็น
---------------------------- */
const initialState = {
  users: [], // จะโหลดจากฐานข้อมูล
  colorPrices: {}, // จะโหลดจากฐานข้อมูล
  products: [], // จะโหลดจากฐานข้อมูล
  announcements: [], // จะโหลดจากฐานข้อมูล
  cart: { items: [], persons: 1, mode: "TOGETHER" },
  orders: [],
  nextIds: { user: 1, product: 107, announcement: 1, order: 1 }, // product เริ่มที่ 107 เพื่อไม่ชนกับสินค้าตัวอย่าง
  settings: {}
};

/* ----------------------------
   Persistence helpers
---------------------------- */
export function hydrateIfEmpty() {
  // ไม่ต้องเซ็ต defaults แล้ว เพราะข้อมูลจะมาจากฐานข้อมูล
  console.log('💾 Skipping localStorage defaults - using database-only mode');
}

function load() {
  try {
    // โหลดเฉพาะข้อมูล session จาก localStorage
    const sessionKey = KEY + '_session';
    const stored = localStorage.getItem(sessionKey);
    const sessionData = stored ? JSON.parse(stored) : {};
    
    // คืนค่า state เริ่มต้นพร้อม session data
    const state = { 
      ...initialState,
      cart: sessionData.cart || { items: [], persons: 1, mode: "TOGETHER" },
      settings: sessionData.settings || {}
    };
    
    console.log('💾 Frontend initialized with empty state - data will be loaded from database');
    return state;
    
  } catch (error) {
    console.warn('⚠️ Failed to load session data, using initial state:', error.message);
    return { ...initialState };
  }
}

function save(s) {
  // Database-only mode: Don't save to localStorage
  console.log('💾 Database-only mode: localStorage saving disabled');
  
  // Only keep essential data in memory for current session
  // Cart and temporary UI state only
  try {
    const sessionData = {
      cart: s.cart || { items: [], persons: 1, mode: "TOGETHER" },
      // Don't save products, users, colorPrices as they come from database
    };
    
    // Only save minimal session data to localStorage
    localStorage.setItem(KEY + '_session', JSON.stringify(sessionData));
    console.log('� Session data saved to localStorage');
    
  } catch (error) {
    console.warn('⚠️ Failed to save session data:', error.message);
    // Continue without localStorage if it fails
  }
}

/* ----------------------------
   Utils
---------------------------- */
function mergeItems(list = []) {
  const out = [];
  for (const it of list) {
    const id = it.id;
    if (id == null) continue;
    const idx = out.findIndex((x) => x.id === id);
    if (idx > -1) {
      out[idx].qty = Number(out[idx].qty || 0) + Number(it.qty || 1);
    } else {
      out.push({
        id,
        name: it.name ?? "",
        price: Number(it.price || 0),
        qty: Number(it.qty || 1),
        color: it.color, // เผื่อมาจาก AI
      });
    }
  }
  return out;
}

/* ----------------------------
   Store
---------------------------- */
export const useDataStore = create((set, get) => ({
  ...load(),

  // ---------- USERS ----------
  loadUsers: async () => {
    try {
      console.log('📡 Loading users from database...');
      const users = await API.users.list();
      
      set((s) => {
        s.users = users;
        console.log('✅ Users loaded from database:', users.length);
        return { ...s };
      });
      
      return users;
    } catch (error) {
      console.warn('⚠️ Failed to load users from database:', error.message);
      
      // ไม่ใช้ fallback แล้ว แค่คืนค่า array ว่าง
      set((s) => {
        s.users = [];
        return { ...s };
      });
      
      console.log('🔄 Using empty users array - please check database connection');
      return [];
    }
  },

  addUser: async (u) => {
    try {
      console.log('📡 Creating user in database:', u.username);
      const result = await API.users.create(u);
      
      set((s) => { 
        s.users.push(result.user);
        save(s); // บันทึก localStorage เป็น backup
        return { ...s }; 
      });
      
      console.log('✅ User created successfully:', result.user.username);
      return result.user;
    } catch (error) {
      console.error('❌ Failed to create user in database:', error.message);
      
      // แสดง error ให้ user เห็น แทนที่จะใช้ fallback
      throw new Error(`ไม่สามารถสร้างผู้ใช้งานได้: ${error.message}`);
    }
  },
  
  updateUser: async (u) => {
    try {
      console.log('📡 Updating user in database:', u.id);
      const result = await API.users.update(u.id, u);
      
      set((s) => { 
        const i = s.users.findIndex((x) => x.id === u.id); 
        if (i > -1) s.users[i] = result.user;
        save(s); // บันทึก localStorage เป็น backup
        return { ...s }; 
      });
      
      console.log('✅ User updated successfully:', result.user.username);
      return result.user;
    } catch (error) {
      console.error('❌ Failed to update user in database:', error.message);
      throw new Error(`ไม่สามารถอัพเดทผู้ใช้งานได้: ${error.message}`);
    }
  },
  
  deleteUser: async (id) => {
    try {
      console.log('📡 Deleting user from database:', id);
      await API.users.delete(id);
      
      set((s) => { 
        s.users = s.users.filter((x) => x.id !== id); 
        save(s); // บันทึก localStorage เป็น backup
        return { ...s }; 
      });
      
      console.log('✅ User deleted successfully:', id);
    } catch (error) {
      console.error('❌ Failed to delete user from database:', error.message);
      throw new Error(`ไม่สามารถลบผู้ใช้งานได้: ${error.message}`);
    }
  },

  // ---------- COLORS ----------
  loadColorPrices: async () => {
    try {
      console.log('📡 Loading color prices from database...');
      const colorPrices = await API.colorPrices.get();
      
      set((s) => {
        s.colorPrices = colorPrices || {};
        console.log('✅ Color prices loaded from database:', Object.keys(s.colorPrices).length);
        return { ...s };
      });
      
      return colorPrices || {};
    } catch (error) {
      console.warn('⚠️ Failed to load color prices from database:', error.message);
      set((s) => {
        s.colorPrices = {};
        return { ...s };
      });
      return {};
    }
  },

  setColorPrice: (color, values) =>
    set((s) => {
      const key = String(color || "").toLowerCase();
      const prev = (s.colorPrices || {})[key] || { price: 0, stock: 0 };
      const nextEntry = {
        price: Number(
          typeof values === 'object' && values !== null ? values.price ?? prev.price : values ?? prev.price
        ) || 0,
        stock: Number(
          typeof values === 'object' && values !== null && values.stock != null ? values.stock : prev.stock
        ) || 0,
      };
      s.colorPrices = {
        ...(s.colorPrices || {}),
        [key]: nextEntry,
      };
      save(s);
      return { ...s };
    }),

  setColorPrices: async (map) => {
    try {
      console.log('📡 Updating color prices in database:', Object.keys(map || {}).length);
      await API.colorPrices.set(map);

      set((s) => {
        const next = { ...(s.colorPrices || {}) };
        Object.entries(map || {}).forEach(([k, v]) => {
          const key = String(k || '').toLowerCase();
          const entry = typeof v === 'object' && v !== null ? v : { price: v, stock: (s.colorPrices?.[key]?.stock ?? 0) };
          next[key] = {
            price: Number(entry.price ?? 0) || 0,
            stock: Number(entry.stock ?? 0) || 0,
          };
        });
        s.colorPrices = next;
        console.log('✅ Color prices updated in database:', Object.keys(next).length);
        return { ...s };
      });
    } catch (error) {
      console.error('❌ Failed to update color prices in database:', error.message);
      throw new Error(`ไม่สามารถอัพเดทราคาสีได้: ${error.message}`);
    }
  },

  // ---------- PRODUCTS ----------
  loadProducts: async () => {
    try {
      console.log('📡 Loading products from database...');
      const products = await API.products.list();
      
      set((s) => {
        s.products = products || [];
        console.log('✅ Products loaded from database:', s.products.length);
        return { ...s };
      });
      
      return products || [];
    } catch (error) {
      console.warn('⚠️ Failed to load products from database:', error.message);
      set((s) => {
        s.products = [];
        return { ...s };
      });
      return [];
    }
  },

  addProduct: async (p) => {
    try {
      console.log('📡 Creating product in database:', p.name);
      const result = await API.products.create(p);
      
      set((s) => { 
        s.products.push(result);
        console.log('✅ Product created successfully:', result.name);
        return { ...s }; 
      });
      
      return result;
    } catch (error) {
      console.error('❌ Failed to create product in database:', error.message);
      throw new Error(`ไม่สามารถสร้างสินค้าได้: ${error.message}`);
    }
  },

  updateProduct: async (id, updates) => {
    try {
      console.log('📡 Updating product in database:', id);
      const result = await API.products.update(id, updates);
      
      set((s) => {
        const idx = s.products.findIndex((p) => p.id === id);
        if (idx > -1) {
          s.products[idx] = result;
          console.log('✅ Product updated successfully:', result.name);
        }
        return { ...s };
      });
      
      return result;
    } catch (error) {
      console.error('❌ Failed to update product in database:', error.message);
      throw new Error(`ไม่สามารถอัพเดทสินค้าได้: ${error.message}`);
    }
  },

  deleteProduct: async (id) => {
    try {
      console.log('📡 Deleting product from database:', id);
      await API.products.delete(id);
      // โหลดข้อมูลสินค้าใหม่จาก API หลังลบ
      const products = await API.products.list();
      set((s) => {
        s.products = products || [];
        console.log('✅ Product deleted and refreshed:', id);
        return { ...s };
      });
    } catch (error) {
      console.error('❌ Failed to delete product from database:', error.message);
      throw new Error(`ไม่สามารถลบสินค้าได้: ${error.message}`);
    }
  },

  setProducts: (list) =>
    set((s) => {
      s.products = list || [];
      console.log('📦 Products set from database:', s.products.length);
      return { ...s };
    }),

  adjustStock: (id, delta) =>
    set((s) => {
      const pr = s.products.find((x) => x.id === id);
      if (pr) {
        pr.stock = (pr.stock || 0) + Number(delta || 0);
        if (pr.stock < 0) pr.stock = 0;
      }
      save(s);
      return { ...s };
    }),

  // ---------- ANNOUNCEMENTS ----------
  loadAnnouncements: async () => {
    try {
      console.log('📡 Loading announcements from database...');
      const announcements = await API.announcements.list();
      
      set((s) => {
        s.announcements = announcements || [];
        console.log('✅ Announcements loaded from database:', s.announcements.length);
        return { ...s };
      });
      
      return announcements || [];
    } catch (error) {
      console.warn('⚠️ Failed to load announcements from database:', error.message);
      set((s) => {
        s.announcements = [];
        return { ...s };
      });
      return [];
    }
  },

  addAnnouncement: async (a) => {
    try {
      console.log('📡 Creating announcement in database:', a.title);
      const result = await API.announcements.create(a);
      
      set((s) => {
        s.announcements.unshift(result);
        console.log('✅ Announcement created successfully:', result.title);
        return { ...s };
      });
      
      return result;
    } catch (error) {
      console.error('❌ Failed to create announcement in database:', error.message);
      throw new Error(`ไม่สามารถสร้างประกาศได้: ${error.message}`);
    }
  },
    // ---------- ANNOUNCEMENTS ----------
addAnnouncement: (a) =>
  set((s) => {
    a.id = s.nextIds.announcement++;
    a.publishedAt = a.publishedAt || new Date().toISOString();
    s.announcements.unshift(a);
    save(s);
    return { ...s };
  }),

updateAnnouncement: async (a) => {
  try {
    console.log('📡 Updating announcement in database:', a.id);
    const result = await API.announcements.update(a.id, a);
    
    set((s) => {
      const i = s.announcements.findIndex((x) => x.id === a.id);
      if (i > -1) {
        s.announcements[i] = result;
        console.log('✅ Announcement updated successfully:', result.title);
      }
      return { ...s };
    });
    
    return result;
  } catch (error) {
    console.error('❌ Failed to update announcement in database:', error.message);
    throw new Error(`ไม่สามารถอัพเดทประกาศได้: ${error.message}`);
  }
},

deleteAnnouncement: async (id) => {
  try {
    console.log('📡 Deleting announcement from database:', id);
    await API.announcements.delete(id);
    
    set((s) => {
      s.announcements = s.announcements.filter((x) => x.id !== id);
      console.log('✅ Announcement deleted successfully:', id);
      return { ...s };
    });
  } catch (error) {
    console.error('❌ Failed to delete announcement from database:', error.message);
    throw new Error(`ไม่สามารถลบประกาศได้: ${error.message}`);
  }
},

  deleteAnnouncement: (id) =>
    set((s) => {
      s.announcements = s.announcements.filter((x) => x.id !== id);
      save(s);
      return { ...s };
    }),

  // ---------- CART ----------
  setCartItems: (items) =>
    set((s) => {
      s.cart.items = mergeItems(items);
      save(s);
      return { ...s };
    }),

  addToCart: (item) =>
    set((s) => {
      s.cart.items = mergeItems([
        ...(s.cart.items || []),
        { ...item, qty: item.qty ?? 1 },
      ]);
      save(s);
      return { ...s };
    }),

  changeCartQty: (id, delta) =>
    set((s) => {
      const it = (s.cart.items || []).find((x) => x.id === id);
      if (it) it.qty = Math.max(1, Number(it.qty || 1) + Number(delta || 0));
      save(s);
      return { ...s };
    }),

  removeFromCart: (id) =>
    set((s) => {
      s.cart.items = (s.cart.items || []).filter((x) => x.id !== id);
      save(s);
      return { ...s };
    }),

  clearCart: () =>
    set((s) => {
      s.cart = { items: [], persons: 1, mode: "TOGETHER" };
      save(s);
      return { ...s };
    }),

  setCartPersons: (n) =>
    set((s) => {
      s.cart.persons = Math.max(1, Number(n) || 1);
      save(s);
      return { ...s };
    }),

  setCartMode: (m) =>
    set((s) => {
      s.cart.mode = m === "SPLIT" ? "SPLIT" : "TOGETHER";
      save(s);
      return { ...s };
    }),

  // ---------- ORDERS ----------
  createOrderFromCart: () =>
    set((s) => {
      if (!s.cart.items?.length) return { ...s };

      const items = JSON.parse(JSON.stringify(s.cart.items));
      const base = {
        ...DEFAULT_ORDER_META,
        persons: s.cart.persons || 1,
        splitMode: s.cart.mode === "SPLIT" ? "SPLIT" : "NONE",
      };

      const totals = computeTotalsDetailed(items);

      const order = {
        id: s.nextIds.order++,
        createdAt: new Date().toISOString(),
        items,
        ...base,
        ...totals, // subtotal, discount(0), service(0), vat(0), total
      };

      s.orders.unshift(order);
      // เคลียร์ตะกร้า
      s.cart = { items: [], persons: 1, mode: "TOGETHER" };
      save(s);
      return { ...s };
    }),

  createOrder: (payload) =>
    set((s) => {
      const merged = { ...DEFAULT_ORDER_META, ...payload };
      const totals = computeTotalsDetailed(merged.items || []);

      // เคารพ payload.total ถ้าถูกส่งมา (เช่น กำหนดเอง)
      const total = typeof merged.total === "number" ? Number(merged.total) : totals.total;

      const order = {
        id: s.nextIds.order++,
        createdAt: new Date().toISOString(),
        ...merged,
        ...totals, // subtotal, discount(0), service(0), vat(0), total
        total,
        paid: !!merged.paid,
      };

      s.orders.unshift(order);
      save(s);
      return { ...s };
    }),

  updateOrder: (order) =>
    set((s) => {
      const i = s.orders.findIndex((x) => x.id === order.id);
      if (i > -1) s.orders[i] = order;
      save(s);
      return { ...s };
    }),

  // คืนออเดอร์ปัจจุบัน (ยังไม่จ่าย) ถ้าไม่มีให้ตัวแรก หรือ null
  getCurrentOrder: () => {
    const s = get();
    return s.orders.find((o) => !o.paid) || s.orders[0] || null;
  },

  // เพิ่มการชำระเงิน + เช็คว่าจ่ายครบหรือยัง
  addPaymentToOrder: (orderId, payment) =>
    set((s) => {
      const idx = s.orders.findIndex((o) => o.id === orderId);
      if (idx === -1) return { ...s };

      const o = { ...s.orders[idx] };
      o.payments = Array.isArray(o.payments) ? [...o.payments] : [];

      const amt = Number(payment.amount || 0);
      const received = Number(payment.received || 0);
      const change =
        payment.change !== undefined
          ? Number(payment.change)
          : Math.max(0, received - amt);

      o.payments.push({
        ...payment,
        amount: amt,
        received,
        change,
        time: new Date().toISOString(),
      });

      const total =
        typeof o.total === "number"
          ? Number(o.total)
          : computeTotalsDetailed(o.items || []).total;

      const paidSoFar = o.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

      o.paid = paidSoFar >= total - 1e-6;
      if (o.paid) o.paidAt = new Date().toISOString();

      s.orders[idx] = o;
      save(s);
      return { ...s };
    }),

  // ---------- PAYMENT QR SETTINGS ----------
  setPaymentQR: (qrImage) =>
    set((s) => {
      if (!s.settings) s.settings = {};
      if (!s.settings.payment) s.settings.payment = {};
      s.settings.payment.qrImage = qrImage;
      console.log('💳 Payment QR updated:', qrImage);
      return { ...s };
    }),

  clearPaymentQR: () =>
    set((s) => {
      if (!s.settings) s.settings = {};
      if (!s.settings.payment) s.settings.payment = {};
      s.settings.payment.qrImage = "";
      console.log('🗑️ Payment QR cleared');
      return { ...s };
    }),

  setPaymentLabel: (qrLabel) =>
    set((s) => {
      if (!s.settings) s.settings = {};
      if (!s.settings.payment) s.settings.payment = {};
      s.settings.payment.qrLabel = qrLabel;
      console.log('🏷️ Payment QR label updated:', qrLabel);
      return { ...s };
    }),
}));

