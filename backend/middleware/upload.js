const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const resumeStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = path.join(uploadDir, 'resumes');
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.user._id}_${Date.now()}${ext}`);
  }
});

const proofStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = path.join(uploadDir, 'proofs');
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `proof_${req.user._id}_${Date.now()}${ext}`);
  }
});

const linkedinStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = path.join(uploadDir, 'linkedin');
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `linkedin_${req.user._id}_${Date.now()}${ext}`);
  }
});

function fileFilter(req, file, cb) {
  const allowedResume = ['.pdf', '.docx'];
  const allowedProof = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.doc', '.docx', '.zip', '.txt', '.md', '.json', '.csv'];
  const allowedLinkedin = ['.pdf'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (file.fieldname === 'resume') {
    if (allowedResume.includes(ext)) return cb(null, true);
    return cb(new Error('Resume must be a PDF or DOCX file'));
  }
  if (file.fieldname === 'linkedinPdf') {
    if (allowedLinkedin.includes(ext)) return cb(null, true);
    return cb(new Error('LinkedIn profile export must be a PDF file'));
  }
  if (['proofFile', 'file', 'proof', 'proofDoc'].includes(file.fieldname)) {
    if (allowedProof.includes(ext)) return cb(null, true);
    return cb(new Error(`Invalid proof file type (${ext}). Allowed: PDF, DOC/DOCX, TXT, images, ZIP`));
  }
  cb(null, true);
}

const uploadResume = multer({
  storage: resumeStorage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
}).single('resume');

const uploadLinkedinPdf = multer({
  storage: linkedinStorage,
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 }
}).single('linkedinPdf');

const uploadProof = multer({
  storage: proofStorage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }
}).single('proofFile');

const uploadProofFlexible = multer({
  storage: proofStorage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }
}).any();

module.exports = { uploadResume, uploadLinkedinPdf, uploadProof, uploadProofFlexible };

