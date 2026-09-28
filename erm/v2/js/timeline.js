/**
 * ERM v2 - Timeline Controller
 * Manages the right-hand live activity feed and the location diary timeline modal.
 */

class TimelineControllerV2 {
  constructor() {
    this.currentLocationId = null;
    this.searchQuery = '';
    this.filterStatus = 'all';
  }

  /**
   * Format ISO date string into readable Thai date-time
   */
  formatDateTime(isoStr) {
    if (!isoStr) return '-';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) + ' น.';
    } catch (e) {
      return isoStr;
    }
  }

  getStatusBadgeHTML(status) {
    switch (status) {
      case 'normal':
        return '<span class="feed-card-status-badge badge-normal">🟢 ปกติ</span>';
      case 'warning':
        return '<span class="feed-card-status-badge badge-warning">🟡 เฝ้าระวัง</span>';
      case 'critical':
        return '<span class="feed-card-status-badge badge-critical">🔴 วิกฤต</span>';
      default:
        return '<span class="feed-card-status-badge" style="background:#334155; color:#cbd5e1;">⚪ ไม่มีข้อมูล</span>';
    }
  }

  /**
   * Render the Right Sidebar Live Feed
   */
  renderFeed() {
    const feedContainer = document.getElementById('feed-list');
    const countBadge = document.getElementById('feed-count');
    if (!feedContainer) return;

    let entries = window.dataStore.getTimeline();

    // Filter by search query
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      entries = entries.filter(e =>
        (e.locationName && e.locationName.toLowerCase().includes(q)) ||
        (e.shortSummary && e.shortSummary.toLowerCase().includes(q)) ||
        (e.description && e.description.toLowerCase().includes(q)) ||
        (e.reportedBy && e.reportedBy.toLowerCase().includes(q))
      );
    }

    // Filter by status
    if (this.filterStatus !== 'all') {
      entries = entries.filter(e => e.status === this.filterStatus);
    }

    if (countBadge) {
      countBadge.textContent = `${entries.length} รายการ`;
    }

    if (entries.length === 0) {
      feedContainer.innerHTML = `
        <div class="feed-empty-state">
          <div style="font-size: 2rem; margin-bottom: 8px;">📭</div>
          <div>ไม่พบข้อมูลการอัปเดตตามเงื่อนไข</div>
        </div>
      `;
      return;
    }

    feedContainer.innerHTML = entries.map(entry => {
      const statusBorderClass = `status-border-${entry.status || 'normal'}`;
      const statusBadge = this.getStatusBadgeHTML(entry.status);
      const timeFormatted = this.formatSocialTime(entry.timestamp);
      const avatarInitial = this.getAvatarInitial(entry.reportedBy);
      const hasImage = !!entry.image;

      return `
        <div class="feed-card feed-card-social ${statusBorderClass}" data-entry-id="${entry.id}" data-location-id="${entry.locationId}" title="คลิกเพื่อไปที่จุดนี้บนแผนที่และดูไดอารีฉบับเต็ม">
          <!-- Social Header: ผู้รายงาน, เวลา และ ป้ายสถานะ -->
          <div class="social-header">
            <div class="social-author">
              <div class="social-avatar" title="ผู้รายงาน: ${this.escapeHTML(entry.reportedBy || 'เจ้าหน้าที่')}">
                ${avatarInitial}
              </div>
              <div class="social-meta">
                <span class="social-name">${this.escapeHTML(entry.reportedBy || 'เจ้าหน้าที่')}</span>
                <span class="social-time" title="${this.formatDateTime(entry.timestamp)}">🕒 ${timeFormatted}</span>
              </div>
            </div>
            ${statusBadge}
          </div>

          <!-- ตำแหน่งที่รายงาน -->
          <div class="social-location">
            <span class="social-pin-icon">📍</span>
            <span class="social-location-name">${this.escapeHTML(entry.locationName)}</span>
          </div>

          <!-- เนื้อหาข้อความรายงานสถานการณ์ -->
          <div class="social-body">
            ${this.escapeHTML(entry.shortSummary || entry.description || 'ไม่มีข้อความสรุป')}
          </div>

          <!-- รูปภาพแนบ (ถ้ามี) -->
          ${hasImage ? `
            <div class="social-photo-preview" onclick="event.stopPropagation(); window.appController.openLightbox('${entry.image}')" title="คลิกเพื่อดูภาพขยาย">
              <img src="${entry.image}" alt="ภาพถ่ายแนบ" class="social-photo-img" loading="lazy">
              <span class="social-photo-pill">🔍 ขยายภาพ</span>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    // Attach click events on feed cards: คลิกเพื่อดูรายละเอียดเพิ่มเติม
    feedContainer.querySelectorAll('.feed-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.social-photo-preview')) return;
        const locationId = card.getAttribute('data-location-id');
        const loc = window.dataStore.getLocationById(locationId);
        if (loc) {
          if (window.innerWidth <= 900) {
            const tabMap = document.getElementById('btn-mobile-tab-map');
            if (tabMap) tabMap.click();
          }
          window.mapController.flyToLocation(loc.lat, loc.lng, 17);
          window.appController.openLocationTimeline(locationId);
        }
      });
    });
  }

  /**
   * Render the Location Diary Timeline modal for a specific location
   */
  renderLocationTimeline(locationId) {
    this.currentLocationId = locationId;
    const loc = window.dataStore.getLocationById(locationId);
    if (!loc) return;

    // Set modal headers
    const titleEl = document.getElementById('timeline-modal-title');
    const coordsEl = document.getElementById('timeline-modal-coords');
    const descEl = document.getElementById('timeline-modal-desc');
    const statusEl = document.getElementById('timeline-modal-status');
    const streamContainer = document.getElementById('timeline-stream-container');
    const addLogBtn = document.getElementById('btn-add-location-log');

    if (titleEl) titleEl.textContent = loc.thaiName || loc.name;
    if (coordsEl) coordsEl.textContent = `พิกัด: ${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)}`;
    if (descEl) descEl.textContent = loc.description || '';

    const latestStatus = window.dataStore.getLatestStatusForLocation(locationId);
    if (statusEl) {
      statusEl.innerHTML = this.getStatusBadgeHTML(latestStatus);
    }

    // Show/hide "+ เพิ่มบันทึกที่จุดนี้" based on admin session
    if (addLogBtn) {
      addLogBtn.style.display = window.authManager.isAdmin() ? 'inline-flex' : 'none';
      addLogBtn.onclick = () => {
        window.appController.openNewReportModalForLocation(loc);
      };
    }

    const entries = window.dataStore.getTimeline(locationId);

    if (entries.length === 0) {
      streamContainer.innerHTML = `
        <div style="text-align: center; padding: 30px; color: var(--text-muted);">
          <div style="font-size: 2.2rem; margin-bottom: 8px;">📖</div>
          <div>ยังไม่มีประวัติบันทึกสถานการณ์ที่จุดนี้</div>
          ${window.authManager.isAdmin() ? '<div style="margin-top: 8px; font-size: 0.8rem; color: #0284c7;">กดปุ่ม "+ เพิ่มบันทึกสถานการณ์" ด้านบนเพื่อเริ่มบันทึกไดอารี</div>' : ''}
        </div>
      `;
      return;
    }

    streamContainer.innerHTML = entries.map(entry => {
      const statusClass = `status-${entry.status || 'normal'}`;
      const statusBadge = this.getStatusBadgeHTML(entry.status);
      const timeStr = this.formatDateTime(entry.timestamp);

      const imageHTML = entry.image
        ? `<div class="timeline-entry-image-wrap" onclick="window.appController.openLightbox('${entry.image}')">
             <img src="${entry.image}" alt="ภาพถ่ายเหตุการณ์ JPG" class="timeline-entry-image">
             <div style="font-size: 0.72rem; color: #ffffff; padding: 4px 8px; background: rgba(15,23,42,0.75); display: flex; justify-content: space-between; align-items: center;">
               <span>🔍 คลิกเพื่อขยายภาพ</span>
               <button type="button" class="btn btn-ghost" style="padding: 1px 6px; font-size: 0.7rem; color: #ffffff;" onclick="event.stopPropagation(); window.imageHelper.downloadJPG('${entry.image}', 'incident-${entry.id}.jpg')">⬇️ ดาวน์โหลด JPG</button>
             </div>
           </div>`
        : '';

      const deleteBtn = window.authManager.isAdmin()
        ? `<button type="button" class="btn btn-ghost" style="color:#ef4444; font-size: 0.72rem; padding: 2px 6px;" onclick="window.appController.deleteEntry('${entry.id}')" title="ลบรายการนี้">🗑️ ลบ</button>`
        : '';

      return `
        <div class="timeline-entry ${statusClass}">
          <div class="timeline-entry-dot"></div>
          
          <div class="timeline-entry-header">
            <div class="timeline-entry-meta">
              <span class="timeline-entry-reporter">👤 ${this.escapeHTML(entry.reportedBy || 'ไม่ระบุชื่อ')}</span>
              ${entry.ipAddress ? `<span class="feed-card-ip">${this.escapeHTML(entry.ipAddress)}</span>` : ''}
              <span class="timeline-entry-time">🕒 ${timeStr}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              ${statusBadge}
              ${deleteBtn}
            </div>
          </div>

          <div class="timeline-entry-summary">${this.escapeHTML(entry.shortSummary || '')}</div>
          <div class="timeline-entry-desc">${this.escapeHTML(entry.description || '')}</div>

          ${imageHTML}
        </div>
      `;
    }).join('');
  }

  escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  formatSocialTime(isoString) {
    if (!isoString) return 'ไม่ระบุเวลา';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return isoString;

      const now = new Date();
      const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (diffSec >= 0 && diffSec < 60) return 'เมื่อสักครู่';
      if (diffSec >= 60 && diffSec < 3600) return `${Math.floor(diffSec / 60)} นาทีที่แล้ว`;

      const isToday = date.getDate() === now.getDate() &&
                      date.getMonth() === now.getMonth() &&
                      date.getFullYear() === now.getFullYear();

      const timeStr = date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      if (isToday) return `วันนี้ ${timeStr} น.`;

      const day = date.getDate();
      const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
      const month = thaiMonths[date.getMonth()];
      const year = (date.getFullYear() + 543).toString().slice(-2);

      return `${day} ${month} ${year} ${timeStr} น.`;
    } catch (e) {
      return isoString;
    }
  }

  getAvatarInitial(name) {
    if (!name) return '👤';
    const clean = String(name).replace(/^(นาย|นาง|นางสาว|ดร\.|ว่าที่|ร\.ต\.|ร้อยตรี)\s*/, '').trim();
    return clean ? clean.charAt(0) : '👤';
  }
}

window.timelineController = new TimelineControllerV2();
