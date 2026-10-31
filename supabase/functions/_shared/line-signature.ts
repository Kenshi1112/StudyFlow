// Owner: Backend
// หน้าที่: ตรวจว่า request ที่เข้า line-webhook มาจาก LINE จริง (header x-line-signature) — ข้อ 8.3
// อ้างอิง: PROJECT_v0.15 section 14.2, 20 (Channel Secret อยู่ใน Edge Function secrets เท่านั้น)
// เขียนด้วย Web Crypto ที่มีทั้งใน Deno และ Node จึงเทสใน Node ได้ (ไฟล์ใน _shared ใช้เฉพาะ TypeScript ที่ลบ type แล้วรันได้เลย)

const encoder = new TextEncoder();

// LINE เซ็น body ดิบด้วย HMAC-SHA256 โดยใช้ Channel Secret เป็นกุญแจ แล้วส่งเป็น base64
// เราคำนวณซ้ำแล้วเทียบ: ตรง = มาจาก LINE / ไม่ตรง = ปลอมหรือ body ถูกแก้ระหว่างทาง
// ต้องใช้ body ดิบ (string ก่อน JSON.parse) เพราะแค่เว้นวรรคต่างไป 1 ตัว signature ก็ไม่ตรง
// crypto.subtle.verify เทียบแบบ constant-time (ไม่รั่วว่าตรงไปกี่ตัวอักษรเหมือนการเทียบ string ด้วย ===)
export async function verifySignature(rawBody: string, signature: string | null, channelSecret: string): Promise<boolean> {
  if (!signature || !channelSecret) return false;
  try {
    const key = await crypto.subtle.importKey('raw', encoder.encode(channelSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const signatureBytes = Uint8Array.from(atob(signature), (char) => char.charCodeAt(0));
    return await crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(rawBody));
  } catch {
    return false; // signature ไม่ใช่ base64 ที่ถูกต้อง
  }
}
