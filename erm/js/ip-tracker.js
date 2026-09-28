/**
 * ERM v2 - IP Address Tracker Module
 * Detects and records client IP address for audit and tracking
 */

class IPTracker {
  constructor() {
    this.cachedIP = null;
  }

  async getClientIP() {
    if (this.cachedIP) {
      return this.cachedIP;
    }

    // 1. Try public IP service with short timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const resp = await fetch('https://api.ipify.org?format=json', {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const data = await resp.json();
        if (data && data.ip) {
          this.cachedIP = data.ip;
          return this.cachedIP;
        }
      }
    } catch (e) {
      // Ignore and fallback
    }

    // 2. Secondary fallback service
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const resp = await fetch('https://icanhazip.com', {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const ip = (await resp.text()).trim();
        if (ip) {
          this.cachedIP = ip;
          return this.cachedIP;
        }
      }
    } catch (e) {
      // Ignore and fallback
    }

    // 3. Fallback for Intranet / Localhost / Offline
    const hostname = window.location.hostname || 'localhost';
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      this.cachedIP = '127.0.0.1 (Localhost)';
    } else if (hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.')) {
      this.cachedIP = `${hostname} (Intranet)`;
    } else {
      this.cachedIP = 'Client (Web Browser)';
    }

    return this.cachedIP;
  }
}

window.ipTracker = new IPTracker();
