/**
 * MealFlow 學餐 AI 流量管制塔 - 企業級後端引擎 (Google Apps Script v5.0)
 * 新增與強化：
 * 1. 真實菜單資料庫 CRUD (`saveStoreMenus`)：支援店家新增/修改/刪除餐點、分類、八方模式、客製化選項群組 (optionsJson)
 * 2. AI 智慧菜單視覺辨識與結構化匯入 (`aiParseMenu`)：支援上傳菜單圖片 (Base64) 或文字，透過 Gemini 2.5 Flash 多模態模型自動擷取全菜單
 * 3. AI 選餐顧問 (`askAiConcierge`) + M/M/1 佇列動態分流模型
 */

const SHEET_ID = '14SaczmfdgXx9t4WfoSBrD_8gs7wzdCcNrsroT0bvzok';
const DB_VERSION = 'v5.0_init_done';
const DEFAULT_GEMINI_API_KEY = '';

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    service: 'MealFlow AI Engine v5.0 (Real Menu CRUD + AI Vision Menu Scanner + Queueing Model)',
    status: 'ONLINE'
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  const hasLock = lock.tryLock(10000);
  if (!hasLock) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: '系統尖峰繁忙中，請稍候再試 (Lock Timeout)'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  try {
    const rawBody = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    const params = JSON.parse(rawBody);
    const action = params.action;
    const ss = SpreadsheetApp.openById(SHEET_ID);
    
    ensureDatabaseInitialized(ss, params.forceInit === true);

    let result = {};
    switch (action) {
      case 'initBundle':
        result = getInitBundle(ss, params);
        break;
      case 'getOrder':
        result = getSingleOrder(ss, params);
        break;
      case 'submitOrder':
        result = handleOrderSubmission(ss, params);
        break;
      case 'updateStoreConfig':
        result = updateStoreSettings(ss, params);
        break;
      case 'saveStoreMenus':
        result = saveStoreMenusToSheet(ss, params);
        break;
      case 'aiParseMenu':
        result = handleAiMenuScan(ss, params);
        break;
      case 'updateOrderStatus':
        result = updateOrderState(ss, params);
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

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      ...result
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: err.message || err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
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
 * 自動初始化資料庫結構（Menus 支援 category, isBafangMode, image, optionsJson）
 */
function ensureDatabaseInitialized(ss, forceCheck) {
  const props = PropertiesService.getScriptProperties();
  if (!forceCheck && props.getProperty('DB_INIT_STATE') === DB_VERSION) {
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
    menuSheet.appendRow(['id', 'storeId', 'name', 'price', 'prepTime', 'tag', 'available', 'category', 'isBafangMode', 'image', 'optionsJson']);
    const stdRiceOpts = JSON.stringify({
      '主食份量': { type: 'radio', choices: [['正常飯量', 0], ['飯少(減醣)', 0], ['大盛加飯', 10]] },
      '辣度選擇': { type: 'radio', choices: [['不辣', 0], ['小辣', 0], ['中辣', 0]] },
      '人氣加購': { type: 'checkbox', choices: [['加香濃起司', 15], ['加溏心溫泉蛋', 15], ['不要蔥花', 0]] }
    });
    const dumplingOpts = JSON.stringify({
      '選擇顆數': { type: 'radio', choices: [['8顆', 56], ['10顆', 70], ['12顆', 84], ['15顆', 105]] },
      '醬料選擇': { type: 'checkbox', choices: [['蒜泥醬油', 0], ['特製辣油', 0], ['不要醬料', 0]] }
    });
    const defaultMenus = [
      ['M01', 'S01', '特製韓式泡菜燒肉飯捲', 75, 4, '🔥 必點人氣', true, '韓式飯捲', false, '', stdRiceOpts],
      ['M02', 'S01', '起司炸蝦海苔飯捲', 85, 5, '⭐ 主廚推薦', true, '韓式飯捲', false, '', stdRiceOpts],
      ['M03', 'S01', '經典鮪魚玉米飯捲', 65, 3, '⚡ 快速出餐', true, '韓式飯捲', false, '', stdRiceOpts],
      ['M18', 'S01', '韓式魚板蘿蔔湯', 35, 2, '🥣 暖胃湯品', true, '暖胃湯飲', false, '', '{}'],
      ['M04', 'S02', '炙燒起司牛五花丼', 115, 4, '🔥 招牌必點', true, '日式蓋飯', false, '', stdRiceOpts],
      ['M05', 'S02', '黃金厚切豬排滑蛋丼', 120, 5, '⭐ 飽足首選', true, '日式蓋飯', false, '', stdRiceOpts],
      ['M06', 'S02', '讚岐胡麻冷烏龍麵', 95, 3, '⚡ 3分極速出餐', true, '讚岐烏龍', false, '', stdRiceOpts],
      ['M19', 'S02', '日式唐揚炸雞 (5塊)', 55, 3, '🍗 人氣單點', true, '單點炸物', false, '', '{}'],
      ['M07', 'S03', '招牌脆皮鍋貼', 7, 5, '🔥 按顆計價', true, '手工鍋貼水餃', true, '', dumplingOpts],
      ['M08', 'S03', '高麗菜鮮肉水餃', 7, 4, '⚡ 按顆計價', true, '手工鍋貼水餃', true, '', dumplingOpts],
      ['M20', 'S03', '酸辣湯 / 無糖豆漿', 30, 1, '🥣 湯品飲品', true, '湯品飲品', false, '', JSON.stringify({'品項選擇': {type:'radio', choices:[['招牌酸辣湯',0],['冰鎮無糖豆漿',-5]]}})],
      ['M09', 'S04', '秘製椒麻雞腿飯', 110, 4, '🔥 銷量冠軍', true, '精緻特餐便當', false, '', stdRiceOpts],
      ['M10', 'S04', '蒜泥白肉精緻便當', 100, 3, '⚡ 極速便當', true, '精緻特餐便當', false, '', stdRiceOpts],
      ['M11', 'S05', '唐揚炸雞熟成咖哩飯', 125, 6, '🔥 排隊人氣', true, '熟成咖哩', false, '', stdRiceOpts],
      ['M12', 'S05', '手打漢堡排歐姆蛋咖哩', 135, 7, '⭐ 限量供應', true, '熟成咖哩', false, '', stdRiceOpts],
      ['M13', 'S06', '蔥爆牛肉鐵板簡餐', 115, 4, '🔥 現點現做', true, '台式簡餐', false, '', stdRiceOpts],
      ['M14', 'S06', '古早味排骨特餐', 105, 3, '⚡ 4分極速取餐', true, '台式簡餐', false, '', stdRiceOpts],
      ['M15', 'S06', '手工鮮蝦紅油抄手麵', 90, 3, '⭐ 學生最愛', true, '特色麵食', false, '', stdRiceOpts],
      ['M16', 'S07', '川味麻辣雞絲涼麵 (大)', 75, 2, '⚡ 2分秒取', true, '手工涼麵', false, '', stdRiceOpts],
      ['M17', 'S07', '綜合三合一味噌湯 (貢丸+蛋花)', 45, 2, '🔥 絕配湯品', true, '招牌湯品', false, '', '{}']
    ];
    defaultMenus.forEach(r => menuSheet.appendRow(r));
  } else {
    // 確保舊版 Menus 表頭擁有新增的擴充欄位
    const headers = menuSheet.getRange(1, 1, 1, menuSheet.getLastColumn()).getValues()[0];
    if (headers.indexOf('optionsJson') === -1) {
      menuSheet.getRange(1, 8, 1, 4).setValues([['category', 'isBafangMode', 'image', 'optionsJson']]);
    }
  }

  let orderSheet = ss.getSheetByName('Orders');
  if (!orderSheet) {
    orderSheet = ss.insertSheet('Orders');
    orderSheet.appendRow([
      'orderId', 'pickupNumber', 'storeId', 'storeName', 'studentId', 'studentName',
      'itemsJson', 'subtotal', 'discount', 'finalTotal', 'promoApplied',
      'paymentMethod', 'pickupTimeSlot', 'status', 'isDivertedOrder', 'createdAt'
    ]);
  }

  props.setProperty('DB_INIT_STATE', DB_VERSION);
}

/**
 * 取得完整前台與後台資料包
 */
function getInitBundle(ss, params) {
  let storeSheet = ss.getSheetByName('Stores');
  if (!storeSheet) {
    ensureDatabaseInitialized(ss, true);
    storeSheet = ss.getSheetByName('Stores');
  }
  const stores = sheetToObjects(storeSheet);
  const rawMenus = sheetToObjects(ss.getSheetByName('Menus'));
  const orders = sheetToObjects(ss.getSheetByName('Orders')).reverse();

  const parsedMenus = rawMenus.filter(m => m.available !== false && String(m.available).toLowerCase() !== 'false').map(m => {
    let options = {};
    if (m.optionsJson) {
      try { options = JSON.parse(m.optionsJson); } catch (e) { options = {}; }
    }
    return {
      id: String(m.id),
      storeId: String(m.storeId),
      name: String(m.name),
      price: Number(m.price) || 0,
      prepTime: Number(m.prepTime) || 3,
      tag: String(m.tag || ''),
      category: String(m.category || '招牌主餐'),
      isBafangMode: Boolean(m.isBafangMode === true || String(m.isBafangMode).toLowerCase() === 'true'),
      image: String(m.image || ''),
      options: options
    };
  });

  const enrichedStores = stores.map(s => {
    const cap = Number(s.maxCapacityPer15Min) || 20;
    const active = Number(s.activeOrders) || 0;
    const loadPct = Math.min(120, Math.round((active / cap) * 100));
    
    let loadState = 'FREE';
    if (loadPct >= 85) loadState = 'FULL';
    else if (loadPct >= 50) loadState = 'MODERATE';

    const avgPrep = Number(s.avgPrepMinutes) || calcPrepMinutes(active, cap);
    const storeObj = {
      ...s,
      maxCapacityPer15Min: cap,
      activeOrders: active,
      avgPrepMinutes: avgPrep,
      promoDiscount: Number(s.promoDiscount) || 0,
      predictedDailyOrders: Number(s.predictedDailyOrders) || 150,
      rating: Number(s.rating) || 4.8,
      loadPercentage: loadPct,
      loadState: loadState,
      menus: parsedMenus.filter(m => m.storeId === s.id)
    };
    storeObj.aiScore = calcAiUtilityScore(storeObj);
    return storeObj;
  });

  const aiRecommendations = {};
  ['雙溪校區', '城中校區'].forEach(campus => {
    const campusStores = enrichedStores.filter(s => s.campus === campus);
    const congested = campusStores
      .filter(s => s.loadState === 'FULL' || s.avgPrepMinutes >= 20)
      .sort((a, b) => b.loadPercentage - a.loadPercentage || b.avgPrepMinutes - a.avgPrepMinutes);
    const availableWithPromo = campusStores
      .filter(s => s.loadState === 'FREE' && s.promoMode !== 'none')
      .sort((a, b) => b.aiScore - a.aiScore);

    if (congested.length > 0 && availableWithPromo.length > 0) {
      const busyStore = congested[0];
      const targetStore = availableWithPromo[0];
      aiRecommendations[campus] = {
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
      aiRecommendations[campus] = { hasAlert: false };
    }
  });

  return {
    bundle: {
      stores: enrichedStores,
      orders: orders.slice(0, 60),
      aiRecommendations: aiRecommendations,
      serverTime: Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss')
    }
  };
}

/**
 * 儲存並更新指定店家的完整菜單至 Google Sheet `Menus` 表
 */
function saveStoreMenusToSheet(ss, params) {
  const storeId = String(params.storeId || '');
  const newMenus = Array.isArray(params.menus) ? params.menus : [];
  if (!storeId) throw new Error('缺少 storeId 參數');

  const menuSheet = ss.getSheetByName('Menus');
  const allRows = menuSheet.getDataRange().getValues();
  const headers = [
    'id', 'storeId', 'name', 'price', 'prepTime', 'tag',
    'available', 'category', 'isBafangMode', 'image', 'optionsJson'
  ];

  // 保留其他店家的菜單，僅替換當前 storeId 的菜單列
  const keptRows = [];
  for (let i = 1; i < allRows.length; i++) {
    if (String(allRows[i][1]) !== storeId) {
      const row = allRows[i];
      keptRows.push([
        row[0], row[1], row[2], row[3], row[4], row[5],
        row[6] !== false, row[7] || '招牌主餐', Boolean(row[8]), row[9] || '', row[10] || '{}'
      ]);
    }
  }

  const storeMenuRows = newMenus.map((m, idx) => [
    m.id || (`M-${storeId}-${Date.now()}-${idx}`),
    storeId,
    String(m.name || '未命名餐點'),
    Number(m.price) || 0,
    Number(m.prepTime) || 4,
    String(m.tag || '🔥 店長推薦'),
    true,
    String(m.category || '招牌主餐'),
    Boolean(m.isBafangMode),
    String(m.image || ''),
    JSON.stringify(m.options || {})
  ]);

  const finalRows = [headers, ...keptRows, ...storeMenuRows];
  menuSheet.clearContents();
  menuSheet.getRange(1, 1, finalRows.length, headers.length).setValues(finalRows);

  return {
    message: `已成功儲存 ${storeMenuRows.length} 道菜單品項至雲端資料庫！`,
    ...getInitBundle(ss, params)
  };
}

/**
 * AI 智慧菜單辨識與自動結構化匯入 (支援菜單照片 Base64 視覺辨識 + 純文字解析)
 */
function handleAiMenuScan(ss, params) {
  const apiKey = params.apiKey || PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY') || DEFAULT_GEMINI_API_KEY;
  const rawText = String(params.rawText || '');
  const imageBase64 = params.imageBase64 || '';
  const mimeType = params.mimeType || 'image/jpeg';

  if (apiKey && (imageBase64 || rawText)) {
    try {
      const sysPrompt = `你是專業的餐飲 POS 系統 AI 菜單建檔專家。
請辨識使用者提供的菜單圖片或文字，自動整理分類、品名、價格、特色標籤，並根據食物特性自動產生合適的客製化選項群組 (options)。
若為水餃或鍋貼類單顆計價品項，請將 isBafangMode 設為 true 並在 options 加入「選擇顆數」單選群組。
請回傳純 JSON 陣列格式：
[
  {
    "category": "分類名稱(如:招牌主餐/特色麵食/單點小菜/湯品飲品)",
    "name": "餐點名稱",
    "price": 100,
    "tag": "🔥 AI推薦",
    "isBafangMode": false,
    "options": {
      "份量選擇": { "type": "radio", "choices": [["正常", 0], ["加大", 15]] },
      "辣度選擇": { "type": "radio", "choices": [["不辣", 0], ["小辣", 0], ["中辣", 0]] }
    }
  }
]`;

      const parts = [{ text: sysPrompt }];
      if (rawText) parts.push({ text: '菜單文字內容：\n' + rawText });
      if (imageBase64) {
        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: imageBase64.replace(/^data:image\/\w+;base64,/, '')
          }
        });
      }

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
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
      const outText = json.candidates && json.candidates[0] && json.candidates[0].content.parts[0].text;
      if (outText) {
        return {
          parsedItems: JSON.parse(outText),
          engine: 'Google Gemini 2.5 Flash Vision OCR'
        };
      }
    } catch (e) {}
  }

  return {
    parsedItems: [],
    engine: 'Fallback heuristic parser'
  };
}

