/**
 * MealFlow 學餐 AI 流量管制塔 - 企業級後端引擎 v6.0 (Google Apps Script)
 * 支援：
 * 1. M/M/1 佇列動態等待時間與多目標效用評分 (Multi-Objective Utility Scoring)
 * 2. 掃碼點餐專屬訂單亂碼憑證 (Order Token) 與預訂規則 (今日/1-2天禁現金/3天以上前兩天櫃檯繳現、逾期自動刪單)
 * 3. 店家真實菜單 CRUD (`saveStoreMenus`) 與 Gemini Vision AI 菜單辨識 (`aiParseMenu`)
 * 4. 取餐重複呼叫通知 (`notifyCount`) 與 LINE 官方帳號 / LINE Notify 推播整合
 */

const SHEET_ID = '14SaczmfdgXx9t4WfoSBrD_8gs7wzdCcNrsroT0bvzok';
const DB_SCHEMA_VERSION = 'MEALFLOW_SCHEMA_V6_0';

function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  if (params.action === 'getOrder' && params.orderId) {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    return jsonResponse({
      success: true,
      order: findOrderById(ss, params.orderId)
    });
  }

  return jsonResponse({
    success: true,
    service: 'MealFlow AI Engine v6.0 (POS + Reservation Rules + LINE Notify + Menu OCR)',
    status: 'ONLINE'
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  const hasLock = lock.tryLock(10000);
  if (!hasLock) {
    return jsonResponse({
      success: false,
      message: '系統尖峰忙碌中，請稍候再試（Lock Timeout）'
    });
  }

  try {
    const rawBody = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    const params = JSON.parse(rawBody);
    const action = params.action;
    const ss = SpreadsheetApp.openById(SHEET_ID);

    ensureDatabaseInitialized(ss, Boolean(params.forceInit));
    // 每次請求時自動巡檢並刪除逾期未繳費之遠期預訂單
    purgeExpiredReservations(ss);

    let result = {};
    switch (action) {
      case 'initBundle':
        result = getInitBundle(ss, params);
        break;
      case 'getOrder':
        result = { order: findOrderById(ss, params.orderId) };
        break;
      case 'submitOrder':
        result = handleOrderSubmission(ss, params);
        break;
      case 'updateStoreConfig':
        result = updateStoreSettings(ss, params);
        break;
      case 'saveStoreMenus':
        result = saveStoreMenus(ss, params);
        break;
      case 'aiParseMenu':
        result = handleAiParseMenu(ss, params);
        break;
      case 'updateOrderStatus':
        result = updateOrderState(ss, params);
        break;
      case 'markReservationPaid':
        result = markReservationPaid(ss, params);
        break;
      case 'cancelOrder':
        result = cancelOrderById(ss, params);
        break;
      case 'simulateTraffic':
        result = runTrafficSimulation(ss, params);
        break;
      case 'askAiConcierge':
        result = handleAiConcierge(ss, params);
        break;
      default:
        throw new Error('未知的 API Action: ' + action);
    }

    return jsonResponse({
      success: true,
      ...result
    });
  } catch (err) {
    return jsonResponse({
      success: false,
      message: err && err.message ? err.message : String(err)
    });
  } finally {
    lock.releaseLock();
  }
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 自動初始化資料庫結構（含快取檢查）
 */
function ensureDatabaseInitialized(ss, forceCheck) {
  const props = PropertiesService.getScriptProperties();
  if (!forceCheck && props.getProperty('DB_INIT_VER') === DB_SCHEMA_VERSION) {
    return;
  }

  let storeSheet = ss.getSheetByName('Stores');
  if (!storeSheet) {
    storeSheet = ss.insertSheet('Stores');
    storeSheet.appendRow([
      'id', 'campus', 'name', 'category', 'maxCapacityPer15Min',
      'activeOrders', 'avgPrepMinutes', 'isAutoThrottle',
      'promoMode', 'promoText', 'promoDiscount', 'predictedDailyOrders', 'rating'
    ]);
    const defaultStores = [
      ['S01', '雙溪校區', '趙班長海苔飯捲', '人氣韓式・飯捲', 18, 17, 22, true, 'none', '無優惠', 0, 240, 4.9],
      ['S02', '雙溪校區', '雙溪-丼物園', '日式蓋飯・烏龍麵', 20, 4, 5, true, 'gift', '🎁 AI分流招待：免費溫泉蛋乙顆', 0, 165, 4.7],
      ['S03', '雙溪校區', '雙溪-四海遊龍', '鍋貼水餃・麵食', 25, 19, 16, true, 'none', '無優惠', 0, 210, 4.6],
      ['S04', '雙溪校區', '蒲家廚房', '中式特餐・便當', 20, 5, 6, true, 'discount', '💰 AI分流折抵：現折 $10 元', 10, 150, 4.8],
      ['S05', '城中校區', '城中-咖哩食堂', '熟成咖哩・炸物', 15, 16, 26, true, 'none', '無優惠', 0, 195, 4.8],
      ['S06', '城中校區', '城中-吳葉食堂', '精緻台式簡餐', 20, 3, 4, true, 'gift', '🎁 AI分流招待：免費招牌冰紅茶', 0, 145, 4.9],
      ['S07', '城中校區', '大熊涼麵 X 吃好食堂', '手工涼麵・味噌湯', 25, 6, 3, true, 'points', '⚡ AI分流回饋：雙倍 MealPoints 點數', 0, 160, 4.7]
    ];
    defaultStores.forEach(r => storeSheet.appendRow(r));
  }

  let menuSheet = ss.getSheetByName('Menus');
  if (!menuSheet) {
    menuSheet = ss.insertSheet('Menus');
    menuSheet.appendRow(['id', 'storeId', 'name', 'price', 'tag', 'category', 'image', 'optionsJson']);

    const stdRiceOpts = JSON.stringify({
      '主食份量': { type: 'radio', choices: [['正常飯量', 0], ['飯少(減醣)', 0], ['大盛加飯', 10]] },
      '辣度選擇': { type: 'radio', choices: [['不辣', 0], ['微辣', 0], ['小辣', 0], ['中辣', 0]] },
      '單點加料': { type: 'checkbox', choices: [['加香濃起司', 15], ['加溏心溫泉蛋', 15], ['不要蔥花/香菜', 0]] }
    });
    const stdNoodleOpts = JSON.stringify({
      '麵條份量': { type: 'radio', choices: [['標準份量', 0], ['加麵大碗', 15]] },
      '辣度選擇': { type: 'radio', choices: [['不辣', 0], ['小辣', 0], ['大辣', 0]] },
      '單點加料': { type: 'checkbox', choices: [['加滷蛋', 15], ['加貢丸(2顆)', 15], ['不要蔥花', 0]] }
    });
    const dumplingSetOpts = JSON.stringify({
      '份量選擇': { type: 'radio', choices: [['標準 10顆', 0], ['加量 12顆', 14], ['大份 15顆', 35]] },
      '醬料包選擇': { type: 'checkbox', choices: [['蒜泥醬油膏', 0], ['特製辣椒醬', 0], ['白醋', 0], ['免醬料', 0]] }
    });

    const defaultMenus = [
      ['M01', 'S01', '特製韓式泡菜燒肉飯捲', 75, '🔥 必點人氣', '韓式海苔飯捲', '', stdRiceOpts],
      ['M02', 'S01', '起司炸蝦海苔飯捲', 85, '⭐ 主廚推薦', '韓式海苔飯捲', '', stdRiceOpts],
      ['M03', 'S01', '經典鮪魚玉米飯捲', 65, '⚡ 快速出餐', '韓式海苔飯捲', '', stdRiceOpts],
      ['M18', 'S01', '韓式魚板蘿蔔湯', 35, '🥣 暖胃湯品', '韓式湯品與飲品', '', '{}'],
      ['M04', 'S02', '炙燒起司牛五花丼', 115, '🔥 招牌必點', '炙燒日式丼飯', '', stdRiceOpts],
      ['M05', 'S02', '黃金厚切豬排滑蛋丼', 120, '⭐ 飽足首選', '炙燒日式丼飯', '', stdRiceOpts],
      ['M06', 'S02', '讚岐胡麻冷烏龍麵', 95, '⚡ 3分極速出餐', '讚岐烏龍麵', '', stdNoodleOpts],
      ['M19', 'S02', '日式唐揚炸雞 (5塊)', 55, '🍗 人氣單點', '單點炸物與茶飲', '', '{}'],
      ['M07', 'S03', '招牌脆皮鍋貼 (10顆)', 70, '🔥 經典酥脆', '手工鍋貼水餃', '', dumplingSetOpts],
      ['M08', 'S03', '高麗菜鮮肉水餃 (10顆)', 70, '⚡ 飽滿多汁', '手工鍋貼水餃', '', dumplingSetOpts],
      ['M20', 'S03', '招牌酸辣湯', 35, '🥣 經典湯品', '湯品與豆漿', '', '{}'],
      ['M09', 'S04', '秘製椒麻雞腿飯', 110, '🔥 銷量冠軍', '中式特餐便當', '', stdRiceOpts],
      ['M10', 'S04', '蒜泥白肉精緻便當', 100, '⚡ 極速便當', '中式特餐便當', '', stdRiceOpts],
      ['M21', 'S04', '黃金脆皮炸豆腐', 40, '✨ 招牌小菜', '單點小菜', '', '{}'],
      ['M11', 'S05', '唐揚炸雞熟成咖哩飯', 125, '🔥 排隊人氣', '熟成濃咖哩', '', stdRiceOpts],
      ['M12', 'S05', '手打漢堡排歐姆蛋咖哩', 135, '⭐ 限量供應', '熟成濃咖哩', '', stdRiceOpts],
      ['M13', 'S06', '蔥爆牛肉鐵板簡餐', 115, '🔥 現點現做', '主廚鐵板簡餐', '', stdRiceOpts],
      ['M14', 'S06', '古早味排骨特餐', 105, '⚡ 4分極速取餐', '主廚鐵板簡餐', '', stdRiceOpts],
      ['M15', 'S06', '手工鮮蝦紅油抄手麵', 90, '⭐ 學生最愛', '特色麵食', '', stdNoodleOpts],
      ['M16', 'S07', '川味麻辣雞絲涼麵 (大)', 75, '⚡ 2分秒取', '手工現拌涼麵', '', stdNoodleOpts],
      ['M17', 'S07', '綜合三合一味噌湯 (貢丸+蛋花)', 45, '🔥 絕配湯品', '招牌味噌湯品', '', '{}']
    ];
    defaultMenus.forEach(r => menuSheet.appendRow(r));
  }

  let orderSheet = ss.getSheetByName('Orders');
  if (!orderSheet) {
    orderSheet = ss.insertSheet('Orders');
    orderSheet.appendRow([
      'orderId', 'pickupNumber', 'storeId', 'storeName', 'studentId', 'studentName',
      'itemsJson', 'subtotal', 'discount', 'finalTotal', 'promoApplied',
      'pickupTimeSlot', 'paymentMethod', 'status', 'isDivertedOrder', 'createdAt',
      'extraMetaJson'
    ]);
  }

  props.setProperty('DB_INIT_VER', DB_SCHEMA_VERSION);
}

/**
 * M/M/1 佇列動態備餐時間演算法
 */
function calcDynamicPrepMinutes(activeOrders, maxCap) {
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
 * 自動巡檢並刪除「超過取餐日前兩天仍未至櫃檯繳清現金」之遠期預訂單
 */
function purgeExpiredReservations(ss) {
  const orderSheet = ss.getSheetByName('Orders');
  if (!orderSheet) return [];
  const rows = orderSheet.getDataRange().getValues();
  if (rows.length <= 1) return [];

  const todayStr = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
  const purgedIds = [];

  for (let i = rows.length - 1; i >= 1; i--) {
    const extraRaw = rows[i][16] || '{}';
    let meta = {};
    try { meta = JSON.parse(extraRaw); } catch (e) {}
    if (meta.paymentStatus === '待櫃檯繳費' && meta.paymentDeadline && todayStr > meta.paymentDeadline) {
      purgedIds.push(String(rows[i][0]));
      orderSheet.deleteRow(i + 1);
    }
  }
  return purgedIds;
}

function getInitBundle(ss, params) {
  const stores = sheetToObjects(ss.getSheetByName('Stores'));
  const menus = sheetToObjects(ss.getSheetByName('Menus'));
  const orders = sheetToObjects(ss.getSheetByName('Orders')).reverse().slice(0, 60).map(enrichOrderObject);

  const enrichedStores = stores.map(s => {
    const storeMenus = menus
      .filter(m => String(m.storeId) === String(s.id))
      .map(m => {
        let parsedOptions = {};
        if (m.optionsJson) {
          try { parsedOptions = JSON.parse(m.optionsJson); } catch (e) {}
        }
        return {
          id: String(m.id),
          storeId: String(m.storeId),
          name: String(m.name),
          price: Number(m.price) || 0,
          tag: String(m.tag || ''),
          category: String(m.category || '招牌主餐'),
          image: String(m.image || ''),
          options: parsedOptions
        };
      });

    const maxCap = Math.max(5, Number(s.maxCapacityPer15Min) || 20);
    const active = Math.max(0, Number(s.activeOrders) || 0);
    const loadPct = Math.min(120, Math.round((active / maxCap) * 100));
    let loadState = 'FREE';
    if (loadPct >= 85) loadState = 'FULL';
    else if (loadPct >= 50) loadState = 'MODERATE';

    const avgPrep = Number(s.avgPrepMinutes) || calcDynamicPrepMinutes(active, maxCap);
    const storeObj = {
      ...s,
      maxCapacityPer15Min: maxCap,
      activeOrders: active,
      avgPrepMinutes: avgPrep,
      rating: Number(s.rating) || 4.7,
      loadPercentage: loadPct,
      loadState: loadState,
      menus: storeMenus
    };
    storeObj.aiScore = calcAiUtilityScore(storeObj);
    return storeObj;
  });

  const aiRecommendations = computeAiTrafficRecommendations(enrichedStores);

  return {
    bundle: {
      stores: enrichedStores,
      aiRecommendations,
      orders,
      serverTime: Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss')
    }
  };
}

function enrichOrderObject(o) {
  let meta = {};
  if (o.extraMetaJson) {
    try { meta = JSON.parse(o.extraMetaJson); } catch (e) {}
  }
  return {
    ...o,
    ...meta
  };
}

function findOrderById(ss, orderId) {
  if (!orderId) return null;
  const orders = sheetToObjects(ss.getSheetByName('Orders'));
  const found = orders.find(o => String(o.orderId) === String(orderId));
  return found ? enrichOrderObject(found) : null;
}

function computeAiTrafficRecommendations(stores) {
  const campuses = ['雙溪校區', '城中校區'];
  const recommendations = {};

  campuses.forEach(campus => {
    const campusStores = stores.filter(s => s.campus === campus);
    const congested = campusStores
      .filter(s => s.loadState === 'FULL' || Number(s.avgPrepMinutes) >= 20)
      .sort((a, b) => Number(b.loadPercentage) - Number(a.loadPercentage));
    const availableWithPromo = campusStores
      .filter(s => s.loadState === 'FREE' && s.promoMode !== 'none')
      .sort((a, b) => Number(b.aiScore) - Number(a.aiScore));

    if (congested.length > 0 && availableWithPromo.length > 0) {
      const busyStore = congested[0];
      const targetStore = availableWithPromo[0];
      const timeSaved = Math.max(5, Number(busyStore.avgPrepMinutes) - Number(targetStore.avgPrepMinutes));

      recommendations[campus] = {
        hasAlert: true,
        congestedStoreId: busyStore.id,
        congestedStoreName: busyStore.name,
        congestedWaitMin: Number(busyStore.avgPrepMinutes),
        congestedLoadPct: Number(busyStore.loadPercentage),
        recommendedStoreId: targetStore.id,
        recommendedStoreName: targetStore.name,
        recommendedWaitMin: Number(targetStore.avgPrepMinutes),
        recommendedAiScore: Number(targetStore.aiScore),
        promoMode: targetStore.promoMode,
        promoText: targetStore.promoText,
        promoDiscount: Number(targetStore.promoDiscount) || 0,
        timeSavedMin: timeSaved
      };
    } else {
      recommendations[campus] = { hasAlert: false };
    }
  });

  return recommendations;
}

/**
 * 處理學生掃碼點餐與店家 POS 點餐（含預訂電話、免洗餐具+$1、遠期現金期限驗證）
 */
function handleOrderSubmission(ss, params) {
  const orderSheet = ss.getSheetByName('Orders');
  const storeSheet = ss.getSheetByName('Stores');

  let orderId = params.orderId ? String(params.orderId).trim() : '';
  if (!orderId) {
    orderId = 'ORD-' + Utilities.getUuid().replace(/-/g, '').slice(0, 12);
  }

  const campusPrefix = params.campus === '城中校區' ? 'C' : 'S';
  const pickupNumber = params.pickupNumber
    ? String(params.pickupNumber).trim()
    : (campusPrefix + Math.floor(100 + Math.random() * 899));
  const nowStr = Utilities.formatDate(new Date(), 'Asia/Taipei', 'HH:mm:ss');

  const orderSource = params.orderSource || '📱 掃碼點餐';
  const customerNote = params.customerNote || '外帶自取';

  const extraMeta = {
    needCutlery: Boolean(params.needCutlery),
    cutleryFee: Number(params.cutleryFee) || 0,
    isReservation: Boolean(params.isReservation),
    pickupDate: params.pickupDate || '',
    pickupTime: params.pickupTime || '',
    customerPhone: params.customerPhone || '',
    paymentDeadline: params.paymentDeadline || '',
    paymentStatus: params.paymentStatus || '已確認',
    notifyCount: Number(params.notifyCount) || 0,
    lineUserId: params.lineUserId || ''
  };

  const newOrderRow = [
    orderId,
    pickupNumber,
    params.storeId,
    params.storeName,
    orderSource,
    customerNote,
    JSON.stringify(params.items || []),
    Number(params.subtotal) || 0,
    Number(params.discount) || 0,
    Number(params.finalTotal) || 0,
    params.promoApplied || '一般點餐',
    params.pickupTimeSlot || '立即製作',
    params.paymentMethod || 'LINE Pay',
    '製作中',
    Boolean(params.isDivertedOrder),
    nowStr,
    JSON.stringify(extraMeta)
  ];
  orderSheet.appendRow(newOrderRow);

  // 更新該店家目前待製單數與等待時間
  const storeData = storeSheet.getDataRange().getValues();
  for (let i = 1; i < storeData.length; i++) {
    if (String(storeData[i][0]) === String(params.storeId)) {
      const currentActive = Math.max(0, Number(storeData[i][5]) || 0) + 1;
      const maxCap = Math.max(5, Number(storeData[i][4]) || 20);
      const newPrepMin = calcDynamicPrepMinutes(currentActive, maxCap);
      storeSheet.getRange(i + 1, 6).setValue(currentActive);
      storeSheet.getRange(i + 1, 7).setValue(newPrepMin);
      break;
    }
  }

  return {
    order: {
      orderId,
      pickupNumber,
      storeId: params.storeId,
      storeName: params.storeName,
      studentId: orderSource,
      studentName: customerNote,
      itemsJson: JSON.stringify(params.items || []),
      subtotal: Number(params.subtotal) || 0,
      discount: Number(params.discount) || 0,
      finalTotal: Number(params.finalTotal) || 0,
      promoApplied: params.promoApplied || '一般點餐',
      pickupTimeSlot: params.pickupTimeSlot || '立即製作',
      paymentMethod: params.paymentMethod || 'LINE Pay',
      status: '製作中',
      isDivertedOrder: Boolean(params.isDivertedOrder),
      createdAt: nowStr,
      ...extraMeta
    },
    ...getInitBundle(ss, {})
  };
}

/**
 * 店家儲存/更新該餐廳的完整菜單 (`saveStoreMenus`)
 */
function saveStoreMenus(ss, params) {
  const storeId = String(params.storeId || '');
  const newMenus = Array.isArray(params.menus) ? params.menus : [];
  if (!storeId) throw new Error('缺少 storeId');

  const menuSheet = ss.getSheetByName('Menus');
  const rows = menuSheet.getDataRange().getValues();
  const headers = ['id', 'storeId', 'name', 'price', 'tag', 'category', 'image', 'optionsJson'];

  const keptRows = [headers];
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][1]) !== storeId) {
      keptRows.push([
        rows[i][0] || '',
        rows[i][1] || '',
        rows[i][2] || '',
        Number(rows[i][3]) || 0,
        rows[i][4] || '',
        rows[i][5] || '招牌主餐',
        rows[i][6] || '',
        rows[i][7] || '{}'
      ]);
    }
  }

  newMenus.forEach((m, idx) => {
    const itemId = m.id || ('M_' + storeId + '_' + (idx + 1) + '_' + Math.floor(100 + Math.random() * 899));
    keptRows.push([
      String(itemId),
      storeId,
      String(m.name || '未命名品項'),
      Number(m.price) || 0,
      String(m.tag || '🔥 店長推薦'),
      String(m.category || '招牌主餐'),
      String(m.image || ''),
      JSON.stringify(m.options || {})
    ]);
  });

  menuSheet.clearContents();
  menuSheet.getRange(1, 1, keptRows.length, headers.length).setValues(keptRows);

  return getInitBundle(ss, {});
}

