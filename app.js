/**
 * 東吳學餐 MealFlow v5.0 - 全功能商用線上點餐 + 購物車抽屜 + 專業櫃檯 POS + 真實菜單 CRUD + AI 視覺菜單掃描匯入
 */

const GAS_URL = 'https://script.google.com/macros/s/AKfycbzVXQRKZfnhgM_BhW6pgy1VOCg7YmCdfnAdHOS_9Tt7agxQa2r69hwg1UGL73gpoVwp/exec';

const STORE_ICONS = {
  'S01': '🍙', 'S02': '🍱', 'S03': '🥟', 'S04': '🍗',
  'S05': '🍛', 'S06': '🥩', 'S07': '🍜'
};

// 預設客製化選項模板
function getStdRiceOptions() {
  return {
    '主食份量': { type: 'radio', choices: [['正常飯量', 0], ['飯少(減醣)', 0], ['大盛加飯', 10]] },
    '辣度選擇': { type: 'radio', choices: [['不辣', 0], ['微辣', 0], ['小辣', 0], ['中辣', 0]] },
    '人氣加料': { type: 'checkbox', choices: [['加香濃起司', 15], ['加溏心溫泉蛋', 15], ['不要蔥花/香菜', 0]] }
  };
}

function getStdNoodleOptions() {
  return {
    '麵條份量': { type: 'radio', choices: [['標準份量', 0], ['加麵大碗', 15]] },
    '辣度選擇': { type: 'radio', choices: [['不辣', 0], ['小辣', 0], ['大辣', 0]] },
    '單點加料': { type: 'checkbox', choices: [['加滷蛋', 15], ['加貢丸(2顆)', 15], ['不要蔥花', 0]] }
  };
}

function getDumplingBafangOptions(unitPrice = 7) {
  return {
    '選擇顆數': {
      type: 'radio',
      choices: [
        ['8顆', unitPrice * 8],
        ['10顆', unitPrice * 10],
        ['12顆', unitPrice * 12],
        ['15顆', unitPrice * 15]
      ]
    },
    '醬料包選擇': {
      type: 'checkbox',
      choices: [['蒜泥醬油膏', 0], ['特製辣椒醬', 0], ['白醋', 0], ['環保免醬料', 0]]
    }
  };
}

const DEFAULT_STORES = [
  {
    id: 'S01', campus: '雙溪校區', name: '趙班長海苔飯捲', category: '人氣韓式・飯捲',
    maxCapacityPer15Min: 18, activeOrders: 17, avgPrepMinutes: 22,
    promoMode: 'none', promoText: '無優惠', promoDiscount: 0, predictedDailyOrders: 240, rating: 4.9,
    menus: [
      { id: 'M01', category: '韓式海苔飯捲', name: '特製韓式泡菜燒肉飯捲', price: 75, tag: '🔥 必點人氣', isBafangMode: false, image: '', options: getStdRiceOptions() },
      { id: 'M02', category: '韓式海苔飯捲', name: '起司炸蝦海苔飯捲', price: 85, tag: '⭐ 主廚推薦', isBafangMode: false, image: '', options: getStdRiceOptions() },
      { id: 'M03', category: '韓式海苔飯捲', name: '經典鮪魚玉米飯捲', price: 65, tag: '⚡ 快速出餐', isBafangMode: false, image: '', options: getStdRiceOptions() },
      { id: 'M18', category: '韓式湯品與飲品', name: '釜山魚板蘿蔔湯', price: 35, tag: '🥣 暖胃湯品', isBafangMode: false, image: '', options: {} },
      { id: 'M22', category: '韓式湯品與飲品', name: '韓國水蜜桃果粒飲', price: 40, tag: '🥤 人氣飲品', isBafangMode: false, image: '', options: { '冰塊調整': { type: 'radio', choices: [['正常冰', 0], ['去冰', 0]] } } }
    ]
  },
  {
    id: 'S02', campus: '雙溪校區', name: '雙溪-丼物園', category: '日式蓋飯・烏龍麵',
    maxCapacityPer15Min: 20, activeOrders: 4, avgPrepMinutes: 5,
    promoMode: 'gift', promoText: '🎁 AI分流招待：免費溫泉蛋乙顆', promoDiscount: 0, predictedDailyOrders: 165, rating: 4.7,
    menus: [
      { id: 'M04', category: '炙燒日式丼飯', name: '炙燒起司牛五花丼', price: 115, tag: '🔥 招牌必點', isBafangMode: false, image: '', options: getStdRiceOptions() },
      { id: 'M05', category: '炙燒日式丼飯', name: '黃金厚切豬排滑蛋丼', price: 120, tag: '⭐ 飽足首選', isBafangMode: false, image: '', options: getStdRiceOptions() },
      { id: 'M06', category: '讚岐烏龍麵', name: '讚岐胡麻冷烏龍麵', price: 95, tag: '⚡ 3分極速出餐', isBafangMode: false, image: '', options: getStdNoodleOptions() },
      { id: 'M19', category: '單點炸物與茶飲', name: '日式唐揚炸雞 (5塊)', price: 55, tag: '🍗 人氣單點', isBafangMode: false, image: '', options: { '調味粉': { type: 'radio', choices: [['原味胡椒', 0], ['日式七味粉', 0], ['泰式酸辣醬', 5]] } } },
      { id: 'M23', category: '單點炸物與茶飲', name: '靜岡無糖玄米綠茶', price: 30, tag: '🍵 解膩首選', isBafangMode: false, image: '', options: {} }
    ]
  },
  {
    id: 'S03', campus: '雙溪校區', name: '雙溪-四海遊龍', category: '鍋貼水餃・麵食',
    maxCapacityPer15Min: 25, activeOrders: 19, avgPrepMinutes: 16,
    promoMode: 'none', promoText: '無優惠', promoDiscount: 0, predictedDailyOrders: 210, rating: 4.6,
    menus: [
      { id: 'M07', category: '招牌鍋貼 (八方計價模式)', name: '招牌脆皮鍋貼', price: 7, tag: '🔥 按顆計價', isBafangMode: true, image: '', options: getDumplingBafangOptions(7) },
      { id: 'M08', category: '手工水餃 (八方計價模式)', name: '高麗菜鮮肉水餃', price: 7, tag: '⚡ 按顆計價', isBafangMode: true, image: '', options: getDumplingBafangOptions(7) },
      { id: 'M24', category: '開胃小菜與湯飲', name: '招牌酸辣湯', price: 35, tag: '🥣 經典絕配', isBafangMode: false, image: '', options: { '胡椒與醋': { type: 'radio', choices: [['正常', 0], ['加辣油', 0], ['不加蔥香菜', 0]] } } },
      { id: 'M20', category: '開胃小菜與湯飲', name: '非基改冰鎮豆漿', price: 25, tag: '🥛 清涼飲品', isBafangMode: false, image: '', options: { '甜度': { type: 'radio', choices: [['微糖', 0], ['無糖', 0]] } } }
    ]
  },
  {
    id: 'S04', campus: '雙溪校區', name: '蒲家廚房', category: '中式特餐・便當',
    maxCapacityPer15Min: 20, activeOrders: 5, avgPrepMinutes: 6,
    promoMode: 'discount', promoText: '💰 AI分流折抵：現折 $10 元', promoDiscount: 10, predictedDailyOrders: 150, rating: 4.8,
    menus: [
      { id: 'M09', category: '人氣特餐便當', name: '秘製椒麻雞腿飯 (含3配菜)', price: 110, tag: '🔥 銷量冠軍', isBafangMode: false, image: '', options: getStdRiceOptions() },
      { id: 'M10', category: '人氣特餐便當', name: '蒜泥白肉精緻便當 (含3配菜)', price: 100, tag: '⚡ 極速便當', isBafangMode: false, image: '', options: getStdRiceOptions() },
      { id: 'M21', category: '單點小菜與湯品', name: '黃金脆皮炸豆腐', price: 40, tag: '✨ 招牌小菜', isBafangMode: false, image: '', options: {} }
    ]
  },
  {
    id: 'S05', campus: '城中校區', name: '城中-咖哩食堂', category: '熟成咖哩・炸物',
    maxCapacityPer15Min: 15, activeOrders: 16, avgPrepMinutes: 26,
    promoMode: 'none', promoText: '無優惠', promoDiscount: 0, predictedDailyOrders: 195, rating: 4.8,
    menus: [
      { id: 'M11', category: '熟成濃咖哩', name: '唐揚炸雞熟成咖哩飯', price: 125, tag: '🔥 排隊人氣', isBafangMode: false, image: '', options: getStdRiceOptions() },
      { id: 'M12', category: '熟成濃咖哩', name: '手打漢堡排歐姆蛋咖哩', price: 135, tag: '⭐ 限量供應', isBafangMode: false, image: '', options: getStdRiceOptions() },
      { id: 'M26', category: '炸物點心', name: '酥炸莫札瑞拉起司條 (3入)', price: 50, tag: '🧀 邪惡點心', isBafangMode: false, image: '', options: {} }
    ]
  },
  {
    id: 'S06', campus: '城中校區', name: '城中-吳葉食堂', category: '精緻台式簡餐',
    maxCapacityPer15Min: 20, activeOrders: 3, avgPrepMinutes: 4,
    promoMode: 'gift', promoText: '🎁 AI分流招待：免費招牌冰紅茶', promoDiscount: 0, predictedDailyOrders: 145, rating: 4.9,
    menus: [
      { id: 'M13', category: '主廚鐵板與簡餐', name: '蔥爆牛肉鐵板簡餐', price: 115, tag: '🔥 現點現做', isBafangMode: false, image: '', options: getStdRiceOptions() },
      { id: 'M14', category: '主廚鐵板與簡餐', name: '古早味排骨特餐', price: 105, tag: '⚡ 4分極速取餐', isBafangMode: false, image: '', options: getStdRiceOptions() },
      { id: 'M15', category: '特色麵食', name: '手工鮮蝦紅油抄手麵', price: 90, tag: '⭐ 學生最愛', isBafangMode: false, image: '', options: getStdNoodleOptions() }
    ]
  },
  {
    id: 'S07', campus: '城中校區', name: '大熊涼麵 X 吃好食堂', category: '手工涼麵・味噌湯',
    maxCapacityPer15Min: 25, activeOrders: 6, avgPrepMinutes: 3,
    promoMode: 'points', promoText: '⚡ AI分流回饋：雙倍 MealPoints 點數', promoDiscount: 0, predictedDailyOrders: 160, rating: 4.7,
    menus: [
      { id: 'M16', category: '手工現拌涼麵', name: '川味麻辣雞絲涼麵 (大)', price: 75, tag: '⚡ 2分秒取', isBafangMode: false, image: '', options: getStdNoodleOptions() },
      { id: 'M17', category: '招牌味噌湯品', name: '綜合三合一味噌湯 (貢丸+蛋花)', price: 45, tag: '🔥 絕配湯品', isBafangMode: false, image: '', options: {} }
    ]
  }
];

