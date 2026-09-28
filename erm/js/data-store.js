/**
 * ERM v2 - Data Store Module with Firebase Firestore Realtime Support
 * Manages standard locations, custom locations, and the timeline diary stream.
 * Automatically synchronizes with Firebase Cloud Firestore when configured,
 * or seamlessly falls back to LocalStorage & local JSON files.
 */

const STORAGE_KEY_TIMELINE = 'erm_v2_timeline_data';
const STORAGE_KEY_CUSTOM_LOCS = 'erm_v2_custom_locations';

class DataStoreV2 {
  constructor() {
    this.locations = [];
    this.timeline = [];
    this.subscribers = [];
    this.unsubscribeFirestoreTimeline = null;
    this.unsubscribeFirestoreLocations = null;
    this.isSyncingWithFirebase = false;
  }

  subscribe(callback) {
    if (typeof callback === 'function') {
      this.subscribers.push(callback);
    }
  }

  notify() {
    this.subscribers.forEach(cb => {
      try {
        cb({
          locations: this.getAllLocations(),
          timeline: this.getTimeline()
        });
      } catch (e) {
        console.error('DataStore subscriber error:', e);
      }
    });
  }

  async init() {
    // 1. Initial fast load from Local Storage & bundled JSON (zero delay)
    await this.loadLocations();
    await this.loadTimeline();
    this.notify();

    // 2. Initialize Firebase if available
    if (window.ermFirebase) {
      const isReady = window.ermFirebase.init();
      if (isReady && window.ermFirebase.isConnected()) {
        this.setupFirestoreSync();
      }

      // Re-bind if config changes dynamically in modal
      window.ermFirebase.onConnectionChange((connected) => {
        if (connected) {
          this.setupFirestoreSync();
        } else {
          this.detachFirestoreSync();
        }
      });
    }

    return {
      locations: this.getAllLocations(),
      timeline: this.getTimeline()
    };
  }

  setupFirestoreSync() {
    const db = window.ermFirebase.getDb();
    if (!db) return;

    this.detachFirestoreSync();
    console.log('🔄 Setting up Firestore Realtime Listeners...');

    // 1. Sync Timeline Collection
    try {
      this.unsubscribeFirestoreTimeline = db.collection('timeline')
        .orderBy('timestamp', 'desc')
        .onSnapshot((snapshot) => {
          if (!snapshot.empty) {
            const items = [];
            snapshot.forEach(doc => {
              items.push({ id: doc.id, ...doc.data() });
            });
            this.timeline = items;
            this.saveTimelineToStorage();
            this.notify();
            console.log(`🔥 Received ${items.length} timeline entries from Firestore.`);
          } else {
            console.log('ℹ️ Firestore timeline collection is currently empty.');
          }
        }, (err) => {
          console.warn('⚠️ Firestore timeline snapshot error (checking rules?):', err);
        });
    } catch (e) {
      console.error('Error attaching timeline snapshot listener:', e);
    }

    // 2. Sync Locations Collection
    try {
      this.unsubscribeFirestoreLocations = db.collection('locations')
        .onSnapshot((snapshot) => {
          if (!snapshot.empty) {
            const firestoreLocs = [];
            snapshot.forEach(doc => {
              firestoreLocs.push({ id: doc.id, ...doc.data() });
            });

            // Merge with standard fallback locations if missing
            const stdLocs = this.getFallbackLocations();
            const combined = [...firestoreLocs];
            stdLocs.forEach(std => {
              if (!combined.some(l => l.id === std.id)) {
                combined.push(std);
              }
            });

            this.locations = combined;
            this.saveCustomLocationsToStorage();
            this.notify();
            console.log(`🔥 Received ${firestoreLocs.length} locations from Firestore.`);
          }
        }, (err) => {
          console.warn('⚠️ Firestore locations snapshot error:', err);
        });
    } catch (e) {
      console.error('Error attaching locations snapshot listener:', e);
    }
  }