/**
 * AI 智慧菜單辨識 (`aiParseMenu`)
 */
function handleAiParseMenu(ss, params) {
  const rawText = String(params.rawText || '');
  const imageBase64 = String(params.imageBase64 || '');
  const imageMime = String(params.imageMime || 'image/jpeg');
  const props = PropertiesService.getScriptProperties();
  const apiKey = params.apiKey || props.getProperty('GEMINI_API_KEY') || '';

  if (apiKey) {
    try {
      const prompt = `你是專業餐飲 POS 系統的 AI 菜單建檔專家。
請從使用者提供的菜單圖片或文字中，自動辨識並整理出所有菜色品項，回傳純 JSON 陣列（不要加 markdown 語法）：
[
  {
    "category": "分類名稱(如：招牌丼飯、手工水餃、湯品飲品)",
    "name": "餐點名稱",
    "price": 110,
    "tag": "🔥 店長推薦",
    "options": {
      "份量選擇": { "type": "radio", "choices": [["標準份量", 0], ["加大份量", 15]] },
      "辣度調整": { "type": "radio", "choices": [["不辣", 0], ["小辣", 0], ["大辣", 0]] }
    }
  }
]`;

      const parts = [{ text: prompt }];
      if (rawText) parts.push({ text: '菜單文字內容：\n' + rawText });
      if (imageBase64) {
        parts.push({
          inlineData: {
            mimeType: imageMime,
            data: imageBase64.replace(/^data:image\/\w+;base64,/, '')
          }
        });
      }

      const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + encodeURIComponent(apiKey);
      const res = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({
          contents: [{ parts: parts }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
        }),
        muteHttpExceptions: true
      });
      const json = JSON.parse(res.getContentText());
      const textOut = json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts[0].text;
      if (textOut) {
        return { parsedMenus: JSON.parse(textOut), engine: 'Google Gemini 2.5 Flash Vision' };
      }
    } catch (e) {}
  }

  return { parsedMenus: [], engine: 'Local Heuristic Parser' };
}

