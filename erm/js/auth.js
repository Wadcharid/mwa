/**
 * ERM v2 - Authentication Module
 * Manages admin session (user: admin / pass: admin) and reporter identification
 */

class AuthManagerV2 {
  constructor() {
    this.STORAGE_SESSION_KEY = 'erm_v2_admin_session';
    this.STORAGE_REPORTER_KEY = 'erm_v2_last_reporter';
    this.subscribers = [];

    // Sync with PHP Session if running in PHP environment
    if (typeof window.PHP_AUTH !== 'undefined' && window.PHP_AUTH.isAdmin) {
      sessionStorage.setItem(this.STORAGE_SESSION_KEY, 'true');
      if (window.PHP_AUTH.userName) {
        this.saveLastReporterName(window.PHP_AUTH.userName);
      }
    }
  }

  subscribe(callback) {
    if (typeof callback === 'function') {
      this.subscribers.push(callback);
    }
  }

  notify() {
    const status = this.isAdmin();
    this.subscribers.forEach(cb => cb(status));
  }

  isAdmin() {
    return sessionStorage.getItem(this.STORAGE_SESSION_KEY) === 'true';
  }

  login(username, password) {
    if (username.trim() === 'admin' && password.trim() === 'admin') {
      sessionStorage.setItem(this.STORAGE_SESSION_KEY, 'true');
      this.notify();
      return { success: true };
    }
    return {
      success: false,
      message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (ค่าเริ่มต้นคือ admin / admin)'
    };
  }

  logout() {
    sessionStorage.removeItem(this.STORAGE_SESSION_KEY);
    this.notify();
  }

  // Remember last reporter name for user convenience
  saveLastReporterName(name) {
    if (name && name.trim()) {
      localStorage.setItem(this.STORAGE_REPORTER_KEY, name.trim());
    }
  }

  getLastReporterName() {
    return localStorage.getItem(this.STORAGE_REPORTER_KEY) || '';
  }
}

window.authManager = new AuthManagerV2();
