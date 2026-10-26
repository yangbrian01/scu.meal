/**
 * 東吳學餐 MealFlow - 全域核心前端引擎 (app.js)
 * 自動根據網址路由決定顯示模式：
 * 1. /order/ (或 ?mode=order)            -> 學生掃碼點餐頁
 * 2. /order/?id=ORD-8f92a1c4...          -> 學生點完餐後的專屬訂單追蹤頁 (帶亂碼單號網址)
 * 3. /store/ (或 ?mode=store)            -> 店家專屬接單與 AI 分流後台 KDS
 * 4. / (根目錄入口)                       -> 系統角色分流導覽台 (方便評審測試掃碼或進入店家端)
 */

const GAS_URL = 'https://script.google.com/macros/s/AKfycbzVXQRKZfnhgM_BhW6pgy1VOCg7YmCdfnAdHOS_9Tt7agxQa2r69hwg1UGL73gpoVwp/exec';

const STORE_ICONS = {
  'S01': '🍙', 'S02': '🍱', 'S03': '🥟', 'S04': '🍗',
  'S05': '🍛', 'S06': '🥩', 'S07': '🍜'
};

const DEFAULT_STORES = [
  {
    id: 'S01', campus: '雙溪校區', name: '趙班長海苔飯捲', category: '人氣韓式・飯捲',
    maxCapacityPer15Min: 18, activeOrders: 17, avgPrepMinutes: 22,
    promoMode: 'none', promoText: '無優惠', promoDiscount: 0, predictedDailyOrders: 240, rating: 4.9,
    menus: [
      { id: 'M01', name: '特製韓式泡菜燒肉飯捲', price: 75, tag: '🔥 必點人氣' },
      { id: 'M02', name: '起司炸蝦海苔飯捲', price: 85, tag: '⭐ 主廚推薦' },
      { id: 'M03', name: '經典鮪魚玉米飯捲', price: 65, tag: '⚡ 快速出餐' }
    ]
  },
  {
    id: 'S02', campus: '雙溪校區', name: '雙溪-丼物園', category: '日式蓋飯・烏龍麵',
    maxCapacityPer15Min: 20, activeOrders: 4, avgPrepMinutes: 5,
    promoMode: 'gift', promoText: '🎁 AI分流招待：免費溫泉蛋乙顆', promoDiscount: 0, predictedDailyOrders: 165, rating: 4.7,
    menus: [
      { id: 'M04', name: '炙燒起司牛五花丼', price: 115, tag: '🔥 招牌必點' },
      { id: 'M05', name: '黃金厚切豬排滑蛋丼', price: 120, tag: '⭐ 飽足首選' },
      { id: 'M06', name: '讚岐胡麻冷烏龍麵', price: 95, tag: '⚡ 3分極速出餐' }
    ]
  },
  {
    id: 'S03', campus: '雙溪校區', name: '雙溪-四海遊龍', category: '鍋貼水餃・麵食',
    maxCapacityPer15Min: 25, activeOrders: 19, avgPrepMinutes: 16,
    promoMode: 'none', promoText: '無優惠', promoDiscount: 0, predictedDailyOrders: 210, rating: 4.6,
    menus: [
      { id: 'M07', name: '招牌鍋貼套餐 (10顆+酸辣湯)', price: 105, tag: '🔥 經典組合' },
      { id: 'M08', name: '高麗菜水餃 (12顆)', price: 78, tag: '⚡ 快速出餐' }
    ]
  },
  {
    id: 'S04', campus: '雙溪校區', name: '蒲家廚房', category: '中式特餐・便當',
    maxCapacityPer15Min: 20, activeOrders: 5, avgPrepMinutes: 6,
    promoMode: 'discount', promoText: '💰 AI分流折抵：現折 $10 元', promoDiscount: 10, predictedDailyOrders: 150, rating: 4.8,
    menus: [
      { id: 'M09', name: '秘製椒麻雞腿飯', price: 110, tag: '🔥 銷量冠軍' },
      { id: 'M10', name: '蒜泥白肉精緻便當', price: 100, tag: '⚡ 極速便當' }
    ]
  },
  {
    id: 'S05', campus: '城中校區', name: '城中-咖哩食堂', category: '熟成咖哩・炸物',
    maxCapacityPer15Min: 15, activeOrders: 16, avgPrepMinutes: 26,
    promoMode: 'none', promoText: '無優惠', promoDiscount: 0, predictedDailyOrders: 195, rating: 4.8,
    menus: [
      { id: 'M11', name: '唐揚炸雞熟成咖哩飯', price: 125, tag: '🔥 排隊人氣' },
      { id: 'M12', name: '手打漢堡排歐姆蛋咖哩', price: 135, tag: '⭐ 限量供應' }
    ]
  },
  {
    id: 'S06', campus: '城中校區', name: '城中-吳葉食堂', category: '精緻台式簡餐',
    maxCapacityPer15Min: 20, activeOrders: 3, avgPrepMinutes: 4,
    promoMode: 'gift', promoText: '🎁 AI分流招待：免費招牌冰紅茶', promoDiscount: 0, predictedDailyOrders: 145, rating: 4.9,
    menus: [
      { id: 'M13', name: '蔥爆牛肉鐵板簡餐', price: 115, tag: '🔥 現點現做' },
      { id: 'M14', name: '古早味排骨特餐', price: 105, tag: '⚡ 4分極速取餐' },
      { id: 'M15', name: '手工鮮蝦紅油抄手麵', price: 90, tag: '⭐ 學生最愛' }
    ]
  },
  {
    id: 'S07', campus: '城中校區', name: '大熊涼麵 X 吃好食堂', category: '手工涼麵・味噌湯',
    maxCapacityPer15Min: 25, activeOrders: 6, avgPrepMinutes: 3,
    promoMode: 'points', promoText: '⚡ AI分流回饋：雙倍 MealPoints 點數', promoDiscount: 0, predictedDailyOrders: 160, rating: 4.7,
    menus: [
      { id: 'M16', name: '川味麻辣雞絲涼麵 (大)', price: 75, tag: '⚡ 2分秒取' },
      { id: 'M17', name: '綜合三合一味噌湯 (貢丸+蛋花)', price: 45, tag: '🔥 絕配湯品' }
    ]
  }
];

