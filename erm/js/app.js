/**
 * ERM - Application Controller (app.js)
 * Connects UI, Map, Data Store, Auth, and Report Exporting.
 */

class ERMApplication {
  constructor() {
    this.currentEditingId = null;
    this.pendingCoordinates = null;
  }

  async init() {
    // 1. Initialize Leaflet Map
    window.ermMap.init();

    // 2. Start Live Clock
    this.startClock();

    // 3. Bind UI Events
    this.bindEvents();

    // 4. Subscribe to Auth changes
    window.authManager.subscribe((isAdmin) => {
      this.updateAuthUI(isAdmin);
      window.ermMap.updateDraggable(isAdmin);
      // Re-render markers to update edit state
      const currentData = window.dataStore.getAll();
      window.ermMap.renderMarkers(currentData);
    });

    // 5. Subscribe to Data changes
    window.dataStore.subscribe((incidents) => {
      window.ermMap.renderMarkers(incidents);
      this.updateKPIs(incidents);
    });

    // 6. Load initial data
    const incidents = await window.dataStore.init();
    this.updateKPIs(incidents);
    this.updateAuthUI(window.authManager.isAdmin());

    // 7. Load Large Font preference
    const isLarge = localStorage.getItem('erm_large_text') === 'true';
    if (isLarge) {
      document.body.classList.add('large-text-mode');
    }
    this.updateFontSizeButtonUI(isLarge);

    // 8. Load Compact Mode preference
    const isCompact = localStorage.getItem('erm_compact_mode') === 'true';
    if (isCompact) {
      document.body.classList.add('compact-mode');
    }
    this.updateCompactModeButtonUI(isCompact);

    console.log('ERM Application initialized with', incidents.length, 'incidents.');
  }

  updateFontSizeButtonUI(isLarge) {
    const btn = document.getElementById('btn-toggle-font-size');
    if (btn) {
      if (isLarge) {
        btn.innerHTML = '<span>🔤 ตัวหนังสือ: ใหญ่พิเศษ</span>';
        btn.classList.add('btn-active');
      } else {
        btn.innerHTML = '<span>🔤 ขนาดตัวหนังสือ</span>';
        btn.classList.remove('btn-active');
      }
    }
  }

  updateCompactModeButtonUI(isCompact) {
    const btn = document.getElementById('btn-toggle-compact-mode');
    if (btn) {
      if (isCompact) {
        btn.innerHTML = '<span>🏷️ ป้าย: กะทัดรัด (ไร้การซ้อนทับ)</span>';
        btn.classList.add('btn-active');
      } else {
        btn.innerHTML = '<span>🏷️ ป้าย: การ์ดเต็ม</span>';
        btn.classList.remove('btn-active');
      }
    }
  }

  startClock() {
    const clockEl = document.getElementById('live-clock');
    const updateTime = () => {
      const now = new Date();
      const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
      const dateStr = `${now.getDate()} ${thaiMonths[now.getMonth()]} ${now.getFullYear() + 543}`;
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      if (clockEl) {
        clockEl.textContent = `${dateStr} | ${timeStr} น.`;
      }
    };
    updateTime();
    setInterval(updateTime, 1000);
  }

  updateKPIs(incidents) {
    const totalEl = document.getElementById('kpi-total');
    const normalEl = document.getElementById('kpi-normal');
    const warningEl = document.getElementById('kpi-warning');
    const criticalEl = document.getElementById('kpi-critical');
    const canalEl = document.getElementById('kpi-canal');
    const facilityEl = document.getElementById('kpi-facility');
    const waterEl = document.getElementById('kpi-water');

    const total = incidents.length;
    const normal = incidents.filter(i => i.status === 'normal').length;
    const warning = incidents.filter(i => i.status === 'warning').length;
    const critical = incidents.filter(i => i.status === 'critical').length;
    const canal = incidents.filter(i => i.category === 'canal').length;
    const facility = incidents.filter(i => i.category === 'facility').length;
    const water = incidents.filter(i => i.category === 'water_quality').length;

    if (totalEl) totalEl.textContent = total;
    if (normalEl) normalEl.textContent = normal;
    if (warningEl) warningEl.textContent = warning;
    if (criticalEl) criticalEl.textContent = critical;
    if (canalEl) canalEl.textContent = `${canal} จุด`;
    if (facilityEl) facilityEl.textContent = `${facility} จุด`;
    if (waterEl) waterEl.textContent = `${water} จุด`;
  }

