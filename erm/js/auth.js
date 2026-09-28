/**
 * ERM - Authentication Module
 * Manages admin session (user: admin / pass: admin)
 */

class AuthManager {
  constructor() {
    this.STORAGE_KEY = 'erm_admin_session';
    this.subscribers = [];
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
    return sessionStorage.getItem(this.STORAGE_KEY) === 'true';
  }

  login(username, password) {
    if (username.trim() === 'admin' && password.trim() === 'admin') {
      sessionStorage.setItem(this.STORAGE_KEY, 'true');
      this.notify();
      return { success: true };
    }
    return { success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (ค่าเริ่มต้นคือ admin / admin)' };
  }

  logout() {
    sessionStorage.removeItem(this.STORAGE_KEY);
    this.notify();
  }
}

window.authManager = new AuthManager();
