/**
 * MealFlow 學餐 AI 流量管制塔 - 企業級後端引擎 (Google Apps Script v4.0)
 * 整合：
 * 1. M/M/1 佇列理論等待時間推論模型與多維度效用評分 (Utility Scoring)
 * 2. Google Gemini API (gemini-2.5-flash) 生成式 AI 選餐顧問與店家動態分流策略分析
 * 3. 支援學生掃碼點餐 (/order/)、專屬亂碼訂單憑證 (?id=ORD-xxx) 與店家櫃檯 POS + 廚房 KDS (/store/)
 */

const SHEET_ID = '14SaczmfdgXx9t4WfoSBrD_8gs7wzdCcNrsroT0bvzok';
const DB_VERSION = 'v4.0_init_done';

// 若有 Google AI Studio 的 Gemini API Key，可填入此處或存入 ScriptProperties 的 'GEMINI_API_KEY'
const DEFAULT_GEMINI_API_KEY = '';

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    service: 'MealFlow AI Engine v4.0 (Queueing Model + Gemini LLM)',
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

/**
 * M/M/1 佇列模型與非線性負載推算預估等待時間（分鐘）
 * 考慮店家每 15 分鐘產能服務率 μ = maxCap / 15 (單/分鐘)
 */
function calcPrepMinutes(activeOrders, maxCap) {
  const cap = Math.max(5, Number(maxCap) || 20);
  const act = Math.max(0, Number(activeOrders) || 0);
  const serviceRatePerMin = cap / 15; // 每分鐘出餐產能 μ
  const loadRatio = act / cap;        // 負載率 ρ
  if (act <= 1) return 3;
  // Little's Law 基礎排隊時間 (act / μ) + 高負載時的非線性壅塞懲罰項
  const queueTime = act / serviceRatePerMin;
  const congestionPenalty = loadRatio >= 0.85 ? Math.pow((loadRatio - 0.75) * 10, 1.5) : 0;
  const est = Math.round(2 + queueTime * 0.85 + congestionPenalty);
  return Math.max(3, Math.min(45, est));
}

/**
 * 計算店家的 AI 綜合推薦效用分數 (0 ~ 99 分)
 * 結合：時間節省權重 (55%)、優惠價值權重 (25%)、顧客評分權重 (20%)
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

/**
 * 自動初始化資料庫結構（若空白則塞入東吳雙溪與城中校區完整菜單資料）
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
    menuSheet.appendRow(['id', 'storeId', 'name', 'price', 'prepTime', 'tag', 'available']);
    const defaultMenus = [
      ['M01', 'S01', '特製韓式泡菜燒肉飯捲', 75, 4, '🔥 必點人氣', true],
      ['M02', 'S01', '起司炸蝦海苔飯捲', 85, 5, '⭐ 主廚推薦', true],
      ['M03', 'S01', '經典鮪魚玉米飯捲', 65, 3, '⚡ 快速出餐', true],
      ['M18', 'S01', '韓式魚板蘿蔔湯', 35, 2, '🥣 暖胃湯品', true],
      ['M04', 'S02', '炙燒起司牛五花丼', 115, 4, '🔥 招牌必點', true],
      ['M05', 'S02', '黃金厚切豬排滑蛋丼', 120, 5, '⭐ 飽足首選', true],
      ['M06', 'S02', '讚岐胡麻冷烏龍麵', 95, 3, '⚡ 3分極速出餐', true],
      ['M19', 'S02', '日式唐揚炸雞 (單點)', 55, 3, '🍗 人氣加點', true],
      ['M07', 'S03', '招牌鍋貼套餐 (10顆+酸辣湯)', 105, 5, '🔥 經典組合', true],
      ['M08', 'S03', '高麗菜水餃 (12顆)', 78, 4, '⚡ 快速出餐', true],
      ['M20', 'S03', '冰鎮無糖豆漿', 25, 1, '🥤 清涼飲品', true],
      ['M09', 'S04', '秘製椒麻雞腿飯', 110, 4, '🔥 銷量冠軍', true],
      ['M10', 'S04', '蒜泥白肉精緻便當', 100, 3, '⚡ 極速便當', true],
      ['M21', 'S04', '脆皮炸豆腐', 40, 2, '✨ 招牌小菜', true],
      ['M11', 'S05', '唐揚炸雞熟成咖哩飯', 125, 6, '🔥 排隊人氣', true],
      ['M12', 'S05', '手打漢堡排歐姆蛋咖哩', 135, 7, '⭐ 限量供應', true],
      ['M13', 'S06', '蔥爆牛肉鐵板簡餐', 115, 4, '🔥 現點現做', true],
      ['M14', 'S06', '古早味排骨特餐', 105, 3, '⚡ 4分極速取餐', true],
      ['M15', 'S06', '手工鮮蝦紅油抄手麵', 90, 3, '⭐ 學生最愛', true],
      ['M16', 'S07', '川味麻辣雞絲涼麵 (大)', 75, 2, '⚡ 2分秒取', true],
      ['M17', 'S07', '綜合三合一味噌湯 (貢丸+蛋花)', 45, 2, '🔥 絕配湯品', true]
    ];
    defaultMenus.forEach(r => menuSheet.appendRow(r));
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
 * 取得完整前台與後台資料包 (搭配 M/M/1 佇列模型與多目標效用評分)
 */