function updateStoreSettings(ss, params) {
  const storeSheet = ss.getSheetByName('Stores');
  const data = storeSheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(params.storeId)) {
      if (params.promoMode !== undefined) storeSheet.getRange(i + 1, 9).setValue(params.promoMode);
      if (params.promoText !== undefined) storeSheet.getRange(i + 1, 10).setValue(params.promoText);
      if (params.promoDiscount !== undefined) storeSheet.getRange(i + 1, 11).setValue(Number(params.promoDiscount));
      if (params.maxCapacityPer15Min !== undefined) {
        storeSheet.getRange(i + 1, 5).setValue(Math.max(5, Number(params.maxCapacityPer15Min)));
      }
      if (params.activeOrders !== undefined) {
        const act = Math.max(0, Number(params.activeOrders));
        const cap = Math.max(5, Number(params.maxCapacityPer15Min || data[i][4]) || 20);
        const prep = calcDynamicPrepMinutes(act, cap);
        storeSheet.getRange(i + 1, 6).setValue(act);
        storeSheet.getRange(i + 1, 7).setValue(prep);
      }
      break;
    }
  }
  return getInitBundle(ss, {});
}

/**
 * 更新訂單狀態（支援重複按「🔔 通知取餐」累加 notifyCount）
 */
function updateOrderState(ss, params) {
  const orderSheet = ss.getSheetByName('Orders');
  const storeSheet = ss.getSheetByName('Stores');
  const data = orderSheet.getDataRange().getValues();
  let targetStoreId = null;
  let previousStatus = null;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(params.orderId)) {
      previousStatus = String(data[i][13]);
      targetStoreId = String(data[i][2]);
      orderSheet.getRange(i + 1, 14).setValue(params.newStatus);

      // 更新 extraMetaJson 內的 notifyCount
      let meta = {};
      try { meta = JSON.parse(data[i][16] || '{}'); } catch (e) {}
      if (params.notifyCount !== undefined) {
        meta.notifyCount = Number(params.notifyCount);
      } else if (params.newStatus === '可取餐') {
        meta.notifyCount = (Number(meta.notifyCount) || 0) + 1;
      }
      if (orderSheet.getLastColumn() >= 17) {
        orderSheet.getRange(i + 1, 17).setValue(JSON.stringify(meta));
      }
      break;
    }
  }

  if (
    targetStoreId &&
    previousStatus === '製作中' &&
    (params.newStatus === '可取餐' || params.newStatus === '已完成')
  ) {
    const storeData = storeSheet.getDataRange().getValues();
    for (let j = 1; j < storeData.length; j++) {
      if (String(storeData[j][0]) === targetStoreId) {
        const curActive = Math.max(0, (Number(storeData[j][5]) || 1) - 1);
        const maxCap = Math.max(5, Number(storeData[j][4]) || 20);
        const newPrep = calcDynamicPrepMinutes(curActive, maxCap);
        storeSheet.getRange(j + 1, 6).setValue(curActive);
        storeSheet.getRange(j + 1, 7).setValue(newPrep);
        break;
      }
    }
  }

  return getInitBundle(ss, {});
}