function loadCachedOrders() {
  try {
    const raw = localStorage.getItem('mealflow_cached_orders_v3');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return [
    {
      orderId: 'ORD-8f92a1c4b7e0', pickupNumber: 'S208', storeId: 'S02', storeName: '雙溪-丼物園',
      itemsJson: JSON.stringify([{ id: 'M04', name: '炙燒起司牛五花丼', price: 115, qty: 1 }]),
      subtotal: 115, discount: 0, finalTotal: 115,
      promoApplied: '🎁 AI分流招待：免費溫泉蛋乙顆',
      pickupTimeSlot: '12:10 下課取餐', paymentMethod: 'LINE Pay', status: '製作中',
      isDivertedOrder: true, createdAt: '12:02:15'
    },
    {
      orderId: 'ORD-3d71e9a0c5b2', pickupNumber: 'C142', storeId: 'S06', storeName: '城中-吳葉食堂',
      itemsJson: JSON.stringify([{ id: 'M14', name: '古早味排骨特餐', price: 105, qty: 1 }]),
      subtotal: 105, discount: 0, finalTotal: 105,
      promoApplied: '🎁 AI分流招待：免費招牌冰紅茶',
      pickupTimeSlot: '12:25 預約取餐', paymentMethod: '現場現金付款', status: '可取餐',
      isDivertedOrder: true, createdAt: '12:00:40'
    }
  ];
}

function saveCachedOrders(orders) {
  try {
    localStorage.setItem('mealflow_cached_orders_v3', JSON.stringify(orders.slice(0, 50)));
  } catch (e) {}
}

let state = {
  routeMode: 'portal', // 'portal' | 'order' | 'ticket' | 'store'
  trackingOrderId: null,
  lastMyOrderId: localStorage.getItem('mealflow_last_my_order_id') || null,
  campus: '雙溪校區',
  filter: 'ALL',
  stores: JSON.parse(JSON.stringify(DEFAULT_STORES)),
  aiRecommendations: {},
  orders: loadCachedOrders(),
  activeStore: null,
  cart: {},
  merchantStoreId: 'S02',
  merchantPromoMode: 'gift',
  pollTimer: null
};

// ==================== 工具與路由解析 ====================
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function generateOrderToken() {
  const chars = '0123456789abcdef';
  let token = 'ORD-';
  for (let i = 0; i < 12; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

function calcPrepMinutes(activeOrders, maxCap) {
  const cap = Math.max(1, Number(maxCap) || 20);
  const act = Math.max(0, Number(activeOrders) || 0);
  const loadRatio = act / cap;
  if (act <= 2) return 3;
  const baseWait = Math.round(2 + loadRatio * 18 + (loadRatio >= 0.85 ? (loadRatio - 0.8) * 20 : 0));
  return Math.max(3, Math.min(45, baseWait));
}

/**
 * 計算專案根目錄相對路徑（相容 GitHub Pages /scu.meal/、/scu.meal/order/、/scu.meal/store/ 以及本地開啟）
 */
function getBaseRootUrl() {
  const path = window.location.pathname;
  if (path.includes('/order/') || path.endsWith('/order')) {
    return path.replace(/\/order\/?(index\.html)?$/, '/');
  }
  if (path.includes('/store/') || path.endsWith('/store')) {
    return path.replace(/\/store\/?(index\.html)?$/, '/');
  }
  return path.replace(/index\.html$/, '');
}

function getOrderPageUrl(queryStr = '') {
  const base = getBaseRootUrl();
  // 若在 file:// 協定下測試，使用 index.html?mode=order 避免資料夾開啟問題；在 http/https (GitHub Pages) 則使用真實 /order/ 網址
  if (window.location.protocol === 'file:') {
    const sep = queryStr ? '&' + queryStr.replace(/^\?/, '') : '';
    return `${base}index.html?mode=order${sep}`;
  }
  const q = queryStr ? (queryStr.startsWith('?') ? queryStr : '?' + queryStr) : '';
  return `${base}order/${q}`;
}

function getStorePageUrl(queryStr = '') {
  const base = getBaseRootUrl();
  if (window.location.protocol === 'file:') {
    const sep = queryStr ? '&' + queryStr.replace(/^\?/, '') : '';
    return `${base}index.html?mode=store${sep}`;
  }
  const q = queryStr ? (queryStr.startsWith('?') ? queryStr : '?' + queryStr) : '';
  return `${base}store/${q}`;
}

/**
 * 解析目前網址屬於哪個端點：
 * - 網址含 ?id=ORD-xxx 或 ?order=ORD-xxx -> 專屬訂單追蹤頁 ('ticket')
 * - 網址路徑含 /store 或 ?mode=store     -> 店家專屬後台 ('store')
 * - 網址路徑含 /order 或 ?mode=order     -> 學生掃碼點餐頁 ('order')
 * - 根目錄 /                            -> 角色入口導覽台 ('portal')
 */
function detectRouteFromUrl() {
  const path = window.location.pathname.toLowerCase();
  const params = new URLSearchParams(window.location.search);
  const forcedMode = window.MEALFLOW_DEFAULT_MODE || params.get('mode');
  const orderToken = params.get('id') || params.get('order');
  const campusParam = params.get('campus');
  const storeParam = params.get('store');

  if (campusParam === '雙溪校區' || campusParam === '城中校區') {
    state.campus = campusParam;
  }
  if (storeParam && state.stores.some(s => s.id === storeParam)) {
    state.merchantStoreId = storeParam;
    const st = state.stores.find(s => s.id === storeParam);
    if (st) state.campus = st.campus;
  }

  if (orderToken) {
    state.routeMode = 'ticket';
    state.trackingOrderId = orderToken;
  } else if (path.includes('/store') || forcedMode === 'store') {
    state.routeMode = 'store';
  } else if (path.includes('/order') || forcedMode === 'order') {
    state.routeMode = 'order';
  } else {
    state.routeMode = 'portal';
  }
}

/**
 * 點完餐後跳轉至專屬訂單網址 (例如 https://yangbrian01.github.io/scu.meal/order/?id=ORD-8f92a1c4b7e0)
 */
function navigateToOrderTicket(orderId) {
  state.lastMyOrderId = orderId;
  try { localStorage.setItem('mealflow_last_my_order_id', orderId); } catch (e) {}

  const targetUrl = getOrderPageUrl(`id=${encodeURIComponent(orderId)}`);
  try {
    window.history.pushState({ orderId }, '', targetUrl);
    state.routeMode = 'ticket';
    state.trackingOrderId = orderId;
    applyRouteView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) {
    window.location.href = targetUrl;
  }
}

/**
 * 從訂單追蹤頁返回繼續點餐 (/order/)
 */
function navigateToOrderMenu() {
  const targetUrl = getOrderPageUrl();
  try {
    window.history.pushState({}, '', targetUrl);
    state.routeMode = 'order';
    state.trackingOrderId = null;
    applyRouteView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) {
    window.location.href = targetUrl;
  }
}

window.addEventListener('popstate', () => {
  detectRouteFromUrl();
  applyRouteView();
});

// ==================== AI 負載計算 ====================
function enrichStoresAndAi() {
  state.stores = state.stores.map(s => {
    const cap = Math.max(1, Number(s.maxCapacityPer15Min) || 20);
    const active = Math.max(0, Number(s.activeOrders) || 0);
    const loadPct = Math.min(120, Math.round((active / cap) * 100));
    let loadState = 'FREE';
    if (loadPct >= 85) loadState = 'FULL';
    else if (loadPct >= 50) loadState = 'MODERATE';

    const avgPrep = Number(s.avgPrepMinutes) || calcPrepMinutes(active, cap);
    return {
      ...s,
      maxCapacityPer15Min: cap,
      activeOrders: active,
      avgPrepMinutes: avgPrep,
      loadPercentage: loadPct,
      loadState: loadState
    };
  });

  const recs = {};
  ['雙溪校區', '城中校區'].forEach(campus => {
    const campusStores = state.stores.filter(s => s.campus === campus);
    const congested = campusStores
      .filter(s => s.loadState === 'FULL' || s.avgPrepMinutes >= 20)
      .sort((a, b) => b.loadPercentage - a.loadPercentage || b.avgPrepMinutes - a.avgPrepMinutes);
    const availableWithPromo = campusStores
      .filter(s => s.loadState === 'FREE' && s.promoMode !== 'none')
      .sort((a, b) => a.avgPrepMinutes - b.avgPrepMinutes);

    if (congested.length > 0 && availableWithPromo.length > 0) {
      const busyStore = congested[0];
      const targetStore = availableWithPromo[0];
      recs[campus] = {
        hasAlert: true,
        congestedStoreId: busyStore.id,
        congestedStoreName: busyStore.name,
        congestedWaitMin: busyStore.avgPrepMinutes,
        congestedLoadPct: busyStore.loadPercentage,
        recommendedStoreId: targetStore.id,
        recommendedStoreName: targetStore.name,
        recommendedWaitMin: targetStore.avgPrepMinutes,
        promoMode: targetStore.promoMode,
        promoText: targetStore.promoText,
        promoDiscount: Number(targetStore.promoDiscount) || 0,
        timeSavedMin: Math.max(5, busyStore.avgPrepMinutes - targetStore.avgPrepMinutes)
      };
    } else {
      recs[campus] = { hasAlert: false };
    }
  });
  state.aiRecommendations = recs;
}

function isStorePromoActive(store) {
  return store && store.promoMode !== 'none' && store.loadState !== 'FULL';
}

function setSyncState(mode, text) {
  const dot = document.getElementById('syncDot');
  const label = document.getElementById('syncText');
  if (!dot || !label) return;
  dot.className = 'sync-dot ' + (mode === 'syncing' ? 'syncing' : mode === 'offline' ? 'offline' : '');
  label.innerText = text;
}

let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.innerText = msg;
  t.style.display = 'block';
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.display = 'none'; }, 3000);
}

