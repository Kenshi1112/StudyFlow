// Owner: Frontend
// หน้าที่: hash router ของ renderer สลับหน้าใน #app โดยไม่รีโหลดหน้าต่าง (ROADMAP 0.5 ทาง A)
// วิธีใช้: ลิงก์ <a href="#/task-board"> หรือ window.router.go('pomodoro', { task: id })
// แต่ละหน้ามี pages/<name>/<name>.html (fragment), <name>.css, <name>.js (ลงทะเบียน window.pages[name])

'use strict';

(function () {
  const DEFAULT_ROUTE = 'room';

  // ชื่อหน้าที่อนุญาต (ตรงกับโฟลเดอร์ใน pages/) ชื่ออื่นจะถูกพากลับ room
  const ROUTES = {
    room: 'Room',
    'task-board': 'Task Board',
    dashboard: 'Dashboard',
    calendar: 'Calendar',
    settings: 'Settings',
    pomodoro: 'Pomodoro',
  };

  const app = document.getElementById('app');
  window.pages = window.pages || {};

  const scriptCache = new Map(); // name -> Promise (โหลดสคริปต์หน้าแต่ละหน้าครั้งเดียว)
  let currentLink = null; // <link> สไตล์ของหน้าปัจจุบัน
  let currentName = null;
  let currentKey = null; // name + query กันเรนเดอร์ซ้ำ
  let navId = 0; // กันผลของการนำทางเก่าที่โหลดช้ากว่า

  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, '');
    const qIndex = raw.indexOf('?');
    const path = qIndex === -1 ? raw : raw.slice(0, qIndex);
    const query = qIndex === -1 ? '' : raw.slice(qIndex + 1);
    return { name: path, query, params: Object.fromEntries(new URLSearchParams(query)) };
  }

  async function fetchFragment(name) {
    const res = await fetch(`pages/${name}/${name}.html`);
    // ใต้ file:// บางครั้ง status เป็น 0 ทั้งที่อ่านได้
    if (!res.ok && res.status !== 0) throw new Error(`โหลดหน้า ${name} ไม่ได้ (${res.status})`);
    return res.text();
  }

  function loadScript(name) {
    if (!scriptCache.has(name)) {
      const p = new Promise((resolve, reject) => {
        const el = document.createElement('script');
        el.src = `pages/${name}/${name}.js`;
        el.onload = () => resolve();
        el.onerror = () => reject(new Error(`โหลดสคริปต์หน้า ${name} ไม่ได้`));
        document.head.appendChild(el);
      });
      p.catch(() => scriptCache.delete(name));
      scriptCache.set(name, p);
    }
    return scriptCache.get(name);
  }

  // โหลด CSS ของหน้าให้เสร็จก่อนค่อยสลับ เพื่อไม่ให้หน้าวาบแบบไม่มีสไตล์
  function loadStyle(name) {
    return new Promise((resolve, reject) => {
      const el = document.createElement('link');
      el.rel = 'stylesheet';
      el.href = `pages/${name}/${name}.css`;
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(`โหลดสไตล์หน้า ${name} ไม่ได้`));
      document.head.appendChild(el);
    });
  }

  function unmountCurrent() {
    if (!currentName) return;
    const page = window.pages[currentName];
    try {
      if (page && typeof page.unmount === 'function') page.unmount();
    } catch (err) {
      console.error(`unmount ของหน้า ${currentName} ผิดพลาด`, err);
    }
    currentName = null;
  }

  function showError(message) {
    const box = document.createElement('p');
    box.setAttribute('role', 'alert');
    box.textContent = message; // textContent กัน HTML แทรก
    app.replaceChildren(box);
  }

  async function render() {
    const { name, query, params } = parseHash();

    if (!Object.prototype.hasOwnProperty.call(ROUTES, name)) {
      // hash ว่างหรือชื่อผิด กลับ room โดยไม่เพิ่ม history
      history.replaceState(null, '', `#/${DEFAULT_ROUTE}`);
      return render();
    }

    const key = `${name}?${query}`;
    if (key === currentKey) return;

    const id = ++navId;
    currentKey = key;

    try {
      const [html, , styleEl] = await Promise.all([
        fetchFragment(name),
        loadScript(name),
        loadStyle(name),
      ]);
      if (id !== navId) {
        styleEl.remove(); // มีการนำทางใหม่แทรกระหว่างโหลด
        return;
      }

      unmountCurrent();
      if (currentLink) currentLink.remove();
      currentLink = styleEl;

      app.innerHTML = html; // fragment เป็นไฟล์ของเราเอง ไม่ใช่ข้อมูลผู้ใช้
      document.title = `StudyFlow - ${ROUTES[name]}`;
      currentName = name;

      const page = window.pages[name];
      if (!page || typeof page.mount !== 'function') {
        throw new Error(`หน้า ${name} ไม่ได้ลงทะเบียน window.pages.${name}.mount`);
      }
      page.mount(app.firstElementChild, params);
      app.focus({ preventScroll: true }); // ให้ screen reader/คีย์บอร์ดเริ่มที่หน้าใหม่
    } catch (err) {
      if (id !== navId) return;
      currentKey = null; // ให้ลองใหม่ได้
      console.error(err);
      showError(err.message);
    }
  }

  function go(name, params) {
    const query = params ? `?${new URLSearchParams(params)}` : '';
    location.hash = `#/${name}${query}`;
  }

  window.router = { go };
  window.addEventListener('hashchange', render);
  render();
})();