function loadLocalStores() {
  try {
    const saved = localStorage.getItem('mealflow_stores_v5');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return JSON.parse(JSON.stringify(DEFAULT_STORES));
}

function saveLocalStores(stores) {
  try {
    localStorage.setItem('mealflow_stores_v5', JSON.stringify(stores));
  } catch (e) {}
}

function loadCachedOrders() {
  try {
    const raw = localStorage.getItem('mealflow_orders_v5');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return [
    {
      orderId: 'ORD-8f92a1c4b7e0', pickupNumber: 'S208', storeId: 'S02', storeName: '雙溪-丼物園',
      studentId: '📱 掃碼點餐', studentName: '外帶自取',
      itemsJson: JSON.stringify([{ id: 'M04', name: '炙燒起司牛五花丼', price: 125, qty: 1, selections: { '主食份量': '大盛加飯', '辣度選擇': '小辣' } }]),
      subtotal: 125, discount: 0, finalTotal: 125,
      promoApplied: '🎁 AI分流招待：免費溫泉蛋乙顆',
      pickupTimeSlot: '立即製作 (約5分鐘)', paymentMethod: 'LINE Pay', status: '製作中',
      isDivertedOrder: true, createdAt: '12:02:15'
    }
  ];
}

function saveCachedOrders(orders) {
  try {
    localStorage.setItem('mealflow_orders_v5', JSON.stringify(orders.slice(0, 60)));
  } catch (e) {}
}

let state = {
  routeMode: 'portal', // 'portal' | 'order' | 'ticket' | 'store'
  trackingOrderId: null,
  myCreatedOrderId: sessionStorage.getItem('mealflow_my_created_order_id') || null,
  campus: '雙溪校區',
  filter: 'ALL',
  stores: loadLocalStores(),
  aiRecommendations: {},
  orders: loadCachedOrders(),

  // 學生點餐狀態：支援「餐廳總覽列表 (null)」與「進入指定餐廳點餐畫面 (storeId)」
  selectedStoreId: null,
  cartItems: [], // [{ id, name, basePrice, price, qty, isBafangMode, selections: {} }]
  configuringItem: null,
  editingCartIndex: -1,
  isPosConfiguring: false, // 區分這顆 options-modal 是給學生購物車還是店家櫃檯 POS 用的
  checkoutDineType: '外帶自取',
  checkoutTableNo: 'A1',
  checkoutTimeMode: 'NOW', // 'NOW' (現場立即製作) | 'RESERVE' (課間預約取餐)
  checkoutReserveTime: '12:10',
  checkoutPayMethod: 'LINE Pay',
  checkoutNote: '',

  // 店家後台 (/store/) 四大分頁：'pos' | 'kds' | 'menu' | 'promo'
  storeTabMode: 'pos',
  merchantStoreId: 'S02',
  merchantPromoMode: 'gift',

  // 店家櫃檯 POS 狀態
  posCategoryFilter: 'ALL',
  posCart: [], // [{ id, name, price, qty, selections: {} }]
  posDineType: '內用',
  posTableNo: '內用1桌',
  posCashReceived: '',

  // 店家菜單管理與 AI 掃描狀態
  adminMenuData: [],
  isMenuDirty: false,
  editingMenuIndex: -1,
  currentEditOptions: {},
  aiScannedItems: [],
  aiScanImageDataUrl: '',

  geminiApiKey: localStorage.getItem('mealflow_gemini_key') || '',
  pollTimer: null
};

// ==================== 工具與 M/M/1 佇列效用演算法 ====================
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
  for (let i = 0; i < 12; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
  return token;
}

function calcPrepMinutes(activeOrders, maxCap) {
  const cap = Math.max(5, Number(maxCap) || 20);
  const act = Math.max(0, Number(activeOrders) || 0);
  const serviceRatePerMin = cap / 15;
  const loadRatio = act / cap;
  if (act <= 1) return 3;
  const queueTime = act / serviceRatePerMin;
  const congestionPenalty = loadRatio >= 0.85 ? Math.pow((loadRatio - 0.75) * 10, 1.5) : 0;
  const est = Math.round(2 + queueTime * 0.85 + congestionPenalty);
  return Math.max(3, Math.min(45, est));
}

function calcAiUtilityScore(store) {
  const waitScore = Math.max(0, 100 - (Number(store.avgPrepMinutes) || 5) * 3.4);
  let promoBonus = 0;
  if (store.promoMode === 'discount') promoBonus = 95;
  else if (store.promoMode === 'gift') promoBonus = 90;
  else if (store.promoMode === 'points') promoBonus = 75;
  const ratingScore = ((Number(store.rating) || 4.7) / 5.0) * 100;
  const raw = waitScore * 0.55 + promoBonus * 0.25 + ratingScore * 0.20;
  return Math.max(35, Math.min(99, Math.round(raw)));
}

/**
 * 確保每道菜都有完整的 category 與 options 結構
 */
function normalizeMenuItem(m, fallbackStoreId) {
  let opts = m.options || {};
  if (typeof opts === 'string') {
    try { opts = JSON.parse(opts); } catch (e) { opts = {}; }
  }
  // 若從舊版 Google Sheet 讀回來沒有 options，自動補上預設客製化選項
  const hasOpts = opts && Object.keys(opts).length > 0;
  const nameStr = String(m.name || '');
  let isBafang = Boolean(m.isBafangMode);

  if (!hasOpts) {
    if (nameStr.includes('鍋貼') || nameStr.includes('水餃')) {
      opts = getDumplingBafangOptions(Number(m.price) <= 15 ? Number(m.price) : 7);
      if (Number(m.price) <= 15) isBafang = true;
    } else if (nameStr.includes('麵') || nameStr.includes('抄手')) {
      opts = getStdNoodleOptions();
    } else if (nameStr.includes('飯') || nameStr.includes('丼') || nameStr.includes('便當') || nameStr.includes('咖哩') || nameStr.includes('簡餐') || nameStr.includes('特餐')) {
      opts = getStdRiceOptions();
    }
  }

  return {
    id: String(m.id || `M-${Date.now()}-${Math.floor(Math.random()*1000)}`),
    storeId: String(m.storeId || fallbackStoreId || 'S02'),
    category: String(m.category || m.cat || '招牌主餐'),
    name: nameStr,
    price: Number(m.price) || 0,
    tag: String(m.tag || ''),
    isBafangMode: isBafang,
    image: String(m.image || ''),
    options: opts
  };
}

function enrichStoresAndAi() {
  state.stores = state.stores.map(s => {
    const defStore = DEFAULT_STORES.find(d => d.id === s.id);
    const rawMenus = (s.menus && s.menus.length > 0) ? s.menus : (defStore ? defStore.menus : []);
    const normalizedMenus = rawMenus.map(m => normalizeMenuItem(m, s.id));

    const cap = Math.max(5, Number(s.maxCapacityPer15Min) || 20);
    const active = Math.max(0, Number(s.activeOrders) || 0);
    const loadPct = Math.min(120, Math.round((active / cap) * 100));
    let loadState = 'FREE';
    if (loadPct >= 85) loadState = 'FULL';
    else if (loadPct >= 50) loadState = 'MODERATE';

    const avgPrep = Number(s.avgPrepMinutes) || calcPrepMinutes(active, cap);
    const obj = {
      ...s,
      maxCapacityPer15Min: cap,
      activeOrders: active,
      avgPrepMinutes: avgPrep,
      loadPercentage: loadPct,
      loadState: loadState,
      menus: normalizedMenus
    };
    obj.aiScore = calcAiUtilityScore(obj);
    return obj;
  });

  const recs = {};
  ['雙溪校區', '城中校區'].forEach(campus => {
    const campusStores = state.stores.filter(s => s.campus === campus);
    const congested = campusStores
      .filter(s => s.loadState === 'FULL' || s.avgPrepMinutes >= 20)
      .sort((a, b) => b.loadPercentage - a.loadPercentage || b.avgPrepMinutes - a.avgPrepMinutes);
    const availableWithPromo = campusStores
      .filter(s => s.loadState === 'FREE' && s.promoMode !== 'none')
      .sort((a, b) => b.aiScore - a.aiScore);

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
        recommendedAiScore: targetStore.aiScore,
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

// ==================== 網址路由控制 ====================
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

function detectRouteFromUrl() {
  const path = window.location.pathname.toLowerCase();
  const params = new URLSearchParams(window.location.search);
  const forcedMode = window.MEALFLOW_DEFAULT_MODE || window.MEALFLOW_FORCED_ROUTE || params.get('mode');
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
    // 若在學生端帶 ?store=S02，直接進入該餐廳菜單頁！
    if (!path.includes('/store') && forcedMode !== 'store') {
      state.selectedStoreId = storeParam;
    }
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

function navigateToOrderTicket(orderId) {
  state.myCreatedOrderId = orderId;
  try { sessionStorage.setItem('mealflow_my_created_order_id', orderId); } catch (e) {}

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

function navigateToOrderMenu(storeId = null) {
  state.selectedStoreId = storeId;
  const q = storeId ? `store=${encodeURIComponent(storeId)}` : '';
  const targetUrl = getOrderPageUrl(q);
  try {
    window.history.pushState({ storeId }, '', targetUrl);
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

// ==================== 主視圖切換 ====================
function applyRouteView() {
  enrichStoresAndAi();

  const mainContainer = document.querySelector('main.container');
  if (mainContainer) {
    mainContainer.classList.toggle('wide-pos', state.routeMode === 'store');
  }

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

  // 底部懸浮購物車只在「學生進入餐廳點餐畫面」顯示
  const floatingCart = document.getElementById('floatingCartBar');
  if (floatingCart) {
    floatingCart.style.display = (state.routeMode === 'order' && state.selectedStoreId) ? 'block' : 'none';
  }

  const campusSwitcher = document.getElementById('headerCampusSwitcher');
  if (campusSwitcher) {
    campusSwitcher.style.display = (state.routeMode === 'order' && !state.selectedStoreId) ? 'inline-flex' : 'none';
  }

  const roleBadge = document.getElementById('headerRoleBadge');
  if (roleBadge) {
    if (state.routeMode === 'store') {
      roleBadge.innerText = '🏪 店家 POS 收銀 & 菜單後台';
      roleBadge.style.background = '#111827';
      roleBadge.style.color = '#FFFFFF';
    } else if (state.routeMode === 'ticket') {
      roleBadge.innerText = '🎟️ 訂單專屬追蹤憑證';
      roleBadge.style.background = 'var(--brand-light)';
      roleBadge.style.color = 'var(--brand-dark)';
    } else if (state.routeMode === 'order') {
      roleBadge.innerText = '📱 線上點餐系統';
      roleBadge.style.background = 'var(--brand-light)';
      roleBadge.style.color = 'var(--brand-dark)';
    } else {
      roleBadge.innerText = '⚡ 系統入口導覽';
      roleBadge.style.background = 'var(--bg-page)';
      roleBadge.style.color = 'var(--text-secondary)';
    }
  }

  if (state.routeMode === 'portal') renderPortalView();
  if (state.routeMode === 'order') renderStudentOrderExperience();
  if (state.routeMode === 'ticket') renderSingleTicketView();
  if (state.routeMode === 'store') renderMerchantView();

  if (state.pollTimer) clearInterval(state.pollTimer);
  if (state.routeMode === 'ticket' || state.routeMode === 'store') {
    state.pollTimer = setInterval(() => {
      syncCloud(false);
    }, 9000);
  }
}

function switchCampus(campus) {
  state.campus = campus;
  state.selectedStoreId = null;
  document.getElementById('btnCampus-雙溪校區').classList.toggle('active', campus === '雙溪校區');
  document.getElementById('btnCampus-城中校區').classList.toggle('active', campus === '城中校區');
  applyRouteView();
}

function setFilter(f) {
  state.filter = f;
  ['ALL', 'FAST', 'PROMO'].forEach(k => {
    const el = document.getElementById('filter-' + k);
    if (el) el.classList.toggle('active', k === f);
  });
  renderStudentOrderExperience();
}

// ==================== 1. 根目錄入口導覽台 (/) ====================
function renderPortalView() {
  const orderUrl = getOrderPageUrl();
  const storeUrl = getStorePageUrl();
  const sampleTicketUrl = getOrderPageUrl('id=ORD-8f92a1c4b7e0');

  const box = document.getElementById('portalContentBox');
  if (!box) return;
  box.innerHTML = `
    <div style="text-align:center; padding: 14px 0 22px;">
      <div style="display:inline-block; background:#EEF2FF; color:#4338CA; font-weight:800; font-size:0.78rem; padding:4px 12px; border-radius:999px; margin-bottom:10px;">
        🧠 M/M/1 佇列模型 × Gemini Vision AI 菜單掃描 × 商用 POS 系統
      </div>
      <h1 style="font-size:1.55rem; font-weight:900; margin-bottom:8px;">東吳學餐 MealFlow 智慧點餐與 POS 管制塔</h1>
      <p style="font-size:0.86rem; color:var(--text-secondary); max-width:580px; margin:0 auto;">
        整合<strong>學生線上掃碼點餐 (<code>/order/</code>)</strong>、<strong>點完餐跳轉的亂碼憑證網址 (<code>?id=ORD-xxx</code>)</strong>與<strong>店家櫃檯 POS 收銀 + AI 掃描菜單管理後台 (<code>/store/</code>)</strong>。
      </p>
    </div>

    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:16px; margin-bottom:20px;">
      <a href="${escapeHtml(orderUrl)}" style="text-decoration:none; color:inherit;">
        <div class="portal-card" style="border:2px solid var(--brand); background:linear-gradient(180deg, #FFFFFF 0%, #FFF9F6 100%);">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <span style="font-size:2.2rem;">📱</span>
              <span class="wait-pill wait-free">學生 QR 掃碼點餐網址</span>
            </div>
            <h2 style="font-size:1.18rem; font-weight:900; margin-bottom:4px;">學生掃碼點餐端</h2>
            <code style="display:block; font-size:0.76rem; color:var(--brand-dark); background:var(--brand-light); padding:5px 8px; border-radius:6px; margin-bottom:10px;">
              /scu.meal/order/
            </code>
            <p style="font-size:0.84rem; color:var(--text-secondary); margin-bottom:14px;">
              分類菜單瀏覽、單選/多選/八方按顆計價客製化彈窗、底部懸浮購物車抽屜 (✎ 編輯選項 / 🗑️ 移除) 與現場/預約取餐結帳。
            </p>
          </div>
          <div class="btn-tip-action" style="text-align:center; width:100%;">進入學生掃碼點餐 (/order/) ➔</div>
        </div>
      </a>

      <a href="${escapeHtml(storeUrl)}" style="text-decoration:none; color:inherit;">
        <div class="portal-card" style="border:2px solid #111827; background:#FFFFFF;">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <span style="font-size:2.2rem;">🖥️</span>
              <span class="wait-pill" style="background:#F3F4F6; color:#111827;">店家平板 POS + 菜單管理</span>
            </div>
            <h2 style="font-size:1.18rem; font-weight:900; margin-bottom:4px;">店家櫃檯 POS & AI 菜單管理後台</h2>
            <code style="display:block; font-size:0.76rem; color:#111827; background:#F3F4F6; padding:5px 8px; border-radius:6px; margin-bottom:10px;">
              /scu.meal/store/
            </code>
            <p style="font-size:0.84rem; color:var(--text-secondary); margin-bottom:14px;">
              包含：1. 商用深色雙欄 POS 收銀機、2. 廚房 KDS 語音出單、3. <strong>📸 AI 掃描菜單一鍵匯入 + 手動菜單編輯器</strong>、4. AI 動態分流設定。
            </p>
          </div>
          <div class="btn-tip-action" style="text-align:center; width:100%; background:#111827; box-shadow:none;">進入店家 POS 與後台 (/store/) ➔</div>
        </div>
      </a>
    </div>

    <div class="merchant-box" style="background:#FFFFFF;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div>
          <div style="font-size:0.76rem; font-weight:800; color:var(--text-secondary);">🔗 範例：點完餐後跳轉的專屬訂單追蹤網址</div>
          <div style="font-size:0.86rem; font-weight:700; margin-top:2px;">
            <code>/scu.meal/order/?id=ORD-8f92a1c4b7e0</code>
          </div>
        </div>
        <a href="${escapeHtml(sampleTicketUrl)}" class="filter-chip" style="text-decoration:none; color:var(--text-primary);">
          🎟️ 查看範例電子取餐單 ➔
        </a>
      </div>
    </div>
  `;
}

// ==================== 2. 學生掃碼點餐頁 (/order/)：支援「學餐總覽」與「進入餐廳分類點餐」 ====================
function enterStoreOrdering(storeId, autoOpenMenuId = null) {
  const store = state.stores.find(s => s.id === storeId);
  if (!store) return;

  // 若切換了不同餐廳，且購物車裡有別家店的餐點，先提醒或清空購物車
  if (state.selectedStoreId && state.selectedStoreId !== storeId && state.cartItems.length > 0) {
    if (!window.confirm(`您的購物車內還有上一家餐廳的餐點，切換至「${store.name}」將會清空購物車，確定要切換嗎？`)) {
      return;
    }
    state.cartItems = [];
  }

  state.selectedStoreId = storeId;
  state.campus = store.campus;
  applyRouteView();
  updateCartUI();
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (autoOpenMenuId) {
    setTimeout(() => handleMenuItemClick(autoOpenMenuId, false), 150);
  }
}

function backToStoreDirectory() {
  state.selectedStoreId = null;
  applyRouteView();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderStudentOrderExperience() {
  enrichStoresAndAi();

  // 檢查本機是否有剛送出的進行中訂單
  const activeBannerBox = document.getElementById('activeOrderFloatingBanner');
  if (activeBannerBox) {
    const myOrder = state.myCreatedOrderId
      ? state.orders.find(o => o.orderId === state.myCreatedOrderId && o.status !== '已完成')
      : null;
    if (myOrder) {
      const isReady = myOrder.status === '可取餐';
      activeBannerBox.innerHTML = `
        <div class="active-order-strip ${isReady ? 'ready' : ''}" onclick="navigateToOrderTicket('${escapeHtml(myOrder.orderId)}')">
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="strip-num">#${escapeHtml(myOrder.pickupNumber)}</span>
            <div>
              <div style="font-weight:800; font-size:0.88rem;">
                ${isReady ? '🔔 您剛點的餐點已可取餐！' : '🍳 您剛點的餐點正在廚房製作中'}
              </div>
              <div style="font-size:0.74rem; opacity:0.9;">
                ${escapeHtml(myOrder.storeName)} ・ 點此返回您的專屬號碼牌 (${escapeHtml(myOrder.orderId)})
              </div>
            </div>
          </div>
          <span style="font-weight:800; font-size:0.82rem;">查看取餐單 ➔</span>
        </div>
      `;
    } else {
      activeBannerBox.innerHTML = '';
    }
  }

  const directoryBlock = document.getElementById('storeDirectoryBlock');
  const inStoreBlock = document.getElementById('inStoreOrderingBlock');
  if (!directoryBlock || !inStoreBlock) return;

  // 若尚未選擇餐廳 -> 顯示學餐店家列表與 AI 選餐顧問
  if (!state.selectedStoreId) {
    directoryBlock.style.display = 'block';
    inStoreBlock.style.display = 'none';
    renderStoreDirectoryList();
  } else {
    // 已進入指定餐廳 -> 顯示如同參考程式般的「分類展開菜單 + 客製化彈窗 + 底部購物車」
    directoryBlock.style.display = 'none';
    inStoreBlock.style.display = 'block';
    renderInStoreMenuCards();
    updateCartUI();
  }
}

function renderStoreDirectoryList() {
  const campusStores = state.stores.filter(s => s.campus === state.campus);
  const rec = state.aiRecommendations[state.campus];
  const tipBox = document.getElementById('aiSmartTipBox');

  if (tipBox) {
    if (rec && rec.hasAlert) {
      tipBox.innerHTML = `
        <div class="smart-tip-card">
          <div style="flex:1; min-width:220px;">
            <div class="smart-tip-badge">⚡ M/M/1 佇列偵測・AI 動態分流建議</div>
            <div class="smart-tip-title">「${escapeHtml(rec.congestedStoreName)}」目前負載 ${rec.congestedLoadPct}% 需久候 ${rec.congestedWaitMin} 分鐘</div>
            <div class="smart-tip-desc">
              改點 AI 效用評分最高 (${rec.recommendedAiScore}分) 的 <strong>${escapeHtml(rec.recommendedStoreName)}</strong> 只要 <strong>${rec.recommendedWaitMin} 分鐘</strong>（省時 ${rec.timeSavedMin} 分），再享 <strong>${escapeHtml(rec.promoText)}</strong>
            </div>
          </div>
          <button class="btn-tip-action" onclick="enterStoreOrdering('${escapeHtml(rec.recommendedStoreId)}')">領優惠免排隊點餐 ➔</button>
        </div>
      `;
    } else {
      tipBox.innerHTML = '';
    }
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
      <div class="store-card ${isRecTarget ? 'recommended' : ''}" onclick="enterStoreOrdering('${escapeHtml(s.id)}')">
        <div class="store-thumb">
          ${icon}
          <span class="ai-score-badge">AI ${s.aiScore}分</span>
        </div>
        <div class="store-info">
          <div class="store-header-row">
            <div class="store-name">${escapeHtml(s.name)}</div>
            <span class="wait-pill ${waitClass}">${waitText}</span>
          </div>
          <div class="store-meta">
            ⭐ ${s.rating} ・ ${escapeHtml(s.category)} ・ 佇列 ${s.activeOrders}/${s.maxCapacityPer15Min} 單 (${s.loadPercentage}%) ・ 共 ${(s.menus || []).length} 道餐點
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

/**
 * 渲染指定餐廳內的「完整分類展開菜單」（完全比照參考程式的分類卡片 + 右下角 + 號設計）
 */
function renderInStoreMenuCards() {
  const store = state.stores.find(s => s.id === state.selectedStoreId);
  const box = document.getElementById('inStoreOrderingBlock');
  if (!store || !box) return;

  const hasPromo = isStorePromoActive(store);
  const rec = state.aiRecommendations[store.campus];
  const isCongested = store.loadState === 'FULL' && rec && rec.hasAlert && rec.recommendedStoreId !== store.id;

  const items = store.menus || [];
  const grouped = {};
  items.forEach(item => {
    const cat = item.category || '招牌推薦';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });

  let menuGroupsHtml = '';
  if (items.length === 0) {
    menuGroupsHtml = `<p style="text-align:center; color:var(--text-muted); padding:40px 0;">此餐廳目前尚無供應品項</p>`;
  } else {
    for (let cat in grouped) {
      menuGroupsHtml += `
        <div>
          <h3 class="category-group-title">
            <span>🏷️</span> ${escapeHtml(cat)}
          </h3>
          <div style="display:grid; grid-template-columns:1fr; gap:12px;">
            ${grouped[cat].map(item => {
              const imgHtml = item.image
                ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">`
                : `<span>🍽️</span>`;
              const priceDisplay = item.isBafangMode
                ? `NT$ ${item.price} /顆`
                : `NT$ ${item.price}`;
              const hasOpts = item.options && Object.keys(item.options).length > 0;

              return `
                <div class="menu-item-card" onclick="handleMenuItemClick('${escapeHtml(item.id)}', false)">
                  <div class="menu-img-box">
                    ${imgHtml}
                    <div class="menu-plus-badge">+</div>
                  </div>
                  <div style="flex:1; display:flex; flex-direction:column; justify-content:space-between; padding:2px 0;">
                    <div>
                      <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                        <h4 style="font-size:1.05rem; font-weight:800; color:var(--text-primary);">${escapeHtml(item.name)}</h4>
                        ${item.tag ? `<span style="font-size:0.7rem; font-weight:700; background:var(--brand-light); color:var(--brand-dark); padding:1px 7px; border-radius:6px;">${escapeHtml(item.tag)}</span>` : ''}
                      </div>
                      <div style="font-size:0.76rem; color:var(--text-secondary); margin-top:3px;">
                        ${hasOpts ? `可選：${Object.keys(item.options).join(' / ')}` : '單點直接加入購物車'}
                      </div>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:8px;">
                      <span style="font-size:1.05rem; font-weight:900; color:var(--text-primary);">${priceDisplay}</span>
                      <span style="font-size:0.76rem; font-weight:700; color:var(--brand);">點擊選擇 ➔</span>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }
  }

  box.innerHTML = `
    <div class="in-store-banner">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
        <button type="button" class="filter-chip" onclick="backToStoreDirectory()">← 切換其他學餐店家</button>
        <span class="wait-pill ${store.loadState === 'FULL' ? 'wait-full' : store.loadState === 'MODERATE' ? 'wait-mod' : 'wait-free'}">
          ⏱️ 目前預估約 ${store.avgPrepMinutes} 分鐘取餐 (待製 ${store.activeOrders} 單)
        </span>
      </div>
      <div style="display:flex; align-items:center; gap:12px;">
        <div style="font-size:2.4rem; background:var(--brand-light); width:60px; height:60px; border-radius:14px; display:flex; align-items:center; justify-content:center;">
          ${STORE_ICONS[store.id] || '🍱'}
        </div>
        <div>
          <h2 style="font-size:1.35rem; font-weight:900;">${escapeHtml(store.name)}</h2>
          <div style="font-size:0.82rem; color:var(--text-secondary);">${escapeHtml(store.campus)} ・ ${escapeHtml(store.category)} ・ ⭐ ${store.rating}</div>
        </div>
      </div>

      ${hasPromo ? `
        <div style="margin-top:12px; background:var(--brand-light); color:var(--brand-dark); padding:10px 14px; border-radius:10px; font-size:0.85rem; font-weight:800;">
          🎉 本店已開啟 AI 離峰分流優惠：${escapeHtml(store.promoText)}（結帳時自動套用）
        </div>
      ` : ''}

      ${isCongested ? `
        <div style="margin-top:10px; background:var(--red-bg); color:var(--red); padding:10px 14px; border-radius:10px; font-size:0.82rem; font-weight:700; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <span>⚠️ 本店目前產能滿載 (${store.loadPercentage}%)，改點「${escapeHtml(rec.recommendedStoreName)}」立省 ${rec.timeSavedMin} 分鐘並享優惠！</span>
          <button type="button" class="btn-tip-action" style="padding:6px 12px; font-size:0.78rem;" onclick="enterStoreOrdering('${escapeHtml(rec.recommendedStoreId)}')">一鍵改點 ➔</button>
        </div>
      ` : ''}
    </div>

    ${menuGroupsHtml}
  `;
}

// ==================== 3. 點擊餐點 ➔ 客製化選項彈窗 (`options-modal`) ➔ 購物車抽屜 (`cart-modal`) ====================
function handleMenuItemClick(itemId, isPos = false) {
  const storeId = isPos ? state.merchantStoreId : state.selectedStoreId;
  const store = state.stores.find(s => s.id === storeId);
  if (!store) return;

  const item = (store.menus || []).find(i => String(i.id) === String(itemId));
  if (!item) return;

  state.isPosConfiguring = isPos;
  state.editingCartIndex = -1;

  if (item.options && Object.keys(item.options).length > 0) {
    state.configuringItem = item;
    openOptionsModal(item, null);
  } else {
    // 沒有客製化選項的單點品項，直接加入購物車或 POS 帳單
    addSimpleItemToCart(item, isPos);
  }
}

function addSimpleItemToCart(item, isPos) {
  const newItemObj = {
    id: item.id,
    name: item.name,
    basePrice: item.price,
    price: item.price,
    qty: 1,
    isBafangMode: Boolean(item.isBafangMode),
    selections: {}
  };
  if (isPos) {
    state.posCart.push(newItemObj);
    const store = state.stores.find(s => s.id === state.merchantStoreId);
    if (store) renderPosCashierPanel(store);
    showToast(`🖥️ 已加入 POS 帳單：${item.name}`);
  } else {
    state.cartItems.push(newItemObj);
    updateCartUI();
    showToast(`🛒 已加入購物車：${item.name}`);
  }
}

function openOptionsModal(item, prefilledSelections = null) {
  document.getElementById('optModalTitle').innerText = item.name;
  document.getElementById('optModalSubtitle').innerText = item.isBafangMode
    ? `八方計價模式（NT$ ${item.price} /顆，總價依所選顆數與加購計算）`
    : `基本價格 NT$ ${item.price}`;

  const content = document.getElementById('optModalContent');
  content.innerHTML = '';

  Object.keys(item.options || {}).forEach(optName => {
    const grp = item.options[optName];
    const isRadio = !grp.type || grp.type === 'radio';
    const inputType = isRadio ? 'radio' : 'checkbox';
    const reqBadge = isRadio
      ? `<span style="color:var(--red); font-size:0.74rem; font-weight:800; margin-left:6px;">* 必選單選</span>`
      : `<span style="color:var(--brand); font-size:0.74rem; font-weight:800; margin-left:6px;">可多選</span>`;

    const choicesArray = grp.choices || grp || [];
    let prefilledValues = [];
    if (prefilledSelections && prefilledSelections[optName]) {
      const sel = prefilledSelections[optName];
      prefilledValues = Array.isArray(sel) ? sel : String(sel).split(', ');
    }

    const choicesHtml = choicesArray.map((opt, idx) => {
      const name = Array.isArray(opt) ? opt[0] : opt;
      const extra = Array.isArray(opt) ? (Number(opt[1]) || 0) : 0;
      // 若為新點選且是必選單選群組，預設幫使用者勾選第一個選項，體驗更順暢
      const isChecked = prefilledSelections
        ? prefilledValues.includes(name)
        : (isRadio && idx === 0);

      return `
        <label class="option-label-row ${isChecked ? 'checked' : ''}">
          <div style="display:flex; align-items:center; gap:10px;">
            <input type="${inputType}" name="optgrp-${escapeHtml(optName)}" value="${escapeHtml(name)}" data-extra="${extra}" ${isChecked ? 'checked' : ''} onchange="checkModalSelections()" style="width:18px; height:18px; accent-color:var(--brand);">
            <span style="font-weight:700; color:var(--text-primary);">${escapeHtml(name)}</span>
          </div>
          ${extra !== 0 ? `<span style="font-weight:800; color:var(--brand); font-size:0.86rem;">${extra > 0 ? `+NT$${extra}` : `-NT$${Math.abs(extra)}`}</span>` : ''}
        </label>
      `;
    }).join('');

    content.insertAdjacentHTML('beforeend', `
      <div style="margin-bottom:18px;">
        <h4 style="font-size:0.96rem; font-weight:900; margin-bottom:8px; color:var(--text-primary);">${escapeHtml(optName)} ${reqBadge}</h4>
        <div>${choicesHtml}</div>
      </div>
    `);
  });

  checkModalSelections();
  document.getElementById('optionsModal').classList.add('open');
}

function closeOptionsModal() {
  document.getElementById('optionsModal').classList.remove('open');
  state.configuringItem = null;
  state.editingCartIndex = -1;
}

function checkModalSelections() {
  const item = state.configuringItem;
  if (!item) return;

  // 同步更新 label 選中樣式
  document.querySelectorAll('#optModalContent .option-label-row').forEach(lbl => {
    const inp = lbl.querySelector('input');
    if (inp) lbl.classList.toggle('checked', inp.checked);
  });

  let extra = 0;
  let allRequiredChecked = true;

  Object.keys(item.options || {}).forEach(cat => {
    const grp = item.options[cat];
    if (!grp.type || grp.type === 'radio') {
      const sel = document.querySelector(`#optModalContent input[name="optgrp-${CSS.escape(cat)}"]:checked`);
      if (!sel) allRequiredChecked = false;
    }
  });

  document.querySelectorAll('#optModalContent input:checked').forEach(sel => {
    extra += parseFloat(sel.dataset.extra || 0);
  });

  const btn = document.getElementById('confirmOptionsBtn');
  if (allRequiredChecked) {
    btn.disabled = false;
    const basePrice = item.isBafangMode ? 0 : item.price;
    const finalPrice = Math.max(0, basePrice + extra);
    btn.innerText = state.editingCartIndex > -1
      ? `儲存變更 (NT$ ${finalPrice})`
      : `確認加入 (NT$ ${finalPrice})`;
  } else {
    btn.disabled = true;
    btn.innerText = '請完成必選項目';
  }
}

function confirmOptionsModal() {
  const item = state.configuringItem;
  if (!item) return;

  let extraTotal = 0;
  const selections = {};

  document.querySelectorAll('#optModalContent input:checked').forEach(r => {
    const cat = r.name.replace(/^optgrp-/, '');
    const grp = item.options[cat];
    const isCheckbox = grp && grp.type === 'checkbox';
    if (isCheckbox) {
      if (!selections[cat]) selections[cat] = [];
      selections[cat].push(r.value);
    } else {
      selections[cat] = r.value;
    }
    extraTotal += parseFloat(r.dataset.extra || 0);
  });

  for (let key in selections) {
    if (Array.isArray(selections[key])) selections[key] = selections[key].join(', ');
  }

  const basePrice = item.isBafangMode ? 0 : item.price;
  const finalPrice = Math.max(0, basePrice + extraTotal);
  const newItemObj = {
    id: item.id,
    name: item.name,
    basePrice: item.price,
    price: finalPrice,
    qty: 1,
    isBafangMode: Boolean(item.isBafangMode),
    selections: selections
  };

  const targetCart = state.isPosConfiguring ? state.posCart : state.cartItems;

  if (state.editingCartIndex > -1) {
    newItemObj.qty = targetCart[state.editingCartIndex].qty || 1;
    targetCart[state.editingCartIndex] = newItemObj;
    showToast(`✅ 已更新選項：${item.name}`);
  } else {
    targetCart.push(newItemObj);
    showToast(`🛒 已加入：${item.name}`);
  }

  if (state.isPosConfiguring) {
    const store = state.stores.find(s => s.id === state.merchantStoreId);
    if (store) renderPosCashierPanel(store);
  } else {
    updateCartUI();
  }
  closeOptionsModal();
}

// ---------- 購物車抽屜 (`cart-modal`) 互動：支援 `✎ 編輯選項`、`🗑️ 移除`、份數調整與結帳設定 ----------
function openCartModal() {
  if (state.cartItems.length === 0) return;
  updateCartUI();
  document.getElementById('cartModal').classList.add('open');
}

function closeCartModal() {
  document.getElementById('cartModal').classList.remove('open');
}

function editCartItemOptions(index, isPos = false) {
  const targetCart = isPos ? state.posCart : state.cartItems;
  const cartItem = targetCart[index];
  if (!cartItem) return;

  const storeId = isPos ? state.merchantStoreId : state.selectedStoreId;
  const store = state.stores.find(s => s.id === storeId);
  const originalMenuItem = store ? (store.menus || []).find(i => String(i.id) === String(cartItem.id)) : null;

  if (!originalMenuItem || !originalMenuItem.options || Object.keys(originalMenuItem.options).length === 0) {
    showToast('此品項無客製化選項可編輯');
    return;
  }

  state.isPosConfiguring = isPos;
  state.editingCartIndex = index;
  state.configuringItem = originalMenuItem;
  openOptionsModal(originalMenuItem, cartItem.selections);
}

function changeCartItemQty(index, delta) {
  if (!state.cartItems[index]) return;
  state.cartItems[index].qty = (state.cartItems[index].qty || 1) + delta;
  if (state.cartItems[index].qty <= 0) {
    state.cartItems.splice(index, 1);
  }
  updateCartUI();
}

function removeCartItem(index) {
  state.cartItems.splice(index, 1);
  updateCartUI();
}

function setCheckoutMode(field, val) {
  state[field] = val;
  updateCartUI();
}

function updateCartUI() {
  const store = state.stores.find(s => s.id === state.selectedStoreId);
  const totalCount = state.cartItems.reduce((sum, i) => sum + (i.qty || 1), 0);
  const subtotal = state.cartItems.reduce((sum, i) => sum + i.price * (i.qty || 1), 0);

  let discount = 0;
  if (subtotal > 0 && store && isStorePromoActive(store) && store.promoMode === 'discount') {
    discount = Number(store.promoDiscount) || 10;
  }
  const finalTotal = Math.max(0, subtotal - discount);

  // 更新底部懸浮購物車按鈕
  const viewCartBtn = document.getElementById('viewCartBtn');
  const countEl = document.getElementById('cartItemCountBadge');
  const previewTotalEl = document.getElementById('cartPreviewTotal');
  if (countEl) countEl.innerText = `${totalCount} 份`;
  if (previewTotalEl) previewTotalEl.innerText = `NT$ ${finalTotal}`;
  if (viewCartBtn) viewCartBtn.disabled = totalCount === 0;

  if (totalCount === 0 && document.getElementById('cartModal')?.classList.contains('open')) {
    closeCartModal();
  }

  // 渲染購物車抽屜內容
  const listDiv = document.getElementById('cartPageList');
  if (!listDiv) return;

  if (state.cartItems.length === 0) {
    listDiv.innerHTML = `
      <div style="text-align:center; padding:40px 0;">
        <p style="color:var(--text-muted); font-size:1.05rem; margin-bottom:12px;">購物車空空的耶</p>
        <button type="button" class="btn-tip-action" onclick="closeCartModal()">去挑選餐點</button>
      </div>
    `;
    return;
  }

  const itemsCardsHtml = state.cartItems.map((item, idx) => {
    const selList = item.selections && Object.keys(item.selections).length > 0
      ? Object.entries(item.selections).map(([k, v]) => `${k}: ${v}`).join(' / ')
      : '標準原味';
    const canEdit = item.selections && Object.keys(item.selections).length > 0;
    const itemSubtotal = item.price * (item.qty || 1);

    return `
      <div style="background:#FFFFFF; padding:14px; border-radius:14px; border:1px solid var(--border); margin-bottom:10px; box-shadow:var(--shadow-sm);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
          <div>
            <h4 style="font-size:1.02rem; font-weight:800; color:var(--text-primary);">${escapeHtml(item.name)}</h4>
            <p style="font-size:0.8rem; color:var(--text-secondary); margin-top:3px;">${escapeHtml(selList)}</p>
          </div>
          <span style="font-size:1.05rem; font-weight:900; color:var(--red); white-space:nowrap;">NT$ ${itemSubtotal}</span>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; padding-top:10px; border-top:1px solid #F3F4F6;">
          <div style="display:inline-flex; align-items:center; gap:8px; background:var(--bg-page); padding:3px 8px; border-radius:999px; border:1px solid var(--border);">
            <button type="button" onclick="changeCartItemQty(${idx}, -1)" style="border:none; background:#fff; width:24px; height:24px; border-radius:50%; font-weight:900;">－</button>
            <span style="font-weight:800; min-width:20px; text-align:center;">${item.qty || 1}</span>
            <button type="button" onclick="changeCartItemQty(${idx}, 1)" style="border:none; background:var(--brand); color:#fff; width:24px; height:24px; border-radius:50%; font-weight:900;">＋</button>
          </div>

          <div style="display:flex; gap:8px;">
            ${canEdit ? `<button type="button" onclick="editCartItemOptions(${idx}, false)" style="border:none; background:var(--brand-light); color:var(--brand-dark); font-weight:800; font-size:0.8rem; padding:6px 12px; border-radius:8px;">✎ 編輯選項</button>` : ''}
            <button type="button" onclick="removeCartItem(${idx})" style="border:none; background:#F3F4F6; color:var(--text-secondary); font-weight:800; font-size:0.8rem; padding:6px 12px; border-radius:8px;">🗑️ 移除</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // 購物車下方的真實商用結帳表單（內用桌號 / 外帶自取、現場立即製作 / 預約取餐、付款方式）
  const checkoutSettingsHtml = `
    <div style="background:#FFFFFF; padding:16px; border-radius:14px; border:1px solid var(--border); margin-top:14px;">
      <h4 style="font-size:0.95rem; font-weight:900; margin-bottom:12px;">📋 取餐與結帳設定</h4>

      <label class="field-label">🍽️ 用餐型態</label>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px;">
        <button type="button" class="filter-chip ${state.checkoutDineType === '外帶自取' ? 'active' : ''}" onclick="setCheckoutMode('checkoutDineType', '外帶自取')">🛍️ 外帶自取</button>
        <button type="button" class="filter-chip ${state.checkoutDineType === '內用' ? 'active' : ''}" onclick="setCheckoutMode('checkoutDineType', '內用')">🍽️ 內用 (填桌號)</button>
      </div>

      ${state.checkoutDineType === '內用' ? `
        <div style="margin-bottom:12px;">
          <label class="field-label">🪑 內用桌號</label>
          <select class="select-input" onchange="state.checkoutTableNo=this.value">
            ${['A1桌', 'A2桌', 'A3桌', 'B1桌', 'B2桌', '吧台區'].map(tb => `
              <option value="${tb}" ${state.checkoutTableNo === tb ? 'selected' : ''}>${tb}</option>
            `).join('')}
          </select>
        </div>
      ` : ''}

      <label class="field-label">⏰ 取餐時間模式</label>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px;">
        <button type="button" class="filter-chip ${state.checkoutTimeMode === 'NOW' ? 'active' : ''}" onclick="setCheckoutMode('checkoutTimeMode', 'NOW')">
          ⚡ 現場立即製作 (約 ${store ? store.avgPrepMinutes : 5} 分)
        </button>
        <button type="button" class="filter-chip ${state.checkoutTimeMode === 'RESERVE' ? 'active' : ''}" onclick="setCheckoutMode('checkoutTimeMode', 'RESERVE')">
          🕒 課間預約取餐
        </button>
      </div>

      ${state.checkoutTimeMode === 'RESERVE' ? `
        <div style="margin-bottom:12px;">
          <label class="field-label">🕒 指定預約取餐時間（下課免等直接拿）</label>
          <select class="select-input" onchange="state.checkoutReserveTime=this.value">
            ${['11:50 (第四節下課前)', '12:00 (第四節下課)', '12:15 (午休尖峰)', '12:30 (午休時段)', '13:00 (第五節上課前)', '17:30 (晚餐時段)'].map(tm => `
              <option value="${tm}" ${state.checkoutReserveTime === tm ? 'selected' : ''}>${tm}</option>
            `).join('')}
          </select>
        </div>
      ` : ''}

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
        <div>
          <label class="field-label">💳 付款方式</label>
          <select class="select-input" onchange="state.checkoutPayMethod=this.value">
            ${['LINE Pay', '街口支付', '現場櫃檯付現', 'Apple Pay'].map(pm => `
              <option value="${pm}" ${state.checkoutPayMethod === pm ? 'selected' : ''}>${pm}</option>
            `).join('')}
          </select>
        </div>
        <div>
          <label class="field-label">📝 訂單備註 (選填)</label>
          <input type="text" class="select-input" placeholder="例：自備環保袋、統編" value="${escapeHtml(state.checkoutNote)}" oninput="state.checkoutNote=this.value">
        </div>
      </div>
    </div>
  `;

  listDiv.innerHTML = itemsCardsHtml + checkoutSettingsHtml;

  const modalTotalEl = document.getElementById('cartModalTotal');
  if (modalTotalEl) {
    modalTotalEl.innerHTML = discount > 0
      ? `<span style="font-size:0.85rem; color:var(--green); margin-right:6px;">(AI分流折抵 -$${discount})</span>NT$ ${finalTotal}`
      : `NT$ ${finalTotal}`;
  }
}

/**
 * 確認購物車並送出訂單 -> 跳轉至專屬亂碼憑證網址 (?id=ORD-xxx)
 */
async function submitStudentCartOrder() {
  const store = state.stores.find(s => s.id === state.selectedStoreId);
  if (!store || state.cartItems.length === 0) return;

  const btn = document.getElementById('finalSubmitOrderBtn');
  btn.disabled = true;
  btn.innerText = '⏳ 正在傳送訂單並產生取餐號...';

  const subtotal = state.cartItems.reduce((sum, i) => sum + i.price * (i.qty || 1), 0);
  const promoActive = isStorePromoActive(store);
  const discount = (promoActive && store.promoMode === 'discount') ? (Number(store.promoDiscount) || 10) : 0;
  const finalTotal = Math.max(0, subtotal - discount);
  const promoApplied = promoActive ? store.promoText : '一般預訂';

  const pickupTimeSlot = state.checkoutTimeMode === 'NOW'
    ? `⚡ 立即製作 (約${store.avgPrepMinutes}分)`
    : `🕒 預約 ${state.checkoutReserveTime}`;
  const customerNote = state.checkoutDineType === '內用'
    ? `內用(${state.checkoutTableNo})${state.checkoutNote ? '・' + state.checkoutNote : ''}`
    : `外帶自取${state.checkoutNote ? '・' + state.checkoutNote : ''}`;

  const formattedItems = state.cartItems.map(i => {
    const selStr = i.selections && Object.keys(i.selections).length > 0
      ? ` [${Object.entries(i.selections).map(([k, v]) => `${k}:${v}`).join(', ')}]`
      : '';
    return {
      id: i.id,
      name: `${i.name}${selStr}`,
      price: i.price,
      qty: i.qty || 1,
      selections: i.selections
    };
  });

  const orderId = generateOrderToken();
  const prefix = store.campus === '城中校區' ? 'C' : 'S';
  const pickupNumber = prefix + String(Math.floor(100 + Math.random() * 899));
  const nowTime = new Date().toLocaleTimeString('zh-TW', { hour12: false });

  const newOrder = {
    orderId,
    pickupNumber,
    storeId: store.id,
    storeName: store.name,
    studentId: '📱 掃碼點餐',
    studentName: customerNote,
    itemsJson: JSON.stringify(formattedItems),
    subtotal,
    discount,
    finalTotal,
    promoApplied,
    pickupTimeSlot,
    paymentMethod: state.checkoutPayMethod,
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
        orderSource: '📱 掃碼點餐',
        customerNote,
        campus: store.campus,
        storeId: store.id,
        storeName: store.name,
        items: formattedItems,
        subtotal,
        discount,
        finalTotal,
        promoApplied,
        paymentMethod: state.checkoutPayMethod,
        pickupTimeSlot,
        isDivertedOrder: promoActive
      })
    });
    const data = await res.json();
    if (data && data.order) {
      newOrder.orderId = data.order.orderId || newOrder.orderId;
      newOrder.pickupNumber = data.order.pickupNumber || newOrder.pickupNumber;
    }
    setSyncState('online', '已同步');
  } catch (e) {
    setSyncState('offline', '離線暫存模式');
  } finally {
    btn.disabled = false;
    btn.innerText = '確認餐點並送出訂單';
  }

  state.orders.unshift(newOrder);
  saveCachedOrders(state.orders);
  store.activeOrders += 1;
  store.avgPrepMinutes = calcPrepMinutes(store.activeOrders, store.maxCapacityPer15Min);
  saveLocalStores(state.stores);

  state.cartItems = [];
  closeCartModal();
  navigateToOrderTicket(newOrder.orderId);
  showToast(`🎉 點餐成功！取餐號碼：#${newOrder.pickupNumber}`);
}

// ==================== 4. 真 AI 智慧選餐顧問 ====================
async function askAiConcierge(presetQuery) {
  const inputEl = document.getElementById('aiUserQueryInput');
  const query = presetQuery || (inputEl ? inputEl.value.trim() : '') || '我趕時間想快點拿到餐，有什麼推薦？';
  if (inputEl && presetQuery) inputEl.value = presetQuery;

  const respBox = document.getElementById('aiConciergeResponse');
  if (!respBox) return;
  respBox.classList.add('show');
  respBox.innerHTML = `<div style="font-size:0.84rem; font-weight:700; color:#4338CA;">🧠 AI 正在分析「${escapeHtml(state.campus)}」各店即時佇列負載 ($\lambda/\mu$)、等待時間與菜單...</div>`;

  enrichStoresAndAi();
  const campusStores = state.stores.filter(s => s.campus === state.campus);

  if (state.geminiApiKey) {
    try {
      const storeContext = campusStores.map(s => ({
        storeId: s.id,
        name: s.name,
        waitMinutes: s.avgPrepMinutes,
        loadPct: s.loadPercentage,
        promo: s.promoText,
        aiUtilityScore: s.aiScore,
        menus: s.menus.map(m => `${m.id}:${m.name}($${m.price})`).join('; ')
      }));

      const prompt = `你是東吳大學「MealFlow 學餐 AI 流量管制與選餐顧問」。
目前校區：${state.campus}
學生需求：「${query}」
即時各餐廳佇列與菜單數據：${JSON.stringify(storeContext)}

請挑選最適合的 1 家餐廳與 1 道主餐，回傳純 JSON：
{
  "reasoning": "85字內的具體分析（說明避開哪家塞車店、省下幾分鐘、為何這道菜符合需求與優惠）",
  "storeId": "推薦店家ID",
  "menuId": "推薦餐點ID",
  "engine": "Google Gemini 2.5 Flash (Live API)"
}`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(state.geminiApiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.3 }
        })
      });
      const json = await res.json();
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        renderAiConciergeResult(JSON.parse(text));
        return;
      }
    } catch (e) {}
  }

  let candidates = [];
  campusStores.forEach(s => {
    (s.menus || []).forEach(m => {
      let score = s.aiScore;
      const q = query.toLowerCase();
      if ((q.includes('趕時間') || q.includes('10分鐘') || q.includes('快')) && s.avgPrepMinutes <= 6) score += 25;
      if ((q.includes('100') || q.includes('省錢') || q.includes('便宜') || q.includes('cp')) && (m.price - (s.promoDiscount || 0) <= 100)) score += 22;
      if ((q.includes('辣') || q.includes('重口味')) && (m.name.includes('辣') || m.name.includes('泡菜') || m.name.includes('椒麻') || m.name.includes('紅油'))) score += 28;
      if ((q.includes('肉') || q.includes('蛋白') || q.includes('飽')) && (m.name.includes('牛') || m.name.includes('豬排') || m.name.includes('雞腿') || m.name.includes('排骨'))) score += 24;
      candidates.push({ store: s, menu: m, totalScore: score });
    });
  });

  candidates.sort((a, b) => b.totalScore - a.totalScore);
  const best = candidates[0];
  const worstStore = campusStores.slice().sort((a, b) => b.avgPrepMinutes - a.avgPrepMinutes)[0];
  const savedMin = Math.max(5, worstStore.avgPrepMinutes - best.store.avgPrepMinutes);

  renderAiConciergeResult({
    reasoning: `根據 M/M/1 佇列模型與語意偏好分析：目前「${worstStore.name}」負載達 ${worstStore.loadPercentage}%（需久候 ${worstStore.avgPrepMinutes} 分鐘）。AI 為您媒合效用分數最高（${best.store.aiScore} 分）的「${best.store.name}」—【${best.menu.name} ($${best.menu.price})】，預估僅需 ${best.store.avgPrepMinutes} 分鐘取餐（立省 ${savedMin} 分鐘），${best.store.promoMode !== 'none' ? `還可享「${best.store.promoText}」！` : '出餐迅速免排隊！'}`,
    storeId: best.store.id,
    menuId: best.menu.id,
    engine: 'MealFlow Queueing Utility AI Engine v5.0'
  });
}

function renderAiConciergeResult(aiResult) {
  const respBox = document.getElementById('aiConciergeResponse');
  if (!respBox) return;
  const targetStore = state.stores.find(s => s.id === aiResult.storeId) || state.stores[0];
  const targetMenu = (targetStore.menus || []).find(m => m.id === aiResult.menuId) || targetStore.menus[0];

  respBox.classList.add('show');
  respBox.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; flex-wrap:wrap; gap:6px;">
      <span style="font-size:0.72rem; font-weight:800; color:#4338CA; background:#EEF2FF; padding:2px 8px; border-radius:999px;">
        🤖 決策引擎：${escapeHtml(aiResult.engine || 'MealFlow AI')}
      </span>
      <span style="font-size:0.75rem; font-weight:800; color:var(--green);">⚡ 預估 ${targetStore.avgPrepMinutes} 分鐘取餐</span>
    </div>
    <p style="font-size:0.84rem; color:var(--text-primary); line-height:1.55; margin-bottom:10px;">
      ${escapeHtml(aiResult.reasoning)}
    </p>
    <div style="display:flex; justify-content:space-between; align-items:center; background:#F9FAFB; padding:8px 12px; border-radius:8px; border:1px solid var(--border); flex-wrap:wrap; gap:8px;">
      <div>
        <strong style="font-size:0.9rem;">${escapeHtml(targetStore.name)} — ${escapeHtml(targetMenu.name)}</strong>
        <span style="color:var(--brand); font-weight:900; margin-left:6px;">$${targetMenu.price}</span>
      </div>
      <button class="btn-tip-action" style="padding:7px 14px; font-size:0.8rem;" onclick="enterStoreOrdering('${escapeHtml(targetStore.id)}', '${escapeHtml(targetMenu.id)}')">
        ⚡ 進入店家選配此餐點 ➔
      </button>
    </div>
  `;
}

function promptGeminiKeyConfig() {
  const cur = state.geminiApiKey || '';
  const input = window.prompt('【選填】輸入 Google Gemini API Key 即可啟用 Gemini 2.5 Flash 實時生成與視覺菜單 OCR（留空則使用內建智慧引擎）：', cur);
  if (input !== null) {
    state.geminiApiKey = input.trim();
    try { localStorage.setItem('mealflow_gemini_key', state.geminiApiKey); } catch (e) {}
    showToast(state.geminiApiKey ? '✅ 已啟用 Google Gemini 2.5 Flash 實時引擎！' : '✅ 已切換為內建智慧引擎');
  }
}

// ==================== 5. 專屬訂單追蹤頁 (/order/?id=ORD-xxx) ====================
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
        <h2 style="font-size:1.2rem; font-weight:800; margin-bottom:6px;">正在雲端尋找您的訂單憑證...</h2>
        <p style="font-size:0.86rem; color:var(--text-secondary); margin-bottom:18px;">
          專屬訂單網址憑證：<code>${escapeHtml(orderId)}</code>
        </p>
        <div style="display:flex; justify-content:center; gap:10px;">
          <button class="filter-chip" onclick="syncCloud(true)">🔄 重新同步雲端</button>
          <button class="btn-tip-action" onclick="navigateToOrderMenu(null)">返回點餐首頁</button>
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
  let statusSub = `預估約 ${waitMin} 分鐘內完成，請保留此專屬網頁作為領餐憑證`;

  if (isReady) {
    statusHeroColor = 'var(--green)';
    statusHeroBg = 'var(--green-bg)';
    statusTitle = '🔔 餐點已製作完成！請前往櫃檯取餐';
    statusSub = `請直接至「${order.storeName}」免排隊櫃檯出示此畫面領取`;
  } else if (isDone) {
    statusHeroColor = '#4B5563';
    statusHeroBg = '#F3F4F6';
    statusTitle = '✅ 本筆訂單已完成取餐';
    statusSub = '感謝您使用東吳學餐 MealFlow 智慧點餐系統';
  }

  box.innerHTML = `
    <div class="ticket-tracker-card" style="border-top: 6px solid ${statusHeroColor};">
      <div style="text-align:center; padding-bottom:18px; border-bottom:1px dashed var(--border);">
        <div style="display:inline-block; background:${statusHeroBg}; color:${statusHeroColor}; font-weight:800; font-size:0.82rem; padding:5px 14px; border-radius:999px; margin-bottom:12px;">
          ${statusTitle}
        </div>
        <div style="font-size:0.8rem; color:var(--text-secondary); font-weight:700;">
          取餐號碼（${escapeHtml(order.studentName || '自取')}）
        </div>
        <div style="font-size:3.6rem; font-weight:900; color:${statusHeroColor}; line-height:1.08; letter-spacing:1px; margin:4px 0 8px;">
          ${escapeHtml(order.pickupNumber)}
        </div>
        <div style="font-size:0.84rem; color:var(--text-secondary);">${escapeHtml(statusSub)}</div>
      </div>

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

      <div style="background:var(--bg-page); border-radius:var(--radius-md); padding:16px; margin-top:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid var(--border);">
          <strong style="font-size:1.05rem;">${escapeHtml(order.storeName)}</strong>
          <span style="font-size:0.78rem; color:var(--text-secondary);">${escapeHtml(order.pickupTimeSlot)}</span>
        </div>

        <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:12px;">
          ${items.map(i => `
            <div style="display:flex; justify-content:space-between; font-size:0.92rem; font-weight:700;">
              <span>${escapeHtml(i.name)} × ${i.qty}</span>
              <span>NT$ ${i.price * i.qty}</span>
            </div>
          `).join('')}
        </div>

        ${order.promoApplied && order.promoApplied !== '一般預訂' ? `
          <div style="background:var(--brand-light); color:var(--brand-dark); padding:8px 10px; border-radius:8px; font-size:0.8rem; font-weight:700; margin-bottom:10px;">
            ${escapeHtml(order.promoApplied)}
          </div>
        ` : ''}

        <div style="display:flex; justify-content:space-between; align-items:center; padding-top:8px; border-top:1px solid var(--border);">
          <span style="font-size:0.82rem; color:var(--text-secondary);">付款：${escapeHtml(order.paymentMethod)}</span>
          <span style="font-size:1.25rem; font-weight:900; color:var(--text-primary);">總計 NT$ ${order.finalTotal}</span>
        </div>
      </div>

      <div style="margin-top:16px; padding:12px; border:1px solid var(--border); border-radius:var(--radius-md); background:#FFFFFF;">
        <div style="font-size:0.74rem; font-weight:700; color:var(--text-secondary); margin-bottom:4px;">
          🔒 本單專屬亂碼憑證網址（這串網址就代表您的訂單，不需登入帳號）：
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <input type="text" readonly value="${escapeHtml(currentFullUrl)}" class="select-input" style="font-size:0.76rem; color:var(--text-secondary); background:var(--bg-page); flex:1;">
          <button class="filter-chip" onclick="copyOrderUrl()">📋 複製連結</button>
        </div>
      </div>

      <div style="display:flex; gap:10px; margin-top:16px;">
        <button class="filter-chip" style="flex:1; padding:12px;" onclick="navigateToOrderMenu(null)">← 返回學餐列表再點一單</button>
        <button class="btn-tip-action" style="padding:12px 18px;" onclick="syncCloud(true)">🔄 刷新進度</button>
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

// ==================== 6. 店家專屬後台 (/store/)：4 大模組切換 ====================
function switchStoreTabMode(mode) {
  state.storeTabMode = mode; // 'pos' | 'kds' | 'menu' | 'promo'
  ['pos', 'kds', 'menu', 'promo'].forEach(k => {
    const btn = document.getElementById('tabBtnStore-' + k);
    const panel = document.getElementById('storePanel-' + k);
    if (btn) btn.classList.toggle('active', k === mode);
    if (panel) panel.style.display = k === mode ? 'block' : 'none';
  });
  renderMerchantView();
}

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
  state.posCategoryFilter = 'ALL';
  state.posCart = [];
  state.posCashReceived = '';
  state.isMenuDirty = false;
  const store = state.stores.find(s => s.id === state.merchantStoreId);
  if (store) {
    state.adminMenuData = JSON.parse(JSON.stringify(store.menus || []));
  }
  renderMerchantView();
}

function renderMerchantView() {
  initMerchantSelect();
  const store = state.stores.find(s => s.id === state.merchantStoreId) || state.stores[0];
  if (!store) return;

  if (!state.isMenuDirty) {
    state.adminMenuData = JSON.parse(JSON.stringify(store.menus || []));
  }

  renderPosCashierPanel(store);
  renderMerchantOrdersOnly();
  renderAdminMenuEditor(store);

  const predEl = document.getElementById('merchPredictLabel');
  if (predEl) {
    const estIntercept = store.loadState === 'FREE' && store.promoMode !== 'none' ? 14 : 4;
    const estRev = estIntercept * 105;
    predEl.innerText = `🧠 AI 佇列推算：預估可攔截 ${estIntercept} 單溢流客（約 +$${estRev} 營收）｜目前負載 ${store.loadPercentage || 0}%`;
  }
  setMerchantPromo(store.promoMode || 'none', false);
  const customInput = document.getElementById('merchCustomText');
  if (customInput) customInput.value = store.promoText || '';
  const actInput = document.getElementById('merchActiveInput');
  if (actInput) actInput.value = store.activeOrders;
  const capInput = document.getElementById('merchCapInput');
  if (capInput) capInput.value = store.maxCapacityPer15Min;
}

// ---------- 模組 A：真・商用平板 POS 收銀機 (深色雙欄 + 分類頁籤 + 客製彈窗 + 收銀鍵盤) ----------
function setPosCatFilter(cat) {
  state.posCategoryFilter = cat;
  const store = state.stores.find(s => s.id === state.merchantStoreId);
  if (store) renderPosCashierPanel(store);
}

function posChangeItemQty(idx, delta) {
  if (!state.posCart[idx]) return;
  state.posCart[idx].qty += delta;
  if (state.posCart[idx].qty <= 0) state.posCart.splice(idx, 1);
  const store = state.stores.find(s => s.id === state.merchantStoreId);
  if (store) renderPosCashierPanel(store);
}

function posClearCart() {
  state.posCart = [];
  state.posCashReceived = '';
  const store = state.stores.find(s => s.id === state.merchantStoreId);
  if (store) renderPosCashierPanel(store);
}

function posQuickCash(amount) {
  state.posCashReceived = String(amount);
  const store = state.stores.find(s => s.id === state.merchantStoreId);
  if (store) renderPosCashierPanel(store);
}

function renderPosCashierPanel(store) {
  const terminalEl = document.getElementById('posTerminalContainer');
  if (!terminalEl) return;

  const menus = store.menus || [];
  const categories = ['ALL', ...Array.from(new Set(menus.map(m => m.category || '招牌主餐')))];
  const filteredMenus = state.posCategoryFilter === 'ALL'
    ? menus
    : menus.filter(m => (m.category || '招牌主餐') === state.posCategoryFilter);

  const subtotal = state.posCart.reduce((acc, i) => acc + i.price * (i.qty || 1), 0);
  const cashNum = Number(state.posCashReceived) || 0;
  const changeAmt = cashNum >= subtotal ? (cashNum - subtotal) : 0;

  terminalEl.innerHTML = `
    <div class="pos-terminal">
      <!-- 左欄：分類橫條 + 高對比菜色鍵盤 -->
      <div>
        <div class="pos-cat-strip">
          ${categories.map(c => `
            <button type="button" class="pos-cat-btn ${state.posCategoryFilter === c ? 'active' : ''}" onclick="setPosCatFilter('${escapeHtml(c)}')">
              ${c === 'ALL' ? '📋 全部品項' : escapeHtml(c)}
            </button>
          `).join('')}
        </div>

        <div class="pos-item-grid">
          ${filteredMenus.map(m => {
            const countInCart = state.posCart.filter(i => i.id === m.id).reduce((s, i) => s + (i.qty || 1), 0);
            const priceLabel = m.isBafangMode ? `$${m.price}/顆` : `$${m.price}`;
            return `
              <button type="button" class="pos-key-tile" onclick="handleMenuItemClick('${escapeHtml(m.id)}', true)">
                <div>
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:4px;">
                    <span style="font-size:0.95rem; font-weight:800; line-height:1.3;">${escapeHtml(m.name)}</span>
                    ${countInCart > 0 ? `<span style="background:var(--brand); color:#fff; padding:1px 7px; border-radius:999px; font-size:0.75rem; font-weight:900;">x${countInCart}</span>` : ''}
                  </div>
                  <div style="font-size:0.72rem; color:#94A3B8; margin-top:4px;">${escapeHtml(m.category || '')}</div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; width:100%; margin-top:10px;">
                  <span style="font-size:1.05rem; font-weight:900; color:#FBBF24;">${priceLabel}</span>
                  <span style="font-size:0.7rem; color:#CBD5E1;">+ 點擊選配</span>
                </div>
              </button>
            `;
          }).join('')}
        </div>
      </div>

      <!-- 右欄：POS 帳單明細與快速收銀出單台 -->
      <div class="pos-receipt-pane">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:10px; border-bottom:2px solid #111827; margin-bottom:10px;">
            <div>
              <div style="font-size:0.72rem; font-weight:900; color:var(--brand);">POS 收銀終端機</div>
              <strong style="font-size:1.08rem;">${escapeHtml(store.name)}</strong>
            </div>
            <select class="select-input" style="width:auto; padding:5px 8px; font-size:0.8rem;" onchange="state.posTableNo=this.value">
              ${['內用1桌', '內用2桌', '內用3桌', '內用吧台', '現場外帶'].map(t => `
                <option value="${t}" ${state.posTableNo === t ? 'selected' : ''}>${t}</option>
              `).join('')}
            </select>
          </div>

          <div style="max-height:260px; overflow-y:auto; margin-bottom:12px;">
            ${state.posCart.length === 0 ? `
              <div style="text-align:center; padding:48px 10px; color:var(--text-muted); font-size:0.86rem;">
                👈 點擊左側商品鍵即可加入帳單<br>（自動彈出份量/辣度/顆數選項）
              </div>
            ` : state.posCart.map((item, idx) => {
              const selStr = item.selections && Object.keys(item.selections).length > 0
                ? Object.values(item.selections).join(' / ')
                : '';
              return `
                <div style="padding:8px 0; border-bottom:1px dashed var(--border);">
                  <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div style="flex:1; min-width:0;">
                      <div style="font-weight:800; font-size:0.9rem;">${escapeHtml(item.name)}</div>
                      ${selStr ? `<div style="font-size:0.74rem; color:var(--brand-dark); font-weight:700;">[${escapeHtml(selStr)}]</div>` : ''}
                    </div>
                    <strong style="font-size:0.92rem; color:var(--text-primary);">$${item.price * item.qty}</strong>
                  </div>
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px;">
                    <div style="display:flex; gap:6px;">
                      <button type="button" onclick="editCartItemOptions(${idx}, true)" style="border:none; background:#EEF2FF; color:#4338CA; padding:3px 8px; border-radius:6px; font-size:0.72rem; font-weight:800;">✎ 改選項</button>
                    </div>
                    <div style="display:inline-flex; align-items:center; gap:6px;">
                      <button type="button" onclick="posChangeItemQty(${idx}, -1)" style="width:24px; height:24px; border-radius:6px; border:1px solid var(--border); background:#F9FAFB; font-weight:900;">-</button>
                      <span style="font-weight:900; min-width:18px; text-align:center;">${item.qty}</span>
                      <button type="button" onclick="posChangeItemQty(${idx}, 1)" style="width:24px; height:24px; border-radius:6px; border:none; background:#111827; color:#fff; font-weight:900;">+</button>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 下方收銀結算與找零 -->
        <div>
          <div style="background:#F8FAFC; border:1px solid var(--border); border-radius:12px; padding:12px; margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span style="font-weight:800; font-size:0.88rem;">應收總額 (${state.posCart.reduce((s,i)=>s+i.qty,0)} 份)</span>
              <span style="font-size:1.65rem; font-weight:900; color:var(--brand);">NT$ ${subtotal}</span>
            </div>
            <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:6px; margin-bottom:6px;">
              <button type="button" class="filter-chip" style="padding:5px; font-size:0.75rem;" onclick="posQuickCash(${subtotal})">剛好</button>
              <button type="button" class="filter-chip" style="padding:5px; font-size:0.75rem;" onclick="posQuickCash(100)">$100</button>
              <button type="button" class="filter-chip" style="padding:5px; font-size:0.75rem;" onclick="posQuickCash(500)">$500</button>
              <button type="button" class="filter-chip" style="padding:5px; font-size:0.75rem;" onclick="posQuickCash(1000)">$1000</button>
            </div>
            ${cashNum > 0 ? `
              <div style="display:flex; justify-content:space-between; font-size:0.84rem; font-weight:900; padding-top:6px; border-top:1px solid var(--border);">
                <span>實收 NT$ ${cashNum}</span>
                <span style="color:var(--green);">應找零：NT$ ${changeAmt}</span>
              </div>
            ` : ''}
          </div>

          <div style="display:flex; gap:8px;">
            <button type="button" class="filter-chip" onclick="posClearCart()">清空</button>
            <button type="button" class="btn-tip-action" style="flex:1; background:#111827; padding:13px;" onclick="submitPosOrder('現場現金')">
              💵 現金收銀出單
            </button>
            <button type="button" class="btn-tip-action" style="flex:1; padding:13px;" onclick="submitPosOrder('LINE Pay')">
              📱 行動支付出單
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function submitPosOrder(payMethod) {
  const store = state.stores.find(s => s.id === state.merchantStoreId);
  if (!store || state.posCart.length === 0) {
    showToast('⚠️ 請先在左側點選餐點加入 POS 帳單');
    return;
  }

  const subtotal = state.posCart.reduce((acc, i) => acc + i.price * (i.qty || 1), 0);
  const formattedItems = state.posCart.map(i => {
    const selStr = i.selections && Object.keys(i.selections).length > 0
      ? ` [${Object.entries(i.selections).map(([k, v]) => `${k}:${v}`).join(', ')}]`
      : '';
    return {
      id: i.id,
      name: `${i.name}${selStr}`,
      price: i.price,
      qty: i.qty || 1
    };
  });

  const orderId = generateOrderToken();
  const pickupNumber = 'P' + String(Math.floor(100 + Math.random() * 899));
  const nowTime = new Date().toLocaleTimeString('zh-TW', { hour12: false });

  const newOrder = {
    orderId,
    pickupNumber,
    storeId: store.id,
    storeName: store.name,
    studentId: '🖥️ 櫃檯POS',
    studentName: state.posTableNo,
    itemsJson: JSON.stringify(formattedItems),
    subtotal,
    discount: 0,
    finalTotal: subtotal,
    promoApplied: '現場櫃檯點餐',
    pickupTimeSlot: `現場(${state.posTableNo})`,
    paymentMethod: payMethod,
    status: '製作中',
    isDivertedOrder: false,
    createdAt: nowTime
  };

  state.orders.unshift(newOrder);
  saveCachedOrders(state.orders);
  store.activeOrders += 1;
  store.avgPrepMinutes = calcPrepMinutes(store.activeOrders, store.maxCapacityPer15Min);
  saveLocalStores(state.stores);

  posClearCart();
  applyRouteView();
  speakOrder(pickupNumber, `櫃檯${state.posTableNo}新訂單，共 ${subtotal} 元`);
  showToast(`✅ POS 收銀出單成功！單號：#${pickupNumber}`);

  try {
    setSyncState('syncing', 'POS 出單同步中...');
    await fetch(GAS_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'submitOrder',
        orderId,
        pickupNumber,
        orderSource: '🖥️ 櫃檯POS',
        customerNote: state.posTableNo,
        campus: store.campus,
        storeId: store.id,
        storeName: store.name,
        items: formattedItems,
        subtotal,
        discount: 0,
        finalTotal: subtotal,
        promoApplied: '現場櫃檯點餐',
        paymentMethod: payMethod,
        pickupTimeSlot: `現場(${state.posTableNo})`,
        isDivertedOrder: false
      })
    });
    setSyncState('online', '已同步');
  } catch (e) {
    setSyncState('offline', '離線暫存模式');
  }
}

// ---------- 模組 B：廚房 KDS 出單佇列 ----------
function renderMerchantOrdersOnly() {
  const store = state.stores.find(s => s.id === state.merchantStoreId) || state.stores[0];
  if (!store) return;

  const storeOrders = state.orders.filter(o => o.storeId === store.id);
  const pendingOrders = storeOrders.filter(o => o.status !== '已完成');
  const countEl = document.getElementById('merchActiveCount');
  if (countEl) countEl.innerText = pendingOrders.length;
  const kdsBadgeEl = document.getElementById('kdsPendingBadge');
  if (kdsBadgeEl) kdsBadgeEl.innerText = pendingOrders.length;

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
    const isPos = String(o.pickupNumber).startsWith('P') || String(o.studentId).includes('POS');

    return `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid var(--border); gap:10px; flex-wrap:wrap; ${isDone ? 'opacity:0.55;' : ''}">
        <div style="flex:1; min-width:220px;">
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-bottom:3px;">
            <a href="${escapeHtml(ticketLink)}" target="_blank" style="text-decoration:none;" title="點擊開啟此顧客的專屬訂單追蹤頁">
              <strong style="color:var(--brand); font-size:1.08rem;">#${escapeHtml(o.pickupNumber)} 🔗</strong>
            </a>
            <span class="wait-pill" style="background:${isPos ? '#EEF2FF' : '#FFF3EE'}; color:${isPos ? '#4338CA' : '#C2410C'};">
              ${isPos ? '🖥️ 櫃檯POS單' : '📱 掃碼預訂'}
            </span>
            <span class="wait-pill ${isReady ? 'wait-free' : isDone ? '' : 'wait-mod'}">${escapeHtml(o.status)}</span>
          </div>
          <div style="font-weight:800; font-size:0.94rem; margin-bottom:2px;">${escapeHtml(itemText)}</div>
          <div style="font-size:0.75rem; color:var(--text-secondary);">
            ${escapeHtml(o.studentName || '')} ・ 憑證 <code>${escapeHtml(o.orderId)}</code> ・ ${escapeHtml(o.pickupTimeSlot)} ・ <strong>NT$ ${o.finalTotal} (${escapeHtml(o.paymentMethod)})</strong>
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

// ---------- 模組 C：真實菜單管理 (CRUD + 客製化選項建構器 + 📸 AI 掃描整張菜單一鍵匯入) ----------
function renderAdminMenuEditor(store) {
  const nameEl = document.getElementById('adminCurrentStoreTitle');
  if (nameEl) nameEl.innerText = `${store.campus} — ${store.name}`;

  const listDiv = document.getElementById('adminMenuListContainer');
  if (!listDiv) return;

  const items = state.adminMenuData || [];
  if (items.length === 0) {
    listDiv.innerHTML = `<div style="text-align:center; padding:32px; border:2px dashed var(--border); border-radius:14px; color:var(--text-muted);">目前無品項，請點擊上方「➕ 手動新增餐點」或「📸 AI 掃描菜單一鍵匯入」！</div>`;
    return;
  }

  listDiv.innerHTML = items.map((item, idx) => {
    const optGroups = item.options ? Object.keys(item.options) : [];
    const priceLabel = item.isBafangMode ? `NT$ ${item.price} /顆 (八方計價)` : `NT$ ${item.price}`;
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 14px; background:#FFFFFF; border:1px solid var(--border); border-radius:12px; margin-bottom:8px; gap:10px; flex-wrap:wrap;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:46px; height:46px; border-radius:10px; background:#FFF7ED; display:flex; align-items:center; justify-content:center; font-size:1.4rem;">
            ${item.image ? `<img src="${escapeHtml(item.image)}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">` : '🍽️'}
          </div>
          <div>
            <div style="font-size:0.74rem; font-weight:800; color:var(--brand);">${escapeHtml(item.category || '未分類')}</div>
            <div style="font-size:0.98rem; font-weight:800; color:var(--text-primary);">${escapeHtml(item.name)}</div>
            <div style="font-size:0.78rem; color:var(--text-secondary);">
              <strong style="color:var(--red);">${priceLabel}</strong>
              ${optGroups.length > 0 ? ` ｜ 客製群組：${escapeHtml(optGroups.join('、'))}` : ' ｜ 單點無選項'}
            </div>
          </div>
        </div>
        <div style="display:flex; gap:6px;">
          <button type="button" class="filter-chip" style="background:#FFF3EE; color:var(--brand-dark); border-color:#FED7AA;" onclick="openMenuEditorModal(${idx})">✏️ 編輯品項與選項</button>
          <button type="button" class="filter-chip" style="background:var(--red-bg); color:var(--red); border-color:#FECACA;" onclick="deleteAdminMenuItem(${idx})">🗑️ 刪除</button>
        </div>
      </div>
    `;
  }).join('');
}

function openMenuEditorModal(index) {
  state.editingMenuIndex = index;
  if (index === -1) {
    document.getElementById('editorModalTitle').innerText = '➕ 新增餐點品項';
    document.getElementById('editItemBafang').checked = false;
    document.getElementById('editItemCategory').value = '招牌主餐';
    document.getElementById('editItemName').value = '';
    document.getElementById('editItemPrice').value = '';
    document.getElementById('editItemTag').value = '🔥 店長推薦';
    document.getElementById('editItemImage').value = '';
    state.currentEditOptions = getStdRiceOptions();
  } else {
    const item = state.adminMenuData[index];
    document.getElementById('editorModalTitle').innerText = `✏️ 編輯：${item.name}`;
    document.getElementById('editItemBafang').checked = Boolean(item.isBafangMode);
    document.getElementById('editItemCategory').value = item.category || '招牌主餐';
    document.getElementById('editItemName').value = item.name || '';
    document.getElementById('editItemPrice').value = item.price || 0;
    document.getElementById('editItemTag').value = item.tag || '';
    document.getElementById('editItemImage').value = item.image || '';
    state.currentEditOptions = {};
    if (item.options) {
      const opts = JSON.parse(JSON.stringify(item.options));
      for (let k in opts) {
        if (Array.isArray(opts[k])) {
          state.currentEditOptions[k] = { type: 'radio', choices: opts[k] };
        } else {
          state.currentEditOptions[k] = opts[k];
        }
      }
    }
  }
  renderOptionsBuilderUI();
  document.getElementById('menuEditorModal').classList.add('open');
}

function closeMenuEditorModal() {
  document.getElementById('menuEditorModal').classList.remove('open');
}

function renderOptionsBuilderUI() {
  const container = document.getElementById('optionsBuilderContainer');
  if (!container) return;
  const keys = Object.keys(state.currentEditOptions);
  if (keys.length === 0) {
    container.innerHTML = `<p style="font-size:0.82rem; color:var(--text-muted); text-align:center; padding:16px; border:1px dashed var(--border); border-radius:10px;">目前無客製化選項（顧客點選時將直接加入購物車）</p>`;
    return;
  }

  container.innerHTML = keys.map(groupName => {
    const grp = state.currentEditOptions[groupName];
    const gType = grp.type || 'radio';
    const choicesHtml = (grp.choices || []).map((opt, idx) => {
      const optName = Array.isArray(opt) ? opt[0] : opt;
      const optPrice = Array.isArray(opt) ? (Number(opt[1]) || 0) : 0;
      return `
        <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
          <span style="color:var(--text-muted);">↳</span>
          <input type="text" value="${escapeHtml(optName)}" onchange="updateOptionChoiceItem('${escapeHtml(groupName)}', ${idx}, 'name', this.value)" class="select-input" style="flex:1; padding:6px 8px;" placeholder="選項名(如:大盛加飯)">
          <span style="font-size:0.75rem; font-weight:700;">+$</span>
          <input type="number" value="${optPrice}" onchange="updateOptionChoiceItem('${escapeHtml(groupName)}', ${idx}, 'price', this.value)" class="select-input" style="width:70px; padding:6px 8px; text-align:center;">
          <button type="button" onclick="deleteOptionChoiceItem('${escapeHtml(groupName)}', ${idx})" style="border:none; background:transparent; color:var(--red); font-size:1.1rem; font-weight:900; padding:0 4px;">×</button>
        </div>
      `;
    }).join('');

    return `
      <div style="border:1px solid var(--border); border-radius:12px; padding:12px; margin-bottom:10px; background:#F9FAFB;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px;">
          <input type="text" value="${escapeHtml(groupName)}" onchange="renameOptionGroup('${escapeHtml(groupName)}', this.value)" class="select-input" style="width:45%; font-weight:800; padding:5px 8px;" placeholder="群組名稱">
          <div style="display:flex; gap:6px; align-items:center;">
            <select onchange="updateOptionGroupType('${escapeHtml(groupName)}', this.value)" class="select-input" style="width:auto; padding:5px 8px; font-size:0.78rem;">
              <option value="radio" ${gType === 'radio' ? 'selected' : ''}>單選 (必選)</option>
              <option value="checkbox" ${gType === 'checkbox' ? 'selected' : ''}>多選 (選填)</option>
            </select>
            <button type="button" onclick="deleteOptionGroup('${escapeHtml(groupName)}')" style="border:none; background:var(--red-bg); color:var(--red); padding:5px 8px; border-radius:6px; font-size:0.75rem; font-weight:800;">刪群組</button>
          </div>
        </div>
        <div style="padding-left:8px; border-left:2px solid #FED7AA;">
          ${choicesHtml}
        </div>
        <button type="button" onclick="addOptionChoiceItem('${escapeHtml(groupName)}')" style="border:none; background:var(--brand-light); color:var(--brand-dark); padding:4px 10px; border-radius:6px; font-size:0.76rem; font-weight:800; margin-top:4px;">＋ 新增子選項</button>
      </div>
    `;
  }).join('');
}

function addOptionGroup() {
  let base = '客製群組';
  let c = 1;
  while (state.currentEditOptions[`${base}${c}`]) c++;
  state.currentEditOptions[`${base}${c}`] = { type: 'radio', choices: [['標準', 0], ['加大', 10]] };
  renderOptionsBuilderUI();
}

function deleteOptionGroup(groupName) {
  delete state.currentEditOptions[groupName];
  renderOptionsBuilderUI();
}

function renameOptionGroup(oldName, newName) {
  newName = newName.trim();
  if (!newName || newName === oldName) return renderOptionsBuilderUI();
  const next = {};
  for (let k in state.currentEditOptions) {
    next[k === oldName ? newName : k] = state.currentEditOptions[k];
  }
  state.currentEditOptions = next;
  renderOptionsBuilderUI();
}

function updateOptionGroupType(groupName, type) {
  if (state.currentEditOptions[groupName]) state.currentEditOptions[groupName].type = type;
}

function addOptionChoiceItem(groupName) {
  if (state.currentEditOptions[groupName]) {
    state.currentEditOptions[groupName].choices.push(['新選項', 0]);
    renderOptionsBuilderUI();
  }
}

function updateOptionChoiceItem(groupName, idx, field, val) {
  const grp = state.currentEditOptions[groupName];
  if (!grp || !grp.choices[idx]) return;
  const cur = grp.choices[idx];
  let name = Array.isArray(cur) ? cur[0] : cur;
  let price = Array.isArray(cur) ? (Number(cur[1]) || 0) : 0;
  if (field === 'name') name = val.trim() || '選項';
  if (field === 'price') price = parseInt(val, 10) || 0;
  grp.choices[idx] = [name, price];
}

function deleteOptionChoiceItem(groupName, idx) {
  const grp = state.currentEditOptions[groupName];
  if (!grp) return;
  grp.choices.splice(idx, 1);
  renderOptionsBuilderUI();
}

function saveMenuItemToLocalDraft() {
  const isBafangMode = document.getElementById('editItemBafang').checked;
  const category = document.getElementById('editItemCategory').value.trim() || '招牌主餐';
  const name = document.getElementById('editItemName').value.trim();
  const price = parseFloat(document.getElementById('editItemPrice').value) || 0;
  const tag = document.getElementById('editItemTag').value.trim() || '🔥 店長推薦';
  const image = document.getElementById('editItemImage').value.trim();

  if (!name) {
    showToast('⚠️ 請輸入餐點品項名稱');
    return;
  }

  const finalOptions = {};
  for (let k in state.currentEditOptions) {
    const grp = state.currentEditOptions[k];
    if (grp && Array.isArray(grp.choices) && grp.choices.length > 0) {
      finalOptions[k] = {
        type: grp.type || 'radio',
        choices: grp.choices.map(c => Array.isArray(c) ? [c[0], Number(c[1]) || 0] : [String(c), 0])
      };
    }
  }

  const existingId = state.editingMenuIndex >= 0 && state.adminMenuData[state.editingMenuIndex]
    ? state.adminMenuData[state.editingMenuIndex].id
    : `M-${state.merchantStoreId}-${Date.now().toString().slice(-4)}`;

  const newItem = {
    id: existingId,
    storeId: state.merchantStoreId,
    category,
    name,
    price,
    tag,
    isBafangMode,
    image,
    options: finalOptions
  };

  if (state.editingMenuIndex === -1) {
    state.adminMenuData.push(newItem);
  } else {
    state.adminMenuData[state.editingMenuIndex] = newItem;
  }

  state.isMenuDirty = true;
  // 立即同步至前端 store.menus，讓 POS 與學生點餐畫面 0 秒生效
  const store = state.stores.find(s => s.id === state.merchantStoreId);
  if (store) {
    store.menus = JSON.parse(JSON.stringify(state.adminMenuData));
    saveLocalStores(state.stores);
  }

  closeMenuEditorModal();
  renderMerchantView();
  showToast(`✅ 已暫存「${name}」，別忘了點擊下方「💾 儲存菜單至雲端」同步至資料庫！`);
}

function deleteAdminMenuItem(idx) {
  const target = state.adminMenuData[idx];
  if (!target) return;
  if (!window.confirm(`確定要刪除「${target.name}」嗎？`)) return;
  state.adminMenuData.splice(idx, 1);
  state.isMenuDirty = true;
  const store = state.stores.find(s => s.id === state.merchantStoreId);
  if (store) {
    store.menus = JSON.parse(JSON.stringify(state.adminMenuData));
    saveLocalStores(state.stores);
  }
  renderMerchantView();
}

async function saveStoreMenusToServer() {
  const store = state.stores.find(s => s.id === state.merchantStoreId);
  if (!store) return;

  store.menus = JSON.parse(JSON.stringify(state.adminMenuData));
  saveLocalStores(state.stores);
  state.isMenuDirty = false;

  const btn = document.getElementById('btnSaveMenuToCloud');
  if (btn) {
    btn.disabled = true;
    btn.innerText = '⏳ 正在寫入雲端資料庫...';
  }

  try {
    setSyncState('syncing', '儲存菜單中...');
    const res = await fetch(GAS_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'saveStoreMenus',
        storeId: store.id,
        menus: store.menus
      })
    });
    const data = await res.json();
    if (data && data.bundle) applyCloudBundle(data.bundle);
    setSyncState('online', '已同步');
    showToast(`💾 已將「${store.name}」共 ${store.menus.length} 道菜單完整儲存至雲端！`);
  } catch (e) {
    setSyncState('offline', '已存於本機快取');
    showToast(`✅ 已儲存「${store.name}」菜單（目前為本機快取生效）！`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = '💾 儲存此餐廳完整菜單至雲端資料庫';
    }
  }
}

// ---------- 📸 AI 智慧辨識菜單一鍵匯入 (`aiMenuScannerModal`) ----------
function openAiMenuScannerModal() {
  state.aiScannedItems = [];
  state.aiScanImageDataUrl = '';
  document.getElementById('aiMenuRawText').value = '';
  document.getElementById('aiMenuImagePreview').style.display = 'none';
  document.getElementById('aiScannedPreviewBox').innerHTML = '';
  document.getElementById('aiMenuScannerModal').classList.add('open');
}

function closeAiMenuScannerModal() {
  document.getElementById('aiMenuScannerModal').classList.remove('open');
}

function handleMenuImageUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    state.aiScanImageDataUrl = e.target.result;
    const imgEl = document.getElementById('aiMenuImagePreview');
    imgEl.src = state.aiScanImageDataUrl;
    imgEl.style.display = 'block';
    showToast('📸 已載入菜單照片，請點擊「🧠 開始 AI 掃描辨識」');
  };
  reader.readAsDataURL(file);
}