// ==================== 畫面切換與自動輪詢控制 ====================
function applyRouteView() {
  enrichStoresAndAi();

  const sections = ['viewPortal', 'viewOrder', 'viewTicket', 'viewStore'];
  const mapModeToSec = {
    portal: 'viewPortal',
    order: 'viewOrder',
    ticket: 'viewTicket',
    store: 'viewStore'
  };
  const activeSec = mapModeToSec[state.routeMode] || 'viewOrder';
  sections.forEach(secId => {
    const el = document.getElementById(secId);
    if (el) el.classList.toggle('active', secId === activeSec);
  });

  // 頂部校區切換器只在「學生點餐頁」顯示
  const campusSwitcher = document.getElementById('headerCampusSwitcher');
  if (campusSwitcher) {
    campusSwitcher.style.display = state.routeMode === 'order' ? 'inline-flex' : 'none';
  }

  // 頂部副標題依路由自動切換
  const roleBadge = document.getElementById('headerRoleBadge');
  if (roleBadge) {
    if (state.routeMode === 'store') {
      roleBadge.innerText = '🏪 店家接單系統';
      roleBadge.style.background = '#111827';
      roleBadge.style.color = '#FFFFFF';
    } else if (state.routeMode === 'ticket') {
      roleBadge.innerText = '🎟️ 訂單專屬追蹤';
      roleBadge.style.background = 'var(--brand-light)';
      roleBadge.style.color = 'var(--brand-dark)';
    } else if (state.routeMode === 'order') {
      roleBadge.innerText = '📱 掃碼免排隊點餐';
      roleBadge.style.background = 'var(--brand-light)';
      roleBadge.style.color = 'var(--brand-dark)';
    } else {
      roleBadge.innerText = '⚡ 系統入口導覽';
      roleBadge.style.background = 'var(--bg-page)';
      roleBadge.style.color = 'var(--text-secondary)';
    }
  }

  if (state.routeMode === 'portal') renderPortalView();
  if (state.routeMode === 'order') renderStoreList();
  if (state.routeMode === 'ticket') renderSingleTicketView();
  if (state.routeMode === 'store') renderMerchantView();

  // 若在「專屬訂單追蹤頁」或「店家接單後台」，啟動每 8 秒背景自動同步最新狀態
  if (state.pollTimer) clearInterval(state.pollTimer);
  if (state.routeMode === 'ticket' || state.routeMode === 'store') {
    state.pollTimer = setInterval(() => {
      syncCloud(false);
    }, 8000);
  }
}

function switchCampus(campus) {
  state.campus = campus;
  document.getElementById('btnCampus-雙溪校區').classList.toggle('active', campus === '雙溪校區');
  document.getElementById('btnCampus-城中校區').classList.toggle('active', campus === '城中校區');
  renderStoreList();
}

function setFilter(f) {
  state.filter = f;
  ['ALL', 'FAST', 'PROMO'].forEach(k => {
    const el = document.getElementById('filter-' + k);
    if (el) el.classList.toggle('active', k === f);
  });
  renderStoreList();
}

