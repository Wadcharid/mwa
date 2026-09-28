/**
 * ERM v2 - Application Orchestrator (app.js)
 * Connects Auth, Map, Data Store, Timeline, Image Upload, and UI Modals.
 */

class ApplicationControllerV2 {
  constructor() {
    this.currentBase64Image = '';
    this.clientIP = 'กำลังตรวจสอบ IP...';
  }

  async init() {
    // 1. Initialize Map
    window.mapController.init();

    // 2. Start Live Clock
    this.startLiveClock();

    // 3. Detect Client IP in background
    window.ipTracker.getClientIP().then(ip => {
      this.clientIP = ip;
      const ipDisplayEl = document.getElementById('report-user-ip');
      if (ipDisplayEl) {
        ipDisplayEl.value = ip;
      }
    });

    // 4. Bind UI Event Handlers
    this.bindEvents();

    // 5. Subscribe to Data Store updates
    window.dataStore.subscribe(({ locations, timeline }) => {
      window.mapController.renderMarkers(locations);
      window.timelineController.renderFeed();
      this.updateKPIs(locations, timeline);
      this.populateLocationDropdown(locations);

      // Re-render open timeline modal if open
      if (window.timelineController.currentLocationId) {
        window.timelineController.renderLocationTimeline(window.timelineController.currentLocationId);
      }
    });

    // 6. Subscribe to Auth changes
    window.authManager.subscribe(isAdmin => {
      this.updateAuthUI(isAdmin);
      // Re-render timeline to update buttons
      if (window.timelineController.currentLocationId) {
        window.timelineController.renderLocationTimeline(window.timelineController.currentLocationId);
      }
    });

    // 7. Load Data
    const { locations, timeline } = await window.dataStore.init();
    this.populateLocationDropdown(locations);
    this.updateKPIs(locations, timeline);
    this.updateAuthUI(window.authManager.isAdmin());
    setTimeout(() => {
      if (window.mapController && window.mapController.map) {
        window.mapController.map.invalidateSize();
        window.mapController.scheduleLayoutUpdate();
      }
    }, 150);

    console.log(`ERM v2 initialized with ${locations.length} locations and ${timeline.length} timeline entries.`);
  }

