// Owner: Backend
// หน้าที่: login Google (OAuth แบบ desktop) และเก็บ refresh token ในเครื่องแบบเข้ารหัส (ข้อ 6.2)
// อ้างอิง: PROJECT_v0.15 section 13.1, 16, 20 — token ห้ามอยู่ใน DB หรือไฟล์ที่ sync ขึ้น cloud

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { app, safeStorage, shell } = require('electron');
const { OAuth2Client } = require('google-auth-library');

// สิทธิ์ที่ขอ (อ่านอย่างเดียวทั้งหมด): วิชา, งาน + การส่งงานของตัวเอง, และอีเมลไว้โชว์ใน Settings
const SCOPE_COURSES = 'https://www.googleapis.com/auth/classroom.courses.readonly';
const SCOPE_COURSEWORK = 'https://www.googleapis.com/auth/classroom.coursework.me.readonly';
// Google อาจตอบกลับสิทธิ์งานของตัวเองเป็นชื่อนี้แทน coursework.me.readonly (ชื่อเทียบเท่า) จึงยอมรับทั้งสองชื่อ
const SCOPE_COURSEWORK_ALIAS = 'https://www.googleapis.com/auth/classroom.student-submissions.me.readonly';
const SCOPES = [SCOPE_COURSES, SCOPE_COURSEWORK, 'openid', 'email'];

// รอผู้ใช้ login นานสุด 3 นาที ไม่งั้นถือว่ายกเลิก
const LOGIN_TIMEOUT_MS = 3 * 60 * 1000;

// อ่าน client id / secret จาก .env ที่รากโปรเจกต์ (ถ้าตั้งเป็น environment variable ไว้แล้วก็ใช้ค่านั้น)
function getCredentials() {
  try {
    process.loadEnvFile(path.join(app.getAppPath(), '.env'));
  } catch {
    // ไม่มีไฟล์ .env ก็ไม่เป็นไร เช็คค่าด้านล่างต่อ
  }
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('ไม่พบ GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (ใส่ในไฟล์ .env ที่รากโปรเจกต์)');
  }
  return { clientId, clientSecret };
}

function tokenFile() {
  return path.join(app.getPath('userData'), 'google-token.bin');
}

// อ่าน token ที่เข้ารหัสไว้ -> { refresh_token, account_email } (ไม่มีไฟล์ หรือถอดรหัสไม่ได้ = null = ยังไม่เชื่อม)
function readToken() {
  if (!fs.existsSync(tokenFile())) return null;
  try {
    return JSON.parse(safeStorage.decryptString(fs.readFileSync(tokenFile())));
  } catch {
    return null;
  }
}

function page(text) {
  return `<!doctype html><meta charset="utf-8"><title>StudyFlow</title><p style="font:20px sans-serif;margin:48px">${text}</p>`;
}

// รอให้ Google redirect กลับมาที่ server ในเครื่อง (http://127.0.0.1:พอร์ต/?code=...&state=...) แล้วคืนค่า code
// เช่น กด Allow -> /?code=4/0AX...&state=ab12 -> คืน '4/0AX...'   กด Cancel -> /?error=access_denied -> reject
function waitForCode(server, state) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('หมดเวลา: ไม่ได้ login Google ภายใน 3 นาที')), LOGIN_TIMEOUT_MS);
    server.once('close', () => clearTimeout(timer)); // ปิด server ไปแล้ว (เช่น เปิดเบราว์เซอร์ไม่ได้) ไม่ต้องรอ timer

    server.on('request', (req, res) => {
      const params = new URL(req.url, 'http://127.0.0.1').searchParams;
      if (!params.has('code') && !params.has('error')) {
        res.writeHead(404).end(); // เช่นเบราว์เซอร์ขอ /favicon.ico
        return;
      }

      const error = params.get('error');
      const ok = !error && params.get('state') === state;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(page(ok ? 'เชื่อมต่อ Google Classroom สำเร็จ กลับไปที่แอป StudyFlow ได้เลย' : 'เชื่อมต่อไม่สำเร็จ กลับไปลองใหม่ในแอป StudyFlow'));

      clearTimeout(timer);
      if (ok) resolve(params.get('code'));
      else reject(new Error(error ? `Google ไม่อนุญาต: ${error}` : 'ผลจาก Google ไม่ถูกต้อง (state ไม่ตรง)'));
    });
  });
}

