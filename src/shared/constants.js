// Owner: Shared (ต้องคุยกันก่อนแก้)
// หน้าที่: ค่าคงที่ที่ทั้ง main และ preload ใช้ร่วมกัน (ค่า enum ตาม PROJECT_v0.13)
// TODO: เพิ่มเฉพาะค่าที่มีใน spec — renderer ให้ขอค่าผ่าน IPC แทนการ import ตรง
'use strict';

const TASK_STATUS = Object.freeze({
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
});

const TASK_SOURCE = Object.freeze({
  MANUAL: 'manual',
  GOOGLE_CLASSROOM: 'google_classroom',
  LINE: 'line',
});

const TASK_PRIORITY = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
});

const DEADLINE_STATE = Object.freeze({
  NO_DEADLINE: 'no_deadline',
  UPCOMING: 'upcoming',
  DUE_TODAY: 'due_today',
  OVERDUE: 'overdue',
  COMPLETED: 'completed',
});

const DASHBOARD_RANGE = Object.freeze({
  THIS_WEEK: 'this_week',
  THIS_MONTH: 'this_month',
  ALL_TIME: 'all_time',
});

module.exports = { TASK_STATUS, TASK_SOURCE, TASK_PRIORITY, DEADLINE_STATE, DASHBOARD_RANGE };
