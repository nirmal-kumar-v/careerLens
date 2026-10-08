const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const { syncUserToPg, syncProfileToPg, findInPg, listInPg } = require('../services/dbService');
const { getMongoStatus } = require('../config/mongodb');
const { getPgStatus } = require('../config/postgresql');
const { memoryUsers, memoryProfiles, saveMemoryDb, findUserByEmail } = require('../services/userStore');

const router = express.Router();

// Register Student
router.post('/register/student', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('name').trim().notEmpty(),
  body('placementCellId').notEmpty().withMessage('Placement cell selection is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, name, regNo, placementCellId } = req.body;
    console.log(`[AUTH][REGISTER-STUDENT] request received for ${email}`);

    if (getMongoStatus()) {
      const existing = await User.findOne({ email });
      if (existing) {
        return res.status(400).json({ error: 'Email already registered' });
      }
      try {
        if (await findInPg('users', { email })) {
          return res.status(400).json({ error: 'Email already registered' });
        }
      } catch (e) {}

      const placementCell = await User.findById(placementCellId);
      if (!placementCell || placementCell.role !== 'placement') {
        return res.status(400).json({ error: 'Invalid placement cell selected' });
      }

      const user = new User({ email, password, name, role: 'student', regNo });
      try {
        await syncUserToPg({
          _id: user._id,
          email,
          password: await bcrypt.hash(password, 12),
          name,
          role: 'student',
          regNo
        });
      } catch (e) {
        console.warn('PG sync warning during student registration:', e.message);
      }
      await user.save();

      const profile = new StudentProfile({
        userId: user._id,
        placementCellId: placementCell._id,
        approvalStatus: 'pending'
      });
      try {
        await syncProfileToPg(profile);
      } catch (e) {
        console.warn('PG sync profile warning during student registration:', e.message);
      }
      await profile.save();

      const token = jwt.sign({ id: user._id, role: 'student' }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
      console.log(`[AUTH][REGISTER-STUDENT] created successfully in MongoDB for ${email}`);

      return res.status(201).json({
        token,
        user: user.toJSON(),
        profile: {
          approvalStatus: profile.approvalStatus,
          placementCellId: profile.placementCellId
        }
      });
    }

    // Memory fallback
    console.log(`[AUTH][REGISTER-STUDENT] processing in memory store for ${email}`);
    if (memoryUsers.some(u => u.email === email)) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    try {
      if (await findInPg('users', { email })) {
        return res.status(400).json({ error: 'Email already registered' });
      }
    } catch (e) {}

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = 'user_' + Date.now();
    const newUser = {
      _id: userId,
      email,
      password: hashedPassword,
      name,
      role: 'student',
      regNo,
      createdAt: new Date()
    };
    const profile = {
      _id: 'prof_' + Date.now(),
      userId,
      placementCellId,
      approvalStatus: 'pending',
      skills: [],
      projects: []
    };

    try {
      await syncUserToPg(newUser);
    } catch (e) {
      console.warn('PG sync warning during memory student registration:', e.message);
    }
    try {
      await syncProfileToPg(profile);
    } catch (e) {
      console.warn('PG sync profile warning during memory student registration:', e.message);
    }

    memoryUsers.push(newUser);
    memoryProfiles.push(profile);
    saveMemoryDb();

    const token = jwt.sign({ id: userId, role: 'student' }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });

    const userObj = { ...newUser };
    delete userObj.password;

    console.log(`[AUTH][REGISTER-STUDENT] created successfully in memory for ${email}`);
    res.status(201).json({
      token,
      user: userObj,
      profile: {
        approvalStatus: profile.approvalStatus,
        placementCellId: profile.placementCellId
      }
    });
  } catch (err) {
    console.error('Student registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Register Placement Cell
router.post('/register/placement', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('name').trim().notEmpty(),
  body('institutionName').trim().notEmpty(),
  body('institutionCode').trim().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, name, institutionName, institutionCode } = req.body;
    console.log(`[AUTH][REGISTER-PLACEMENT] request received for ${email}`);

    if (getMongoStatus()) {
      const existing = await User.findOne({ email });
      if (existing) {
        return res.status(400).json({ error: 'Email already registered' });
      }
      try {
        if (await findInPg('users', { email })) {
          return res.status(400).json({ error: 'Email already registered' });
        }
      } catch (e) {}

      const user = new User({ email, password, name, role: 'placement', institutionName, institutionCode });
      try {
        await syncUserToPg({
          _id: user._id,
          email,
          password: await bcrypt.hash(password, 12),
          name,
          role: 'placement',
          institutionName,
          institutionCode
        });
      } catch (e) {
        console.warn('PG sync warning during placement registration:', e.message);
      }
      await user.save();

      const token = jwt.sign({ id: user._id, role: 'placement' }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
      console.log(`[AUTH][REGISTER-PLACEMENT] created successfully in MongoDB for ${email}`);

      return res.status(201).json({
        token,
        user: user.toJSON()
      });
    }

    // Memory fallback
    console.log(`[AUTH][REGISTER-PLACEMENT] processing in memory store for ${email}`);
    if (memoryUsers.some(u => u.email === email)) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    try {
      if (await findInPg('users', { email })) {
        return res.status(400).json({ error: 'Email already registered' });
      }
    } catch (e) {}

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = 'user_' + Date.now();
    const newUser = {
      _id: userId,
      email,
      password: hashedPassword,
      name,
      role: 'placement',
      institutionName,
      institutionCode,
      createdAt: new Date()
    };

    try {
      await syncUserToPg(newUser);
    } catch (e) {
      console.warn('PG sync warning during memory placement registration:', e.message);
    }
    memoryUsers.push(newUser);
    saveMemoryDb();

    const token = jwt.sign({ id: userId, role: 'placement' }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });

    const userObj = { ...newUser };
    delete userObj.password;

    console.log(`[AUTH][REGISTER-PLACEMENT] created successfully in memory for ${email}`);
    res.status(201).json({
      token,
      user: userObj
    });
  } catch (err) {
    console.error('Placement registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    console.log(`[AUTH][LOGIN] request received for ${email}`);

    console.log('[AUTH][LOGIN] database lookup started');
    const user = await findUserByEmail(email);
    console.log('[AUTH][LOGIN] database lookup completed:', Boolean(user));
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    console.log('[AUTH][LOGIN] password verification started');
    const isMatch = user.comparePassword
      ? await user.comparePassword(password)
      : await bcrypt.compare(password, user.password);
    console.log('[AUTH][LOGIN] password verification completed:', isMatch);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    console.log('[AUTH][LOGIN] JWT generation started');
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });

    let profileData = null;
    if (user.role === 'student') {
      try {
        const pgProfile = await findInPg('student_profiles', { user_id: user._id.toString() });
        const profile = pgProfile || (getMongoStatus()
          ? await StudentProfile.findOne({ userId: user._id })
          : memoryProfiles.find(p => p.userId === user._id));
        if (profile) {
          profileData = {
            approvalStatus: profile.approvalStatus || profile.approval_status,
            placementCellId: profile.placementCellId || profile.placement_cell_id,
            profileComplete: profile.profileComplete || Boolean(profile.resume_path && profile.github_url)
          };
        }
      } catch (e) {
        console.warn('Profile fetch warning on login:', e.message);
      }
    }

    const userObj = user.toJSON ? user.toJSON() : { ...user };
    delete userObj.password;

    console.log(`[AUTH][LOGIN] response sent for ${email}`);
    res.json({
      token,
      user: userObj,
      profile: profileData
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/me', require('../middleware/auth').authenticate, async (req, res) => {
  try {
    let profileData = null;
    if (req.user.role === 'student') {
      if (getPgStatus()) {
        const pgProf = await findInPg('student_profiles', { user_id: req.user._id.toString() });
        if (pgProf) {
          profileData = {
            _id: pgProf.id,
            userId: pgProf.user_id,
            resumePath: pgProf.resume_path,
            githubUrl: pgProf.github_url,
            portfolioUrl: pgProf.portfolio_url,
            leetcodeUrl: pgProf.leetcode_url,
            gfgUrl: pgProf.gfg_url,
            linkedinUrl: pgProf.linkedin_url,
            linkedinPdfPath: pgProf.linkedin_pdf_path,
            figmaUrl: pgProf.figma_url,
            targetRole: pgProf.target_role,
            placementCellId: pgProf.placement_cell_id,
            approvalStatus: pgProf.approval_status
          };
        }
      }
      if (!profileData && getMongoStatus()) {
        const profile = await StudentProfile.findOne({ userId: req.user._id });
        if (profile) {
          profileData = profile.toObject();
        }
      }
      if (!profileData) {
        profileData = memoryProfiles.find(p => p.userId?.toString() === req.user._id?.toString()) || null;
      }
    }
    const userObj = req.user.toJSON ? req.user.toJSON() : { ...req.user };
    delete userObj.password;
    res.json({ user: userObj, profile: profileData });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Get all placement cells (public, for student registration)
router.get('/placement-cells', async (req, res) => {
  try {
    console.log('[AUTH][PLACEMENT-CELLS] request received');
    console.log('[AUTH][PLACEMENT-CELLS] query started');
    if (getPgStatus()) {
      try {
        const pgCells = await listInPg('users', { role: 'placement' });
        if (pgCells?.length) {
          console.log(`[AUTH][PLACEMENT-CELLS] query completed from PG (${pgCells.length} cells)`);
          return res.json(pgCells.map(cell => ({
            _id: cell.mongo_id || cell.id?.toString(),
            name: cell.name,
            institutionName: cell.institution_name,
            institutionCode: cell.institution_code
          })));
        }
      } catch (e) {
        console.warn('PG list placement cells warning:', e.message);
      }
    }
    if (getMongoStatus()) {
      try {
        const cells = await User.find({ role: 'placement' })
          .select('name institutionName institutionCode _id');
        console.log(`[AUTH][PLACEMENT-CELLS] query completed from Mongo (${cells.length} cells)`);
        return res.json(cells);
      } catch (e) {
        console.warn('Mongo list placement cells warning:', e.message);
      }
    }
    const cells = memoryUsers.filter(u => u.role === 'placement').map(u => ({
      _id: u._id,
      name: u.name,
      institutionName: u.institutionName,
      institutionCode: u.institutionCode
    }));
    console.log(`[AUTH][PLACEMENT-CELLS] query completed from Memory (${cells.length} cells)`);
    res.json(cells);
  } catch (err) {
    console.error('Failed to fetch placement cells:', err);
    res.status(500).json({ error: 'Failed to fetch placement cells' });
  }
});

module.exports = router;