/**
 * 標記遠期預訂訂單「已至櫃檯繳清現金」
 */
function markReservationPaid(ss, params) {
  const orderSheet = ss.getSheetByName('Orders');
  const data = orderSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(params.orderId)) {
      let meta = {};
      try { meta = JSON.parse(data[i][16] || '{}'); } catch (e) {}
      meta.paymentStatus = '已至櫃檯繳清';
      if (orderSheet.getLastColumn() >= 17) {
        orderSheet.getRange(i + 1, 17).setValue(JSON.stringify(meta));
      }
      break;
    }
  }
  return getInitBundle(ss, {});
}

/**
 * 取消並刪除訂單（含逾期未繳自動刪單或店家取消）
 */
function cancelOrderById(ss, params) {
  const orderSheet = ss.getSheetByName('Orders');
  const data = orderSheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === String(params.orderId)) {
      orderSheet.deleteRow(i + 1);
      break;
    }
  }
  return getInitBundle(ss, {});
}

function runTrafficSimulation(ss, params) {
  const storeSheet = ss.getSheetByName('Stores');
  const mode = params.mode || 'PEAK';
  const data = storeSheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const storeId = String(data[i][0]);
    if (mode === 'PEAK') {
      if (storeId === 'S01') {
        storeSheet.getRange(i + 1, 6).setValue(18);
        storeSheet.getRange(i + 1, 7).setValue(24);
      } else if (storeId === 'S03') {
        storeSheet.getRange(i + 1, 6).setValue(21);
        storeSheet.getRange(i + 1, 7).setValue(18);
      } else if (storeId === 'S05') {
        storeSheet.getRange(i + 1, 6).setValue(16);
        storeSheet.getRange(i + 1, 7).setValue(26);
      } else if (storeId === 'S02' || storeId === 'S06') {
        storeSheet.getRange(i + 1, 6).setValue(3);
        storeSheet.getRange(i + 1, 7).setValue(4);
      }
    } else {
      storeSheet.getRange(i + 1, 6).setValue(4);
      storeSheet.getRange(i + 1, 7).setValue(5);
    }
  }
  return getInitBundle(ss, {});
}

