/**
 * 東吳學餐 MealFlow v4.0 - 商用掃碼點餐 + 櫃檯 POS 收銀 + 真 AI 決策系統
 *
 * 1. 為什麼知道哪筆訂單是我的？
 *    - 預設打開 /order/ 時，完全不會出現任何假訂單提示！
 *    - 只有當使用者在「這台裝置親手送出訂單」後，系統才會產生一組唯一亂碼憑證 (例如 ?id=ORD-8f92a1c4b7e0)
 *      並跳轉至該專屬網址，同時把該憑證存在這支手機自己的 sessionStorage/localStorage。
 * 2. 真實商用點餐 UI：
 *    - 學生端 (/order/)：支援 AI 選餐顧問、店家分類菜單、份量/辣度/加料客製化、內用/外帶選擇、購物車明細。
 *    - 店家端 (/store/)：內建「🖥️ 櫃檯 POS 現場點餐收銀機」(幫現場客點餐、算找零、直接出單) + 「👨‍🍳 廚房 KDS 與 AI 流量控制台」。
 * 3. 真 AI 雙引擎：
 *    - 支援直接呼叫 Google Gemini 2.5 Flash API (可由後端 GAS 或前端直接呼叫) + M/M/1 佇列理論效用評分模型 (Utility Scoring)。
 */

const GAS_URL = 'https://script.google.com/macros/s/AKfycbzVXQRKZfnhgM_BhW6pgy1VOCg7YmCdfnAdHOS_9Tt7agxQa2r69hwg1UGL73gpoVwp/exec';

const STORE_ICONS = {
  'S01': '🍙', 'S02': '🍱', 'S03': '🥟', 'S04': '🍗',
  'S05': '🍛', 'S06': '🥩', 'S07': '🍜'
};

const DISH_ICONS = {
  'M01': '🍙', 'M02': '🍤', 'M03': '🐟', 'M18': '🥣', 'M22': '🥤',
  'M04': '🥩', 'M05': '🐷', 'M06': '🍜', 'M19': '🍗', 'M23': '🍵',
  'M07': '🥟', 'M08': '🥟', 'M20': '🥛', 'M24': '🥒',
  'M09': '🍗', 'M10': '🍱', 'M21': '🧈', 'M25': '🍲',
  'M11': '🍛', 'M12': '🍔', 'M26': '🧀', 'M27': '🥤',
  'M13': '🥩', 'M14': '🍖', 'M15': '🍜', 'M28': '🥬',
  'M16': '🍜', 'M17': '🥣', 'M29': '🥚'
};