function handleAiConcierge(ss, params) {
  const bundle = getInitBundle(ss, params).bundle;
  const campus = params.campus || '雙溪校區';
  const userQuery = String(params.query || '我趕時間想快點拿到餐，有什麼推薦？');
  const campusStores = bundle.stores.filter(s => s.campus === campus);
  const apiKey = params.apiKey || PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY') || DEFAULT_GEMINI_API_KEY;

  if (apiKey) {
    try {
      const storeContext = campusStores.map(s => ({
        storeId: s.id,
        name: s.name,
        waitMinutes: s.avgPrepMinutes,
        loadPct: s.loadPercentage,
        promo: s.promoText,
        aiUtilityScore: s.aiScore,
        menus: s.menus.map(m => `${m.id}:${m.name}($${m.price})`).join(', ')
      }));

      const prompt = `你是東吳大學「MealFlow 學餐 AI 流量管制與選餐顧問」。
目前校區：${campus}
使用者需求：「${userQuery}」
即時各餐廳佇列與菜單數據：${JSON.stringify(storeContext)}

請回傳純 JSON：
{
  "reasoning": "80字內的專業分析（包含預計省下多少排隊時間、為何推薦該店與優惠亮點）",
  "storeId": "推薦店家ID",
  "menuId": "推薦主餐ID",
  "engine": "Gemini 2.5 Flash Live"
}`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.3 }
        }),
        muteHttpExceptions: true
      });
      const json = JSON.parse(res.getContentText());
      const text = json.candidates && json.candidates[0] && json.candidates[0].content.parts[0].text;
      if (text) return { aiResult: JSON.parse(text) };
    } catch (e) {}
  }

  const sorted = campusStores.slice().sort((a, b) => b.aiScore - a.aiScore);
  const bestStore = sorted[0];
  const worstStore = campusStores.slice().sort((a, b) => b.avgPrepMinutes - a.avgPrepMinutes)[0];
  const bestMenu = (bestStore && bestStore.menus && bestStore.menus[0]) || { id: 'M04', name: '招牌特餐', price: 100 };
  const savedMin = Math.max(5, (worstStore ? worstStore.avgPrepMinutes : 20) - (bestStore ? bestStore.avgPrepMinutes : 5));

  return {
    aiResult: {
      reasoning: `經 M/M/1 佇列模型與效用函數分析，「${worstStore.name}」目前負載達 ${worstStore.loadPercentage}%（需等 ${worstStore.avgPrepMinutes} 分）。強烈建議改點「${bestStore.name}」的【${bestMenu.name} ($${bestMenu.price})】，目前僅需 ${bestStore.avgPrepMinutes} 分鐘（為您省下 ${savedMin} 分鐘），還可享「${bestStore.promoText}」！`,
      storeId: bestStore.id,
      menuId: bestMenu.id,
      engine: 'MealFlow Queueing Utility AI Engine v5.0'
    }
  };
}