// ==================== 1. 根目錄入口導覽台 (/) ====================
function renderPortalView() {
  const orderUrl = getOrderPageUrl();
  const storeUrl = getStorePageUrl();
  const sampleTicketUrl = getOrderPageUrl(`id=${encodeURIComponent(state.lastMyOrderId || 'ORD-8f92a1c4b7e0')}`);

  const box = document.getElementById('portalContentBox');
  if (!box) return;
  box.innerHTML = `
    <div style="text-align:center; padding: 18px 0 24px;">
      <div style="display:inline-block; background:var(--brand-light); color:var(--brand-dark); font-weight:800; font-size:0.78rem; padding:4px 12px; border-radius:999px; margin-bottom:10px;">
        東吳大學雙溪 / 城中校區 AI 學餐流量管制塔
      </div>
      <h1 style="font-size:1.55rem; font-weight:900; margin-bottom:8px;">請選擇要進入的系統端點</h1>
      <p style="font-size:0.88rem; color:var(--text-secondary); max-width:520px; margin:0 auto;">
        為符合真實商用掃碼點餐體驗，<strong>學生點餐端</strong>、<strong>訂單專屬取餐頁</strong>與<strong>店家廚房後台</strong>已拆分為獨立網址。
      </p>
    </div>

    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:16px; margin-bottom:20px;">
      <!-- 學生掃碼點餐端 -->
      <a href="${escapeHtml(orderUrl)}" style="text-decoration:none; color:inherit;">
        <div class="portal-card" style="border:2px solid var(--brand); background:linear-gradient(180deg, #FFFFFF 0%, #FFF9F6 100%);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <span style="font-size:2.2rem;">📱</span>
            <span class="wait-pill wait-free">學生掃碼固定網址</span>
          </div>
          <h2 style="font-size:1.18rem; font-weight:900; margin-bottom:4px;">學生掃碼點餐端</h2>
          <code style="display:block; font-size:0.76rem; color:var(--brand-dark); background:var(--brand-light); padding:5px 8px; border-radius:6px; margin-bottom:10px; word-break:break-all;">
            /scu.meal/order/
          </code>
          <p style="font-size:0.84rem; color:var(--text-secondary); margin-bottom:14px;">
            學生掃描桌上或學餐入口 QR Code 進入。無須登入帳號，AI 自動推薦免排隊優惠店家，點完餐後自動跳轉至專屬亂碼訂單網址。
          </p>
          <div class="btn-tip-action" style="text-align:center; width:100%;">進入學生點餐頁 (/order/) ➔</div>
        </div>
      </a>

      <!-- 店家接單後台端 -->
      <a href="${escapeHtml(storeUrl)}" style="text-decoration:none; color:inherit;">
        <div class="portal-card" style="border:2px solid #111827; background:#FFFFFF;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <span style="font-size:2.2rem;">🏪</span>
            <span class="wait-pill" style="background:#F3F4F6; color:#111827;">店家平板 KDS 網址</span>
          </div>
          <h2 style="font-size:1.18rem; font-weight:900; margin-bottom:4px;">店家接單與 AI 分流後台</h2>
          <code style="display:block; font-size:0.76rem; color:#111827; background:#F3F4F6; padding:5px 8px; border-radius:6px; margin-bottom:10px; word-break:break-all;">
            /scu.meal/store/
          </code>
          <p style="font-size:0.84rem; color:var(--text-secondary); margin-bottom:14px;">
            廚房專屬接單畫面。支援語音自動讀單、一鍵「🔔 通知取餐」（即時推播至學生訂單頁）、3 秒切換離峰分流優惠與評審尖峰模擬。
          </p>
          <div class="btn-tip-action" style="text-align:center; width:100%; background:#111827; box-shadow:none;">進入店家接單端 (/store/) ➔</div>
        </div>
      </a>
    </div>

    <div class="merchant-box" style="background:#F9FAFB;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div>
          <div style="font-size:0.76rem; font-weight:800; color:var(--text-secondary);">🔗 範例：點完餐後產生的專屬訂單追蹤網址</div>
          <div style="font-size:0.86rem; font-weight:700; margin-top:2px;">
            <code>/scu.meal/order/?id=${escapeHtml(state.lastMyOrderId || 'ORD-8f92a1c4b7e0')}</code>
          </div>
        </div>
        <a href="${escapeHtml(sampleTicketUrl)}" class="filter-chip" style="text-decoration:none; color:var(--text-primary); font-weight:700;">
          🎟️ 直接查看此範例取餐單 ➔
        </a>
      </div>
    </div>
  `;
}