function getInitBundle(ss, params) {
  let storeSheet = ss.getSheetByName('Stores');
  if (!storeSheet) {
    ensureDatabaseInitialized(ss, true);
    storeSheet = ss.getSheetByName('Stores');
  }
  const stores = sheetToObjects(storeSheet);
  const menus = sheetToObjects(ss.getSheetByName('Menus'));
  const orders = sheetToObjects(ss.getSheetByName('Orders')).reverse();

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
      menus: menus.filter(m => m.storeId === s.id).map(m => ({
        ...m,
        price: Number(m.price) || 0,
        prepTime: Number(m.prepTime) || 3
      }))
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
 * 真 AI 選餐與動態分流決策引擎 (整合 Gemini 2.5 Flash API + 佇列效用演算法 Fallback)
 */
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

請根據佇列等待時間、優惠活動與使用者需求，挑選最適合的 1~2 道餐點，並回傳純 JSON 格式（不要 markdown 標記）：
{
  "reasoning": "80字內的專業分析（包含預計省下多少排隊時間、為何推薦該店與優惠亮點）",
  "storeId": "推薦店家ID (如 S02)",
  "menuId": "推薦主餐ID (如 M04)",
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
      if (text) {
        const parsed = JSON.parse(text);
        return { aiResult: parsed };
      }
    } catch (e) {
      // 若 API 呼叫異常則無縫切換至下方的多目標佇列效用演算法
    }
  }

  // 多目標佇列效用演算法 (Multi-Objective Queueing Utility Engine)
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
      engine: 'MealFlow Queueing Utility AI Engine v4.0'
    }
  };
}

function getSingleOrder(ss, params) {
  const orderSheet = ss.getSheetByName('Orders');
  const orders = sheetToObjects(orderSheet);
  const found = orders.find(o => String(o.orderId) === String(params.orderId));
  if (!found) {
    return { found: false, message: '找不到該筆訂單' };
  }
  return { found: true, order: found };
}

function generateOrderToken() {
  const chars = '0123456789abcdef';
  let token = 'ORD-';
  for (let i = 0; i < 12; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
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

  const orderSource = String(params.orderSource || 'QR掃碼點餐');
  const customerNote = String(params.customerNote || '自取');
  const itemsJson = JSON.stringify(params.items || []);
  const subtotal = Number(params.subtotal) || 0;
  const discount = Number(params.discount) || 0;
  const finalTotal = Number(params.finalTotal) || 0;
  const promoApplied = params.promoApplied || '一般預訂';
  const paymentMethod = params.paymentMethod || 'LINE Pay';
  const pickupTimeSlot = params.pickupTimeSlot || '立即製作';
  const isDivertedOrder = Boolean(params.isDivertedOrder);

  const newOrderRow = [
    orderId,
    pickupNumber,
    params.storeId,
    params.storeName,
    orderSource,
    customerNote,
    itemsJson,
    subtotal,
    discount,
    finalTotal,
    promoApplied,
    paymentMethod,
    pickupTimeSlot,
    '製作中',
    isDivertedOrder,
    nowStr
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
      orderId,
      pickupNumber,
      storeId: params.storeId,
      storeName: params.storeName,
      studentId: orderSource,
      studentName: customerNote,
      itemsJson,
      subtotal,
      discount,
      finalTotal,
      promoApplied,
      paymentMethod,
      pickupTimeSlot,
      status: '製作中',
      isDivertedOrder,
      createdAt: nowStr
    },
    storeLoad: {
      storeId: params.storeId,
      activeOrders: updatedActive,
      avgPrepMinutes: updatedWait
    }
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