// 豐富完整的東吳學餐真實菜單（包含主餐、單點小食、湯品飲品）
const DEFAULT_STORES = [
  {
    id: 'S01', campus: '雙溪校區', name: '趙班長海苔飯捲', category: '人氣韓式・飯捲',
    maxCapacityPer15Min: 18, activeOrders: 17, avgPrepMinutes: 22,
    promoMode: 'none', promoText: '無優惠', promoDiscount: 0, predictedDailyOrders: 240, rating: 4.9,
    menus: [
      { id: 'M01', name: '特製韓式泡菜燒肉飯捲', price: 75, cat: '主餐', desc: '道地韓式發酵泡菜搭配秘製梅花燒肉', tag: '🔥 必點人氣' },
      { id: 'M02', name: '起司炸蝦海苔飯捲', price: 85, cat: '主餐', desc: '整尾酥炸白蝦佐香濃切達起司片', tag: '⭐ 主廚推薦' },
      { id: 'M03', name: '經典鮪魚玉米飯捲', price: 65, cat: '主餐', desc: '特調洋蔥鮪魚沙拉與香甜玉米粒', tag: '⚡ 快速出餐' },
      { id: 'M18', name: '韓式魚板蘿蔔湯', price: 35, cat: '小食/湯飲', desc: '釜山進口魚板與清甜白蘿蔔高湯', tag: '🥣 暖胃湯品' },
      { id: 'M22', name: '韓國進口水蜜桃果粒飲', price: 40, cat: '小食/湯飲', desc: '吃得到真實水蜜桃果肉', tag: '🥤 人氣飲品' }
    ]
  },
  {
    id: 'S02', campus: '雙溪校區', name: '雙溪-丼物園', category: '日式蓋飯・烏龍麵',
    maxCapacityPer15Min: 20, activeOrders: 4, avgPrepMinutes: 5,
    promoMode: 'gift', promoText: '🎁 AI分流招待：免費溫泉蛋乙顆', promoDiscount: 0, predictedDailyOrders: 165, rating: 4.7,
    menus: [
      { id: 'M04', name: '炙燒起司牛五花丼', price: 115, cat: '主餐', desc: '主廚炙燒雙色起司與日式壽喜燒牛五花', tag: '🔥 招牌必點' },
      { id: 'M05', name: '黃金厚切豬排滑蛋丼', price: 120, cat: '主餐', desc: '現炸 2cm 厚切里肌豬排與半熟滑蛋', tag: '⭐ 飽足首選' },
      { id: 'M06', name: '讚岐胡麻冷烏龍麵', price: 95, cat: '主餐', desc: 'Q彈讚岐烏龍佐濃郁焙煎胡麻醬', tag: '⚡ 3分極速出餐' },
      { id: 'M19', name: '日式唐揚炸雞 (5塊)', price: 55, cat: '小食/湯飲', desc: '生薑醬油醃漬去骨雞腿肉現炸', tag: '🍗 人氣單點' },
      { id: 'M23', name: '日式無糖玄米綠茶', price: 30, cat: '小食/湯飲', desc: '清爽解膩現萃玄米茶', tag: '🍵 解膩首選' }
    ]
  },
  {
    id: 'S03', campus: '雙溪校區', name: '雙溪-四海遊龍', category: '鍋貼水餃・麵食',
    maxCapacityPer15Min: 25, activeOrders: 19, avgPrepMinutes: 16,
    promoMode: 'none', promoText: '無優惠', promoDiscount: 0, predictedDailyOrders: 210, rating: 4.6,
    menus: [
      { id: 'M07', name: '招牌鍋貼套餐 (10顆+酸辣湯)', price: 105, cat: '主餐', desc: '底部焦香脆皮招牌鍋貼配經典酸辣湯', tag: '🔥 經典組合' },
      { id: 'M08', name: '高麗菜鮮肉水餃 (12顆)', price: 78, cat: '主餐', desc: '每日現包梨山脆甜高麗菜水餃', tag: '⚡ 快速出餐' },
      { id: 'M24', name: '涼拌小黃瓜', price: 35, cat: '小食/湯飲', desc: '蒜香清脆開胃小菜', tag: '🥒 開胃小菜' },
      { id: 'M20', name: '冰鎮非基改無糖豆漿', price: 25, cat: '小食/湯飲', desc: '濃純香現磨豆漿', tag: '🥛 必配飲品' }
    ]
  },
  {
    id: 'S04', campus: '雙溪校區', name: '蒲家廚房', category: '中式特餐・便當',
    maxCapacityPer15Min: 20, activeOrders: 5, avgPrepMinutes: 6,
    promoMode: 'discount', promoText: '💰 AI分流折抵：現折 $10 元', promoDiscount: 10, predictedDailyOrders: 150, rating: 4.8,
    menus: [
      { id: 'M09', name: '秘製椒麻雞腿飯 (含3配菜)', price: 110, cat: '主餐', desc: '酥脆大雞腿淋上雲南花椒酸甜醬汁', tag: '🔥 銷量冠軍' },
      { id: 'M10', name: '蒜泥白肉精緻便當 (含3配菜)', price: 100, cat: '主餐', desc: '嚴選五花薄片佐古早味蒜蓉醬油膏', tag: '⚡ 極速便當' },
      { id: 'M21', name: '黃金脆皮炸豆腐', price: 40, cat: '小食/湯飲', desc: '外酥內嫩搭配台式泡菜', tag: '✨ 招牌小菜' },
      { id: 'M25', name: '每日例湯 (紫菜蛋花湯)', price: 25, cat: '小食/湯飲', desc: '大骨熬製清爽家常湯品', tag: '🍲 熱湯' }
    ]
  },
  {
    id: 'S05', campus: '城中校區', name: '城中-咖哩食堂', category: '熟成咖哩・炸物',
    maxCapacityPer15Min: 15, activeOrders: 16, avgPrepMinutes: 26,
    promoMode: 'none', promoText: '無優惠', promoDiscount: 0, predictedDailyOrders: 195, rating: 4.8,
    menus: [
      { id: 'M11', name: '唐揚炸雞熟成咖哩飯', price: 125, cat: '主餐', desc: '48小時蔬果熬製濃厚日式熟成咖哩', tag: '🔥 排隊人氣' },
      { id: 'M12', name: '手打漢堡排歐姆蛋咖哩', price: 135, cat: '主餐', desc: '厚實多汁牛豬混合手打漢堡排', tag: '⭐ 限量供應' },
      { id: 'M26', name: '酥炸莫札瑞拉起司條 (3入)', price: 50, cat: '小食/湯飲', desc: '超長牽絲濃郁起司條', tag: '🧀 邪惡點心' },
      { id: 'M27', name: '沖繩黑糖奶茶', price: 40, cat: '小食/湯飲', desc: '手炒黑糖香氣濃郁', tag: '🥤 人氣飲品' }
    ]
  },
  {
    id: 'S06', campus: '城中校區', name: '城中-吳葉食堂', category: '精緻台式簡餐',
    maxCapacityPer15Min: 20, activeOrders: 3, avgPrepMinutes: 4,
    promoMode: 'gift', promoText: '🎁 AI分流招待：免費招牌冰紅茶', promoDiscount: 0, predictedDailyOrders: 145, rating: 4.9,
    menus: [
      { id: 'M13', name: '蔥爆牛肉鐵板簡餐', price: 115, cat: '主餐', desc: '大火快炒宜蘭三星蔥與鮮嫩牛里肌', tag: '🔥 現點現做' },
      { id: 'M14', name: '古早味排骨特餐', price: 105, cat: '主餐', desc: '獨家五香滷汁先炸後滷入味排骨', tag: '⚡ 4分極速取餐' },
      { id: 'M15', name: '手工鮮蝦紅油抄手麵', price: 90, cat: '主餐', desc: '整隻鮮蝦雲吞佐四川微麻紅油醬', tag: '⭐ 學生最愛' },
      { id: 'M28', name: '蒜香燙青菜 (季節時蔬)', price: 35, cat: '小食/湯飲', desc: '補充膳食纖維首選', tag: '🥬 健康配菜' }
    ]
  },
  {
    id: 'S07', campus: '城中校區', name: '大熊涼麵 X 吃好食堂', category: '手工涼麵・味噌湯',
    maxCapacityPer15Min: 25, activeOrders: 6, avgPrepMinutes: 3,
    promoMode: 'points', promoText: '⚡ AI分流回饋：雙倍 MealPoints 點數', promoDiscount: 0, predictedDailyOrders: 160, rating: 4.7,
    menus: [
      { id: 'M16', name: '川味麻辣雞絲涼麵 (大)', price: 75, cat: '主餐', desc: '純芝麻醬與花椒辣油完美融合', tag: '⚡ 2分秒取' },
      { id: 'M17', name: '綜合三合一味噌湯 (貢丸+蛋花)', price: 45, cat: '小食/湯飲', desc: '柴魚高湯現打滑順蛋花與新竹貢丸', tag: '🔥 絕配湯品' },
      { id: 'M29', name: '秘滷溏心蛋 (乙顆)', price: 20, cat: '小食/湯飲', desc: '冰涼入味膏狀蛋黃', tag: '🥚 必加配料' }
    ]
  }
];