// login: เปิดเบราว์เซอร์ให้ผู้ใช้เลือกบัญชี -> ได้ code -> แลกเป็น token -> เก็บ refresh token แบบเข้ารหัส
// คืน { account_email } ของบัญชีที่เชื่อม
async function signIn() {
  const { clientId, clientSecret } = getCredentials();
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('เครื่องนี้เข้ารหัส token ไม่ได้ (safeStorage ใช้ไม่ได้) จึงไม่เก็บ token');
  }

  // Google บังคับให้แอป desktop รับผลทาง loopback: เปิด server ชั่วคราวในเครื่อง พอร์ต 0 = ให้ระบบสุ่มพอร์ตที่ว่าง
  const server = http.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const client = new OAuth2Client({ clientId, clientSecret, redirectUri: `http://127.0.0.1:${server.address().port}` });

    // PKCE: ส่งรหัสย่อ (challenge) ไปกับ URL แล้วค่อยส่งรหัสจริง (verifier) ตอนแลก token กันคนอื่นดัก code ไปใช้
    const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
    const state = crypto.randomBytes(16).toString('hex'); // กันผลจากที่อื่นที่เราไม่ได้ขอ
    const url = client.generateAuthUrl({
      access_type: 'offline', // ขอ refresh token
      prompt: 'consent', // บังคับให้ถามทุกครั้ง ไม่งั้น Google อาจไม่ส่ง refresh token มาตอนเชื่อมซ้ำ
      scope: SCOPES,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const waiting = waitForCode(server, state); // ต้องเริ่มรอก่อนเปิดเบราว์เซอร์
    await shell.openExternal(url);
    const code = await waiting;

    const { tokens } = await client.getToken({ code, codeVerifier });

    // Google ให้ผู้ใช้เลือกติ๊กสิทธิ์ทีละอัน ถ้าไม่ติ๊ก Classroom ครบก็ใช้งานไม่ได้ (ต้องมี courses + coursework หรือชื่อเทียบเท่า)
    const granted = tokens.scope || '';
    const missing = [];
    if (!granted.includes(SCOPE_COURSES)) missing.push('classroom.courses.readonly');
    if (!granted.includes(SCOPE_COURSEWORK) && !granted.includes(SCOPE_COURSEWORK_ALIAS)) missing.push('classroom.coursework.me.readonly');
    if (missing.length > 0) {
      console.error('[google-auth] สิทธิ์ที่ Google ส่งมา:', granted || '(ว่าง)');
      throw new Error(`ต้องติ๊กอนุญาตสิทธิ์ Classroom ให้ครบทุกข้อ แล้วกด Connect ใหม่ (ยังขาด: ${missing.join(', ')})`);
    }
    if (!tokens.refresh_token) {
      throw new Error('Google ไม่ส่ง refresh token มา ลองกด Connect ใหม่');
    }

    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: clientId });
    const accountEmail = ticket.getPayload().email;

    // เข้ารหัสด้วย safeStorage (ใช้ key ของ OS) แล้วเขียนเป็นไฟล์ในเครื่อง ไม่เก็บใน SQLite
    const encrypted = safeStorage.encryptString(JSON.stringify({ refresh_token: tokens.refresh_token, account_email: accountEmail }));
    fs.writeFileSync(tokenFile(), encrypted);
    return { account_email: accountEmail };
  } finally {
    server.close();
    server.closeAllConnections();
  }
}

// disconnect: ลบไฟล์ token (ไม่มีไฟล์ก็ไม่เป็นไร)
function signOut() {
  fs.rmSync(tokenFile(), { force: true });
}

// บัญชีที่เชื่อมอยู่ -> { account_email } หรือ null (ไม่คืน token ออกไปนอกไฟล์นี้)
function getAccount() {
  const token = readToken();
  return token ? { account_email: token.account_email } : null;
}

// ตัวเรียก Google API: ใส่ refresh token ไว้ ไลบรารีจะขอ access token ใหม่ให้เองทุกครั้งที่หมดอายุ (อายุประมาณ 1 ชม.)
function getAuthClient() {
  const token = readToken();
  if (!token) throw new Error('ยังไม่ได้เชื่อม Google Classroom');

  const { clientId, clientSecret } = getCredentials();
  const client = new OAuth2Client({ clientId, clientSecret });
  client.setCredentials({ refresh_token: token.refresh_token });
  return client;
}

// ขอ id token ใหม่จาก refresh token ที่เก็บไว้ (อายุประมาณ 1 ชม.) เพื่อเอาไป login Supabase (ข้อ 7.3)
// id token = "บัตรยืนยันตัวตน" ที่ Google เซ็นให้ว่าคนนี้คือบัญชีนี้ (ต่างจาก access token ที่ใช้เรียก Classroom API)
async function getIdToken() {
  const { credentials } = await getAuthClient().refreshAccessToken();
  if (!credentials.id_token) {
    throw new Error('Google ไม่ส่ง id token มา ลองกด Connect Google ใหม่');
  }
  return credentials.id_token;
}

module.exports = {
  signIn,
  signOut,
  getAccount,
  getAuthClient,
  getIdToken,
};
