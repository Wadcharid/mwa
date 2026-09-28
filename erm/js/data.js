/**
 * ERM - Data Store Module (Serverless / JSON / LocalStorage)
 * Handles data persistence, CRUD operations, and JSON file export/import.
 */

const ERM_STORAGE_KEY = 'erm_incidents_data_v1';

class IncidentDataStore {
  constructor() {
    this.incidents = [];
    this.subscribers = [];
  }

  // Subscribe to data updates
  subscribe(callback) {
    if (typeof callback === 'function') {
      this.subscribers.push(callback);
    }
  }

  notify() {
    this.subscribers.forEach(cb => cb(this.incidents));
  }

  // Load data: Try localStorage first; if empty, fetch initial data/incidents.json
  async init() {
    const cached = localStorage.getItem(ERM_STORAGE_KEY);
    if (cached) {
      try {
        this.incidents = JSON.parse(cached);
        this.notify();
        return this.incidents;
      } catch (e) {
        console.warn('Failed to parse cached data, falling back to JSON file:', e);
      }
    }

    try {
      const resp = await fetch('data/incidents.json');
      if (resp.ok) {
        this.incidents = await resp.json();
        this.saveToStorage();
        this.notify();
        return this.incidents;
      }
    } catch (err) {
      console.error('Error fetching initial incidents.json:', err);
    }

    // Fallback if fetch fails (e.g. opened directly as file:// in some browsers)
    if (!this.incidents || this.incidents.length === 0) {
      this.incidents = this.getDefaultFallbackData();
      this.saveToStorage();
      this.notify();
    }
    return this.incidents;
  }

  saveToStorage() {
    try {
      localStorage.setItem(ERM_STORAGE_KEY, JSON.stringify(this.incidents));
    } catch (e) {
      console.error('LocalStorage write failed:', e);
    }
  }

  getAll() {
    return this.incidents;
  }

  getById(id) {
    return this.incidents.find(item => item.id === id);
  }

  getByCategory(category) {
    if (!category || category === 'all') return this.incidents;
    return this.incidents.filter(item => item.category === category);
  }

  save(data) {
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    let savedItem = null;
    if (data.id) {
      // Update existing
      const index = this.incidents.findIndex(item => item.id === data.id);
      if (index !== -1) {
        this.incidents[index] = {
          ...this.incidents[index],
          ...data,
          updatedAt: formattedDate
        };
        savedItem = this.incidents[index];
      } else {
        savedItem = {
          ...data,
          updatedAt: formattedDate
        };
        this.incidents.push(savedItem);
      }
    } else {
      // Create new
      const newId = 'inc-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
      savedItem = {
        ...data,
        id: newId,
        updatedAt: formattedDate,
        metrics: data.metrics || []
      };
      data.id = newId;
      this.incidents.push(savedItem);
    }

    this.saveToStorage();
    this.notify();
    return savedItem;
  }

  updateCoordinates(id, lat, lng) {
    const item = this.getById(id);
    if (item) {
      item.lat = Number(lat.toFixed(6));
      item.lng = Number(lng.toFixed(6));
      const now = new Date();
      item.updatedAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      this.saveToStorage();
      this.notify();
      return true;
    }
    return false;
  }

  delete(id) {
    const index = this.incidents.findIndex(item => item.id === id);
    if (index !== -1) {
      this.incidents.splice(index, 1);
      this.saveToStorage();
      this.notify();
      return true;
    }
    return false;
  }

  // Export current dataset to JSON file (for GitHub commit / Cloudflare Pages)
  exportJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.incidents, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "incidents.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  // Import JSON file to replace or merge data
  async importJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target.result);
          if (Array.isArray(parsed)) {
            this.incidents = parsed;
            this.saveToStorage();
            this.notify();
            resolve(this.incidents);
          } else {
            reject(new Error('รูปแบบไฟล์ JSON ต้องเป็น Array ของรายการข้อมูล'));
          }
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('เกิดข้อผิดพลาดในการอ่านไฟล์'));
      reader.readAsText(file);
    });
  }

  // Reset to default sample dataset
  async resetToDefault() {
    localStorage.removeItem(ERM_STORAGE_KEY);
    await this.init();
    return this.incidents;
  }

  getDefaultFallbackData() {
    return [
      {
        id: "inc-001",
        category: "canal",
        title: "คลองมหาสวัสดิ์ (ประตูน้ำทิศเหนือ)",
        shortSummary: "ระดับน้ำ +1.20 ม.รทก. (ปกติ)",
        status: "normal",
        lat: 13.80915,
        lng: 100.41320,
        details: "ระดับน้ำในคลองมหาสวัสดิ์ฝั่งทิศเหนืออยู่ในเกณฑ์ควบคุม ประตูระบายน้ำเปิดระบาย 20 ซม. อัตราการไหลปกติ ไม่มีสิ่งกีดขวางทางน้ำ การระบายน้ำคล่องตัว",
        metrics: [
          { label: "ระดับน้ำปัจจุบัน", value: "+1.20 ม.รทก." },
          { label: "ระดับเตือนภัย", value: "+1.80 ม.รทก." }
        ],
        reportedBy: "ฝ่ายเฝ้าระวังแหล่งน้ำดิบ",
        updatedAt: "2026-09-28 09:15"
      },
      {
        id: "inc-003",
        category: "facility",
        title: "หน้าโรงงาน ถ.กาญจนาภิเษก (จุดกลับรถ)",
        shortSummary: "จุดกลับรถสัญจรได้ปกติ ไม่มีน้ำขัง",
        status: "normal",
        lat: 13.80480,
        lng: 100.41950,
        details: "การจราจรหน้าทางเข้าโรงงานและถนนกาญจนาภิเษกสัญจรได้คล่องตัว จุดกลับรถใต้สะพานไม่มีน้ำท่วมขัง ผิวจราจรแห้ง",
        metrics: [
          { label: "สภาพการจราจร", value: "คล่องตัว" }
        ],
        reportedBy: "รปภ. ประจำจุดหน้าโรงงาน",
        updatedAt: "2026-09-28 09:10"
      },
      {
        id: "inc-005",
        category: "water_quality",
        title: "อาคารสูบจ่ายน้ำและผลิตหลัก",
        shortSummary: "จ่ายน้ำ 1.25M ลบ.ม./วัน (ปกติ 95%)",
        status: "normal",
        lat: 13.80630,
        lng: 100.41580,
        details: "สถานการณ์การผลิตและสูบจ่ายน้ำประปาปัจจุบันเดินเครื่องเต็มประสิทธิภาพ อัตราการจ่าย 1,250,000 ลบ.ม./วัน",
        metrics: [
          { label: "กำลังการผลิตปัจจุบัน", value: "1.25 ล้าน ลบ.ม./วัน" }
        ],
        reportedBy: "วิศวกรควบคุมการผลิต",
        updatedAt: "2026-09-28 09:00"
      }
    ];
  }
}

// Global instance
window.dataStore = new IncidentDataStore();