function loadCachedOrders() {
  try {
    const raw = localStorage.getItem('mealflow_orders_v4');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return [
    {
      orderId: 'ORD-8f92a1c4b7e0', pickupNumber: 'S208', storeId: 'S02', storeName: '雙溪-丼物園',
      studentId: 'QR掃碼預訂', studentName: '外帶自取',
      itemsJson: JSON.stringify([{ id: 'M04', name: '炙燒起司牛五花丼 (正常/不辣)', price: 115, qty: 1 }]),
      subtotal: 115, discount: 0, finalTotal: 115,
      promoApplied: '🎁 AI分流招待：免費溫泉蛋乙顆',
      pickupTimeSlot: '12:10 下課取餐', paymentMethod: 'LINE Pay', status: '製作中',
      isDivertedOrder: true, createdAt: '12:02:15'
    }
  ];
}

function saveCachedOrders(orders) {
  try {
    localStorage.setItem('mealflow_orders_v4', JSON.stringify(orders.slice(0, 60)));
  } catch (e) {}
}

let state = {
  routeMode: 'portal', // 'portal' | 'order' | 'ticket' | 'store'
  trackingOrderId: null,
  // 只有當使用者在「這支手機瀏覽器」真的送出過訂單，才會存入 myCreatedOrderId；預設為 null，絕不亂顯示別人的訂單！
  myCreatedOrderId: sessionStorage.getItem('mealflow_my_created_order_id') || null,
  campus: '雙溪校區',
  filter: 'ALL',
  stores: JSON.parse(JSON.stringify(DEFAULT_STORES)),
  aiRecommendations: {},
  orders: loadCachedOrders(),

  // 學生點餐 Modal 狀態
  activeStore: null,
  menuCatFilter: 'ALL',
  cart: {},
  customOpts: {
    dineType: '外帶自取',
    riceSize: '正常份量',
    spicy: '不辣',
    addons: [], // ['加起司+$15', '加溫泉蛋+$15']
    note: '',
    phoneLast3: ''
  },

  // 店家端 (/store/) 狀態：支援 'pos' (櫃檯現場點餐收銀) 與 'kds' (廚房出單與AI設定)
  storeTabMode: 'pos',
  merchantStoreId: 'S02',
  merchantPromoMode: 'gift',
  posCart: [], // [{ id, name, price, qty, note }]
  posDineType: '內用',
  posCustomTags: [],
  posCashReceived: '',

  // Gemini API Key (可選填，用於現場展示真實 LLM 生成)
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
  for (let i = 0; i < 12; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * M/M/1 佇列模型與 Little's Law 推算預估等待時間（分鐘）
 */
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

/**
 * 多目標效用函數 (Multi-Objective Utility Function) 計算 AI 推薦分數 (0~99)
 */
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

function enrichStoresAndAi() {
  state.stores = state.stores.map(s => {
    // 若雲端傳回的店家缺少小菜分類，自動補齊預設完整菜單描述
    const defStore = DEFAULT_STORES.find(d => d.id === s.id);
    const mergedMenus = (s.menus && s.menus.length >= 4)
      ? s.menus
      : (defStore ? defStore.menus : (s.menus || []));

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
      menus: mergedMenus
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

// ==================== 網址與路由管理 ====================
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
  toastTimer = setTimeout(() => { t.style.display = 'none'; }, 3200);
}

// ==================== 路由視圖切換 ====================
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

  const campusSwitcher = document.getElementById('headerCampusSwitcher');
  if (campusSwitcher) {
    campusSwitcher.style.display = state.routeMode === 'order' ? 'inline-flex' : 'none';
  }

  const roleBadge = document.getElementById('headerRoleBadge');
  if (roleBadge) {
    if (state.routeMode === 'store') {
      roleBadge.innerText = '🏪 店家 POS 收銀 & KDS 後台';
      roleBadge.style.background = '#111827';
      roleBadge.style.color = '#FFFFFF';
    } else if (state.routeMode === 'ticket') {
      roleBadge.innerText = '🎟️ 訂單專屬追蹤憑證';
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
  const aiResp = document.getElementById('aiConciergeResponse');
  if (aiResp) aiResp.classList.remove('show');
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
  const sampleTicketUrl = getOrderPageUrl('id=ORD-8f92a1c4b7e0');

  const box = document.getElementById('portalContentBox');
  if (!box) return;
  box.innerHTML = `
    <div style="text-align:center; padding: 14px 0 22px;">
      <div style="display:inline-block; background:#EEF2FF; color:#4338CA; font-weight:800; font-size:0.78rem; padding:4px 12px; border-radius:999px; margin-bottom:10px;">
        🧠 M/M/1 佇列模型 × Google Gemini 生成式 AI 雙引擎驅動
      </div>
      <h1 style="font-size:1.55rem; font-weight:900; margin-bottom:8px;">東吳學餐 MealFlow 智慧點餐與 POS 系統</h1>
      <p style="font-size:0.86rem; color:var(--text-secondary); max-width:560px; margin:0 auto;">
        完全比照真實餐飲商用架構，拆分為<strong>學生手機掃碼點餐端 (<code>/order/</code>)</strong>、<strong>點完餐跳轉的亂碼憑證頁 (<code>?id=ORD-xxx</code>)</strong>與<strong>店家櫃檯 POS 收銀 + 廚房 KDS 後台 (<code>/store/</code>)</strong>。
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
              內建「✨ MealFlow AI 選餐顧問」、完整分類菜單、辣度/加飯/加料客製化與購物車。送出訂單後自動產生唯一亂碼網址並跳轉至電子號碼牌。
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
              <span class="wait-pill" style="background:#F3F4F6; color:#111827;">店家平板 POS + KDS</span>
            </div>
            <h2 style="font-size:1.18rem; font-weight:900; margin-bottom:4px;">店家櫃檯 POS 點餐 & 廚房後台</h2>
            <code style="display:block; font-size:0.76rem; color:#111827; background:#F3F4F6; padding:5px 8px; border-radius:6px; margin-bottom:10px;">
              /scu.meal/store/
            </code>
            <p style="font-size:0.84rem; color:var(--text-secondary); margin-bottom:14px;">
              支援店員幫現場客快速點餐收銀（方塊按鍵、自動算找零、現場出號）＋ 廚房 KDS 語音讀單、一鍵叫號取餐與 AI 動態分流優惠設定。
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

// ==================== 2. 真 AI 智慧選餐顧問 (Gemini API + Queueing Utility Engine) ====================
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

  // 1. 若前端有設定 Gemini API Key，直接從瀏覽器呼叫 Google Gemini 2.5 Flash 實時生成
  if (state.geminiApiKey) {
    try {
      const storeContext = campusStores.map(s => ({
        storeId: s.id,
        name: s.name,
        waitMinutes: s.avgPrepMinutes,
        loadPct: s.loadPercentage,
        promo: s.promoText,
        aiUtilityScore: s.aiScore,
        menus: s.menus.map(m => `${m.id}:${m.name}($${m.price},${m.desc || ''})`).join('; ')
      }));

      const prompt = `你是東吳大學「MealFlow 學餐 AI 流量管制與選餐顧問」。
目前校區：${state.campus}
學生需求：「${query}」
即時各餐廳佇列與菜單數據：${JSON.stringify(storeContext)}

請根據佇列等待時間、優惠活動與學生需求，挑選最適合的 1 家餐廳與 1 道主餐，回傳純 JSON：
{
  "reasoning": "90字內的具體分析（說明避開哪家塞車店、省下幾分鐘、為何這道菜符合他的需求與優惠）",
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
        const parsed = JSON.parse(text);
        renderAiConciergeResult(parsed);
        return;
      }
    } catch (e) {}
  }

  // 2. 結合情境語意特徵匹配 + M/M/1 佇列效用演算法推理
  let candidates = [];
  campusStores.forEach(s => {
    (s.menus || []).forEach(m => {
      let score = s.aiScore;
      const q = query.toLowerCase();
      if ((q.includes('趕時間') || q.includes('10分鐘') || q.includes('快')) && s.avgPrepMinutes <= 6) score += 25;
      if ((q.includes('100') || q.includes('省錢') || q.includes('便宜') || q.includes('cp')) && (m.price - (s.promoDiscount || 0) <= 100)) score += 22;
      if ((q.includes('辣') || q.includes('重口味')) && (m.name.includes('辣') || m.name.includes('泡菜') || m.name.includes('椒麻') || m.name.includes('紅油'))) score += 28;
      if ((q.includes('肉') || q.includes('蛋白') || q.includes('飽')) && (m.name.includes('牛') || m.name.includes('豬排') || m.name.includes('雞腿') || m.name.includes('排骨'))) score += 24;
      if (m.cat === '主餐') score += 10;
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
    engine: 'MealFlow Queueing Utility AI Engine v4.0'
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
      <button class="btn-tip-action" style="padding:7px 14px; font-size:0.8rem;" onclick="openStoreMenu('${escapeHtml(targetStore.id)}', '${escapeHtml(targetMenu.id)}')">
        ⚡ 一鍵帶入點餐 ➔
      </button>
    </div>
  `;
}

function promptGeminiKeyConfig() {
  const cur = state.geminiApiKey || '';
  const input = window.prompt('【選填】輸入 Google Gemini API Key 即可啟用雲端 Gemini 2.5 Flash 實時生成（留空則使用內建 M/M/1 佇列效用 AI 引擎）：', cur);
  if (input !== null) {
    state.geminiApiKey = input.trim();
    try { localStorage.setItem('mealflow_gemini_key', state.geminiApiKey); } catch (e) {}
    showToast(state.geminiApiKey ? '✅ 已啟用 Google Gemini 2.5 Flash 實時推理引擎！' : '✅ 已切換為內建 M/M/1 佇列效用 AI 引擎');
  }
}

// ==================== 3. 學生掃碼點餐頁 (/order/) ====================
function renderStoreList() {
  enrichStoresAndAi();

  // 只有當「這台手機瀏覽器在本次工作階段真的親手送出過訂單 (myCreatedOrderId)」時，才顯示返回該訂單的浮條！
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
          <button class="btn-tip-action" onclick="openStoreMenu('${escapeHtml(rec.recommendedStoreId)}')">領優惠免排隊 ➔</button>
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
      <div class="store-card ${isRecTarget ? 'recommended' : ''}" onclick="openStoreMenu('${escapeHtml(s.id)}')">
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
            ⭐ ${s.rating} ・ ${escapeHtml(s.category)} ・ 佇列 ${s.activeOrders}/${s.maxCapacityPer15Min} 單 (${s.loadPercentage}%)
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

// ==================== 真實商用點餐抽屜 (分類 Tab + 客製化選項 + 購物車) ====================
function openStoreMenu(storeId, preselectMenuId) {
  const store = state.stores.find(s => s.id === storeId);
  if (!store) return;

  state.activeStore = store;
  state.menuCatFilter = 'ALL';
  state.cart = {};
  state.customOpts = {
    dineType: '外帶自取',
    riceSize: '正常份量',
    spicy: '不辣',
    addons: [],
    note: '',
    phoneLast3: ''
  };

  if (preselectMenuId) {
    state.cart[preselectMenuId] = 1;
  } else if (store.menus && store.menus.length > 0) {
    state.cart[store.menus[0].id] = 1;
  }

  document.getElementById('sheetStoreName').innerText = store.name;
  document.getElementById('sheetStoreMeta').innerText =
    `${store.campus} ・ 目前待製 ${store.activeOrders} 單（預估約 ${store.avgPrepMinutes} 分鐘取餐｜AI 效用 ${store.aiScore} 分）`;

  const promoBanner = document.getElementById('sheetPromoBanner');
  if (isStorePromoActive(store)) {
    promoBanner.style.display = 'block';
    promoBanner.innerText = `🎉 本單已自動套用 AI 分流優惠：${store.promoText}`;
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

function setMenuCatFilter(cat) {
  state.menuCatFilter = cat;
  ['ALL', '主餐', '小食/湯飲'].forEach(c => {
    const el = document.getElementById('catTab-' + c);
    if (el) el.classList.toggle('active', c === cat);
  });
  renderSheetMenu();
}

function changeQty(menuId, delta) {
  const cur = state.cart[menuId] || 0;
  const next = Math.max(0, cur + delta);
  if (next === 0) delete state.cart[menuId];
  else state.cart[menuId] = next;
  renderSheetMenu();
}

function setCustomOpt(key, val) {
  state.customOpts[key] = val;
  renderSheetMenu();
}

function toggleAddon(addonStr) {
  const idx = state.customOpts.addons.indexOf(addonStr);
  if (idx >= 0) state.customOpts.addons.splice(idx, 1);
  else state.customOpts.addons.push(addonStr);
  renderSheetMenu();
}

function getAddonExtraPrice() {
  let extra = 0;
  if (state.customOpts.riceSize === '大盛加飯+$10') extra += 10;
  state.customOpts.addons.forEach(a => {
    if (a.includes('+15')) extra += 15;
    if (a.includes('+10')) extra += 10;
  });
  return extra;
}

function renderSheetMenu() {
  const store = state.activeStore;
  if (!store) return;

  const allMenus = store.menus || [];
  const filteredMenus = state.menuCatFilter === 'ALL'
    ? allMenus
    : allMenus.filter(m => (m.cat || '主餐') === state.menuCatFilter);

  const dishesHtml = filteredMenus.map(m => {
    const qty = state.cart[m.id] || 0;
    const icon = DISH_ICONS[m.id] || '🍱';
    return `
      <div class="menu-dish-card">
        <div class="dish-icon-box">${icon}</div>
        <div style="flex:1; min-width:0;">
          <div class="item-title">
            ${escapeHtml(m.name)}
            ${m.tag ? `<span class="item-tag">${escapeHtml(m.tag)}</span>` : ''}
          </div>
          <div class="item-desc">${escapeHtml(m.desc || '現點現做招牌餐點')}</div>
          <div class="item-price">$${m.price}</div>
        </div>
        ${qty === 0 ? `
          <button class="btn-add-dish" onclick="changeQty('${escapeHtml(m.id)}', 1)">＋ 加入</button>
        ` : `
          <div class="qty-stepper">
            <button class="step-btn" onclick="changeQty('${escapeHtml(m.id)}', -1)">－</button>
            <span style="font-weight:800; min-width:18px; text-align:center;">${qty}</span>
            <button class="step-btn plus" onclick="changeQty('${escapeHtml(m.id)}', 1)">＋</button>
          </div>
        `}
      </div>
    `;
  }).join('');

  // 計算小計與加購金額
  let itemTotalQty = 0;
  let subtotal = 0;
  allMenus.forEach(m => {
    const q = state.cart[m.id] || 0;
    itemTotalQty += q;
    subtotal += m.price * q;
  });

  const addonPrice = itemTotalQty > 0 ? getAddonExtraPrice() : 0;
  subtotal += addonPrice;

  const customHtml = `
    <div class="custom-options-box">
      <div style="font-size:0.86rem; font-weight:800; margin-bottom:8px;">🎛️ 餐點客製化與用餐選項</div>

      <label class="field-label">🍽️ 用餐方式</label>
      <div class="opt-pill-row">
        ${['外帶自取', '內用'].map(d => `
          <button type="button" class="opt-pill ${state.customOpts.dineType === d ? 'active' : ''}" onclick="setCustomOpt('dineType', '${d}')">${d}</button>
        `).join('')}
      </div>

      <label class="field-label">🍚 主食份量調整</label>
      <div class="opt-pill-row">
        ${['正常份量', '飯少 (減醣)', '大盛加飯+$10'].map(r => `
          <button type="button" class="opt-pill ${state.customOpts.riceSize === r ? 'active' : ''}" onclick="setCustomOpt('riceSize', '${r}')">${r}</button>
        `).join('')}
      </div>

      <label class="field-label">🌶️ 辣度選擇</label>
      <div class="opt-pill-row">
        ${['不辣', '微辣', '小辣', '中辣'].map(sp => `
          <button type="button" class="opt-pill ${state.customOpts.spicy === sp ? 'active' : ''}" onclick="setCustomOpt('spicy', '${sp}')">${sp}</button>
        `).join('')}
      </div>

      <label class="field-label">➕ 人氣加料區 (可複選)</label>
      <div class="opt-pill-row">
        ${['加香濃起司+15', '加溏心溫泉蛋+15', '加韓式泡菜+10', '不要蔥花/香菜'].map(ad => `
          <button type="button" class="opt-pill ${state.customOpts.addons.includes(ad) ? 'active' : ''}" onclick="toggleAddon('${ad}')">${ad}</button>
        `).join('')}
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:4px;">
        <div>
          <label class="field-label">📝 廚房備註 (選填)</label>
          <input type="text" class="select-input" placeholder="例：醬汁分開、餐具自備" value="${escapeHtml(state.customOpts.note)}" oninput="state.customOpts.note=this.value">
        </div>
        <div>
          <label class="field-label">📱 手機末三碼 (取餐核對用，選填)</label>
          <input type="tel" maxlength="3" class="select-input" placeholder="例：888 (免填亦可)" value="${escapeHtml(state.customOpts.phoneLast3)}" oninput="state.customOpts.phoneLast3=this.value">
        </div>
      </div>
    </div>
  `;

  document.getElementById('sheetMenuContainer').innerHTML = `
    <div class="menu-card-grid">${dishesHtml}</div>
    ${customHtml}
  `;

  let discount = 0;
  const noteEl = document.getElementById('sheetDiscountNote');
  if (subtotal > 0 && isStorePromoActive(store) && store.promoMode === 'discount') {
    discount = Number(store.promoDiscount) || 10;
    noteEl.innerText = `(已折抵 -$${discount})`;
  } else {
    noteEl.innerText = '';
  }

  const finalTotal = Math.max(0, subtotal - discount);
  document.getElementById('sheetTotalPrice').innerText = `$${finalTotal}`;
  const submitBtn = document.getElementById('submitOrderBtn');
  if (submitBtn) {
    submitBtn.innerHTML = `
      <span>🛒 已選 ${itemTotalQty} 項・確認結帳</span>
      <span>$${finalTotal} ➔</span>
    `;
  }
}

/**
 * 學生送出掃碼訂單 -> 產生亂碼憑證網址 (?id=ORD-xxx) -> 跳轉至電子取餐單
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

  // 把客製化選項附加為明細說明
  const customParts = [
    state.customOpts.dineType,
    state.customOpts.riceSize,
    state.customOpts.spicy,
    ...state.customOpts.addons
  ];
  if (state.customOpts.note) customParts.push(`備註:${state.customOpts.note}`);
  const addonExtra = getAddonExtraPrice();
  if (addonExtra > 0) {
    subtotal += addonExtra;
    items.push({ id: 'CUSTOM', name: `客製加購 (${customParts.join('/')})`, price: addonExtra, qty: 1 });
  } else {
    items[0].name = `${items[0].name} (${customParts.join('/')})`;
  }

  const btn = document.getElementById('submitOrderBtn');
  btn.disabled = true;
  btn.innerText = '⏳ 正在產生專屬訂單憑證...';

  const promoActive = isStorePromoActive(store);
  const discount = (promoActive && store.promoMode === 'discount') ? (Number(store.promoDiscount) || 10) : 0;
  const finalTotal = Math.max(0, subtotal - discount);
  const promoApplied = promoActive ? store.promoText : '一般預訂';
  const pickupTimeSlot = document.getElementById('pickupSlotSelect').value;
  const paymentMethod = document.getElementById('paymentSelect').value;

  const orderId = generateOrderToken();
  const prefix = store.campus === '城中校區' ? 'C' : 'S';
  const pickupNumber = prefix + String(Math.floor(100 + Math.random() * 899));
  const nowTime = new Date().toLocaleTimeString('zh-TW', { hour12: false });
  const customerNote = `${state.customOpts.dineType}${state.customOpts.phoneLast3 ? '・末碼' + state.customOpts.phoneLast3 : ''}`;

  const newOrder = {
    orderId,
    pickupNumber,
    storeId: store.id,
    storeName: store.name,
    studentId: '📱 掃碼點餐',
    studentName: customerNote,
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
        orderSource: '📱 掃碼點餐',
        customerNote,
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
      newOrder.orderId = data.order.orderId || newOrder.orderId;
      newOrder.pickupNumber = data.order.pickupNumber || newOrder.pickupNumber;
    }
    setSyncState('online', '已同步');
  } catch (e) {
    setSyncState('offline', '離線暫存模式');
  } finally {
    btn.disabled = false;
  }

  state.orders.unshift(newOrder);
  saveCachedOrders(state.orders);
  store.activeOrders += 1;
  store.avgPrepMinutes = calcPrepMinutes(store.activeOrders, store.maxCapacityPer15Min);

  closeMenuModal();
  navigateToOrderTicket(newOrder.orderId);
  showToast(`🎉 訂單已成立！取餐號碼：${newOrder.pickupNumber}`);
}

// ==================== 4. 專屬訂單追蹤頁 (/order/?id=ORD-xxx) ====================
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
  let statusSub = `預估約 ${waitMin} 分鐘內完成，請保留此專屬網頁作為領餐憑證`;

  if (isReady) {
    statusHeroColor = 'var(--green)';
    statusHeroBg = 'var(--green-bg)';
    statusTitle = '🔔 餐點已製作完成！請前往取餐';
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
          <span style="font-size:0.82rem; color:var(--text-secondary);">付款：${escapeHtml(order.paymentMethod)}</span>
          <span style="font-size:1.25rem; font-weight:900; color:var(--text-primary);">總計 $${order.finalTotal}</span>
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
        <button class="filter-chip" style="flex:1; padding:12px;" onclick="navigateToOrderMenu()">← 返回學餐列表再點一單</button>
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

// ==================== 5. 店家專屬後台 (/store/)：櫃檯 POS 點餐收銀 + 廚房 KDS ====================
function switchStoreTabMode(mode) {
  state.storeTabMode = mode; // 'pos' | 'kds'
  const btnPos = document.getElementById('tabBtnStorePos');
  const btnKds = document.getElementById('tabBtnStoreKds');
  const panelPos = document.getElementById('storePosPanel');
  const panelKds = document.getElementById('storeKdsPanel');

  if (btnPos) btnPos.classList.toggle('active', mode === 'pos');
  if (btnKds) btnKds.classList.toggle('active', mode === 'kds');
  if (panelPos) panelPos.style.display = mode === 'pos' ? 'block' : 'none';
  if (panelKds) panelKds.style.display = mode === 'kds' ? 'block' : 'none';

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
  state.posCart = [];
  state.posCustomTags = [];
  state.posCashReceived = '';
  renderMerchantView();
}

function renderMerchantView() {
  initMerchantSelect();
  const store = state.stores.find(s => s.id === state.merchantStoreId) || state.stores[0];
  if (!store) return;

  // 渲染 POS 櫃檯點餐收銀介面
  renderPosCashierPanel(store);

  // 渲染 KDS 廚房佇列與 AI 分流控制台
  const predEl = document.getElementById('merchPredictLabel');
  if (predEl) {
    // 動態推算溢流攔截效益
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

  renderMerchantOrdersOnly();
}

// ---------- 店家櫃檯 POS 快速收銀系統 ----------
function posAddDish(menuId) {
  const store = state.stores.find(s => s.id === state.merchantStoreId);
  if (!store) return;
  const menu = (store.menus || []).find(m => m.id === menuId);
  if (!menu) return;

  const existing = state.posCart.find(i => i.id === menu.id);
  if (existing) existing.qty += 1;
  else state.posCart.push({ id: menu.id, name: menu.name, price: menu.price, qty: 1 });
  renderPosCashierPanel(store);
}

function posChangeItemQty(menuId, delta) {
  const idx = state.posCart.findIndex(i => i.id === menuId);
  if (idx < 0) return;
  state.posCart[idx].qty += delta;
  if (state.posCart[idx].qty <= 0) state.posCart.splice(idx, 1);
  const store = state.stores.find(s => s.id === state.merchantStoreId);
  if (store) renderPosCashierPanel(store);
}

function posToggleTag(tag) {
  const idx = state.posCustomTags.indexOf(tag);
  if (idx >= 0) state.posCustomTags.splice(idx, 1);
  else state.posCustomTags.push(tag);
  const store = state.stores.find(s => s.id === state.merchantStoreId);
  if (store) renderPosCashierPanel(store);
}

function posSetDineType(type) {
  state.posDineType = type;
  const store = state.stores.find(s => s.id === state.merchantStoreId);
  if (store) renderPosCashierPanel(store);
}

function posQuickCash(amount) {
  state.posCashReceived = String(amount);
  const store = state.stores.find(s => s.id === state.merchantStoreId);
  if (store) renderPosCashierPanel(store);
}

function posClearCart() {
  state.posCart = [];
  state.posCustomTags = [];
  state.posCashReceived = '';
  const store = state.stores.find(s => s.id === state.merchantStoreId);
  if (store) renderPosCashierPanel(store);
}

function renderPosCashierPanel(store) {
  const gridEl = document.getElementById('posMenuGrid');
  const ticketEl = document.getElementById('posTicketBox');
  if (!gridEl || !ticketEl) return;

  // 左側：大格菜色方塊按鍵
  gridEl.innerHTML = (store.menus || []).map(m => {
    const inCart = state.posCart.find(i => i.id === m.id);
    const qtyBadge = inCart ? `<span style="background:var(--brand); color:#fff; padding:2px 8px; border-radius:999px; font-size:0.75rem; font-weight:900;">x${inCart.qty}</span>` : '';
    return `
      <button type="button" class="pos-tile-btn" onclick="posAddDish('${escapeHtml(m.id)}')">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; width:100%; gap:4px;">
          <span style="font-weight:800; font-size:0.9rem; color:var(--text-primary); line-height:1.3;">${escapeHtml(m.name)}</span>
          ${qtyBadge}
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%; margin-top:8px;">
          <span style="font-size:0.72rem; color:var(--text-secondary);">${escapeHtml(m.cat || '主餐')}</span>
          <span style="font-size:1rem; font-weight:900; color:var(--brand);">$${m.price}</span>
        </div>
      </button>
    `;
  }).join('');

  // 計算 POS 帳單金額
  let subtotal = state.posCart.reduce((acc, i) => acc + i.price * i.qty, 0);
  if (state.posCustomTags.includes('加飯+$10')) subtotal += 10;
  if (state.posCustomTags.includes('加蛋+$15')) subtotal += 15;
  if (state.posCustomTags.includes('加起司+$15')) subtotal += 15;

  const cashNum = Number(state.posCashReceived) || 0;
  const changeAmt = cashNum > 0 ? Math.max(0, cashNum - subtotal) : 0;

  ticketEl.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:10px; border-bottom:2px solid #111827; margin-bottom:10px;">
      <div>
        <div style="font-size:0.72rem; font-weight:800; color:var(--brand);">🖥️ 櫃檯現場 POS 收銀單</div>
        <strong style="font-size:1.05rem;">${escapeHtml(store.name)}</strong>
      </div>
      <div style="display:flex; gap:4px;">
        ${['內用', '外帶'].map(t => `
          <button type="button" class="opt-pill ${state.posDineType === t ? 'active' : ''}" onclick="posSetDineType('${t}')">${t}</button>
        `).join('')}
      </div>
    </div>

    <!-- 已點品項清單 -->
    <div style="min-height:120px; max-height:220px; overflow-y:auto; margin-bottom:10px;">
      ${state.posCart.length === 0 ? `
        <p style="text-align:center; color:var(--text-muted); padding:34px 0; font-size:0.84rem;">
          👈 點擊左側菜色方塊即可快速加入帳單
        </p>
      ` : state.posCart.map(item => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:7px 0; border-bottom:1px dashed var(--border);">
          <div style="flex:1; min-width:0;">
            <div style="font-weight:800; font-size:0.88rem;">${escapeHtml(item.name)}</div>
            <div style="font-size:0.75rem; color:var(--text-secondary);">$${item.price} × ${item.qty} = <strong>$${item.price * item.qty}</strong></div>
          </div>
          <div class="qty-stepper">
            <button type="button" class="step-btn" onclick="posChangeItemQty('${escapeHtml(item.id)}', -1)">－</button>
            <span style="font-weight:800; min-width:16px; text-align:center;">${item.qty}</span>
            <button type="button" class="step-btn plus" onclick="posChangeItemQty('${escapeHtml(item.id)}', 1)">＋</button>
          </div>
        </div>
      `).join('')}
    </div>

    <!-- 店員一鍵快速客製化按鍵 -->
    <div style="margin-bottom:10px;">
      <div style="font-size:0.74rem; font-weight:700; color:var(--text-secondary); margin-bottom:4px;">⚡ 現場客製快速鍵：</div>
      <div style="display:flex; gap:5px; flex-wrap:wrap;">
        ${['加飯+$10', '加蛋+$15', '加起司+$15', '小辣', '中辣', '不要蔥', '醬少'].map(tg => `
          <button type="button" class="opt-pill ${state.posCustomTags.includes(tg) ? 'active' : ''}" style="padding:4px 8px; font-size:0.74rem;" onclick="posToggleTag('${tg}')">${tg}</button>
        `).join('')}
      </div>
    </div>

    <!-- 現金收銀與找零計算 -->
    <div style="background:var(--bg-page); padding:10px 12px; border-radius:10px; margin-bottom:12px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <span style="font-size:0.82rem; font-weight:700;">應收總計：</span>
        <span style="font-size:1.45rem; font-weight:900; color:var(--brand);">$${subtotal}</span>
      </div>
      <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
        <span style="font-size:0.75rem; color:var(--text-secondary);">快速收現：</span>
        <button type="button" class="filter-chip" style="padding:3px 9px; font-size:0.75rem;" onclick="posQuickCash(${subtotal})">剛好 ($${subtotal})</button>
        <button type="button" class="filter-chip" style="padding:3px 9px; font-size:0.75rem;" onclick="posQuickCash(100)">$100</button>
        <button type="button" class="filter-chip" style="padding:3px 9px; font-size:0.75rem;" onclick="posQuickCash(500)">$500</button>
        <button type="button" class="filter-chip" style="padding:3px 9px; font-size:0.75rem;" onclick="posQuickCash(1000)">$1000</button>
      </div>
      ${cashNum > 0 ? `
        <div style="display:flex; justify-content:space-between; margin-top:6px; padding-top:6px; border-top:1px solid var(--border); font-size:0.82rem; font-weight:800;">
          <span>實收 $${cashNum}</span>
          <span style="color:var(--green);">找零：$${changeAmt}</span>
        </div>
      ` : ''}
    </div>

    <div style="display:flex; gap:8px;">
      <button type="button" class="filter-chip" onclick="posClearCart()">🗑️ 清空</button>
      <button type="button" class="btn-tip-action" id="btnPosSubmit" style="flex:1; background:#111827;" onclick="submitPosOrder('現場現金')">
        ⚡ 現金結帳出單
      </button>
      <button type="button" class="btn-tip-action" style="flex:1;" onclick="submitPosOrder('LINE Pay')">
        💳 LINE Pay 出單
      </button>
    </div>
  `;
}

/**
 * 店家櫃檯 POS 直接送出現場訂單 -> 自動進入廚房 KDS 佇列並語音播報
 */
async function submitPosOrder(payMethod) {
  const store = state.stores.find(s => s.id === state.merchantStoreId);
  if (!store) return;
  if (state.posCart.length === 0) {
    showToast('⚠️ 請先在左側點擊菜色加入 POS 帳單');
    return;
  }

  const items = JSON.parse(JSON.stringify(state.posCart));
  let subtotal = items.reduce((acc, i) => acc + i.price * i.qty, 0);
  if (state.posCustomTags.includes('加飯+$10')) subtotal += 10;
  if (state.posCustomTags.includes('加蛋+$15')) subtotal += 15;
  if (state.posCustomTags.includes('加起司+$15')) subtotal += 15;

  if (state.posCustomTags.length > 0) {
    items[0].name += ` (${state.posCustomTags.join('/')})`;
  }

  const orderId = generateOrderToken();
  const pickupNumber = 'P' + String(Math.floor(100 + Math.random() * 899));
  const nowTime = new Date().toLocaleTimeString('zh-TW', { hour12: false });
  const customerNote = `🖥️ 櫃檯POS・${state.posDineType}`;

  const newOrder = {
    orderId,
    pickupNumber,
    storeId: store.id,
    storeName: store.name,
    studentId: '🖥️ 櫃檯POS',
    studentName: customerNote,
    itemsJson: JSON.stringify(items),
    subtotal,
    discount: 0,
    finalTotal: subtotal,
    promoApplied: '現場櫃檯點餐',
    pickupTimeSlot: `現場${state.posDineType}`,
    paymentMethod: payMethod,
    status: '製作中',
    isDivertedOrder: false,
    createdAt: nowTime
  };

  state.orders.unshift(newOrder);
  saveCachedOrders(state.orders);
  store.activeOrders += 1;
  store.avgPrepMinutes = calcPrepMinutes(store.activeOrders, store.maxCapacityPer15Min);

  posClearCart();
  applyRouteView();
  speakOrder(pickupNumber, `櫃檯現場${state.posDineType}新訂單，共 ${subtotal} 元`);
  showToast(`✅ 現場 POS 出單成功！取餐號：#${pickupNumber}`);

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
        customerNote,
        campus: store.campus,
        storeId: store.id,
        storeName: store.name,
        items,
        subtotal,
        discount: 0,
        finalTotal: subtotal,
        promoApplied: '現場櫃檯點餐',
        paymentMethod: payMethod,
        pickupTimeSlot: `現場${state.posDineType}`,
        isDivertedOrder: false
      })
    });
    setSyncState('online', '已同步');
  } catch (e) {
    setSyncState('offline', '離線暫存模式');
  }
}

// ---------- 店家廚房 KDS 出單佇列 ----------
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
            ${escapeHtml(o.studentName || '')} ・ 憑證 <code>${escapeHtml(o.orderId)}</code> ・ ${escapeHtml(o.pickupTimeSlot)} ・ <strong>$${o.finalTotal} (${escapeHtml(o.paymentMethod)})</strong>
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
