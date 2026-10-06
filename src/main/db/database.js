// Owner: Backend
// หน้าที่: เปิด/ปิด SQLite และสร้างตาราง (ที่เดียวที่แตะ DB ฝั่ง local — spec §17.2)
'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const Database = require('better-sqlite3');

// connection ที่เปิดไว้ ทั้งแอปใช้ตัวเดียวกัน (null = ยังไม่ได้เปิด)
let db = null;

// เปิดไฟล์ DB ใน userData แล้วสร้างตาราง เรียกครั้งเดียวตอนแอปเริ่ม (จาก main.js)
function initDatabase() {
  const folder = app.getPath('userData');
  fs.mkdirSync(folder, { recursive: true }); // better-sqlite3 สร้างโฟลเดอร์ให้ไม่ได้ ถ้ายังไม่มีต้องสร้างก่อน

  db = new Database(path.join(folder, 'studyflow.sqlite'));
  db.pragma('foreign_keys = ON'); // SQLite ปิด foreign key เป็นค่าเริ่มต้น ต้องเปิดเองทุกครั้งที่เชื่อมต่อ

  runMigrations();
}

// ให้ไฟล์อื่น (เช่น task.service.js) ขอ connection ไปใช้
function getDb() {
  if (!db) throw new Error('Database is not initialized. Call initDatabase() first.');
  return db;
}

// อ่าน schema.sql มารันทุกครั้งที่เปิดแอป ทุกตารางเป็น IF NOT EXISTS จึงรันซ้ำได้ ไม่สร้างซ้ำ ข้อมูลเดิมไม่หาย
// (ถ้าแก้ schema.sql ระหว่างพัฒนา ตารางเดิมไม่เปลี่ยนตาม ให้ลบไฟล์ studyflow.sqlite ทิ้งแล้วเปิดแอปใหม่)
function runMigrations() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(sql);
}

// ปิดไฟล์ตอนแอปปิด
function closeDatabase() {
  if (db) db.close();
  db = null;
}

module.exports = {
  initDatabase,
  getDb,
  runMigrations,
  closeDatabase,
};
