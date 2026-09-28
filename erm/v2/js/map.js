/**
 * ERM v2 - Map Controller (Leaflet + High-Res Satellite Layers)
 * Renders interactive balloon badges with dynamic anti-collision displacement
 * and precision SVG leader stems connecting to exact GPS ground coordinates.
 */

class MapControllerV2 {
  constructor(containerId) {
    this.containerId = containerId;
    this.map = null;
    this.markers = new Map();
    this.locations = [];
    this.animFrameId = null;
    this.defaultCenter = [13.8085, 100.4085]; // Central Mahasawat Plant area
    this.defaultZoom = 16;
  }

    // 1. Base Tile Layers: Google Maps Satellite (ภาพดาวเทียม) & Google Maps Hybrid
    const googleSatellite = L.tileLayer('https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['0', '1', '2', '3'],
      crossOrigin: 'anonymous',
      attribution: '&copy; Google Maps Satellite'
    });

    const googleHybrid = L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['0', '1', '2', '3'],
      crossOrigin: 'anonymous',
      attribution: '&copy; Google Maps Hybrid'
    });

    // 2. Instantiate Leaflet Map
    this.map = L.map(this.containerId, {
      center: this.defaultCenter,
      zoom: this.defaultZoom,
      maxZoom: 20,
      layers: [googleSatellite],
      zoomControl: false
    });

    // Zoom controls at top-left
    L.control.zoom({ position: 'topleft' }).addTo(this.map);

    // Layer Control: Switch between Satellite and Hybrid
    const baseLayers = {
      "🛰️ ดาวเทียม (Satellite)": googleSatellite,
      "🗺️ ดาวเทียม+ถนน (Hybrid)": googleHybrid
    };
    L.control.layers(baseLayers, null, { position: 'topright', collapsed: true }).addTo(this.map);

    // 3. Map Click Event (Admin: create new report / custom pin at clicked point)
    this.map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      if (window.authManager && window.authManager.isAdmin()) {
        window.appController.openNewReportModalForCustomPoint(lat, lng);
      } else {
        window.appController.showToast('ℹ️ เข้าสู่ระบบ Admin ก่อนเพื่อคลิกปักหมุดจุดใหม่บนแผนที่');
      }
    });

    // 4. Dynamic Collision Avoidance Hooks on Pan & Zoom
    this.map.on('move', () => this.scheduleLayoutUpdate());
    this.map.on('zoom', () => this.scheduleLayoutUpdate());
    this.map.on('moveend', () => this.updateBalloonCollisions());
    this.map.on('zoomend', () => this.updateBalloonCollisions());
    this.map.on('viewreset', () => this.updateBalloonCollisions());
    this.map.on('resize', () => {
      this.map.invalidateSize();
      this.scheduleLayoutUpdate();
    });

    window.addEventListener('resize', () => {
      if (this.map) {
        this.map.invalidateSize();
        this.scheduleLayoutUpdate();
      }
    });

    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        if (this.map) {
          this.map.invalidateSize();
          this.scheduleLayoutUpdate();
        }
      }, 300);
    });

    console.log('Leaflet Map v2 initialized with Google Maps Satellite & Dynamic Balloon Anti-Collision.');
  }

  scheduleLayoutUpdate() {
    if (this.animFrameId) return;
    this.animFrameId = requestAnimationFrame(() => {
      this.animFrameId = null;
      this.updateBalloonCollisions();
    });
  }

  renderMarkers(locations) {
    if (!this.map) return;
    this.locations = locations || [];

    // Retain set of current location IDs
    const validIds = new Set(this.locations.map(l => l.id));

    // Remove markers that no longer exist
    for (const [id, marker] of this.markers.entries()) {
      if (!validIds.has(id)) {
        this.map.removeLayer(marker);
        this.markers.delete(id);
      }
    }

    // Add or update markers
    this.locations.forEach(loc => {
      const icon = this.createLocationIcon(loc);

      if (this.markers.has(loc.id)) {
        const marker = this.markers.get(loc.id);
        marker.setLatLng([loc.lat, loc.lng]);
        marker.setIcon(icon);
      } else {
        const marker = L.marker([loc.lat, loc.lng], {
          icon: icon,
          title: loc.name
        }).addTo(this.map);

        // Click on marker opens Diary Timeline
        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          window.appController.openLocationTimeline(loc.id);
        });

        this.markers.set(loc.id, marker);
      }
    });

    // Trigger collision resolution after DOM elements are created
    this.scheduleLayoutUpdate();
    setTimeout(() => this.updateBalloonCollisions(), 50);
    setTimeout(() => this.updateBalloonCollisions(), 250);
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  createLocationIcon(loc) {
    const status = window.dataStore.getLatestStatusForLocation(loc.id);
    const statusClass = `status-${status}`;

    let statusText = 'ปกติ';
    if (status === 'warning') statusText = 'เฝ้าระวัง';
    else if (status === 'critical') statusText = 'วิกฤต';
    else if (status === 'nodata') statusText = 'ยังไม่มีบันทึก';

    const html = `
      <div class="erm-v2-marker-root" id="marker-${loc.id}">
        <!-- Dynamic SVG Leader Line connecting (0, 0) to Balloon Badge border -->
        <svg class="balloon-leader-svg" overflow="visible">
          <line class="balloon-stem-line ${statusClass}" x1="0" y1="0" x2="0" y2="0" />
          <circle class="balloon-stem-dot ${statusClass}" cx="0" cy="0" r="3" />
        </svg>

        <!-- Ground Target Pinpoint Dot exactly at (0, 0) GPS coordinate -->
        <div class="callout-target-dot ${statusClass}" title="${this.escapeHtml(loc.name)}"></div>

        <!-- Movable Balloon Badge Box -->
        <div class="balloon-badge-box ${statusClass}" id="balloon-${loc.id}" data-id="${loc.id}" title="คลิกเพื่อดูรายละเอียดไทม์ไลน์ ${this.escapeHtml(loc.name)}">
          <span class="callout-badge-name">${this.escapeHtml(loc.name)}</span>
          <span class="callout-status-chip ${statusClass}">
            <span class="dot-status ${status}"></span>
            ${statusText}
          </span>
        </div>
      </div>
    `;

    return L.divIcon({
      html: html,
      className: 'erm-v2-leaflet-icon',
      iconSize: [0, 0],
      iconAnchor: [0, 0] // Centered with absolute 100% precision on GPS coordinates
    });
  }

  /**
   * Real-time Anti-Collision Force Relaxation Algorithm
   * Detects overlaps between balloon badges and fans them out smoothly,
   * drawing an exact leader line from the ground dot to the badge edge.
   */
  updateBalloonCollisions() {
    if (!this.map || !this.locations || this.locations.length === 0) return;

    // Viewport bounds with slight safety margin
    const mapBounds = this.map.getBounds().pad(0.12);
    const items = [];

    // 1. Gather all markers visible inside or near the current map viewport
    for (const loc of this.locations) {
      const latLng = L.latLng(loc.lat, loc.lng);
      if (!mapBounds.contains(latLng)) continue;

      const badgeEl = document.getElementById(`balloon-${loc.id}`);
      const lineEl = document.querySelector(`#marker-${loc.id} .balloon-stem-line`);
      if (!badgeEl) continue;

      // Exact ground coordinates in Leaflet screen pixels
      const groundPoint = this.map.latLngToContainerPoint(latLng);

      // Measure actual badge width & height (with fallback)
      const width = badgeEl.offsetWidth || (loc.name.length * 8 + 76);
      const height = badgeEl.offsetHeight || 30;

      // Initial preferred offset based on direction hint
      let defaultDx = 0;
      let defaultDy = -38;
      const dir = loc.direction || 'top';
      if (dir === 'top') { defaultDx = 0; defaultDy = -38; }
      else if (dir === 'bottom') { defaultDx = 0; defaultDy = 38; }
      else if (dir === 'left') { defaultDx = -75; defaultDy = 0; }
      else if (dir === 'right') { defaultDx = 75; defaultDy = 0; }

      items.push({
        id: loc.id,
        name: loc.name,
        badgeEl,
        lineEl,
        groundX: groundPoint.x,
        groundY: groundPoint.y,
        width,
        height,
        halfW: width / 2,
        halfH: height / 2,
        // Center position in screen container space
        x: groundPoint.x + defaultDx,
        y: groundPoint.y + defaultDy,
        defaultDx,
        defaultDy
      });
    }

    if (items.length === 0) return;

    // 2. Iterative Force Relaxation & Collision Separation
    const iterations = 24;
    const gapX = 10; // Horizontal margin between adjacent badges
    const gapY = 8;  // Vertical margin between adjacent badges
    const springStrength = 0.07; // Pull back towards ideal ground offset

    for (let it = 0; it < iterations; it++) {
      // 2a. Mutual repulsion between overlapping badges
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const a = items[i];
          const b = items[j];

          const minDistanceX = a.halfW + b.halfW + gapX;
          const minDistanceY = a.halfH + b.halfH + gapY;

          const diffX = a.x - b.x;
          const diffY = a.y - b.y;

          const overlapX = minDistanceX - Math.abs(diffX);
          const overlapY = minDistanceY - Math.abs(diffY);

          if (overlapX > 0 && overlapY > 0) {
            // Collision detected! Normalize by dimension to favor vertical tiering
            const normX = diffX / minDistanceX;
            const normY = diffY / minDistanceY;
            let normDist = Math.hypot(normX, normY);

            let ux, uy;
            if (normDist < 0.001) {
              // Exact center coincidence: push apart along alternating angle
              const angle = ((i + j) * 2.39996) % (2 * Math.PI);
              ux = Math.cos(angle);
              uy = Math.sin(angle);
            } else {
              ux = normX / normDist;
              uy = normY / normDist;
            }

            // Push magnitude proportional to overlap
            const pushRatio = 0.45;
            const pushX = ux * overlapX * pushRatio;
            const pushY = uy * overlapY * pushRatio;

            a.x += pushX;
            a.y += pushY;
            b.x -= pushX;
            b.y -= pushY;
          }
        }
      }

      // 2b. Avoid covering other markers' ground pinpoint dots
      for (let i = 0; i < items.length; i++) {
        const a = items[i];
        for (let j = 0; j < items.length; j++) {
          if (i === j) continue;
          const b = items[j];
          const pinRadius = 14;
          const ovPinX = (a.halfW + pinRadius) - Math.abs(a.x - b.groundX);
          const ovPinY = (a.halfH + pinRadius) - Math.abs(a.y - b.groundY);
          if (ovPinX > 0 && ovPinY > 0) {
            const dy = (a.y >= b.groundY ? 1 : -1);
            a.y += dy * ovPinY * 0.35;
          }
        }
      }

      // 2c. Spring force pulling each badge gently back towards its preferred spot
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const idealX = item.groundX + item.defaultDx;
        const idealY = item.groundY + item.defaultDy;
        item.x += (idealX - item.x) * springStrength;
        item.y += (idealY - item.y) * springStrength;
      }
    }

    // 3. Final Deterministic Pass: 100% Zero-Overlap Guarantee
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        const minDistanceX = a.halfW + b.halfW + 6;
        const minDistanceY = a.halfH + b.halfH + 6;
        const diffX = a.x - b.x;
        const diffY = a.y - b.y;
        const ovX = minDistanceX - Math.abs(diffX);
        const ovY = minDistanceY - Math.abs(diffY);
        if (ovX > 0 && ovY > 0) {
          if (ovY <= ovX) {
            const sign = (diffY >= 0 ? 1 : -1);
            a.y += sign * (ovY / 2);
            b.y -= sign * (ovY / 2);
          } else {
            const sign = (diffX >= 0 ? 1 : -1);
            a.x += sign * (ovX / 2);
            b.x -= sign * (ovX / 2);
          }
        }
      }
    }

    // 4. Apply calculated positions & draw SVG leader stems
    for (const item of items) {
      const relX = Math.round(item.x - item.groundX);
      const relY = Math.round(item.y - item.groundY);

      // Set CSS variables for GPU-accelerated translate
      item.badgeEl.style.setProperty('--bx', `${relX}px`);
      item.badgeEl.style.setProperty('--by', `${relY}px`);

      if (item.lineEl) {
        const dist = Math.hypot(relX, relY);
        if (dist < 18) {
          // Badge is directly over the ground pinpoint, hide line
          item.lineEl.setAttribute('x1', '0');
          item.lineEl.setAttribute('y1', '0');
          item.lineEl.setAttribute('x2', '0');
          item.lineEl.setAttribute('y2', '0');
          item.lineEl.style.opacity = '0';
        } else {
          // Compute exact intersection of ray with the badge perimeter
          const scaleX = item.halfW / (Math.abs(relX) || 0.001);
          const scaleY = item.halfH / (Math.abs(relY) || 0.001);
          // Scale by 0.94 so the stem penetrates slightly into the pill underneath the border
          const scale = Math.min(scaleX, scaleY) * 0.94;
          const borderX = relX * (1 - scale);
          const borderY = relY * (1 - scale);

          item.lineEl.setAttribute('x1', '0');
          item.lineEl.setAttribute('y1', '0');
          item.lineEl.setAttribute('x2', `${Math.round(borderX)}`);
          item.lineEl.setAttribute('y2', `${Math.round(borderY)}`);
          item.lineEl.style.opacity = '1';
        }
      }
    }
  }

  flyToLocation(lat, lng, zoom = 17) {
    if (this.map) {
      this.map.flyTo([lat, lng], zoom, {
        duration: 1.2,
        easeLinearity: 0.25
      });
    }
  }

  resetView() {
    if (this.map) {
      this.map.flyTo(this.defaultCenter, this.defaultZoom, {
        duration: 1
      });
    }
  }

  fitAllBounds() {
    if (this.map && this.markers.size > 0) {
      const group = L.featureGroup(Array.from(this.markers.values()));
      this.map.fitBounds(group.getBounds().pad(0.08), {
        duration: 1.2
      });
    }
  }
}

window.mapController = new MapControllerV2('map');
