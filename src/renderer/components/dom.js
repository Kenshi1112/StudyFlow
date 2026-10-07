// Owner: Frontend
// หน้าที่: helper สร้าง DOM element แบบสั้น ๆ ใช้ร่วมกันทุก component (ไม่ใช้ innerHTML กับข้อมูลผู้ใช้)

'use strict';

(function () {
  // el('button', { class: 'btn', type: 'button', text: 'OK', onclick: fn }, child1, child2)
  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value === false || value == null) continue;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value === true ? '' : String(value));
    }
    for (const child of children.flat()) {
      if (child != null) node.append(child);
    }
    return node;
  }

  window.dom = { el };
})();
