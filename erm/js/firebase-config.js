/**
 * Firebase Configuration & Helper for MWA ERM
 * Project: mwa-erm
 * Console: https://console.firebase.google.com/u/0/project/mwa-erm/overview
 */

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyC26WVUAg_Taj93PZcNHzBGQ5HaFgr70EQ",
  authDomain: "mwa-erm.firebaseapp.com",
  projectId: "mwa-erm",
  storageBucket: "mwa-erm.firebasestorage.app",
  messagingSenderId: "493541324598",
  appId: "1:493541324598:web:5f8788ee5b2d8ac3e7a597",
  measurementId: "G-Q0CM1CW3L2"
};

const STORAGE_KEY_FIREBASE_CONFIG = 'erm_firebase_config';

class ErmFirebaseManager {
  constructor() {
    this.app = null;
    this.db = null;
    this.connected = false;
    this.connectionListeners = [];
  }

  getConfig() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_FIREBASE_CONFIG);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.projectId) {
          return { ...DEFAULT_FIREBASE_CONFIG, ...parsed };
        }
      }
    } catch (e) {
      console.warn('Failed to parse saved Firebase config:', e);
    }
    return { ...DEFAULT_FIREBASE_CONFIG };
  }

  saveConfig(config) {
    localStorage.setItem(STORAGE_KEY_FIREBASE_CONFIG, JSON.stringify(config));
  }

  resetConfig() {
    localStorage.removeItem(STORAGE_KEY_FIREBASE_CONFIG);
  }

  onConnectionChange(callback) {
    if (typeof callback === 'function') {
      this.connectionListeners.push(callback);
    }
  }

  notifyConnectionChange() {
    this.connectionListeners.forEach(cb => {
      try { cb(this.connected, this.getConfig()); } catch (e) { console.error(e); }
    });
  }

  init() {
    const config = this.getConfig();
    if (typeof firebase === 'undefined') {
      console.warn('⚠️ Firebase SDK not loaded in page');
      this.connected = false;
      this.notifyConnectionChange();
      return false;
    }

    if (!config.apiKey || config.apiKey.trim() === '' || config.apiKey === 'YOUR_API_KEY') {
      console.info('ℹ️ Firebase API Key not configured yet. Operating in LocalStorage mode.');
      this.connected = false;
      this.notifyConnectionChange();
      return false;
    }

    try {
      if (!firebase.apps.length) {
        this.app = firebase.initializeApp(config);
      } else {
        this.app = firebase.app();
      }
      this.db = firebase.firestore();
      this.connected = true;
      console.log('🔥 Firebase Cloud Firestore connected successfully (Project:', config.projectId + ')');
      this.notifyConnectionChange();
      return true;
    } catch (err) {
      console.error('❌ Failed to initialize Firebase:', err);
      this.connected = false;
      this.notifyConnectionChange();
      return false;
    }
  }

  isConnected() {
    return this.connected && this.db !== null;
  }

  getDb() {
    return this.db;
  }
}

window.ermFirebase = new ErmFirebaseManager();
