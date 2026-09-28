/**
 * turbidity.js - Controller for Raw Water Turbidity (ความขุ่น) Monitoring Widget
 * Reports turbidity for: แควน้อย, แควใหญ่, แม่กลอง, ท่าม่วง, บางเลน กม.35, คลองตะวันตก กม.14
 * Source: MWA RWC (http://rwc.mwa.co.th/page/home/table.php via get_turbidity.php)
 */

class TurbidityWidget {
  constructor() {
    this.widgetEl = document.getElementById('map-turbidity-widget');
    this.listEl = document.getElementById('turbidity-list');
    this.timeEl = document.getElementById('turbidity-update-time');
    this.alertBadgeEl = document.getElementById('turbidity-alert-badge');
    this.toggleBtn = document.getElementById('btn-turbidity-toggle');
    this.toggleIcon = document.getElementById('turbidity-toggle-icon');
    this.headerEl = document.getElementById('turbidity-widget-toggle');
    this.refreshBtn = document.getElementById('btn-refresh-turbidity');
    this.isCollapsed = false; // Initial state: ขยาย (Expanded)
    this.pollInterval = 3 * 60 * 1000; // 3 minutes
    this.timerId = null;

    // Target stations in order
    this.targetStations = [
      { id: 'S16', name: 'แควน้อย' },
      { id: 'T5',  name: 'แควใหญ่' },
      { id: 'S11', name: 'แม่กลอง' },
      { id: 'S9',  name: 'ท่าม่วง' },
      { id: 'S12', name: 'บางเลน กม.35' },
      { id: 'S14', name: 'คลองตะวันตก กม.14' }
    ];
  }

  init() {
    if (!this.widgetEl) return;

    this.bindEvents();
    this.fetchData();

    // Auto-refresh every 3 minutes
    this.timerId = setInterval(() => {
      this.fetchData(false);
    }, this.pollInterval);
  }

  bindEvents() {
    // Toggle collapse/expand on header click or button click
    if (this.headerEl) {
      this.headerEl.addEventListener('click', (e) => {
        // Prevent toggle if clicking on refresh or other action buttons
        if (e.target.closest('#btn-refresh-turbidity')) return;
        this.toggleCollapse();
      });
    }

    // Manual refresh button
    if (this.refreshBtn) {
      this.refreshBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.refreshBtn.classList.add('spinning');
        this.fetchData(true).finally(() => {
          setTimeout(() => {
            this.refreshBtn.classList.remove('spinning');
          }, 600);
        });
      });
    }
  }

  toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
    if (this.isCollapsed) {
      this.widgetEl.classList.add('collapsed');
      if (this.toggleIcon) this.toggleIcon.textContent = '+';
    } else {
      this.widgetEl.classList.remove('collapsed');
      if (this.toggleIcon) this.toggleIcon.textContent = '−';
    }
  }

  async fetchData(isManual = false) {
    try {
      // Try PHP endpoint first, with fallback to static cache file
      let res;
      try {
        res = await fetch('get_turbidity.php?t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
      } catch (err) {
        // Fallback for static environments (GitHub Pages, etc.)
        res = await fetch('data/turbidity_cache.json?t=' + Date.now(), { cache: 'no-store' });
      }

      const json = await res.json();
      if (json && json.data) {
        this.renderData(json.data, json.time, json.date);
      } else {
        throw new Error('Invalid data structure');
      }
    } catch (error) {
      console.warn('Turbidity fetch error, using fallback:', error);
      this.renderFallback();
    }
  }

  renderData(stationData, timeStr, dateStr) {
    if (!this.listEl) return;

    let hasHigh = false;
    let highCount = 0;

    // Create a lookup map by ID and by partial name
    const dataMap = {};
    stationData.forEach(item => {
      dataMap[item.id] = item;
      dataMap[item.name] = item;
    });

    const rowsHtml = this.targetStations.map(st => {
      const item = dataMap[st.id] || dataMap[st.name];
      const turbVal = item && item.turbidity !== null && item.turbidity !== undefined ? item.turbidity : null;
      const rawVal = item && item.raw_turbidity ? item.raw_turbidity : (turbVal !== null ? turbVal : '-');

      // เกณฑ์สี: ถ้าความขุ่นเกิน 100 NTU ให้เป็นสีแดง (ไม่ต้องแสดงลูกศรแนวโน้ม)
      const isHigh = turbVal !== null && turbVal > 100;
      if (isHigh) {
        hasHigh = true;
        highCount++;
      }

      const valClass = isHigh ? 'turbidity-val val-high' : 'turbidity-val val-normal';
      const displayVal = turbVal !== null ? `${turbVal} <span class="unit">NTU</span>` : (rawVal !== '-' ? `${rawVal} <span class="unit">NTU</span>` : '-');

      return `
        <div class="turbidity-row ${isHigh ? 'row-alert' : ''}" title="${st.name}: ${turbVal !== null ? turbVal : rawVal} NTU">
          <span class="turbidity-name">${st.name}</span>
          <span class="${valClass}">${displayVal}</span>
        </div>
      `;
    }).join('');

    this.listEl.innerHTML = rowsHtml;

    // Update timestamp
    if (this.timeEl) {
      const displayTime = timeStr ? `${timeStr} น.` : (dateStr ? dateStr : 'ล่าสุด');
      this.timeEl.innerHTML = `🕒 ข้อมูล ณ ${displayTime}`;
    }

    // Update alert badge in header
    if (this.alertBadgeEl) {
      if (hasHigh) {
        this.alertBadgeEl.textContent = `>100 NTU (${highCount})`;
        this.alertBadgeEl.style.display = 'inline-block';
      } else {
        this.alertBadgeEl.style.display = 'none';
      }
    }
  }

  renderFallback() {
    if (!this.listEl) return;
    const fallbackItems = [
      { name: 'แควน้อย', val: 665, high: true },
      { name: 'แควใหญ่', val: 478, high: true },
      { name: 'แม่กลอง', val: 378, high: true },
      { name: 'ท่าม่วง', val: 71, high: false },
      { name: 'บางเลน กม.35', val: 28.1, high: false },
      { name: 'คลองตะวันตก กม.14', val: 35.5, high: false }
    ];

    this.listEl.innerHTML = fallbackItems.map(st => `
      <div class="turbidity-row ${st.high ? 'row-alert' : ''}">
        <span class="turbidity-name">${st.name}</span>
        <span class="turbidity-val ${st.high ? 'val-high' : 'val-normal'}">${st.val} <span class="unit">NTU</span></span>
      </div>
    `).join('');

    if (this.timeEl) {
      this.timeEl.innerHTML = '🕒 ข้อมูลสำรองล่าสุด';
    }
  }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.turbidityWidget = new TurbidityWidget();
  window.turbidityWidget.init();
});