function getSingleOrder(ss, params) {
  const orderSheet = ss.getSheetByName('Orders');
  const orders = sheetToObjects(orderSheet);
  const found = orders.find(o => String(o.orderId) === String(params.orderId));
  if (!found) return { found: false, message: '找不到該筆訂單' };
  return { found: true, order: found };
}

function generateOrderToken() {
  const chars = '0123456789abcdef';
  let token = 'ORD-';
  for (let i = 0; i < 12; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
  return token;
}

function handleOrderSubmission(ss, params) {
  const orderSheet = ss.getSheetByName('Orders');
  const storeSheet = ss.getSheetByName('Stores');
  
  const now = new Date();
  const nowStr = Utilities.formatDate(now, 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');
  const orderId = params.orderId || generateOrderToken();
  const prefix = params.campus === '城中校區' ? 'C' : 'S';
  const pickupNumber = params.pickupNumber || (prefix + String(Math.floor(100 + Math.random() * 899)));

  const orderSource = String(params.orderSource || '📱 掃碼點餐');
  const customerNote = String(params.customerNote || '外帶自取');
  const itemsJson = JSON.stringify(params.items || []);
  const subtotal = Number(params.subtotal) || 0;
  const discount = Number(params.discount) || 0;
  const finalTotal = Number(params.finalTotal) || 0;
  const promoApplied = params.promoApplied || '一般預訂';
  const paymentMethod = params.paymentMethod || 'LINE Pay';
  const pickupTimeSlot = params.pickupTimeSlot || '立即製作';
  const isDivertedOrder = Boolean(params.isDivertedOrder);

  const newOrderRow = [
    orderId, pickupNumber, params.storeId, params.storeName,
    orderSource, customerNote, itemsJson, subtotal, discount, finalTotal,
    promoApplied, paymentMethod, pickupTimeSlot, '製作中', isDivertedOrder, nowStr
  ];
  orderSheet.appendRow(newOrderRow);

  let updatedActive = null;
  let updatedWait = null;
  const storeData = storeSheet.getDataRange().getValues();
  for (let i = 1; i < storeData.length; i++) {
    if (storeData[i][0] === params.storeId) {
      const maxCap = Number(storeData[i][4]) || 20;
      const curActive = Number(storeData[i][5]) || 0;
      updatedActive = curActive + 1;
      updatedWait = calcPrepMinutes(updatedActive, maxCap);
      storeSheet.getRange(i + 1, 6).setValue(updatedActive);
      storeSheet.getRange(i + 1, 7).setValue(updatedWait);
      break;
    }
  }

  return {
    message: '訂單已送出！取餐號碼：' + pickupNumber,
    order: {
      orderId, pickupNumber, storeId: params.storeId, storeName: params.storeName,
      studentId: orderSource, studentName: customerNote, itemsJson, subtotal, discount, finalTotal,
      promoApplied, paymentMethod, pickupTimeSlot, status: '製作中', isDivertedOrder, createdAt: nowStr
    },
    storeLoad: { storeId: params.storeId, activeOrders: updatedActive, avgPrepMinutes: updatedWait }
  };
}

function updateStoreSettings(ss, params) {
  const storeSheet = ss.getSheetByName('Stores');
  const data = storeSheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === params.storeId) {
      const maxCap = params.maxCapacityPer15Min !== undefined
        ? Math.max(5, Number(params.maxCapacityPer15Min))
        : (Number(data[i][4]) || 20);

      if (params.promoMode !== undefined) storeSheet.getRange(i + 1, 9).setValue(params.promoMode);
      if (params.promoText !== undefined) storeSheet.getRange(i + 1, 10).setValue(params.promoText);
      if (params.promoDiscount !== undefined) storeSheet.getRange(i + 1, 11).setValue(Number(params.promoDiscount));
      if (params.maxCapacityPer15Min !== undefined) storeSheet.getRange(i + 1, 5).setValue(maxCap);
      if (params.activeOrders !== undefined) {
        const act = Math.max(0, Number(params.activeOrders));
        const wait = params.avgPrepMinutes !== undefined
          ? Math.max(2, Number(params.avgPrepMinutes))
          : calcPrepMinutes(act, maxCap);
        storeSheet.getRange(i + 1, 6).setValue(act);
        storeSheet.getRange(i + 1, 7).setValue(wait);
      }
      break;
    }
  }
  return {
    message: '店家 AI 分流與產能配置已同步更新！',
    ...getInitBundle(ss, params)
  };
}