// ==================== 2. 學生掃碼點餐頁 (/order/) ====================
function renderStoreList() {
  enrichStoresAndAi();

  // 若這台手機剛剛點過餐且該筆訂單還在「製作中/可取餐」，在頂部顯示一個貼心浮條可點回該訂單網址
  const activeBannerBox = document.getElementById('activeOrderFloatingBanner');
  if (activeBannerBox) {
    const recentOrder = state.lastMyOrderId
      ? state.orders.find(o => o.orderId === state.lastMyOrderId && o.status !== '已完成')
      : null;
    if (recentOrder) {
      const isReady = recentOrder.status === '可取餐';
      activeBannerBox.innerHTML = `
        <div class="active-order-strip ${isReady ? 'ready' : ''}" onclick="navigateToOrderTicket('${escapeHtml(recentOrder.orderId)}')">
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="strip-num">#${escapeHtml(recentOrder.pickupNumber)}</span>
            <div>
              <div style="font-weight:800; font-size:0.88rem;">
                ${isReady ? '🔔 您的餐點已可取餐！' : '🍳 您的餐點正在廚房製作中'}
              </div>
              <div style="font-size:0.75rem; opacity:0.9;">
                ${escapeHtml(recentOrder.storeName)} ・ 點擊查看專屬取餐單 (${escapeHtml(recentOrder.orderId.slice(0, 10))}...)
              </div>
            </div>
          </div>
          <span style="font-weight:800; font-size:0.82rem;">查看取餐號 ➔</span>
        </div>
      `;
    } else {
      activeBannerBox.innerHTML = '';
    }
  }

  const campusStores = state.stores.filter(s => s.campus === state.campus);
  const rec = state.aiRecommendations[state.campus];
  const tipBox = document.getElementById('aiSmartTipBox');

  if (rec && rec.hasAlert) {
    tipBox.innerHTML = `
      <div class="smart-tip-card">
        <div style="flex:1; min-width:220px;">
          <div class="smart-tip-badge">⚡ AI 流量管制塔・免排隊推薦</div>
          <div class="smart-tip-title">「${escapeHtml(rec.congestedStoreName)}」目前滿載 (${rec.congestedLoadPct}%) 需等 ${rec.congestedWaitMin} 分鐘</div>
          <div class="smart-tip-desc">
            改點 <strong>${escapeHtml(rec.recommendedStoreName)}</strong> 只要 <strong>${rec.recommendedWaitMin} 分鐘</strong>（省時 ${rec.timeSavedMin} 分），再享 <strong>${escapeHtml(rec.promoText)}</strong>
          </div>
        </div>
        <button class="btn-tip-action" onclick="openStoreMenu('${escapeHtml(rec.recommendedStoreId)}')">領優惠免排隊 ➔</button>
      </div>
    `;
  } else {
    tipBox.innerHTML = '';
  }

  let list = campusStores;
  if (state.filter === 'FAST') list = list.filter(s => s.loadState === 'FREE');
  if (state.filter === 'PROMO') list = list.filter(s => isStorePromoActive(s));

  const container = document.getElementById('storeListContainer');
  if (!container) return;
  if (list.length === 0) {
    container.innerHTML = `<p style="text-align:center; color:var(--text-muted); padding:36px 0;">目前無符合篩選條件的餐廳</p>`;
    return;
  }

  container.innerHTML = list.map(s => {
    let waitClass = 'wait-free';
    let waitText = `🟢 順暢・約 ${s.avgPrepMinutes} 分取餐`;
    let barColor = 'var(--green)';

    if (s.loadState === 'FULL') {
      waitClass = 'wait-full';
      waitText = `🔴 滿載久候 (${s.avgPrepMinutes}分)`;
      barColor = 'var(--red)';
    } else if (s.loadState === 'MODERATE') {
      waitClass = 'wait-mod';
      waitText = `🟡 適中・約 ${s.avgPrepMinutes} 分`;
      barColor = 'var(--amber)';
    }

    const icon = STORE_ICONS[s.id] || '🍱';
    const hasPromo = isStorePromoActive(s);
    const isRecTarget = rec && rec.hasAlert && rec.recommendedStoreId === s.id;

    return `
      <div class="store-card ${isRecTarget ? 'recommended' : ''}" onclick="openStoreMenu('${escapeHtml(s.id)}')">
        <div class="store-thumb">${icon}</div>
        <div class="store-info">
          <div class="store-header-row">
            <div class="store-name">${escapeHtml(s.name)}</div>
            <span class="wait-pill ${waitClass}">${waitText}</span>
          </div>
          <div class="store-meta">
            ⭐ ${s.rating} ・ ${escapeHtml(s.category)} ・ 待製 ${s.activeOrders} 單
          </div>
          <div class="load-bar-wrap">
            <div class="load-bar-fill" style="width:${Math.min(100, s.loadPercentage)}%; background:${barColor};"></div>
          </div>
          ${hasPromo ? `<div class="promo-tag">${escapeHtml(s.promoText)}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// ==================== 點餐抽屜 Modal ====================
function openStoreMenu(storeId) {
  const store = state.stores.find(s => s.id === storeId);
  if (!store) return;

  state.activeStore = store;
  state.cart = {};
  if (store.menus && store.menus.length > 0) {
    state.cart[store.menus[0].id] = 1;
  }

  document.getElementById('sheetStoreName').innerText = store.name;
  document.getElementById('sheetStoreMeta').innerText =
    `${store.campus} ・ 目前待製 ${store.activeOrders} 單（預估約 ${store.avgPrepMinutes} 分鐘取餐）`;

  const promoBanner = document.getElementById('sheetPromoBanner');
  if (isStorePromoActive(store)) {
    promoBanner.style.display = 'block';
    promoBanner.innerText = `🎉 本單已自動套用分流優惠：${store.promoText}`;
  } else {
    promoBanner.style.display = 'none';
  }

  const congestedWarn = document.getElementById('sheetCongestedWarning');
  const rec = state.aiRecommendations[store.campus];
  if (store.loadState === 'FULL' && rec && rec.hasAlert && rec.recommendedStoreId !== store.id) {
    congestedWarn.style.display = 'block';
    congestedWarn.innerHTML = `⚠️ 本店目前產能滿載 (${store.loadPercentage}%)，需等候約 ${store.avgPrepMinutes} 分鐘。建議改點「<a href="javascript:void(0)" style="color:inherit;text-decoration:underline;" onclick="openStoreMenu('${escapeHtml(rec.recommendedStoreId)}')">${escapeHtml(rec.recommendedStoreName)}</a>」僅需 ${rec.recommendedWaitMin} 分鐘並享優惠！`;
  } else {
    congestedWarn.style.display = 'none';
  }

  renderSheetMenu();
  document.getElementById('menuModal').classList.add('open');
}

function closeMenuModal() {
  document.getElementById('menuModal').classList.remove('open');
}

function changeQty(menuId, delta) {
  const cur = state.cart[menuId] || 0;
  const next = Math.max(0, cur + delta);
  if (next === 0) delete state.cart[menuId];
  else state.cart[menuId] = next;
  renderSheetMenu();
}

function renderSheetMenu() {
  const store = state.activeStore;
  if (!store) return;

  let subtotal = 0;
  const html = (store.menus || []).map(m => {
    const qty = state.cart[m.id] || 0;
    subtotal += m.price * qty;
    return `
      <div class="menu-item">
        <div>
          <div class="item-title">
            ${escapeHtml(m.name)}
            ${m.tag ? `<span class="item-tag">${escapeHtml(m.tag)}</span>` : ''}
          </div>
          <div class="item-price">$${m.price}</div>
        </div>
        <div class="qty-stepper">
          <button class="step-btn" onclick="changeQty('${escapeHtml(m.id)}', -1)">－</button>
          <span style="font-weight:800; min-width:18px; text-align:center;">${qty}</span>
          <button class="step-btn plus" onclick="changeQty('${escapeHtml(m.id)}', 1)">＋</button>
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('sheetMenuContainer').innerHTML = html;

  let discount = 0;
  const noteEl = document.getElementById('sheetDiscountNote');
  if (subtotal > 0 && isStorePromoActive(store) && store.promoMode === 'discount') {
    discount = Number(store.promoDiscount) || 10;
    noteEl.innerText = `(已折抵 -$${discount})`;
  } else {
    noteEl.innerText = '';
  }

  document.getElementById('sheetTotalPrice').innerText = `$${Math.max(0, subtotal - discount)}`;
}

/**
 * 送出訂單 -> 產生專屬亂碼 Token (ORD-xxxxxxxxxxxx) -> 跳轉至 /order/?id=ORD-xxxxxxxxxxxx
 */
async function placeOrder() {
  const store = state.activeStore;
  if (!store) return;

  const items = [];
  let subtotal = 0;
  (store.menus || []).forEach(m => {
    const q = state.cart[m.id] || 0;
    if (q > 0) {
      items.push({ id: m.id, name: m.name, price: m.price, qty: q });
      subtotal += m.price * q;
    }
  });

  if (items.length === 0) {
    showToast('⚠️ 請至少選擇一項餐點');
    return;
  }

  const btn = document.getElementById('submitOrderBtn');
  btn.disabled = true;
  btn.innerText = '⏳ 正在建立專屬取餐單...';

  const promoActive = isStorePromoActive(store);
  const discount = (promoActive && store.promoMode === 'discount') ? (Number(store.promoDiscount) || 10) : 0;
  const finalTotal = Math.max(0, subtotal - discount);
  const promoApplied = promoActive ? store.promoText : '一般預訂';
  const pickupTimeSlot = document.getElementById('pickupSlotSelect').value;
  const paymentMethod = document.getElementById('paymentSelect').value;

  // 產生一組專屬亂碼 Token 作為該筆訂單的唯一網址識別碼
  const orderId = generateOrderToken();
  const prefix = store.campus === '城中校區' ? 'C' : 'S';
  const pickupNumber = prefix + String(Math.floor(100 + Math.random() * 899));
  const nowTime = new Date().toLocaleTimeString('zh-TW', { hour12: false });

  const newOrder = {
    orderId,
    pickupNumber,
    storeId: store.id,
    storeName: store.name,
    itemsJson: JSON.stringify(items),
    subtotal,
    discount,
    finalTotal,
    promoApplied,
    pickupTimeSlot,
    paymentMethod,
    status: '製作中',
    isDivertedOrder: promoActive,
    createdAt: nowTime
  };

  try {
    setSyncState('syncing', '傳送訂單中...');
    const res = await fetch(GAS_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'submitOrder',
        orderId,
        pickupNumber,
        campus: store.campus,
        storeId: store.id,
        storeName: store.name,
        items,
        subtotal,
        discount,
        finalTotal,
        promoApplied,
        paymentMethod,
        pickupTimeSlot,
        isDivertedOrder: promoActive
      })
    });
    const data = await res.json();
    if (data && data.order) {
      // 若後端尚未更新為 v3.0 而自己產生了 orderId，也能完美無縫接軌相容
      newOrder.orderId = data.order.orderId || newOrder.orderId;
      newOrder.pickupNumber = data.order.pickupNumber || newOrder.pickupNumber;
    }
    setSyncState('online', '已同步');
  } catch (e) {
    setSyncState('offline', '離線暫存模式');
  } finally {
    btn.disabled = false;
    btn.innerText = '送出預訂・領取餐號';
  }

  state.orders.unshift(newOrder);
  saveCachedOrders(state.orders);
  store.activeOrders += 1;
  store.avgPrepMinutes = calcPrepMinutes(store.activeOrders, store.maxCapacityPer15Min);

  closeMenuModal();
  // 直接跳轉到專屬訂單亂碼網址 /order/?id=ORD-xxxxxxxxxxxx
  navigateToOrderTicket(newOrder.orderId);
  showToast(`🎉 訂單已成立！取餐號碼：${newOrder.pickupNumber}`);
}

// ==================== 3. 專屬訂單追蹤頁 (/order/?id=ORD-xxx) ====================
function renderSingleTicketView() {
  const box = document.getElementById('singleTicketContainer');
  if (!box) return;

  const orderId = state.trackingOrderId;
  const order = state.orders.find(o => String(o.orderId) === String(orderId));
  const currentFullUrl = window.location.href;

  if (!order) {
    box.innerHTML = `
      <div class="merchant-box" style="text-align:center; padding:40px 20px;">
        <div style="font-size:2.6rem; margin-bottom:10px;">🔍</div>
        <h2 style="font-size:1.2rem; font-weight:800; margin-bottom:6px;">正在雲端尋找您的訂單...</h2>
        <p style="font-size:0.86rem; color:var(--text-secondary); margin-bottom:18px;">
          訂單憑證：<code>${escapeHtml(orderId)}</code>
        </p>
        <div style="display:flex; justify-content:center; gap:10px;">
          <button class="filter-chip" onclick="syncCloud(true)">🔄 重新查詢雲端</button>
          <button class="btn-tip-action" onclick="navigateToOrderMenu()">返回點餐首頁</button>
        </div>
      </div>
    `;
    return;
  }

  let items = [];
  try { items = JSON.parse(order.itemsJson || '[]'); } catch (e) {}
  const store = state.stores.find(s => s.id === order.storeId);
  const waitMin = store ? store.avgPrepMinutes : 5;

  const isCooking = order.status === '製作中';
  const isReady = order.status === '可取餐';
  const isDone = order.status === '已完成';

  let statusHeroColor = 'var(--brand)';
  let statusHeroBg = 'var(--brand-light)';
  let statusTitle = '🍳 廚房正在為您製作餐點';
  let statusSub = `預估約 ${waitMin} 分鐘內完成，請留意畫面狀態更新`;

  if (isReady) {
    statusHeroColor = 'var(--green)';
    statusHeroBg = 'var(--green-bg)';
    statusTitle = '🔔 餐點已製作完成！請前往取餐';
    statusSub = `請直接至「${order.storeName}」免排隊快取櫃檯出示此畫面領取`;
  } else if (isDone) {
    statusHeroColor = '#4B5563';
    statusHeroBg = '#F3F4F6';
    statusTitle = '✅ 本筆訂單已完成取餐';
    statusSub = '感謝您使用東吳學餐 MealFlow 智慧分流點餐系統';
  }

  box.innerHTML = `
    <div class="ticket-tracker-card" style="border-top: 6px solid ${statusHeroColor};">
      <div style="text-align:center; padding-bottom:18px; border-bottom:1px dashed var(--border);">
        <div style="display:inline-block; background:${statusHeroBg}; color:${statusHeroColor}; font-weight:800; font-size:0.82rem; padding:5px 14px; border-radius:999px; margin-bottom:12px;">
          ${statusTitle}
        </div>
        <div style="font-size:0.8rem; color:var(--text-secondary); font-weight:700;">您的專屬取餐號碼</div>
        <div style="font-size:3.6rem; font-weight:900; color:${statusHeroColor}; line-height:1.08; letter-spacing:1px; margin:4px 0 8px;">
          ${escapeHtml(order.pickupNumber)}
        </div>
        <div style="font-size:0.84rem; color:var(--text-secondary);">${escapeHtml(statusSub)}</div>
      </div>

      <!-- 3 階段進度條 -->
      <div class="tracker-steps">
        <div class="tracker-step active">
          <div class="step-circle">✓</div>
          <div class="step-label">已送出接單</div>
        </div>
        <div class="tracker-line ${isCooking || isReady || isDone ? 'active' : ''}"></div>
        <div class="tracker-step ${isCooking || isReady || isDone ? 'active' : ''}">
          <div class="step-circle">${isReady || isDone ? '✓' : '2'}</div>
          <div class="step-label">廚房製作中</div>
        </div>
        <div class="tracker-line ${isReady || isDone ? 'active ready' : ''}"></div>
        <div class="tracker-step ${isReady || isDone ? 'active ready' : ''}">
          <div class="step-circle">🔔</div>
          <div class="step-label">可立即取餐</div>
        </div>
      </div>

      <!-- 訂單明細 -->
      <div style="background:var(--bg-page); border-radius:var(--radius-md); padding:16px; margin-top:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid var(--border);">
          <strong style="font-size:1.05rem;">${escapeHtml(order.storeName)}</strong>
          <span style="font-size:0.78rem; color:var(--text-secondary);">${escapeHtml(order.pickupTimeSlot)}</span>
        </div>

        <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:12px;">
          ${items.map(i => `
            <div style="display:flex; justify-content:space-between; font-size:0.92rem; font-weight:700;">
              <span>${escapeHtml(i.name)} × ${i.qty}</span>
              <span>$${i.price * i.qty}</span>
            </div>
          `).join('')}
        </div>

        ${order.promoApplied && order.promoApplied !== '一般預訂' ? `
          <div style="background:var(--brand-light); color:var(--brand-dark); padding:8px 10px; border-radius:8px; font-size:0.8rem; font-weight:700; margin-bottom:10px;">
            ${escapeHtml(order.promoApplied)}
          </div>
        ` : ''}

        <div style="display:flex; justify-content:space-between; align-items:center; padding-top:8px; border-top:1px solid var(--border);">
          <span style="font-size:0.82rem; color:var(--text-secondary);">付款方式：${escapeHtml(order.paymentMethod)}</span>
          <span style="font-size:1.25rem; font-weight:900; color:var(--text-primary);">總計 $${order.finalTotal}</span>
        </div>
      </div>

      <!-- 專屬亂碼網址資訊與複製按鈕 -->
      <div style="margin-top:16px; padding:12px; border:1px solid var(--border); border-radius:var(--radius-md); background:#FFFFFF;">
        <div style="font-size:0.74rem; font-weight:700; color:var(--text-secondary); margin-bottom:4px;">
          🔒 本單專屬追蹤網址（關閉網頁可隨時憑此網址查看進度）：
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <input type="text" readonly value="${escapeHtml(currentFullUrl)}" class="select-input" style="font-size:0.76rem; color:var(--text-secondary); background:var(--bg-page); flex:1;">
          <button class="filter-chip" onclick="copyOrderUrl()">📋 複製連結</button>
        </div>
      </div>

      <div style="display:flex; gap:10px; margin-top:16px;">
        <button class="filter-chip" style="flex:1; padding:12px;" onclick="navigateToOrderMenu()">← 返回學餐列表再點一單</button>
        <button class="btn-tip-action" style="padding:12px 18px;" onclick="syncCloud(true)">🔄 立即刷新狀態</button>
      </div>
    </div>
  `;
}

function copyOrderUrl() {
  try {
    navigator.clipboard.writeText(window.location.href);
    showToast('✅ 已複製本筆訂單專屬追蹤網址！');
  } catch (e) {
    showToast('請直接複製瀏覽器上方網址列');
  }
}

// ==================== 4. 店家專屬接單後台 (/store/) ====================
function initMerchantSelect() {
  const sel = document.getElementById('merchantSelect');
  if (!sel) return;
  const currentVal = sel.value || state.merchantStoreId || 'S02';
  sel.innerHTML = state.stores.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.campus)}｜${escapeHtml(s.name)}</option>`).join('');
  sel.value = state.stores.some(s => s.id === currentVal) ? currentVal : state.stores[0].id;
  state.merchantStoreId = sel.value;
}

function onMerchantStoreChange() {
  const sel = document.getElementById('merchantSelect');
  if (!sel) return;
  state.merchantStoreId = sel.value;
  const store = state.stores.find(s => s.id === state.merchantStoreId) || state.stores[0];
  if (!store) return;

  setMerchantPromo(store.promoMode || 'none', false);
  document.getElementById('merchCustomText').value = store.promoText || '';
  document.getElementById('merchActiveInput').value = store.activeOrders;
  document.getElementById('merchCapInput').value = store.maxCapacityPer15Min;
  renderMerchantOrdersOnly();
}

function renderMerchantView() {
  initMerchantSelect();
  const store = state.stores.find(s => s.id === state.merchantStoreId) || state.stores[0];
  if (!store) return;

  const predEl = document.getElementById('merchPredictLabel');
  if (predEl) {
    predEl.innerText = `🤖 AI 今日備料預測：${store.predictedDailyOrders || 160} 份｜目前負載 ${store.loadPercentage || 0}%`;
  }
  setMerchantPromo(store.promoMode || 'none', false);
  document.getElementById('merchCustomText').value = store.promoText || '';
  document.getElementById('merchActiveInput').value = store.activeOrders;
  document.getElementById('merchCapInput').value = store.maxCapacityPer15Min;

  renderMerchantOrdersOnly();
}

function renderMerchantOrdersOnly() {
  const store = state.stores.find(s => s.id === state.merchantStoreId) || state.stores[0];
  if (!store) return;

  const storeOrders = state.orders.filter(o => o.storeId === store.id);
  const pendingOrders = storeOrders.filter(o => o.status !== '已完成');
  const countEl = document.getElementById('merchActiveCount');
  if (countEl) countEl.innerText = pendingOrders.length;

  const listEl = document.getElementById('merchantOrderList');
  if (!listEl) return;
  if (storeOrders.length === 0) {
    listEl.innerHTML = '<p style="color:var(--text-muted); font-size:0.86rem; text-align:center; padding:18px;">目前無待製餐點</p>';
    return;
  }

  listEl.innerHTML = storeOrders.map(o => {
    let items = [];
    try { items = JSON.parse(o.itemsJson || '[]'); } catch (e) {}
    const itemText = items.map(i => `${i.name} x${i.qty}`).join('、');
    const isReady = o.status === '可取餐';
    const isDone = o.status === '已完成';
    const ticketLink = getOrderPageUrl(`id=${encodeURIComponent(o.orderId)}`);

    return `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid var(--border); gap:10px; flex-wrap:wrap; ${isDone ? 'opacity:0.55;' : ''}">
        <div style="flex:1; min-width:200px;">
          <a href="${escapeHtml(ticketLink)}" target="_blank" style="text-decoration:none;" title="點擊開啟此顧客的訂單追蹤頁">
            <strong style="color:var(--brand); font-size:1.05rem;">#${escapeHtml(o.pickupNumber)} 🔗</strong>
          </a>
          <span class="wait-pill ${isReady ? 'wait-free' : isDone ? '' : 'wait-mod'}" style="margin-left:6px;">${escapeHtml(o.status)}</span>
          <span style="font-weight:700; margin-left:6px;">${escapeHtml(itemText)}</span>
          <div style="font-size:0.76rem; color:var(--text-secondary); margin-top:3px;">
            憑證 <code>${escapeHtml(o.orderId)}</code> ・ ${escapeHtml(o.promoApplied)} ・ ${escapeHtml(o.pickupTimeSlot)} ・ <strong>$${o.finalTotal}</strong>
          </div>
        </div>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <button class="filter-chip" onclick="speakOrderById('${escapeHtml(o.orderId)}')">🔊 讀單</button>
          ${o.status === '製作中' ? `
            <button class="btn-tip-action" style="padding:6px 12px; font-size:0.8rem;" onclick="updateOrderStatus('${escapeHtml(o.orderId)}', '可取餐')">🔔 通知取餐</button>
          ` : ''}
          ${o.status !== '已完成' ? `
            <button class="filter-chip" style="border-color:var(--green); color:var(--green);" onclick="updateOrderStatus('${escapeHtml(o.orderId)}', '已完成')">✅ 完成結單</button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function setMerchantPromo(mode, autoFill = true) {
  state.merchantPromoMode = mode;
  ['none', 'gift', 'discount', 'points'].forEach(k => {
    const el = document.getElementById('pBtn-' + k);
    if (el) el.classList.toggle('active', k === mode);
  });
  if (autoFill) {
    const input = document.getElementById('merchCustomText');
    if (!input) return;
    if (mode === 'none') input.value = '無優惠';
    if (mode === 'gift') input.value = '🎁 AI分流招待：免費招牌冰紅茶/溫泉蛋';
    if (mode === 'discount') input.value = '💰 AI分流折抵：現折 $10 元';
    if (mode === 'points') input.value = '⚡ AI分流回饋：雙倍 MealPoints 點數';
  }
}

async function saveMerchantPromo() {
  const store = state.stores.find(s => s.id === state.merchantStoreId);
  if (!store) return;

  const newActive = Math.max(0, Number(document.getElementById('merchActiveInput').value) || 0);
  const newCap = Math.max(5, Number(document.getElementById('merchCapInput').value) || 20);

  store.promoMode = state.merchantPromoMode;
  store.promoText = document.getElementById('merchCustomText').value.trim() || '無優惠';
  store.promoDiscount = state.merchantPromoMode === 'discount' ? 10 : 0;
  store.activeOrders = newActive;
  store.maxCapacityPer15Min = newCap;
  store.avgPrepMinutes = calcPrepMinutes(newActive, newCap);

  applyRouteView();
  showToast(`✅ 已更新「${store.name}」的分流優惠與產能設定！`);

  const btn = document.getElementById('btnSaveMerchant');
  if (btn) btn.disabled = true;
  try {
    setSyncState('syncing', '儲存設定中...');
    const res = await fetch(GAS_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'updateStoreConfig',
        storeId: store.id,
        promoMode: store.promoMode,
        promoText: store.promoText,
        promoDiscount: store.promoDiscount,
        activeOrders: store.activeOrders,
        maxCapacityPer15Min: store.maxCapacityPer15Min
      })
    });
    const data = await res.json();
    if (data && data.bundle) applyCloudBundle(data.bundle);
    setSyncState('online', '已同步');
  } catch (e) {
    setSyncState('offline', '離線暫存模式');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function updateOrderStatus(orderId, newStatus) {
  const ord = state.orders.find(o => o.orderId === orderId);
  if (!ord) return;

  const oldStatus = ord.status;
  ord.status = newStatus;

  const store = state.stores.find(s => s.id === ord.storeId);
  if (store && oldStatus === '製作中' && (newStatus === '可取餐' || newStatus === '已完成') && !ord._capacityReleased) {
    ord._capacityReleased = true;
    store.activeOrders = Math.max(0, (Number(store.activeOrders) || 1) - 1);
    store.avgPrepMinutes = calcPrepMinutes(store.activeOrders, store.maxCapacityPer15Min);
  }

  saveCachedOrders(state.orders);
  applyRouteView();

  if (newStatus === '可取餐') {
    speakOrder(ord.pickupNumber, '餐點已製作完成，請至快速櫃檯取餐');
    showToast(`🔔 已通知 #${ord.pickupNumber} 取餐並同步雲端`);
  } else {
    showToast(`✅ 訂單 #${ord.pickupNumber} 已完成取餐結單`);
  }

  try {
    setSyncState('syncing', '更新訂單狀態...');
    const res = await fetch(GAS_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'updateOrderStatus',
        orderId: ord.orderId,
        newStatus: newStatus
      })
    });
    const data = await res.json();
    if (data && data.bundle) applyCloudBundle(data.bundle);
    setSyncState('online', '已同步');
  } catch (e) {
    setSyncState('offline', '離線暫存模式');
  }
}

// ==================== 評審 Demo：一鍵模擬尖峰塞車 vs 離峰順暢 ====================
async function triggerTrafficSim(mode) {
  state.stores.forEach(s => {
    if (mode === 'PEAK') {
      if (s.id === 'S01') { s.activeOrders = 18; s.avgPrepMinutes = 24; }
      else if (s.id === 'S03') { s.activeOrders = 21; s.avgPrepMinutes = 18; }
      else if (s.id === 'S05') { s.activeOrders = 16; s.avgPrepMinutes = 26; }
      else if (s.id === 'S02' || s.id === 'S06') { s.activeOrders = 3; s.avgPrepMinutes = 4; }
      else { s.activeOrders = 5; s.avgPrepMinutes = 5; }
    } else {
      s.activeOrders = 4;
      s.avgPrepMinutes = 5;
    }
  });

  applyRouteView();
  showToast(mode === 'PEAK'
    ? '🔥 已啟動「中午 12:10 尖峰塞車」情境！AI 分流引擎已觸發'
    : '🌿 已恢復全校區離峰順暢狀態！');

  try {
    setSyncState('syncing', '同步模擬情境...');
    const res = await fetch(GAS_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'simulateTraffic', mode })
    });
    const data = await res.json();
    if (data && data.bundle) applyCloudBundle(data.bundle);
    setSyncState('online', '已同步');
  } catch (e) {
    setSyncState('offline', '離線模擬模式');
  }
}