  startLiveClock() {
    const clockEl = document.getElementById('live-clock');
    const update = () => {
      if (!clockEl) return;
      const now = new Date();
      clockEl.textContent = now.toLocaleDateString('th-TH', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }) + ' ' + now.toLocaleTimeString('th-TH');
    };
    update();
    setInterval(update, 1000);
  }

  updateKPIs(locations, timeline) {
    const totalEl = document.getElementById('kpi-total-points');
    const normalEl = document.getElementById('kpi-normal-count');
    const warningEl = document.getElementById('kpi-warning-count');
    const criticalEl = document.getElementById('kpi-critical-count');

    let normal = 0;
    let warning = 0;
    let critical = 0;

    locations.forEach(loc => {
      const st = window.dataStore.getLatestStatusForLocation(loc.id);
      if (st === 'normal') normal++;
      else if (st === 'warning') warning++;
      else if (st === 'critical') critical++;
    });

    if (totalEl) totalEl.textContent = locations.length;
    if (normalEl) normalEl.textContent = normal;
    if (warningEl) warningEl.textContent = warning;
    if (criticalEl) criticalEl.textContent = critical;

    const mobileBadge = document.getElementById('mobile-feed-badge');
    if (mobileBadge) mobileBadge.textContent = timeline.length;
  }

  updateAuthUI(isAdmin) {
    const loginBtn = document.getElementById('btn-login-toggle');
    const addReportBtn = document.getElementById('btn-add-report');
    const adminBanner = document.getElementById('admin-hint-bar');

    if (isAdmin) {
      if (loginBtn) {
        loginBtn.innerHTML = '<span>🔓 ออกจากระบบ (Admin)</span>';
        loginBtn.className = 'btn btn-logged-in';
      }
      if (addReportBtn) addReportBtn.style.display = 'inline-flex';
      if (adminBanner) adminBanner.style.display = 'flex';
    } else {
      if (loginBtn) {
        loginBtn.innerHTML = '<span>🔐 เข้าสู่ระบบ (Admin)</span>';
        loginBtn.className = 'btn btn-admin';
      }
      if (addReportBtn) addReportBtn.style.display = 'none';
      if (adminBanner) adminBanner.style.display = 'none';
    }
  }

  populateLocationDropdown(locations) {
    const select = document.getElementById('report-location-select');
    if (!select) return;

    const currentVal = select.value;
    select.innerHTML = `
      <option value="" disabled selected>-- เลือกตำแหน่งที่ต้องการรายงาน --</option>
      <optgroup label="📍 ตำแหน่งมาตรฐาน 17 จุด">
        ${locations.filter(l => l.isStandard).map(l => `
          <option value="${l.id}">${l.name} (${l.thaiName || l.name})</option>
        `).join('')}
      </optgroup>
      ${locations.filter(l => !l.isStandard).length > 0 ? `
        <optgroup label="📌 ตำแหน่งอื่นๆ ที่เพิ่มไว้">
          ${locations.filter(l => !l.isStandard).map(l => `
            <option value="${l.id}">${l.name}</option>
          `).join('')}
        </optgroup>
      ` : ''}
      <option value="custom_new">➕ กำหนดจุดใหม่บนแผนที่...</option>
    `;

    if (currentVal && Array.from(select.options).some(o => o.value === currentVal)) {
      select.value = currentVal;
    }

    // Also populate quick jump dropdown in top bar
    this.populateQuickJumpDropdown(locations);
  }

  populateQuickJumpDropdown(locations) {
    const jumpSelect = document.getElementById('quick-jump-select');
    if (!jumpSelect) return;

    jumpSelect.innerHTML = `
      <option value="">🎯 ไปยังตำแหน่ง (17 จุด)...</option>
      <optgroup label="📍 พื้นที่โรงงานมหาสวัสดิ์">
        ${locations.filter(l => l.isStandard && !['loc-banglen', 'loc-bangkhen', 'loc-thamuang'].includes(l.id)).map(l => `
          <option value="${l.id}">${l.name}</option>
        `).join('')}
      </optgroup>
      <optgroup label="🌐 จุดรับน้ำ/สถานีภายนอก">
        ${locations.filter(l => ['loc-banglen', 'loc-bangkhen', 'loc-thamuang'].includes(l.id)).map(l => `
          <option value="${l.id}">${l.name}</option>
        `).join('')}
      </optgroup>
      ${locations.filter(l => !l.isStandard).length > 0 ? `
        <optgroup label="📌 จุดอื่นๆ ที่เพิ่มไว้">
          ${locations.filter(l => !l.isStandard).map(l => `
            <option value="${l.id}">${l.name}</option>
          `).join('')}
        </optgroup>
      ` : ''}
    `;
  }

  bindEvents() {
    // Quick Jump Location Select
    const jumpSelect = document.getElementById('quick-jump-select');
    if (jumpSelect) {
      jumpSelect.addEventListener('change', () => {
        const locId = jumpSelect.value;
        if (!locId) return;
        const loc = window.dataStore.getLocationById(locId);
        if (loc) {
          window.mapController.flyToLocation(loc.lat, loc.lng, 18);
          this.showToast(`📍 ไปยัง: ${loc.name} (${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)})`);
        }
        jumpSelect.value = '';
      });
    }

    // Fit All Bounds Button
    const fitBtn = document.getElementById('btn-fit-bounds');
    if (fitBtn) {
      fitBtn.addEventListener('click', () => {
        window.mapController.fitAllBounds();
        this.showToast('🗺️ ปรับมุมมองครอบคลุมทุกจุด');
      });
    }

    // 1. Reset View Button
    const resetBtn = document.getElementById('btn-reset-view');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        window.mapController.resetView();
        this.showToast('🎯 กลับสู่ศูนย์กลางโรงงานมหาสวัสดิ์');
      });
    }

    // 1.1 Save Screenshot Button (เฉพาะข้อมูลบนแผนที่ และ ข้อมูลด้านข้าง)
    const screenshotBtn = document.getElementById('btn-save-screenshot');
    if (screenshotBtn) {
      screenshotBtn.addEventListener('click', async () => {
        const captureArea = document.getElementById('main-capture-area') || document.querySelector('.main-layout');
        if (!captureArea) return;

        if (typeof html2canvas === 'undefined') {
          this.showToast('⚠️ กำลังโหลดระบบบันทึกภาพ กรุณาลองใหม่อีกครั้ง...', 'error');
          return;
        }

        const origHTML = screenshotBtn.innerHTML;
        screenshotBtn.disabled = true;
        screenshotBtn.innerHTML = '<span>⏳ กำลังจับภาพ...</span>';
        this.showToast('📸 กำลังประมวลผลบันทึกภาพหน้าจอ...');

        try {
          await new Promise(r => setTimeout(r, 60));

          const canvas = await html2canvas(captureArea, {
            useCORS: true,
            allowTaint: true,
            logging: false,
            scale: 2, // Hi-DPI quality
            ignoreElements: (el) => {
              return el.classList && (
                el.classList.contains('modal-backdrop') ||
                el.classList.contains('toast-container')
              );
            }
          });

          const now = new Date();
          const pad = n => String(n).padStart(2, '0');
          const timeStr = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
          const filename = `ERM_Map_Feed_${timeStr}.png`;

          const link = document.createElement('a');
          link.download = filename;
          link.href = canvas.toDataURL('image/png');
          link.click();

          this.showToast(`📸 บันทึกภาพหน้าจอ "${filename}" เรียบร้อยแล้ว`, 'success');
        } catch (err) {
          console.error('Screenshot error:', err);
          this.showToast('⚠️ ไม่สามารถบันทึกภาพหน้าจอได้: ' + (err.message || 'Error'), 'error');
        } finally {
          screenshotBtn.disabled = false;
          screenshotBtn.innerHTML = origHTML;
        }
      });
    }

    // 2. Export / Import JSON
    const exportBtn = document.getElementById('btn-export-json');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        window.dataStore.exportTimelineJSON();
        this.showToast('💾 ส่งออกไฟล์ timeline.json เรียบร้อยแล้ว');
      });
    }

    const importBtn = document.getElementById('btn-import-json');
    const importInput = document.getElementById('input-import-json');
    if (importBtn && importInput) {
      importBtn.addEventListener('click', () => importInput.click());
      importInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const count = await window.dataStore.importTimelineJSON(file);
          this.showToast(`📥 นำเข้าข้อมูลสำเร็จ (${count} รายการ)`);
        } catch (err) {
          alert('เกิดข้อผิดพลาดในการนำเข้า: ' + err.message);
        }
        importInput.value = '';
      });
    }

    // 3. Login Modal & Form
    const loginToggleBtn = document.getElementById('btn-login-toggle');
    if (loginToggleBtn) {
      loginToggleBtn.addEventListener('click', () => {
        if (window.authManager.isAdmin()) {
          window.authManager.logout();
          this.showToast('ออกจากระบบผู้ดูแลเรียบร้อยแล้ว');
        } else {
          this.openModal('modal-login');
        }
      });
    }

    const loginForm = document.getElementById('form-login');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const u = document.getElementById('login-username').value;
        const p = document.getElementById('login-password').value;
        const res = window.authManager.login(u, p);
        if (res.success) {
          this.closeModal('modal-login');
          loginForm.reset();
          this.showToast('✅ เข้าสู่ระบบผู้ดูแลสำเร็จ');
        } else {
          alert(res.message);
        }
      });
    }

    // 4. Add Report Button
    const addReportBtn = document.getElementById('btn-add-report');
    if (addReportBtn) {
      addReportBtn.addEventListener('click', () => {
        this.openNewReportModal();
      });
    }

    // 5. Location Select Change in Form
    const locSelect = document.getElementById('report-location-select');
    const customNameGroup = document.getElementById('group-custom-location-name');
    const latInput = document.getElementById('report-lat');
    const lngInput = document.getElementById('report-lng');

    if (locSelect) {
      locSelect.addEventListener('change', () => {
        const val = locSelect.value;
        if (val === 'custom_new') {
          if (customNameGroup) customNameGroup.style.display = 'block';
          if (latInput) { latInput.readOnly = false; latInput.value = ''; }
          if (lngInput) { lngInput.readOnly = false; lngInput.value = ''; }
        } else {
          if (customNameGroup) customNameGroup.style.display = 'none';
          const loc = window.dataStore.getLocationById(val);
          if (loc) {
            if (latInput) { latInput.value = loc.lat.toFixed(6); latInput.readOnly = true; }
            if (lngInput) { lngInput.value = loc.lng.toFixed(6); lngInput.readOnly = true; }
          }
        }
      });
    }

    // 6. Image File Picker & Direct Camera Compression (JPG)
    const imageInput = document.getElementById('report-image-input');
    const cameraInput = document.getElementById('report-camera-input');
    const imagePreview = document.getElementById('report-image-preview');
    const imageClearBtn = document.getElementById('btn-clear-image');

    const handleImageFile = async (file) => {
      if (!file) return;
      try {
        this.showToast('⏳ กำลังประมวลผลและบีบอัดรูปภาพ JPG...');
        const jpgDataUrl = await window.imageHelper.processToJPG(file, 1280, 0.82);
        this.currentBase64Image = jpgDataUrl;
        if (imagePreview) {
          imagePreview.src = jpgDataUrl;
          imagePreview.style.display = 'block';
        }
        if (imageClearBtn) imageClearBtn.style.display = 'inline-block';
        this.showToast('📸 ภาพ JPG พร้อมแนบแล้ว');
      } catch (err) {
        alert('ข้อผิดพลาดเกี่ยวกับรูปภาพ: ' + err.message);
        if (imageInput) imageInput.value = '';
        if (cameraInput) cameraInput.value = '';
      }
    };

    if (imageInput) {
      imageInput.addEventListener('change', (e) => handleImageFile(e.target.files[0]));
    }
    if (cameraInput) {
      cameraInput.addEventListener('change', (e) => handleImageFile(e.target.files[0]));
    }

    if (imageClearBtn) {
      imageClearBtn.addEventListener('click', () => {
        this.currentBase64Image = '';
        if (imageInput) imageInput.value = '';
        if (cameraInput) cameraInput.value = '';
        if (imagePreview) {
          imagePreview.src = '';
          imagePreview.style.display = 'none';
        }
        imageClearBtn.style.display = 'none';
      });
    }

    // 7. Form Report Submission
    const reportForm = document.getElementById('form-report');
    if (reportForm) {
      reportForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleReportSubmit();
      });
    }

    // 8. Feed Search and Filter Controls
    const searchInput = document.getElementById('feed-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        window.timelineController.searchQuery = e.target.value;
        window.timelineController.renderFeed();
      });
    }

    const filterSelect = document.getElementById('feed-filter-status');
    if (filterSelect) {
      filterSelect.addEventListener('change', (e) => {
        window.timelineController.filterStatus = e.target.value;
        window.timelineController.renderFeed();
      });
    }

    // 9. Generic Modal Close buttons (data-close-modal="modalId")
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetModalId = btn.getAttribute('data-close-modal');
        this.closeModal(targetModalId);
      });
    });

    // Close modal on backdrop click
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          this.closeModal(backdrop.id);
        }
      });
    });

    // 10. Mobile GPS Detection, Fast Presets & Navigation Tabs
    this.setupGPSDetection();
    this.setupQuickPresets();
    this.setupMobileNavigation();
  }

  setupGPSDetection() {
    const gpsBtn = document.getElementById('btn-gps-detect');
    const badge = document.getElementById('gps-status-badge');
    const locSelect = document.getElementById('report-location-select');
    const latInput = document.getElementById('report-lat');
    const lngInput = document.getElementById('report-lng');

    if (!gpsBtn) return;

    gpsBtn.addEventListener('click', () => {
      if (!navigator.geolocation) {
        if (badge) {
          badge.className = 'gps-error';
          badge.textContent = '⚠️ อุปกรณ์ของคุณไม่รองรับการตรวจหาพิกัด GPS';
          badge.style.display = 'flex';
        }
        return;
      }

      if (badge) {
        badge.className = 'gps-loading';
        badge.textContent = '📡 กำลังค้นหาตำแหน่งพิกัด GPS ของอุปกรณ์...';
        badge.style.display = 'flex';
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const userLat = pos.coords.latitude;
          const userLng = pos.coords.longitude;
          const accuracy = Math.round(pos.coords.accuracy || 0);

          const allLocs = window.dataStore.getAllLocations();
          let closest = null;
          let minDist = Infinity;

          allLocs.forEach(loc => {
            const dist = this.getDistanceKm(userLat, userLng, loc.lat, loc.lng);
            if (dist < minDist) {
              minDist = dist;
              closest = loc;
            }
          });

          // หากอยู่ใกล้จุดมาตรฐานในระยะ 800 เมตร ให้เลือกจุดนั้นอัตโนมัติ
          if (closest && minDist <= 0.8) {
            if (locSelect) {
              locSelect.value = closest.id;
              locSelect.dispatchEvent(new Event('change'));
            }
            if (badge) {
              badge.className = '';
              badge.textContent = `📍 ตำแหน่งใกล้ที่สุด: "${closest.name}" (ห่างประมาณ ${Math.round(minDist * 1000)} ม., ความแม่นยำ ±${accuracy} ม.)`;
              badge.style.display = 'flex';
            }
            this.showToast(`🎯 ตรวจพบตำแหน่ง: ${closest.name}`);
          } else {
            // เลือกโหมดจุดใหม่ พร้อมใส่พิกัด GPS ให้ทันที
            if (locSelect) {
              locSelect.value = 'custom_new';
              locSelect.dispatchEvent(new Event('change'));
            }
            if (latInput) latInput.value = userLat.toFixed(6);
            if (lngInput) lngInput.value = userLng.toFixed(6);
            if (badge) {
              badge.className = '';
              badge.textContent = `📍 พิกัดปัจจุบัน: ${userLat.toFixed(6)}, ${userLng.toFixed(6)} (ความแม่นยำ ±${accuracy} ม.)`;
              badge.style.display = 'flex';
            }
            this.showToast('📍 บันทึกพิกัด GPS ปัจจุบันเรียบร้อย');
          }
        },
        (err) => {
          console.warn('GPS Error:', err);
          let msg = 'ไม่สามารถดึงตำแหน่งพิกัดได้';
          if (err.code === 1) msg = 'กรุณากด "อนุญาต (Allow)" การเข้าถึงตำแหน่งในเบราว์เซอร์';
          else if (err.code === 2) msg = 'สัญญาณ GPS ออฟไลน์ หรืออยู่นอกพื้นที่รับสัญญาณ';
          else if (err.code === 3) msg = 'หมดเวลาค้นหาพิกัด GPS กรุณาลองใหม่อีกครั้ง';
          if (badge) {
            badge.className = 'gps-error';
            badge.textContent = '⚠️ ' + msg;
            badge.style.display = 'flex';
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    });
  }

  getDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  setupQuickPresets() {
    const container = document.getElementById('quick-preset-chips');
    const summaryInput = document.getElementById('report-summary');
    if (!container || !summaryInput) return;

    container.addEventListener('click', (e) => {
      const chip = e.target.closest('.preset-chip');
      if (!chip) return;
      const text = chip.getAttribute('data-text') || '';
      summaryInput.value = text;

      // Auto check matching status radio
      if (text.includes('ปกติ') || chip.textContent.includes('🟢')) {
        const rad = document.getElementById('st-opt-normal');
        if (rad) rad.checked = true;
      } else if (text.includes('เฝ้าระวัง') || text.includes('รอระบาย') || text.includes('หนุนสูง') || chip.textContent.includes('🟡')) {
        const rad = document.getElementById('st-opt-warning');
        if (rad) rad.checked = true;
      } else if (text.includes('วิกฤต') || chip.textContent.includes('🔴')) {
        const rad = document.getElementById('st-opt-critical');
        if (rad) rad.checked = true;
      }

      this.showToast(`⚡ เลือกสรุป: "${text}"`);
    });
  }

  setupMobileNavigation() {
    const tabMap = document.getElementById('btn-mobile-tab-map');
    const tabFeed = document.getElementById('btn-mobile-tab-feed');
    const fabAdd = document.getElementById('btn-mobile-fab-add');
    const mainLayout = document.getElementById('main-capture-area');

    if (tabMap && tabFeed && mainLayout) {
      tabMap.addEventListener('click', () => {
        tabMap.classList.add('active');
        tabFeed.classList.remove('active');
        mainLayout.classList.remove('mobile-view-feed');
        mainLayout.classList.add('mobile-view-map');
        if (window.mapController && window.mapController.map) {
          window.mapController.map.invalidateSize();
          window.mapController.scheduleLayoutUpdate();
          setTimeout(() => {
            if (window.mapController && window.mapController.map) {
              window.mapController.map.invalidateSize();
              window.mapController.scheduleLayoutUpdate();
            }
          }, 150);
        }
      });

      tabFeed.addEventListener('click', () => {
        tabFeed.classList.add('active');
        tabMap.classList.remove('active');
        mainLayout.classList.remove('mobile-view-map');
        mainLayout.classList.add('mobile-view-feed');
      });
    }

    if (fabAdd) {
      fabAdd.addEventListener('click', () => {
        if (window.authManager && window.authManager.isAdmin()) {
          this.openNewReportModal();
        } else {
          this.showToast('🔐 กรุณาเข้าสู่ระบบ Admin เพื่อบันทึกรายงาน');
          this.openModal('modal-login');
        }
      });
    }
  }

  openModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) {
      el.classList.add('active');
    }
  }

  closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) {
      el.classList.remove('active');
    }
  }

  openLocationTimeline(locationId) {
    window.timelineController.renderLocationTimeline(locationId);
    this.openModal('modal-timeline');
  }

  openNewReportModal() {
    const form = document.getElementById('form-report');
    if (form) form.reset();

    // Reset GPS badge
    const gpsBadge = document.getElementById('gps-status-badge');
    if (gpsBadge) {
      gpsBadge.style.display = 'none';
      gpsBadge.className = '';
      gpsBadge.textContent = '';
    }

    // Populate reporter name from cache
    const reporterInput = document.getElementById('report-reporter-name');
    if (reporterInput) {
      reporterInput.value = window.authManager.getLastReporterName();
    }

    // Populate IP
    const ipInput = document.getElementById('report-user-ip');
    if (ipInput) {
      ipInput.value = this.clientIP;
    }

    // Clear image
    this.currentBase64Image = '';
    const imgPreview = document.getElementById('report-image-preview');
    const imgClear = document.getElementById('btn-clear-image');
    if (imgPreview) imgPreview.style.display = 'none';
    if (imgClear) imgClear.style.display = 'none';

    // Hide custom location name
    const customGroup = document.getElementById('group-custom-location-name');
    if (customGroup) customGroup.style.display = 'none';

    this.openModal('modal-new-report');
  }

  openNewReportModalForLocation(loc) {
    this.openNewReportModal();
    const locSelect = document.getElementById('report-location-select');
    if (locSelect) {
      locSelect.value = loc.id;
      locSelect.dispatchEvent(new Event('change'));
    }
  }

  openNewReportModalForCustomPoint(lat, lng) {
    this.openNewReportModal();
    const locSelect = document.getElementById('report-location-select');
    const customGroup = document.getElementById('group-custom-location-name');
    const latInput = document.getElementById('report-lat');
    const lngInput = document.getElementById('report-lng');

    if (locSelect) locSelect.value = 'custom_new';
    if (customGroup) customGroup.style.display = 'block';
    if (latInput) { latInput.value = lat.toFixed(6); latInput.readOnly = false; }
    if (lngInput) { lngInput.value = lng.toFixed(6); lngInput.readOnly = false; }
  }

  handleReportSubmit() {
    const locSelect = document.getElementById('report-location-select');
    const locVal = locSelect ? locSelect.value : '';
    const customNameInput = document.getElementById('report-custom-name');
    const latInput = document.getElementById('report-lat');
    const lngInput = document.getElementById('report-lng');
    const reporterInput = document.getElementById('report-reporter-name');
    const shortSummaryInput = document.getElementById('report-summary');
    const descInput = document.getElementById('report-desc');
    const statusRadio = document.querySelector('input[name="report-status"]:checked');

    if (!locVal) {
      alert('กรุณาเลือกตำแหน่ง');
      return;
    }

    const reporterName = reporterInput ? reporterInput.value.trim() : '';
    if (!reporterName) {
      alert('กรุณาระบุชื่อผู้รายงาน');
      return;
    }
    // Remember reporter name
    window.authManager.saveLastReporterName(reporterName);

    let locationId = locVal;
    let locationName = '';
    let lat = parseFloat(latInput.value);
    let lng = parseFloat(lngInput.value);

    if (locVal === 'custom_new') {
      const customName = customNameInput ? customNameInput.value.trim() : '';
      if (!customName) {
        alert('กรุณาระบุชื่อสถานที่สำหรับจุดใหม่');
        return;
      }
      if (isNaN(lat) || isNaN(lng)) {
        alert('กรุณาระบุพิกัด ละติจูด / ลองจิจูด ให้ถูกต้อง');
        return;
      }

      // Add custom location to data store
      const newLoc = window.dataStore.addCustomLocation(customName, lat, lng);
      locationId = newLoc.id;
      locationName = newLoc.name;
    } else {
      const loc = window.dataStore.getLocationById(locVal);
      if (loc) {
        locationName = loc.name;
        lat = loc.lat;
        lng = loc.lng;
      }
    }

    const newEntry = {
      locationId,
      locationName,
      lat,
      lng,
      status: statusRadio ? statusRadio.value : 'normal',
      shortSummary: shortSummaryInput ? shortSummaryInput.value.trim() : '',
      description: descInput ? descInput.value.trim() : '',
      reportedBy: reporterName,
      ipAddress: this.clientIP,
      timestamp: new Date().toISOString(),
      image: this.currentBase64Image
    };

    window.dataStore.addTimelineEntry(newEntry);
    this.closeModal('modal-new-report');
    this.showToast('✅ บันทึกข้อมูลเข้าไทม์ไลน์เรียบร้อยแล้ว');

    // If modal-timeline was open, refresh it
    if (window.timelineController.currentLocationId === locationId) {
      window.timelineController.renderLocationTimeline(locationId);
    }
  }

  deleteEntry(entryId) {
    if (confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการบันทึกนี้?')) {
      window.dataStore.deleteTimelineEntry(entryId);
      this.showToast('🗑️ ลบรายการเรียบร้อยแล้ว');
    }
  }

  openLightbox(imageSrc) {
    const modal = document.getElementById('modal-lightbox');
    const imgEl = document.getElementById('lightbox-image');
    if (modal && imgEl) {
      imgEl.src = imageSrc;
      this.openModal('modal-lightbox');
    }
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
}

window.appController = new ApplicationControllerV2();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.appController.init();
});
