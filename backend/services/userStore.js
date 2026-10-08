const User = require('../models/User');
const { getMongoStatus } = require('../config/mongodb');
const { findInPg } = require('./dbService');
const bcrypt = require('bcryptjs');

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '../uploads/memory_db.json');

const memoryUsers = [
  {
    _id: 'default_placement_cell_1',
    name: 'Main Placement Cell',
    email: 'placement@iitb.ac.in',
    password: bcrypt.hashSync('password123', 10),
    role: 'placement',
    institutionName: 'IIT Bombay',
    institutionCode: 'IITB-01',
    createdAt: new Date()
  },
  {
    _id: 'default_student_1',
    name: 'Demo Student',
    email: 'student@college.edu',
    password: bcrypt.hashSync('password123', 10),
    role: 'student',
    regNo: 'REG2024001',
    createdAt: new Date()
  }
];
const memoryProfiles = [
  {
    _id: 'default_profile_1',
    userId: 'default_student_1',
    placementCellId: 'default_placement_cell_1',
    approvalStatus: 'approved',
    skills: [],
    projects: []
  }
];
const memoryAnalyses = [];

function loadMemoryDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.users)) {
        data.users.forEach(u => {
          if (!memoryUsers.some(existing => existing.email === u.email || existing._id === u._id)) {
            memoryUsers.push(u);
          }
        });
      }
      if (Array.isArray(data.profiles)) {
        data.profiles.forEach(p => {
          const existingIdx = memoryProfiles.findIndex(ep => ep.userId?.toString() === p.userId?.toString());
          if (existingIdx !== -1) memoryProfiles[existingIdx] = p;
          else memoryProfiles.push(p);
        });
      }
      if (Array.isArray(data.analyses)) {
        memoryAnalyses.length = 0;
        memoryAnalyses.push(...data.analyses);
      }
    }
  } catch (err) {
    console.warn('Failed to load memory DB from disk:', err.message);
  }
}

function saveMemoryDb() {
  try {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify({
      users: memoryUsers,
      profiles: memoryProfiles,
      analyses: memoryAnalyses
    }, null, 2));
  } catch (err) {
    console.warn('Failed to save memory DB to disk:', err.message);
  }
}

loadMemoryDb();

async function findUserById(id) {
  try {
    const pgUser = await findInPg('users', { mongo_id: id.toString() });
    if (pgUser) return hydratePgUser(pgUser);
  } catch (err) {
    console.warn('findUserById pg check error:', err.message);
  }

  if (getMongoStatus()) {
    try {
      const u = await User.findById(id);
      if (u) return u;
    } catch (e) {}
  }
  const mem = memoryUsers.find(u => u._id === id || u._id?.toString() === id?.toString());
  if (!mem) return null;
  return {
    ...mem,
    toJSON: () => {
      const copy = { ...mem };
      delete copy.password;
      return copy;
    }
  };
}

async function findUserByEmail(email) {
  try {
    const pgUser = await findInPg('users', { email });
    if (pgUser?.password_hash) return hydratePgUser(pgUser);
  } catch (err) {
    console.warn('findUserByEmail pg check error:', err.message);
  }

  if (getMongoStatus()) {
    try {
      const user = await User.findOne({ email });
      if (user) return user;
    } catch (e) {}
  }

  return memoryUsers.find(user => user.email === email) || null;
}

function hydratePgUser(row) {
  const user = {
    _id: row.mongo_id,
    email: row.email,
    password: row.password_hash,
    name: row.name,
    role: row.role,
    regNo: row.reg_no,
    institutionName: row.institution_name,
    institutionCode: row.institution_code,
    createdAt: row.created_at,
    comparePassword: candidate => bcrypt.compare(candidate, row.password_hash),
    toJSON: () => {
      const { password, ...safeUser } = user;
      return safeUser;
    }
  };
  return user;
}

module.exports = {
  memoryUsers,
  memoryProfiles,
  memoryAnalyses,
  saveMemoryDb,
  findUserById,
  findUserByEmail
};