// ==================== 語音讀單 ====================
function speakOrderById(orderId) {
  const ord = state.orders.find(o => o.orderId === orderId);
  if (!ord) return;
  let items = [];
  try { items = JSON.parse(ord.itemsJson || '[]'); } catch (e) {}
  const itemText = items.map(i => `${i.name} ${i.qty} 份`).join('，');
  speakOrder(ord.pickupNumber, `${itemText}，${ord.promoApplied}`);
}

function speakOrder(pickupNo, text) {
  if (!('speechSynthesis' in window)) {
    showToast('⚠️ 您的瀏覽器不支援語音合成');
    return;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(`取餐號 ${pickupNo}，${text}`);
  u.lang = 'zh-TW';
  window.speechSynthesis.speak(u);
}

function speakSample() {
  speakOrder('S208', '炙燒起司牛五花丼一份，AI分流招待免費溫泉蛋乙顆');
  showToast('🔊 正在播放廚房語音讀單');
}

// ==================== 雲端同步 ====================
function applyCloudBundle(bundle) {
  if (!bundle) return;
  if (Array.isArray(bundle.stores) && bundle.stores.length > 0) {
    state.stores = bundle.stores;
  }
  if (Array.isArray(bundle.orders) && bundle.orders.length > 0) {
    const cloudIds = new Set(bundle.orders.map(o => o.orderId));
    const localUnsynced = state.orders.filter(o => !cloudIds.has(o.orderId));
    state.orders = [...localUnsynced, ...bundle.orders];
    saveCachedOrders(state.orders);
  }
  applyRouteView();
}

async function syncCloud(showFeedback = false) {
  try {
    setSyncState('syncing', '同步中...');
    const res = await fetch(GAS_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'initBundle' })
    });
    const data = await res.json();
    if (data && data.bundle) {
      applyCloudBundle(data.bundle);
      setSyncState('online', '已同步');
      if (showFeedback) showToast('🔄 已與雲端資料庫同步最新狀態');
    }
  } catch (e) {
    setSyncState('offline', '離線模式');
    if (showFeedback) showToast('⚠️ 目前使用本機快取資料展示');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  detectRouteFromUrl();
  applyRouteView();
  syncCloud(false);
});