  updateAuthUI(isAdmin) {
    const loginBtn = document.getElementById('btn-login-toggle');
    const adminBanner = document.getElementById('admin-mode-banner');
    const adminControls = document.querySelectorAll('.admin-only');

    if (isAdmin) {
      if (loginBtn) {
        loginBtn.innerHTML = '<span>🔓 ออกจากระบบ (Admin)</span>';
        loginBtn.classList.remove('btn-admin');
        loginBtn.classList.add('btn-ghost');
      }
      if (adminBanner) adminBanner.classList.add('show');
      adminControls.forEach(el => el.style.display = 'inline-flex');
    } else {
      if (loginBtn) {
        loginBtn.innerHTML = '<span>🔐 เข้าสู่ระบบ (Admin)</span>';
        loginBtn.classList.add('btn-admin');
        loginBtn.classList.remove('btn-ghost');
      }
      if (adminBanner) adminBanner.classList.remove('show');
      adminControls.forEach(el => el.style.display = 'none');
    }
  }

  bindEvents() {
    // 1. Export Executive Report Button
    const btnReport = document.getElementById('btn-export-report');
    if (btnReport) {
      btnReport.addEventListener('click', () => {
        window.reportExporter.exportReportPNG();
      });
    }

    // 2. Auth Toggle Button
    const btnAuth = document.getElementById('btn-login-toggle');
    if (btnAuth) {
      btnAuth.addEventListener('click', () => {
        if (window.authManager.isAdmin()) {
          window.authManager.logout();
          this.showToast('ออกจากระบบผู้ดูแลเรียบร้อยแล้ว', 'info');
        } else {
          this.openModal('modal-login');
        }
      });
    }

    // Login Form Submit
    const loginForm = document.getElementById('form-login');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const user = document.getElementById('login-username').value;
        const pass = document.getElementById('login-password').value;
        const result = window.authManager.login(user, pass);
        if (result.success) {
          this.closeModal('modal-login');
          loginForm.reset();
          this.showToast('เข้าสู่ระบบผู้ดูแลระบบสำเร็จ (Admin Mode)', 'success');
        } else {
          alert(result.message);
        }
      });
    }

    // 3. Category Filter Tabs
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const cat = btn.getAttribute('data-category');
        window.ermMap.setFilter(cat);
      });
    });

    // 4. Add Incident Button
    const btnAdd = document.getElementById('btn-add-incident');
    if (btnAdd) {
      btnAdd.addEventListener('click', () => {
        this.openCreateModal();
      });
    }

    // 5. Incident Form Submit (Save / Edit)
    const incidentForm = document.getElementById('form-incident');
    if (incidentForm) {
      incidentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSaveIncident();
      });
    }

    // 6. JSON Export & Import Buttons
    const btnExportJson = document.getElementById('btn-export-json');
    if (btnExportJson) {
      btnExportJson.addEventListener('click', () => {
        window.dataStore.exportJSON();
        this.showToast('ดาวน์โหลดไฟล์ incidents.json สำเร็จ (พร้อม commit สู่ Git/Cloudflare)', 'success');
      });
    }

    const btnImportJson = document.getElementById('btn-import-json');
    const inputImportJson = document.getElementById('input-import-json');
    if (btnImportJson && inputImportJson) {
      btnImportJson.addEventListener('click', () => {
        inputImportJson.click();
      });
      inputImportJson.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
          try {
            await window.dataStore.importJSON(file);
            this.showToast('นำเข้าข้อมูล JSON สำเร็จ!', 'success');
          } catch (err) {
            alert('เกิดข้อผิดพลาดในการนำเข้าไฟล์: ' + err.message);
          }
          inputImportJson.value = '';
        }
      });
    }

    // 7. Reset View Button
    const btnResetView = document.getElementById('btn-reset-view');
    if (btnResetView) {
      btnResetView.addEventListener('click', () => {
        window.ermMap.resetView();
      });
    }

    // 7.1 Font Size Toggle Button
    const btnToggleFont = document.getElementById('btn-toggle-font-size');
    if (btnToggleFont) {
      btnToggleFont.addEventListener('click', () => {
        const isNowLarge = document.body.classList.toggle('large-text-mode');
        localStorage.setItem('erm_large_text', isNowLarge);
        this.updateFontSizeButtonUI(isNowLarge);
        this.showToast(isNowLarge ? 'เปิดโหมดตัวหนังสือขนาดใหญ่พิเศษ (มองเห็นชัดในมุมมองกว้าง)' : 'เปลี่ยนเป็นขนาดตัวหนังสือปกติ', 'info');
      });
    }

    // 7.2 Compact Mode Toggle Button
    const btnToggleCompact = document.getElementById('btn-toggle-compact-mode');
    if (btnToggleCompact) {
      btnToggleCompact.addEventListener('click', () => {
        const isNowCompact = document.body.classList.toggle('compact-mode');
        localStorage.setItem('erm_compact_mode', isNowCompact);
        this.updateCompactModeButtonUI(isNowCompact);
        this.showToast(isNowCompact ? 'เปิดโหมดป้ายกะทัดรัด (ลดการซ้อนทับ 75%)' : 'เปลี่ยนเป็นโหมดการ์ดเต็ม', 'info');
      });
    }

    // 8. Image upload in Incident Form
    const inputImg = document.getElementById('incident-image');
    if (inputImg) {
      inputImg.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          if (file.size > 2 * 1024 * 1024) {
            alert('ขนาดรูปภาพต้องไม่เกิน 2MB');
            inputImg.value = '';
            return;
          }
          const reader = new FileReader();
          reader.onload = (ev) => {
            document.getElementById('incident-image-preview').src = ev.target.result;
            document.getElementById('incident-image-preview').style.display = 'block';
            document.getElementById('incident-image-base64').value = ev.target.result;
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // 9. Add Metric Row Button in Form
    const btnAddMetric = document.getElementById('btn-add-metric');
    if (btnAddMetric) {
      btnAddMetric.addEventListener('click', () => {
        this.addMetricRow('', '');
      });
    }

    // 10. Close Modal buttons
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-close-modal');
        this.closeModal(modalId);
      });
    });
  }

  openCreateModal(lat = null, lng = null) {
    if (!window.authManager.isAdmin()) {
      this.openModal('modal-login');
      return;
    }

    this.currentEditingId = null;
    const form = document.getElementById('form-incident');
    form.reset();

    document.getElementById('modal-incident-title').textContent = '➕ เพิ่มจุดรายงานสถานการณ์ใหม่';
    document.getElementById('incident-id').value = '';
    document.getElementById('incident-image-base64').value = '';
    document.getElementById('incident-image-preview').style.display = 'none';
    document.getElementById('metrics-container').innerHTML = '';

    // Set coordinates
    const defaultCenter = window.ermMap.map.getCenter();
    document.getElementById('incident-lat').value = (lat !== null ? lat : defaultCenter.lat).toFixed(6);
    document.getElementById('incident-lng').value = (lng !== null ? lng : defaultCenter.lng).toFixed(6);

    const dirSelect = document.getElementById('incident-direction');
    if (dirSelect) dirSelect.value = 'top';

    // Default 1 metric row
    this.addMetricRow('ระดับน้ำ / ค่าตรวจวัด', '');

    this.openModal('modal-incident');
  }

  openEditModal(id) {
    const item = window.dataStore.getById(id);
    if (!item) return;

    this.currentEditingId = id;
    document.getElementById('modal-incident-title').textContent = '✏️ แก้ไขข้อมูลจุดรายงาน';
    document.getElementById('incident-id').value = item.id;
    document.getElementById('incident-category').value = item.category;
    document.getElementById('incident-title').value = item.title;
    document.getElementById('incident-short-summary').value = item.shortSummary;
    document.getElementById('incident-details').value = item.details || '';
    document.getElementById('incident-reported-by').value = item.reportedBy || '';
    document.getElementById('incident-lat').value = item.lat;
    document.getElementById('incident-lng').value = item.lng;

    const dirSelect = document.getElementById('incident-direction');
    if (dirSelect) dirSelect.value = item.direction || 'top';

    // Status radio
    const statusRadio = document.querySelector(`input[name="incident-status"][value="${item.status}"]`);
    if (statusRadio) statusRadio.checked = true;

    // Image
    const preview = document.getElementById('incident-image-preview');
    const base64Input = document.getElementById('incident-image-base64');
    if (item.image) {
      preview.src = item.image;
      preview.style.display = 'block';
      base64Input.value = item.image;
    } else {
      preview.style.display = 'none';
      base64Input.value = '';
    }

    // Metrics
    const metricsContainer = document.getElementById('metrics-container');
    metricsContainer.innerHTML = '';
    if (item.metrics && item.metrics.length > 0) {
      item.metrics.forEach(m => this.addMetricRow(m.label, m.value));
    } else {
      this.addMetricRow('ค่าตรวจวัด', '');
    }

    this.openModal('modal-incident');
  }

  addMetricRow(label = '', value = '') {
    const container = document.getElementById('metrics-container');
    const row = document.createElement('div');
    row.className = 'metric-input-row';
    row.style.cssText = 'display: flex; gap: 8px; margin-bottom: 6px; align-items: center;';
    row.innerHTML = `
      <input type="text" class="form-input metric-label" placeholder="ชื่อค่า (เช่น ระดับน้ำ)" value="${window.ermMap.escapeHtml(label)}" style="flex: 1;">
      <input type="text" class="form-input metric-value" placeholder="ค่าที่วัดได้ (เช่น +1.50 ม.)" value="${window.ermMap.escapeHtml(value)}" style="flex: 1;">
      <button type="button" class="btn btn-ghost btn-remove-metric" style="color: var(--color-critical); padding: 4px 8px;">✕</button>
    `;
    row.querySelector('.btn-remove-metric').addEventListener('click', () => row.remove());
    container.appendChild(row);
  }

  handleSaveIncident() {
    const id = document.getElementById('incident-id').value;
    const category = document.getElementById('incident-category').value;
    const title = document.getElementById('incident-title').value.trim();
    const shortSummary = document.getElementById('incident-short-summary').value.trim();
    const details = document.getElementById('incident-details').value.trim();
    const reportedBy = document.getElementById('incident-reported-by').value.trim();
    const lat = parseFloat(document.getElementById('incident-lat').value);
    const lng = parseFloat(document.getElementById('incident-lng').value);
    const statusRadio = document.querySelector('input[name="incident-status"]:checked');
    const status = statusRadio ? statusRadio.value : 'normal';
    const dirSelect = document.getElementById('incident-direction');
    const direction = dirSelect ? dirSelect.value : 'top';
    const image = document.getElementById('incident-image-base64').value;

    if (!title) {
      alert('กรุณากรอกชื่อจุด');
      return;
    }
    if (!shortSummary) {
      alert('กรุณากรอกข้อความสรุปสั้นๆ ที่จะแสดงบนแผนที่ทันที');
      return;
    }
    if (isNaN(lat) || isNaN(lng)) {
      alert('พิกัด ละติจูด / ลองจิจูด ไม่ถูกต้อง');
      return;
    }

    // Collect metrics
    const metrics = [];
    document.querySelectorAll('.metric-input-row').forEach(row => {
      const lbl = row.querySelector('.metric-label').value.trim();
      const val = row.querySelector('.metric-value').value.trim();
      if (lbl || val) {
        metrics.push({ label: lbl, value: val });
      }
    });

    const incidentData = {
      category,
      title,
      shortSummary,
      direction,
      status,
      lat,
      lng,
      details,
      metrics,
      reportedBy,
      image
    };

    if (id) {
      incidentData.id = id;
    }

    const saved = window.dataStore.save(incidentData);
    this.closeModal('modal-incident');
    this.showToast(`บันทึกข้อมูล "${title}" เรียบร้อยแล้ว`, 'success');

    // Pan to marker
    const targetId = (saved && saved.id) ? saved.id : id;
    if (targetId) {
      window.ermMap.flyToIncident(targetId);
    }
  }

  showIncidentDetail(id) {
    const item = window.dataStore.getById(id);
    if (!item) return;

    const modal = document.getElementById('modal-detail');
    const titleEl = document.getElementById('detail-title');
    const categoryEl = document.getElementById('detail-category');
    const statusEl = document.getElementById('detail-status');
    const summaryEl = document.getElementById('detail-short-summary');
    const detailsEl = document.getElementById('detail-desc');
    const metaContainer = document.getElementById('detail-meta-container');
    const metricsList = document.getElementById('detail-metrics-list');
    const imageContainer = document.getElementById('detail-image-container');
    const actionBtns = document.getElementById('detail-admin-actions');

    const catMeta = window.ermMap.categoryLabels[item.category] || { name: 'เหตุการณ์', icon: '📍', class: 'cat-facility' };
    const statusMeta = window.ermMap.statusLabels[item.status] || { name: 'ปกติ', class: 'status-normal' };

    titleEl.textContent = item.title;
    categoryEl.innerHTML = `<span class="callout-category-badge ${catMeta.class}">${catMeta.icon} ${catMeta.name}</span>`;
    statusEl.innerHTML = `<span class="callout-status-pill ${statusMeta.class}"><span class="status-dot ${item.status}"></span> ${statusMeta.name}</span>`;
    summaryEl.textContent = item.shortSummary;
    detailsEl.textContent = item.details || 'ไม่มีรายละเอียดเพิ่มเติม';

    metaContainer.innerHTML = `
      <div class="meta-item">
        <span class="meta-item-label">พิกัดทางภูมิศาสตร์</span>
        <span class="meta-item-value">${item.lat.toFixed(5)}, ${item.lng.toFixed(5)}</span>
      </div>
      <div class="meta-item">
        <span class="meta-item-label">ผู้รายงาน / หน่วยงาน</span>
        <span class="meta-item-value">${item.reportedBy || 'ไม่ระบุ'}</span>
      </div>
      <div class="meta-item">
        <span class="meta-item-label">อัปเดตล่าสุด</span>
        <span class="meta-item-value">${item.updatedAt || '-'}</span>
      </div>
      <div class="meta-item">
        <span class="meta-item-label">รหัสอ้างอิง</span>
        <span class="meta-item-value" style="font-family: monospace; font-size: 0.75rem;">${item.id}</span>
      </div>
    `;

    // Metrics
    metricsList.innerHTML = '';
    if (item.metrics && item.metrics.length > 0) {
      item.metrics.forEach(m => {
        const row = document.createElement('div');
        row.className = 'metric-row';
        row.innerHTML = `
          <span class="metric-row-label">${window.ermMap.escapeHtml(m.label)}</span>
          <span class="metric-row-value">${window.ermMap.escapeHtml(m.value)}</span>
        `;
        metricsList.appendChild(row);
      });
      document.getElementById('detail-metrics-section').style.display = 'block';
    } else {
      document.getElementById('detail-metrics-section').style.display = 'none';
    }

    // Image
    if (item.image) {
      imageContainer.innerHTML = `<img src="${item.image}" alt="รูปภาพประกอบ" style="width: 100%; max-height: 250px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border-color);">`;
      imageContainer.style.display = 'block';
    } else {
      imageContainer.innerHTML = '';
      imageContainer.style.display = 'none';
    }

    // Admin buttons (Edit & Delete)
    const isAdmin = window.authManager.isAdmin();
    if (isAdmin) {
      actionBtns.innerHTML = `
        <button class="btn btn-outline" id="btn-detail-edit" style="color: #38bdf8;">✏️ แก้ไขข้อมูล</button>
        <button class="btn btn-outline" id="btn-detail-delete" style="color: var(--color-critical);">🗑️ ลบจุดนี้</button>
      `;
      document.getElementById('btn-detail-edit').addEventListener('click', () => {
        this.closeModal('modal-detail');
        this.openEditModal(item.id);
      });
      document.getElementById('btn-detail-delete').addEventListener('click', () => {
        if (confirm(`คุณต้องการลบจุด "${item.title}" ใช่หรือไม่?`)) {
          this.closeModal('modal-detail');
          window.dataStore.delete(item.id);
          this.showToast(`ลบจุด "${item.title}" เรียบร้อยแล้ว`, 'warning');
        }
      });
      actionBtns.style.display = 'flex';
    } else {
      actionBtns.innerHTML = '';
      actionBtns.style.display = 'none';
    }

    this.openModal('modal-detail');
  }

  openModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.add('open');
  }

  closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.remove('open');
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'warning') icon = '⚠️';
    if (type === 'error') icon = '❌';

    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
}

// Global instance
window.app = new ERMApplication();

// DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  window.app.init();
});