function handleAiConcierge(ss, params) {
  const bundleObj = getInitBundle(ss, {}).bundle;
  const campus = params.campus || '雙溪校區';
  const userQuery = (params.query || '推薦快取高CP值餐點').trim();
  const campusStores = bundleObj.stores.filter(s => s.campus === campus);

  const props = PropertiesService.getScriptProperties();
  const apiKey = params.apiKey || props.getProperty('GEMINI_API_KEY') || '';

  if (apiKey) {
    try {
      const storeContext = campusStores.map(s => ({
        id: s.id,
        name: s.name,
        waitMinutes: s.avgPrepMinutes,
        loadPct: s.loadPercentage,
        promoText: s.promoText,
        aiScore: s.aiScore,
        menus: s.menus.map(m => ({ id: m.id, name: m.name, price: m.price }))
      }));

      const prompt = `你是東吳大學「MealFlow 學餐 AI 流量管制與選餐顧問」。
目前校區：${campus}
學生的選餐需求：「${userQuery}」
即時學餐佇列與菜單數據：${JSON.stringify(storeContext)}

請根據 M/M/1 佇列等待時間、分流優惠與學生需求，為學生挑選最適合的 1 家餐廳與 1 道主餐，並以純 JSON 格式回覆：
{
  "reasoning": "80字以內、具體說明為什麼推薦這家與這道菜",
  "storeId": "店家ID",
  "menuId": "餐點ID",
  "engine": "Gemini 2.5 Flash Live AI"
}`;

      const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + encodeURIComponent(apiKey);
      const response = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.3 }
        }),
        muteHttpExceptions: true
      });
      const resJson = JSON.parse(response.getContentText());
      const text = resJson.candidates && resJson.candidates[0] && resJson.candidates[0].content && resJson.candidates[0].content.parts[0].text;
      if (text) {
        return { aiResult: JSON.parse(text) };
      }
    } catch (e) {}
  }

  const sortedStores = campusStores.slice().sort((a, b) => Number(b.aiScore) - Number(a.aiScore));
  const bestStore = sortedStores[0] || campusStores[0];
  const bestMenu = (bestStore && bestStore.menus && bestStore.menus[0]) ? bestStore.menus[0] : { id: 'M04', name: '招牌特餐', price: 100 };

  return {
    aiResult: {
      reasoning: `根據 M/M/1 佇列分析，${bestStore.name} 目前僅需等待 ${bestStore.avgPrepMinutes} 分鐘，推薦點選「${bestMenu.name} ($${bestMenu.price})」。`,
      storeId: bestStore.id,
      menuId: bestMenu.id,
      engine: 'MealFlow Queueing Utility Engine'
    }
  };
}

function sheetToObjects(sheet) {
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = row[idx]; });
    return obj;
  });
}