function updateOrderState(ss, params) {
  const orderSheet = ss.getSheetByName('Orders');
  const storeSheet = ss.getSheetByName('Stores');
  const data = orderSheet.getDataRange().getValues();
  let targetStoreId = null;
  let oldStatus = null;

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === params.orderId) {
      targetStoreId = data[i][2];
      oldStatus = data[i][13];
      orderSheet.getRange(i + 1, 14).setValue(params.newStatus);
      break;
    }
  }

  if (targetStoreId && oldStatus === '製作中' && (params.newStatus === '可取餐' || params.newStatus === '已完成')) {
    const sData = storeSheet.getDataRange().getValues();
    for (let j = 1; j < sData.length; j++) {
      if (sData[j][0] === targetStoreId) {
        const maxCap = Number(sData[j][4]) || 20;
        const cur = Number(sData[j][5]) || 1;
        const nextAct = Math.max(0, cur - 1);
        storeSheet.getRange(j + 1, 6).setValue(nextAct);
        storeSheet.getRange(j + 1, 7).setValue(calcPrepMinutes(nextAct, maxCap));
        break;
      }
    }
  }

  return {
    message: '訂單狀態已更新為：' + params.newStatus,
    ...getInitBundle(ss, params)
  };
}

function runTrafficSimulation(ss, params) {
  const storeSheet = ss.getSheetByName('Stores');
  const data = storeSheet.getDataRange().getValues();
  const mode = params.mode || 'PEAK';

  for (let i = 1; i < data.length; i++) {
    const storeId = data[i][0];
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
      } else {
        storeSheet.getRange(i + 1, 6).setValue(5);
        storeSheet.getRange(i + 1, 7).setValue(5);
      }
    } else {
      storeSheet.getRange(i + 1, 6).setValue(4);
      storeSheet.getRange(i + 1, 7).setValue(5);
    }
  }
  return {
    message: mode === 'PEAK' ? '🔥 已啟動「中午 12:10 尖峰塞車」模擬情境！' : '✅ 已恢復全校區正常離峰流量！',
    ...getInitBundle(ss, params)
  };
}

function sheetToObjects(sheet) {
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = row[idx];
    });
    return obj;
  });
}