  detachFirestoreSync() {
    if (this.unsubscribeFirestoreTimeline) {
      this.unsubscribeFirestoreTimeline();
      this.unsubscribeFirestoreTimeline = null;
    }
    if (this.unsubscribeFirestoreLocations) {
      this.unsubscribeFirestoreLocations();
      this.unsubscribeFirestoreLocations = null;
    }
  }

  getBasePath() {
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      const src = scripts[i].getAttribute('src') || '';
      if (src.includes('data-store.js')) {
        const idx = src.indexOf('js/data-store.js');
        if (idx !== -1) {
          return src.substring(0, idx);
        }
      }
    }
    return '';
  }

  async loadLocations() {
    const basePath = this.getBasePath();
    // Load standard locations (try detected basePath first, then fallback to root data/)
    try {
      let resp = await fetch(basePath + 'data/locations.json');
      if (!resp.ok && basePath) {
        resp = await fetch('data/locations.json');
      }
      if (resp.ok) {
        this.locations = await resp.json();
      }
    } catch (e) {
      console.warn('Failed to fetch data/locations.json, using fallback:', e);
      this.locations = this.getFallbackLocations();
    }

    // Load any user-created custom locations from localStorage
    const savedCustom = localStorage.getItem(STORAGE_KEY_CUSTOM_LOCS);
    if (savedCustom) {
      try {
        const customLocs = JSON.parse(savedCustom);
        if (Array.isArray(customLocs)) {
          this.locations = [...this.locations, ...customLocs];
        }
      } catch (err) {
        console.error('Failed to parse custom locations:', err);
      }
    }
  }

  async loadTimeline() {
    // Check localStorage first (must be a non-empty array)
    const cachedTimeline = localStorage.getItem(STORAGE_KEY_TIMELINE);
    if (cachedTimeline) {
      try {
        const parsed = JSON.parse(cachedTimeline);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.timeline = parsed;
          return;
        }
      } catch (e) {
        console.warn('Failed to parse cached timeline, falling back to file:', e);
      }
    }

    // Fallback: fetch from data/timeline.json
    try {
      const basePath = this.getBasePath();
      let resp = await fetch(basePath + 'data/timeline.json');
      if (!resp.ok && basePath) {
        resp = await fetch('data/timeline.json');
      }
      if (resp.ok) {
        this.timeline = await resp.json();
        this.saveTimelineToStorage();
        return;
      }
    } catch (e) {
      console.warn('Failed to fetch data/timeline.json:', e);
    }

    if (!this.timeline || this.timeline.length === 0) {
      this.timeline = [];
    }
  }

  saveTimelineToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY_TIMELINE, JSON.stringify(this.timeline));
    } catch (e) {
      console.error('LocalStorage write failed:', e);
    }
  }

  saveCustomLocationsToStorage() {
    try {
      const customLocs = this.locations.filter(l => !l.isStandard);
      localStorage.setItem(STORAGE_KEY_CUSTOM_LOCS, JSON.stringify(customLocs));
    } catch (e) {
      console.error('Custom locations save failed:', e);
    }
  }

  getAllLocations() {
    return this.locations;
  }

  getLocationById(id) {
    return this.locations.find(l => l.id === id);
  }

  getTimeline(filterLocationId = null) {
    let list = [...this.timeline];
    if (filterLocationId) {
      list = list.filter(item => item.locationId === filterLocationId);
    }
    // Sort descending by timestamp (newest first)
    list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return list;
  }

  getLatestStatusForLocation(locationId) {
    const entries = this.getTimeline(locationId);
    if (entries.length > 0) {
      return entries[0].status; // Most recent status
    }
    return 'nodata';
  }

  getLatestEntryForLocation(locationId) {
    const entries = this.getTimeline(locationId);
    return entries.length > 0 ? entries[0] : null;
  }

  /**
   * Add a new Timeline record (Diary Post)
   * Automatically persists to Firebase Cloud Firestore and LocalStorage
   */
  async addTimelineEntry(entry) {
    const newEntry = {
      id: 'tl-' + Date.now(),
      locationId: entry.locationId,
      locationName: entry.locationName,
      lat: Number(entry.lat),
      lng: Number(entry.lng),
      status: entry.status || 'normal',
      shortSummary: entry.shortSummary || '',
      description: entry.description || '',
      reportedBy: entry.reportedBy || 'ผู้ดูแลระบบ',
      ipAddress: entry.ipAddress || '127.0.0.1',
      timestamp: entry.timestamp || new Date().toISOString(),
      image: entry.image || ''
    };

    // Optimistic Local update
    this.timeline.unshift(newEntry);
    this.saveTimelineToStorage();
    this.notify();

    // Firebase Firestore sync
    if (window.ermFirebase && window.ermFirebase.isConnected()) {
      try {
        const db = window.ermFirebase.getDb();
        await db.collection('timeline').doc(newEntry.id).set(newEntry);
        console.log('✅ Entry saved to Firebase Firestore:', newEntry.id);
      } catch (err) {
        console.error('❌ Failed to save entry to Firestore:', err);
      }
    }

    return newEntry;
  }

  /**
   * Add a new Custom Location (e.g. from clicking on map)
   */
  async addCustomLocation(name, lat, lng, description = '') {
    const id = 'loc-custom-' + Date.now();
    const newLoc = {
      id,
      name,
      thaiName: name,
      lat: Number(lat),
      lng: Number(lng),
      category: 'facility',
      description,
      isStandard: false
    };

    this.locations.push(newLoc);
    this.saveCustomLocationsToStorage();
    this.notify();

    // Firebase Firestore sync
    if (window.ermFirebase && window.ermFirebase.isConnected()) {
      try {
        const db = window.ermFirebase.getDb();
        await db.collection('locations').doc(newLoc.id).set(newLoc);
        console.log('✅ Custom location saved to Firebase Firestore:', newLoc.id);
      } catch (err) {
        console.error('❌ Failed to save custom location to Firestore:', err);
      }
    }

    return newLoc;
  }

  /**
   * Delete a timeline entry (Admin only)
   */
  async deleteTimelineEntry(entryId) {
    this.timeline = this.timeline.filter(e => e.id !== entryId);
    this.saveTimelineToStorage();
    this.notify();

    // Firebase Firestore sync
    if (window.ermFirebase && window.ermFirebase.isConnected()) {
      try {
        const db = window.ermFirebase.getDb();
        await db.collection('timeline').doc(entryId).delete();
        console.log('🗑️ Entry deleted from Firestore:', entryId);
      } catch (err) {
        console.error('❌ Failed to delete entry from Firestore:', err);
      }
    }
  }

  /**
   * Migrate / Seed standard locations & timeline history into Firebase Cloud Firestore
   */
  async syncAllToFirebase() {
    if (!window.ermFirebase || !window.ermFirebase.isConnected()) {
      throw new Error('Firebase ยังไม่ได้เชื่อมต่อ กรุณาระบุ Firebase Config ก่อน');
    }

    const db = window.ermFirebase.getDb();
    let locationsCount = 0;
    let timelineCount = 0;

    // 1. Seed Locations
    const locs = this.getAllLocations();
    for (const loc of locs) {
      await db.collection('locations').doc(loc.id).set(loc, { merge: true });
      locationsCount++;
    }

    // 2. Seed Timeline
    const entries = this.getTimeline();
    for (const entry of entries) {
      await db.collection('timeline').doc(entry.id).set(entry, { merge: true });
      timelineCount++;
    }

    return { locationsCount, timelineCount };
  }

  /**
   * Export all timeline data as a JSON file
   */
  exportTimelineJSON() {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(this.timeline, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `timeline-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
  }

  /**
   * Import timeline JSON file
   */
  async importTimelineJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          if (Array.isArray(imported)) {
            this.timeline = imported;
            this.saveTimelineToStorage();
            this.notify();

            // Also sync to Firebase if online
            if (window.ermFirebase && window.ermFirebase.isConnected()) {
              const db = window.ermFirebase.getDb();
              for (const item of imported) {
                if (item.id) {
                  await db.collection('timeline').doc(item.id).set(item, { merge: true });
                }
              }
            }

            resolve(imported.length);
          } else {
            reject(new Error('รูปแบบไฟล์ JSON ไม่ถูกต้อง (ต้องเป็น Array)'));
          }
        } catch (err) {
          reject(new Error('เกิดข้อผิดพลาดในการแปลงไฟล์ JSON'));
        }
      };
      reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์ได้'));
      reader.readAsText(file);
    });
  }

  getFallbackLocations() {
    return [
      { id: "loc-dps", name: "DPS", thaiName: "สถานีสูบจ่ายน้ำ DPS", lat: 13.808759218223376, lng: 100.40970963895805, direction: "top", category: "facility", isStandard: true },
      { id: "loc-tps", name: "TPS", thaiName: "สถานีสูบถ่ายน้ำ TPS", lat: 13.808286118958122, lng: 100.40907811024276, direction: "left", category: "facility", isStandard: true },
      { id: "loc-rps1", name: "RPS1", thaiName: "สถานีสูบน้ำดิบ RPS 1", lat: 13.81226362737259, lng: 100.40694895618114, direction: "top", category: "facility", isStandard: true },
      { id: "loc-rps2", name: "RPS2", thaiName: "สถานีสูบน้ำดิบ RPS 2", lat: 13.81144885695744, lng: 100.40567687691177, direction: "left", category: "facility", isStandard: true },
      { id: "loc-surge-tower", name: "ถนนจุดจอดรถหน้า Surge Tower", thaiName: "ถนนจุดจอดรถหน้า Surge Tower", lat: 13.808076825972208, lng: 100.40971538443868, direction: "bottom", category: "facility", isStandard: true },
      { id: "loc-raw-water-basin", name: "Raw Water Basin", thaiName: "สระพักน้ำดิบ (Raw Water Basin)", lat: 13.811961850304513, lng: 100.4053478538198, direction: "top", category: "canal", isStandard: true },
      { id: "loc-banglen", name: "รส.บางเลน", thaiName: "โรงสูบน้ำดิบบางเลน", lat: 14.010918551132619, lng: 100.18452925916316, direction: "top", category: "water_quality", description: "โรงสูบน้ำดิบบางเลน", isStandard: true },
      { id: "loc-thamuang", name: "จุดรับน้ำดิบท่าม่วง", thaiName: "จุดรับน้ำดิบท่าม่วง (จ.กาญจนบุรี)", lat: 13.955898910198963, lng: 99.6250990834308, direction: "top", category: "canal", isStandard: true },
      { id: "loc-workshop", name: "ถนน Workshop", thaiName: "ถนนหน้าโรงซ่อมบำรุง (Workshop)", lat: 13.80683177076353, lng: 100.40776994365987, direction: "bottom", category: "facility", isStandard: true },
      { id: "loc-u-turn-front", name: "จุดกลับรถหน้าโรงงานฯ", thaiName: "จุดกลับรถหน้าโรงงานผลิตน้ำมหาสวัสดิ์", lat: 13.808445225424613, lng: 100.41093757923936, direction: "right", category: "facility", isStandard: true },
      { id: "loc-u-turn-wat-sri", name: "จุดกลับรถหน้า ซ.วัดศรีประวัติ", thaiName: "จุดกลับรถหน้า ซ.วัดศรีประวัติ (คลองมหาสวัสดิ์)", lat: 13.80190817394532, lng: 100.41020141463888, direction: "bottom", category: "canal", isStandard: true },
      { id: "loc-plant-front", name: "หน้าโรงงาน", thaiName: "ประตูทางเข้าหลัก หน้าโรงงาน", lat: 13.807532300140185, lng: 100.4108361979887, direction: "right", category: "facility", isStandard: true },
      { id: "loc-7-11-sri-prawat", name: "7-11 กลาง ซ.วัดศรีประวัติ", thaiName: "7-Eleven กลาง ซ.วัดศรีประวัติ", lat: 13.803484368789302, lng: 100.40755510406127, direction: "left", category: "facility", isStandard: true }
    ];
  }
}

window.dataStore = new DataStoreV2();
