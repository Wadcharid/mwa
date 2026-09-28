/**
 * ERM - Map Module (Leaflet + Google Satellite without API Key)
 * Renders satellite base map and permanent custom callout badges.
 */

class ERMMap {
  constructor(containerId) {
    this.containerId = containerId;
    this.map = null;
    this.markers = new Map();
    this.activeFilter = 'all';
    this.currentCenter = [13.8062, 100.4140]; // Default: โรงงานผลิตน้ำมหาสวัสดิ์ & คลองรอบโรงงาน
    this.defaultZoom = 16;
    this.categoryLabels = {
      canal: { name: 'คลองสาธารณะ', icon: '🌊', class: 'cat-canal' },
      facility: { name: 'ใน/รอบโรงงาน', icon: '⚠️', class: 'cat-facility' },
      water_quality: { name: 'คุณภาพน้ำ & ผลิต', icon: '🏭', class: 'cat-water_quality' }
    };
    this.statusLabels = {
      normal: { name: 'ปกติ', class: 'status-normal' },
      warning: { name: 'เฝ้าระวัง', class: 'status-warning' },
      critical: { name: 'วิกฤต', class: 'status-critical' }
    };
  }

  init() {
    // 1. Base Tile Layers (No API key needed)
    const googleHybrid = L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: '&copy; Google Satellite Imagery'
    });

    const googleSatellite = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: '&copy; Google Satellite'
    });

    const esriSatellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    });

    const openStreetMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    });

    // 2. Initialize Leaflet Map
    this.map = L.map(this.containerId, {
      center: this.currentCenter,
      zoom: this.defaultZoom,
      layers: [googleHybrid], // Default is Google Hybrid (Satellite + Road/Names)
      zoomControl: false
    });

    // Zoom control at top-right
    L.control.zoom({ position: 'topright' }).addTo(this.map);

    // Layer switcher control at top-right
    const baseLayers = {
      "ดาวเทียม Google (มีชื่อทาง/สถานที่)": googleHybrid,
      "ดาวเทียม Google (ภาพล้วน)": googleSatellite,
      "ดาวเทียม Esri World Imagery": esriSatellite,
      "แผนที่ถนนทั่วไป (OpenStreetMap)": openStreetMap
    };
    L.control.layers(baseLayers, null, { position: 'topright' }).addTo(this.map);

    // 3. Map Click Event (Admin: create new pin at clicked coordinate)
    this.map.on('click', (e) => {
      if (window.authManager && window.authManager.isAdmin()) {
        const { lat, lng } = e.latlng;
        if (window.app && typeof window.app.openCreateModal === 'function') {
          window.app.openCreateModal(lat, lng);
        }
      }
    });

    // 4. Zoom listener to adapt marker styling on wide map view
    this.map.on('zoomend', () => {
      const zoom = this.map.getZoom();
      const container = document.getElementById(this.containerId);
      if (container) {
        if (zoom <= 15) {
          container.classList.add('map-zoomed-out');
        } else {
          container.classList.remove('map-zoomed-out');
        }
      }
    });

    return this.map;
  }

  // Create or refresh all incident markers
  renderMarkers(incidents) {
    if (!incidents || !Array.isArray(incidents)) return;

    // Clear old markers that no longer exist
    const incomingIds = new Set(incidents.map(i => i.id));
    for (const [id, marker] of this.markers.entries()) {
      if (!incomingIds.has(id)) {
        this.map.removeLayer(marker);
        this.markers.delete(id);
      }
    }

    const isAdmin = window.authManager && window.authManager.isAdmin();

    // Render or update each incident
    const defaultDirs = ['top', 'bottom', 'right', 'left'];
    incidents.forEach((item, index) => {
      // Check filter
      const shouldShow = (this.activeFilter === 'all' || item.category === this.activeFilter);

      if (!shouldShow) {
        if (this.markers.has(item.id)) {
          this.map.removeLayer(this.markers.get(item.id));
        }
        return;
      }

      const catMeta = this.categoryLabels[item.category] || { name: 'เหตุการณ์', icon: '📍', class: 'cat-facility' };
      const statusMeta = this.statusLabels[item.status] || { name: 'ปกติ', class: 'status-normal' };

      // Direction: Explicit choice > Smart Auto-Stagger (Top, Bottom, Right, Left)
      const direction = item.direction || defaultDirs[index % defaultDirs.length];

      // HTML for Permanent Callout Badge (supports Full View & Compact Badge View, and 4-way Direction)
      const htmlContent = `
        <div class="erm-callout-marker" data-id="${item.id}" title="คลิกเพื่อดูรายละเอียดเชิงลึก">
          <div class="callout-box dir-${direction} ${statusMeta.class}">
            <!-- Full Card View -->
            <div class="callout-full-view">
              <div class="callout-head">
                <span class="callout-category-badge ${catMeta.class}">
                  ${catMeta.icon} ${catMeta.name}
                </span>
                <span class="callout-status-pill ${statusMeta.class}">
                  <span class="status-dot ${item.status}"></span> ${statusMeta.name}
                </span>
              </div>
              <div class="callout-title" title="${this.escapeHtml(item.title)}">${this.escapeHtml(item.title)}</div>
              <div class="callout-summary" title="${this.escapeHtml(item.shortSummary || '')}">${this.escapeHtml(item.shortSummary || 'ไม่มีข้อความสรุป')}</div>
              <div class="callout-footer">
                <span class="callout-reporter" title="ผู้รายงาน: ${this.escapeHtml(item.reportedBy || 'ไม่ระบุ')}">
                  <span class="reporter-icon">👤</span> ${this.escapeHtml(item.reportedBy || 'ไม่ระบุผู้รายงาน')}
                </span>
              </div>
            </div>

            <!-- Compact Inline View (Zero-overlap horizontal pill) -->
            <div class="callout-compact-view">
              <span class="compact-status-badge ${statusMeta.class}">
                <span class="status-dot ${item.status}"></span> ${statusMeta.name}
              </span>
              <span class="compact-title" title="${this.escapeHtml(item.title)}">${this.escapeHtml(item.title)}</span>
              <span class="compact-summary" title="${this.escapeHtml(item.shortSummary || '')}">: ${this.escapeHtml(item.shortSummary || '')}</span>
              ${item.reportedBy ? `<span class="compact-reporter" title="ผู้รายงาน: ${this.escapeHtml(item.reportedBy)}">(👤 ${this.escapeHtml(item.reportedBy)})</span>` : ''}
            </div>

            <div class="callout-arrow"></div>
          </div>
          <div class="callout-pin-anchor"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'erm-leaflet-div-icon',
        html: htmlContent,
        iconSize: [0, 0],
        iconAnchor: [0, 0] // Centered exactly on GPS coordinate
      });

      if (this.markers.has(item.id)) {
        // Update existing marker safely without throwing TypeError
        const existingMarker = this.markers.get(item.id);
        existingMarker.setLatLng([item.lat, item.lng]);
        existingMarker.setIcon(customIcon);
        
        // Correct way to set draggable in Leaflet:
        if (existingMarker.dragging) {
          if (isAdmin) {
            existingMarker.dragging.enable();
          } else {
            existingMarker.dragging.disable();
          }
        }

        // Re-bind listeners with latest incident data
        existingMarker.off('click').on('click', (e) => {
          if (e && e.originalEvent) {
            L.DomEvent.stopPropagation(e.originalEvent);
          }
          if (window.app && typeof window.app.showIncidentDetail === 'function') {
            window.app.showIncidentDetail(item.id);
          }
        });

        existingMarker.off('dragend').on('dragend', (e) => {
          const newLatLng = e.target.getLatLng();
          if (window.dataStore) {
            window.dataStore.updateCoordinates(item.id, newLatLng.lat, newLatLng.lng);
            if (window.app && typeof window.app.showToast === 'function') {
              window.app.showToast(`ย้ายพิกัด ${item.title} สำเร็จ (${newLatLng.lat.toFixed(5)}, ${newLatLng.lng.toFixed(5)})`, 'success');
            }
          }
        });

        if (!this.map.hasLayer(existingMarker)) {
          this.map.addLayer(existingMarker);
        }
      } else {
        // Create new marker
        const marker = L.marker([item.lat, item.lng], {
          icon: customIcon,
          draggable: isAdmin,
          riseOnHover: true
        });

        // Click marker -> view full details
        marker.on('click', (e) => {
          if (e && e.originalEvent) {
            L.DomEvent.stopPropagation(e.originalEvent);
          }
          if (window.app && typeof window.app.showIncidentDetail === 'function') {
            window.app.showIncidentDetail(item.id);
          }
        });

        // Drag end (Admin only)
        marker.on('dragend', (e) => {
          const newLatLng = e.target.getLatLng();
          if (window.dataStore) {
            window.dataStore.updateCoordinates(item.id, newLatLng.lat, newLatLng.lng);
            if (window.app && typeof window.app.showToast === 'function') {
              window.app.showToast(`ย้ายพิกัด ${item.title} สำเร็จ (${newLatLng.lat.toFixed(5)}, ${newLatLng.lng.toFixed(5)})`, 'success');
            }
          }
        });

        marker.addTo(this.map);
        this.markers.set(item.id, marker);
      }
    });
  }

  // Update draggable state of all markers based on Admin login state
  updateDraggable(isAdmin) {
    for (const [, marker] of this.markers.entries()) {
      if (marker.dragging) {
        if (isAdmin) {
          marker.dragging.enable();
        } else {
          marker.dragging.disable();
        }
      }
    }
  }

  // Filter markers by category
  setFilter(category) {
    this.activeFilter = category;
    if (window.dataStore) {
      this.renderMarkers(window.dataStore.getAll());
    }
  }

  // Focus map on specific incident
  flyToIncident(id) {
    const item = window.dataStore ? window.dataStore.getById(id) : null;
    if (item && this.map) {
      this.map.flyTo([item.lat, item.lng], 18, { duration: 1.2 });
    }
  }

  // Reset to default center & zoom or fit all visible markers
  resetView() {
    if (!this.map) return;
    const activeLatLngs = [];
    for (const [, marker] of this.markers.entries()) {
      if (this.map.hasLayer(marker)) {
        activeLatLngs.push(marker.getLatLng());
      }
    }
    if (activeLatLngs.length > 0) {
      const bounds = L.latLngBounds(activeLatLngs);
      this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
    } else {
      this.map.flyTo(this.currentCenter, this.defaultZoom, { duration: 1.0 });
    }
  }

  escapeHtml(text) {
    if (!text) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, m => map[m]);
  }
}

window.ermMap = new ERMMap('map');