function fillSampleRawMenuText() {
  const sample = `【雙溪人氣新菜單 — 紙本掃描內容】
== 招牌主廚蓋飯 ==
1. 炙燒明太子鮭魚親子丼 $145 (人氣必點)
2. 秘製蔥鹽松阪豬肉飯 $125
3. 醬燒無骨雞腿排便當 $105

== 手工水餃鍋貼 (按顆計價) ==
4. 剝皮辣椒鮮肉水餃 每顆 $8 元
5. 鮮蝦韭黃脆皮鍋貼 每顆 $9 元

== 現做湯品與飲料 ==
6. 蛤蜊薑絲清湯 $45
7. 手標泰式厚奶茶 $40`;
  document.getElementById('aiMenuRawText').value = sample;
  runAiMenuRecognition();
}

/**
 * 執行 AI 菜單辨識：
 * 1. 若有 Gemini API Key，直接呼叫 Gemini 2.5 Flash 多模態模型辨識照片 (`imageBase64`) 與文字
 * 2. 內建高精準度智慧正規表示式與語意分類引擎，即時從雜亂文字/OCR 擷取分類、品名、價格、八方計價與自動配置客製群組
 */
async function runAiMenuRecognition() {
  const rawText = document.getElementById('aiMenuRawText').value.trim();
  const previewBox = document.getElementById('aiScannedPreviewBox');
  if (!rawText && !state.aiScanImageDataUrl) {
    showToast('⚠️ 請先上傳菜單照片、貼上菜單文字，或點擊「載入範例菜單」');
    return;
  }

  previewBox.innerHTML = `<div style="padding:20px; text-align:center; color:var(--indigo); font-weight:800;">🧠 AI 正在掃描解析菜單結構、自動歸納分類並生成客製化選項群組...</div>`;

  // 1. 嘗試透過 Gemini 2.5 Flash Vision API 辨識照片或文字
  if (state.geminiApiKey) {
    try {
      const sysPrompt = `你是專業餐飲 POS 系統的 AI 菜單建檔專家。
請辨識以下菜單圖片或文字，自動整理出所有餐點的「category (分類)」、「name (品名)」、「price (數字價格)」、「tag (標籤)」、「isBafangMode (若為水餃或鍋貼單顆計價設為 true)」，並根據食物種類自動生成合適的「options (客製化選項群組)」。
回傳純 JSON 陣列：
[
  {
    "category": "分類名稱",
    "name": "餐點名稱",
    "price": 120,
    "tag": "🔥 AI辨識新品",
    "isBafangMode": false,
    "options": {
      "主食份量": { "type": "radio", "choices": [["正常", 0], ["大盛加飯", 10]] },
      "辣度選擇": { "type": "radio", "choices": [["不辣", 0], ["小辣", 0]] }
    }
  }
]`;
      const parts = [{ text: sysPrompt }];
      if (rawText) parts.push({ text: rawText });
      if (state.aiScanImageDataUrl) {
        const mimeMatch = state.aiScanImageDataUrl.match(/^data:(image\/\w+);base64,/);
        parts.push({
          inlineData: {
            mimeType: mimeMatch ? mimeMatch[1] : 'image/jpeg',
            data: state.aiScanImageDataUrl.replace(/^data:image\/\w+;base64,/, '')
          }
        });
      }

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(state.geminiApiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
        })
      });
      const json = await res.json();
      const out = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (out) {
        const parsed = JSON.parse(out);
        if (Array.isArray(parsed) && parsed.length > 0) {
          state.aiScannedItems = parsed.map(m => normalizeMenuItem(m, state.merchantStoreId));
          renderAiScannedPreview('Google Gemini 2.5 Flash Vision OCR');
          return;
        }
      }
    } catch (e) {}
  }

  // 2. 智慧結構化語意解析引擎（支援各種菜單文字格式與圖片上傳模擬辨識）
  const lines = (rawText || `招牌黃金鍋貼 每顆 $7\n特製紅燒牛肉麵 $130\n招牌滷肉飯 $45\n冰鎮酸梅湯 $35`).split(/\r?\n/);
  let currentCat = 'AI 智慧歸納主餐';
  const results = [];

  lines.forEach(line => {
    const clean = line.trim();
    if (!clean) return;

    // 偵測分類標題列 (例如 == 招牌蓋飯 == 或 【手工麵食】)
    if (/^(==|【|\[|###|#)/.test(clean) && !/\$\s*\d+|\d+\s*元/.test(clean)) {
      currentCat = clean.replace(/[=【】\[\]#]/g, '').trim() || currentCat;
      return;
    }

    // 偵測「品名 + 價格」列
    const priceMatch = clean.match(/(?:NT\$|\$|＄)?\s*(\d{1,4})\s*(?:元|\/顆)?/);
    if (priceMatch) {
      const price = parseInt(priceMatch[1], 10);
      let name = clean
        .replace(/^\d+[\.\、\)\s]+/, '')
        .replace(/(?:每顆|單顆)?\s*(?:NT\$|\$|＄)?\s*\d{1,4}\s*(?:元|\/顆)?.*$/, '')
        .trim();
      if (!name) name = 'AI 辨識餐點';

      const isBafang = clean.includes('顆') || name.includes('水餃') || name.includes('鍋貼') || price <= 15;
      let autoCat = currentCat;
      if (isBafang) autoCat = '手工水餃鍋貼 (按顆計價)';
      else if (name.includes('湯') || name.includes('茶') || name.includes('飲') || name.includes('奶') || name.includes('豆漿')) autoCat = '湯品與特調飲品';
      else if (name.includes('麵') || name.includes('烏龍') || name.includes('抄手')) autoCat = '特色麵食系列';

      let autoOpts = {};
      if (isBafang) autoOpts = getDumplingBafangOptions(price);
      else if (autoCat.includes('湯') || autoCat.includes('飲')) {
        if (name.includes('茶') || name.includes('奶') || name.includes('飲')) {
          autoOpts = { '甜度冰塊': { type: 'radio', choices: [['正常甜正常冰', 0], ['微糖微冰', 0], ['無糖去冰', 0]] } };
        }
      } else if (autoCat.includes('麵')) {
        autoOpts = getStdNoodleOptions();
      } else {
        autoOpts = getStdRiceOptions();
      }

      results.push({
        id: `M-AI-${Date.now().toString().slice(-3)}-${results.length}`,
        storeId: state.merchantStoreId,
        category: autoCat,
        name,
        price,
        tag: isBafang ? '🔥 按顆計價' : '✨ AI 自動建檔',
        isBafangMode: isBafang,
        image: '',
        options: autoOpts
      });
    }
  });

  state.aiScannedItems = results;
  renderAiScannedPreview('MealFlow AI 菜單結構化辨識引擎');
}

function renderAiScannedPreview(engineName) {
  const previewBox = document.getElementById('aiScannedPreviewBox');
  if (!previewBox) return;

  if (state.aiScannedItems.length === 0) {
    previewBox.innerHTML = `<p style="color:var(--red); text-align:center; padding:14px; font-weight:700;">未偵測到包含價格的菜色，請確認每行格式如「炙燒牛五花丼 $115」</p>`;
    return;
  }

  previewBox.innerHTML = `
    <div style="background:#EEF2FF; border:1.5px solid #C7D2FE; border-radius:12px; padding:12px; margin-top:12px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:6px;">
        <span style="font-size:0.76rem; font-weight:900; color:#4338CA;">✅ ${escapeHtml(engineName)}：成功自動發現 ${state.aiScannedItems.length} 道品項與客製選項！</span>
      </div>
      <div style="max-height:210px; overflow-y:auto; display:flex; flex-direction:column; gap:6px; margin-bottom:12px;">
        ${state.aiScannedItems.map(item => `
          <div style="background:#FFFFFF; padding:8px 12px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; font-size:0.84rem;">
            <div>
              <span style="font-size:0.7rem; font-weight:800; color:var(--brand); background:var(--brand-light); padding:1px 6px; border-radius:4px; margin-right:6px;">${escapeHtml(item.category)}</span>
              <strong>${escapeHtml(item.name)}</strong>
              <span style="font-size:0.72rem; color:var(--text-secondary); margin-left:6px;">
                (自動綁定：${Object.keys(item.options || {}).length > 0 ? Object.keys(item.options).join('/') : '單點'})
              </span>
            </div>
            <strong style="color:var(--red);">${item.isBafangMode ? `$${item.price}/顆` : `$${item.price}`}</strong>
          </div>
        `).join('')}
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button type="button" class="btn-tip-action" style="flex:1;" onclick="applyAiScannedMenus('APPEND')">
          ➕ 一鍵追加匯入 (${state.aiScannedItems.length} 道新菜加入現有菜單)
        </button>
        <button type="button" class="filter-chip" style="border-color:var(--red); color:var(--red);" onclick="applyAiScannedMenus('REPLACE')">
          🔄 覆蓋取代整份菜單
        </button>
      </div>
    </div>
  `;
}

function applyAiScannedMenus(mode) {
  if (state.aiScannedItems.length === 0) return;
  if (mode === 'REPLACE') {
    if (!window.confirm('確定要用 AI 辨識出的新菜單覆蓋目前所有品項嗎？')) return;
    state.adminMenuData = JSON.parse(JSON.stringify(state.aiScannedItems));
  } else {
    state.adminMenuData = [...state.adminMenuData, ...JSON.parse(JSON.stringify(state.aiScannedItems))];
  }

  state.isMenuDirty = true;
  const store = state.stores.find(s => s.id === state.merchantStoreId);
  if (store) {
    store.menus = JSON.parse(JSON.stringify(state.adminMenuData));
    saveLocalStores(state.stores);
  }

  closeAiMenuScannerModal();
  renderMerchantView();
  showToast(`🎉 已成功匯入 ${state.aiScannedItems.length} 道餐點！您可繼續手動微調或點擊儲存至雲端`);
}

// ---------- 模組 D：店家 AI 分流優惠與產能設定 ----------
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
  saveLocalStores(state.stores);

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
    saveLocalStores(state.stores);
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
  saveLocalStores(state.stores);
  applyRouteView();
  showToast(mode === 'PEAK'
    ? '🔥 已啟動「中午 12:10 尖峰塞車」情境！M/M/1 佇列分流已觸發'
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

function applyCloudBundle(bundle) {
  if (!bundle) return;
  if (Array.isArray(bundle.stores) && bundle.stores.length > 0) {
    // 合併雲端店家狀態，同時保留本機剛編輯過但尚未覆蓋的豐富客製化菜單
    state.stores = bundle.stores.map(cloudStore => {
      const localStore = state.stores.find(l => l.id === cloudStore.id);
      const cloudMenusHasOpts = (cloudStore.menus || []).some(m => m.options && Object.keys(m.options).length > 0);
      return {
        ...cloudStore,
        menus: cloudMenusHasOpts ? cloudStore.menus : (localStore ? localStore.menus : cloudStore.menus)
      };
    });
    saveLocalStores(state.stores);
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
    setSyncState('offline', '已同步本機快取');
    if (showFeedback) showToast('⚠️ 目前使用本機快取資料展示');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  detectRouteFromUrl();
  applyRouteView();
  syncCloud(false);
});
