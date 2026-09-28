/**
 * sync-turbidity.js
 * Scrapes latest turbidity data from MWA RWC (http://rwc.mwa.co.th/page/home/table.php),
 * updates local cache (data/turbidity_cache.json), and syncs to Firebase Cloud Firestore (turbidity/latest).
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const FIREBASE_API_KEY = 'AIzaSyC26WVUAg_Taj93PZcNHzBGQ5HaFgr70EQ';
const FIREBASE_PROJECT_ID = 'mwa-erm';

const TARGET_STATIONS = [
  { id: 'S16', search_name: 'แม่น้ำแควน้อย', name: 'แควน้อย' },
  { id: 'T5',  search_name: 'แม่น้ำแควใหญ่', name: 'แควใหญ่' },
  { id: 'S11', search_name: 'เขื่อนแม่กลอง', name: 'แม่กลอง' },
  { id: 'S9',  search_name: 'ท่าม่วง',        name: 'ท่าม่วง' },
  { id: 'S12', search_name: 'บางเลน กม.35',   name: 'บางเลน กม.35' },
  { id: 'S14', search_name: 'คลองตะวันตก กม.14', name: 'คลองตะวันตก กม.14' }
];

function fetchMwaHtml() {
  return new Promise((resolve, reject) => {
    const req = http.get('http://rwc.mwa.co.th/page/home/table.php', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('MWA connection timeout (10s)'));
    });
    req.on('error', reject);
  });
}

function parseMwaTurbidity(html) {
  const rows = html.match(/<TR[\s\S]*?<\/TR>/gi) || [];
  const extracted = [];
  let updateDate = '';
  let updateTime = '';

  for (const st of TARGET_STATIONS) {
    const row = rows.find(r => {
      const hasId = r.includes('id=' + st.id + '"') || r.includes('id=' + st.id + '\'') || r.includes('id=' + st.id + ' ');
      const hasName = st.search_name && r.includes(st.search_name);
      if (!hasId && !hasName) return false;
      const cellMatches = r.match(/<TD[\s\S]*?<\/TD>/gi) || [];
      return cellMatches.length >= 7;
    });

    if (!row) {
      extracted.push({
        id: st.id,
        name: st.name,
        turbidity: null,
        raw_turbidity: '-',
        is_high: false,
        date: updateDate,
        time: updateTime
      });
      continue;
    }

    const cells = (row.match(/<TD[\s\S]*?<\/TD>/gi) || []).map(c => c.replace(/<[^>]+>/g, '').trim());
    // Index: 0: Station, 1: Dist, 2: Date, 3: Time, 4: pH, 5: Salinity, 6: Turbidity
    const rowDate = cells[2] || '';
    const rowTime = cells[3] || '';
    const rawTurb = cells[6] || '-';
    const turbVal = isNaN(parseFloat(rawTurb)) ? null : parseFloat(rawTurb);

    if (rowTime && !updateTime) updateTime = rowTime;
    if (rowDate && !updateDate) updateDate = rowDate;

    extracted.push({
      id: st.id,
      name: st.name,
      turbidity: turbVal,
      raw_turbidity: rawTurb,
      is_high: turbVal !== null && turbVal > 100,
      date: rowDate,
      time: rowTime
    });
  }

  return {
    status: 'success',
    source: 'live',
    date: updateDate,
    time: updateTime,
    updated_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
    data: extracted
  };
}

function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: val.toString() };
    return { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields = {};
    for (const k of Object.keys(val)) {
      fields[k] = toFirestoreValue(val[k]);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const k of Object.keys(obj)) {
    if (obj[k] !== undefined) {
      fields[k] = toFirestoreValue(obj[k]);
    }
  }
  return { fields };
}

function syncToFirestore(payload) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(toFirestoreFields(payload));
    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/turbidity/latest?key=${FIREBASE_API_KEY}`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    }, (res) => {
      let respData = '';
      res.on('data', chunk => respData += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(true);
        } else {
          reject(new Error(`Firestore error HTTP ${res.statusCode}: ${respData}`));
        }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

async function main() {
  console.log('🌊 กำลังดึงข้อมูลคุณภาพน้ำสดจาก http://rwc.mwa.co.th/page/home/table.php ...');
  try {
    const html = await fetchMwaHtml();
    const result = parseMwaTurbidity(html);
    console.log(`✅ ดึงข้อมูลสำเร็จ ณ วันที่ ${result.date} เวลา ${result.time} น.`);
    console.table(result.data.map(d => ({
      'สถานี': d.name,
      'ความขุ่น (NTU)': d.turbidity !== null ? d.turbidity : d.raw_turbidity,
      'สถานะ': d.is_high ? '⚠️ เกิน 100 NTU' : 'ปกติ',
      'เวลา': d.time
    })));

    // 1. Save local JSON cache
    const cachePath = path.join(__dirname, 'data', 'turbidity_cache.json');
    fs.writeFileSync(cachePath, JSON.stringify(result, null, 4), 'utf8');
    console.log(`💾 บันทึกไฟล์แคชเรียบร้อย: ${cachePath}`);

    // 2. Sync to Firebase Cloud Firestore
    try {
      await syncToFirestore(result);
      console.log('🔥 ซิงค์ข้อมูลขึ้น Firebase Cloud Firestore (turbidity/latest) สำเร็จ!');
    } catch (fbErr) {
      console.warn('⚠️ ไม่สามารถซิงค์ขึ้น Firebase ได้:', fbErr.message);
    }

  } catch (err) {
    console.error('❌ เกิดข้อผิดพลาดในการดึงข้อมูล:', err.message);
    process.exit(1);
  }
}

main();
