/**
 * ERM - Executive Report Image Export Module
 * Captures clean satellite map, markers, and floating legend without title/footer banners.
 */

class ExecutiveReportExporter {
  constructor() {
    this.isExporting = false;
  }

  async exportReportPNG() {
    if (this.isExporting) return;
    this.isExporting = true;

    if (window.app && typeof window.app.showToast === 'function') {
      window.app.showToast('กำลังเตรียมบันทึกภาพแผนที่และป้ายกำกับ...', 'warning');
    }

    try {
      const now = new Date();
      const fileStamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

      // 1. Target the main content area (contains #map and .map-overlay-panel legend)
      const captureElement = document.querySelector('.main-content') || document.getElementById('map');
      if (!captureElement) throw new Error('ไม่พบองค์ประกอบแผนที่');

      // Temporarily hide admin banner and leaflet UI controls (+/- zoom & layer switcher)
      const adminBanner = document.getElementById('admin-mode-banner');
      const prevBannerDisplay = adminBanner ? adminBanner.style.display : '';
      if (adminBanner) adminBanner.style.display = 'none';

      const controls = captureElement.querySelectorAll('.leaflet-control-container');
      controls.forEach(c => c.style.opacity = '0');

      // 2. Capture pure map + pins + legend with html2canvas
      const mapCanvas = await html2canvas(captureElement, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#0b1120',
        scale: 2, // High-resolution retina output
        logging: false
      });

      // 3. Restore controls and banner
      controls.forEach(c => c.style.opacity = '1');
      if (adminBanner) adminBanner.style.display = prevBannerDisplay;

      // 4. Download pure map PNG directly (No title header, no footer)
      const link = document.createElement('a');
      link.download = `ERM_Map_${fileStamp}.png`;
      link.href = mapCanvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      link.remove();

      if (window.app && typeof window.app.showToast === 'function') {
        window.app.showToast('บันทึกภาพแผนที่และป้ายกำกับสำเร็จแล้ว!', 'success');
      }
    } catch (err) {
      console.error('Failed to export map image:', err);
      if (window.app && typeof window.app.showToast === 'function') {
        window.app.showToast('เกิดข้อผิดพลาดในการสร้างภาพ: ' + err.message, 'error');
      }
    } finally {
      this.isExporting = false;
    }
  }
}

window.reportExporter = new ExecutiveReportExporter();
