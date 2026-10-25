// Owner: Frontend
// หน้าที่: ไอคอน Source ของ task (manual / google_classroom / line) ชุดเดียวใช้ทั้งการ์ด ตัวกรอง และแผง Detail
// กติกา UX Review: โทนเดียว (ใช้สีตัวอักษรรอบข้าง) ไม่ใช้สีแบรนด์ และเป็นไอคอนเรียบ ๆ ที่วาดเองไม่ใช่โลโก้จริง

'use strict';

(function () {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  const LABELS = {
    manual: 'Added manually',
    google_classroom: 'Imported from Classroom',
    line: 'Added via LINE',
  };

  // เส้นของแต่ละไอคอน (viewBox 24x24, stroke currentColor)
  const PATHS = {
    manual: ['M4 20h4L19 9a2.1 2.1 0 0 0-4-4L4 16v4z', 'M13.5 6.5l4 4'], // ดินสอ
    google_classroom: ['M2 9l10-5 10 5-10 5-10-5z', 'M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5', 'M22 9v6'], // หมวกรับปริญญา
    line: ['M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z'], // ฟองคำพูด
  };

  function create(source, size) {
    const key = PATHS[source] ? source : 'manual';
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', String(size || 24));
    svg.setAttribute('height', String(size || 24));
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    for (const d of PATHS[key]) {
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', d);
      svg.append(path);
    }
    return svg;
  }

  function label(source) {
    return LABELS[source] || LABELS.manual;
  }

  window.SourceIcon = { create, label };
})();
