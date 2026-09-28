/**
 * Direct Migration Script to Firebase Cloud Firestore via REST API
 * Populates 'locations' and 'timeline' collections for mwa-erm
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const apiKey = 'AIzaSyC26WVUAg_Taj93PZcNHzBGQ5HaFgr70EQ';
const projectId = 'mwa-erm';

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

function uploadDoc(collection, docId, data) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(toFirestoreFields(data));
    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${projectId}/databases/(default)/documents/${collection}/${docId}?key=${apiKey}`,
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
          reject(new Error(`HTTP ${res.statusCode}: ${respData}`));
        }
      });
    });

    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

async function run() {
  console.log('🚀 เริ่มต้นนำเข้าข้อมูลเข้าสู่ Firebase Cloud Firestore (mwa-erm)...');

  // 1. Upload locations
  const locationsFile = path.join(__dirname, 'data', 'locations.json');
  if (fs.existsSync(locationsFile)) {
    const locations = JSON.parse(fs.readFileSync(locationsFile, 'utf8'));
    console.log(`📍 กำลังอัปโหลดจุดตรวจการณ์ ${locations.length} จุด...`);
    for (const loc of locations) {
      try {
        await uploadDoc('locations', loc.id, loc);
        process.stdout.write(`  ✅ อัปโหลดจุด: ${loc.name} (${loc.id})\n`);
      } catch (err) {
        console.error(`  ❌ ไม่สามารถอัปโหลด ${loc.id}:`, err.message);
      }
    }
  }

  // 2. Upload timeline
  const timelineFile = path.join(__dirname, 'data', 'timeline.json');
  if (fs.existsSync(timelineFile)) {
    const timeline = JSON.parse(fs.readFileSync(timelineFile, 'utf8'));
    console.log(`\n📅 กำลังอัปโหลดประวัติสถานการณ์ (Timeline) ${timeline.length} รายการ...`);
    for (const item of timeline) {
      try {
        await uploadDoc('timeline', item.id, item);
        process.stdout.write(`  ✅ อัปโหลดบันทึก: ${item.locationName} - ${item.shortSummary || ''} (${item.id})\n`);
      } catch (err) {
        console.error(`  ❌ ไม่สามารถอัปโหลด ${item.id}:`, err.message);
      }
    }
  }

  console.log('\n🎉 ซิงค์ข้อมูลทั้งหมดขึ้น Firebase Cloud Firestore สำเร็จเรียบร้อยแล้ว!');
}

run().catch(console.error);
