// Owner: Frontend
// หน้าที่: ควบคุม first-run prompt ของ Google Classroom (spec §13.1, UX Review หัวข้อ 0)
// แสดงครั้งเดียวตอนเปิดแอปครั้งแรก (settings.has_seen_first_run_prompt = false) ถามว่าจะเชื่อม Classroom ไหม
//   - "Connect Google Classroom": classroom:connect -> ถ้ายังไม่มี cutoff เปิดป๊อปอัปเลือกวัน (บังคับตาม §13.1) -> settings:set cutoff
//   - "Use without it" (หรือ Esc): ปิดถาวร ไม่บล็อกการใช้งานแอป
// ทั้งสองทางตั้ง has_seen_first_run_prompt = true  ถ้าเชื่อมอยู่แล้ว (เช่น เครื่องที่เคยเชื่อมก่อนมี prompt) ข้ามเงียบ ๆ ไม่ถามซ้ำ
// ไม่แสดงซ้อนกับป๊อปอัปรับงานใหม่: ป๊อปอัปนั้นขึ้นเฉพาะบัญชีที่เชื่อมแล้ว (UX Review หัวข้อ 0)

'use strict';

(function () {
  const api = window.apiClient;

  async function markSeen() {
    try {
      await api.invoke('settings:set', { key: 'has_seen_first_run_prompt', value: true });
    } catch (err) {
      console.warn('[first-run] บันทึก has_seen_first_run_prompt ไม่ได้ จะถามอีกครั้งตอนเปิดแอปครั้งหน้า', err);
    }
  }

  async function askCutoff() {
    window.ClassroomPopups.cutoff({
      onConfirm: async (date) => {
        await api.invoke('settings:set', { key: 'classroom_cutoff_date', value: date.toISOString() });
        await markSeen();
      },
      // ไม่เลือกวัน: ถือว่าเชื่อมแล้วแต่ยังไม่ดึงงาน (Backend ไม่ให้ดึงจนกว่าจะตั้ง cutoff) ไปตั้งต่อได้ที่ Settings
      onCancel: () => markSeen(),
    });
  }

  async function maybeShow() {
    if (!api || !window.ClassroomPopups) return;
    let settings;
    try {
      settings = await api.invoke('settings:get');
    } catch (err) {
      return;
    }
    if (!settings || settings.has_seen_first_run_prompt !== false) return;

    try {
      const status = await api.invoke('classroom:get-status');
      if (status && status.connected) {
        await markSeen();
        return;
      }
    } catch (err) {
      // อ่านสถานะไม่ได้: ถามตามปกติ
    }

    window.ClassroomPopups.firstRun({
      onConnect: async (dialog) => {
        const status = await api.invoke('classroom:connect');
        if (!(status && status.connected)) throw new Error('ยังเชื่อม Google Classroom ไม่สำเร็จ ลองอีกครั้ง หรือเลือก Use without it');
        dialog.finish();
        if (status.cutoff_date) await markSeen();
        else await askCutoff();
      },
      onSkip: () => markSeen(),
    });
  }

  window.FirstRun = { maybeShow };
  maybeShow();
})();
