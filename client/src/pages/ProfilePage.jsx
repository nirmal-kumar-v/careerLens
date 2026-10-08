import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Globe, Code2, Briefcase, Save, Loader2, CheckCircle } from 'lucide-react';

const GithubIcon = ({ className }) => (
  <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path><path d="M9 18c-4.51 2-5-2-7-2"></path></svg>
);

const LinkedinIcon = ({ className }) => (
  <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>
);

const FigmaIcon = ({ className }) => (
  <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 5.5A3.5 3.5 0 0 1 8.5 2H12v7H8.5A3.5 3.5 0 0 1 5 5.5z"></path><path d="M12 2h3.5a3.5 3.5 0 1 1 0 7H12V2z"></path><path d="M12 12.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 1 1-7 0z"></path><path d="M5 19.5A3.5 3.5 0 0 1 8.5 16H12v3.5a3.5 3.5 0 1 1-7 0z"></path><path d="M5 12.5A3.5 3.5 0 0 1 8.5 9H12v7H8.5A3.5 3.5 0 0 1 5 12.5z"></path></svg>
);

const FIELDS = [
  { name: 'githubUrl', label: 'GitHub Profile', icon: GithubIcon, placeholder: 'https://github.com/username', required: true, hint: 'Required — used for repository and ownership analysis' },
  { name: 'portfolioUrl', label: 'Portfolio Website', icon: Globe, placeholder: 'https://yoursite.dev', required: false, hint: 'Optional — personal site or portfolio' },
  { name: 'leetcodeUrl', label: 'LeetCode Profile', icon: Code2, placeholder: 'https://leetcode.com/u/username', required: false, hint: 'Optional — DSA and coding evidence' },
  { name: 'gfgUrl', label: 'GeeksforGeeks Profile', icon: Code2, placeholder: 'https://www.geeksforgeeks.org/user/username', required: false, hint: 'Optional — coding activity' },
  { name: 'linkedinUrl', label: 'LinkedIn Profile', icon: LinkedinIcon, placeholder: 'https://linkedin.com/in/username', required: false, hint: 'Optional — professional signals' },
  { name: 'figmaUrl', label: 'Figma Profile / Link', icon: FigmaIcon, placeholder: 'https://figma.com/@username', required: false, hint: 'Optional — design work evidence' },
];

export default function ProfilePage() {
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef();
  const linkedinPdfRef = useRef();
  const [form, setForm] = useState({
    githubUrl: '', portfolioUrl: '', leetcodeUrl: '',
    gfgUrl: '', linkedinUrl: '', figmaUrl: '', targetRole: ''
  });
  const [resume, setResume] = useState(null);
  const [resumeFile, setResumeFile] = useState(null);
  const [linkedinPdf, setLinkedinPdf] = useState(null);
  const [linkedinPdfFile, setLinkedinPdfFile] = useState(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    api.get('/student/profile').then(r => {
      const p = r.data;
      setForm({
        githubUrl: p.githubUrl || '',
        portfolioUrl: p.portfolioUrl || '',
        leetcodeUrl: p.leetcodeUrl || '',
        gfgUrl: p.gfgUrl || '',
        linkedinUrl: p.linkedinUrl || '',
        figmaUrl: p.figmaUrl || '',
        targetRole: p.targetRole || ''
      });
      setResume(Boolean(p.resumePath));
      setResumeFile(p.resumePath ? p.resumePath.split(/[\\/]/).pop() : null);
      setLinkedinPdf(Boolean(p.linkedinPdfPath));
      setLinkedinPdfFile(p.linkedinPdfPath ? p.linkedinPdfPath.split(/[\\/]/).pop() : null);
    }).catch(() => {});
  }, []);

  const handleSave = async (e, runAfterSave = false) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: updatedProfile } = await api.put('/student/profile', form);
      if (updatedProfile?.resumePath) {
        setResume(true);
        setResumeFile(updatedProfile.resumePath.split(/[\\/]/).pop());
      }
      await refreshProfile();
      if (runAfterSave) {
        const hasResumeFile = resume || Boolean(updatedProfile?.resumePath);
        if (!hasResumeFile) {
          toast.error('Upload a PDF or DOCX resume before starting analysis');
          return;
        }
        setAnalyzing(true);
        await api.post('/analysis/run');
        toast.success('Analysis complete');
        navigate('/analysis');
        return;
      }
      toast.success('Profile saved!');
    } catch (err) {
      const sourceErrors = Object.entries(err.response?.data?.sourceErrors || {})
        .map(([source, message]) => `${source}: ${message}`)
        .join(' ');
      toast.error(sourceErrors || err.response?.data?.error || 'Save or analysis failed');
    } finally {
      setSaving(false);
      setAnalyzing(false);
    }
  };

  const handleResumeUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('resume', file);
    try {
      await api.post('/student/resume', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResume(true);
      setResumeFile(file.name);
      toast.success('Resume uploaded!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleLinkedinPdfUpload = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please upload a PDF file exported from LinkedIn');
      return;
    }
    setUploadingPdf(true);
    const fd = new FormData();
    fd.append('linkedinPdf', file);
    try {
      await api.post('/student/linkedin-pdf', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setLinkedinPdf(true);
      setLinkedinPdfFile(file.name);
      toast.success('LinkedIn PDF uploaded successfully!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'LinkedIn PDF upload failed');
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files[0];
    if (file) handleResumeUpload(file);
  };

  return (
    <div className="anim-fade-up">
      <div className="page-header">
        <h1 className="page-title">My Profile</h1>
        <p className="page-subtitle">Provide your resume and professional links for analysis</p>
      </div>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        {/* Resume Upload */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Resume <span style={{ color: 'var(--red)', fontSize: '0.75rem', marginLeft: 4 }}>required</span></span>
            {resume && <span className="badge badge-verified"><CheckCircle size={11} /> Uploaded</span>}
          </div>

          <div
            className={`upload-zone ${drag ? 'drag' : ''}`}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={handleDrop}
            onClick={(e) => {
              if (e.target.tagName !== 'INPUT') {
                fileRef.current?.click();
              }
            }}
            style={{ cursor: 'pointer' }}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx"
              style={{ display: 'none' }}
              onClick={e => e.stopPropagation()}
              onChange={e => {
                if (e.target.files && e.target.files[0]) {
                  handleResumeUpload(e.target.files[0]);
                }
              }}
            />
            {uploading ? (
              <><div className="big-spinner" style={{ margin: '0 auto 12px' }} /><p>Uploading resume…</p></>
            ) : (
              <>
                <div className="upload-zone-icon">📄</div>
                <div className="upload-zone-title" style={{ fontWeight: 600 }}>
                  {resume ? (resumeFile || 'Resume uploaded') : 'Drop your resume here or click to browse'}
                </div>
                <div className="upload-zone-sub" style={{ marginBottom: 12 }}>Supported formats: PDF, DOCX · Max 10 MB</div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileRef.current?.click();
                  }}
                  style={{ marginTop: 4, padding: '6px 14px', fontSize: '0.82rem' }}
                >
                  {resume ? 'Replace Resume File' : 'Choose Resume File'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* LinkedIn PDF Export Upload (Optional Fallback) */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">LinkedIn Profile PDF <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: 4 }}>optional</span></span>
            {linkedinPdf && <span className="badge badge-verified"><CheckCircle size={11} /> Attached</span>}
          </div>

          <div
            className="upload-zone"
            onClick={() => linkedinPdfRef.current.click()}
          >
            <input
              ref={linkedinPdfRef}
              type="file"
              accept=".pdf"
              style={{ display: 'none' }}
              onClick={e => e.stopPropagation()}
              onChange={e => handleLinkedinPdfUpload(e.target.files[0])}
            />
            {uploadingPdf ? (
              <><div className="big-spinner" style={{ margin: '0 auto 12px' }} /><p>Uploading…</p></>
            ) : (
              <>
                <div className="upload-zone-icon">💼</div>
                <div className="upload-zone-title">
                  {linkedinPdf ? (linkedinPdfFile || 'LinkedIn PDF uploaded — click to replace') : 'Upload exported LinkedIn PDF (optional)'}
                </div>
                <div className="upload-zone-sub">Tip: Profile → More → Save to PDF · Max 15 MB</div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Professional Links */}
      <form onSubmit={handleSave}>
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <span className="card-title">Professional Links</span>
          </div>

          <div className="grid-2">
            {FIELDS.map(({ name, label, icon: Icon, placeholder, required, hint }) => (
              <div className="form-group" key={name} style={{ marginBottom: 0 }}>
                <label className="form-label">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Icon size={13} />
                    {label}
                    {required && <span className="required">*</span>}
                  </span>
                </label>
                <input
                  className="form-input"
                  type="url"
                  name={name}
                  placeholder={placeholder}
                  value={form[name]}
                  onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
                  required={required}
                />
                <span className="form-hint">{hint}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Target Role */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <span className="card-title">Target Role</span>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">
              <Briefcase size={13} style={{ display: 'inline', marginRight: 5 }} />
              What role are you targeting?
            </label>
            <input
              className="form-input"
              type="text"
              placeholder="e.g. Software Engineer, UI/UX Designer, Data Analyst"
              value={form.targetRole}
              onChange={e => setForm(f => ({ ...f, targetRole: e.target.value }))}
            />
            <span className="form-hint">
              Leave blank and the system will suggest roles based on your evidence.
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn btn-secondary btn-lg" type="submit" disabled={saving || uploading}>
          {saving ? <><Loader2 size={17} /> Saving…</> : <><Save size={17} /> Save Profile</>}
        </button>
        <button className="btn btn-primary btn-lg" type="button" onClick={e => handleSave(e, true)} disabled={saving || uploading || analyzing}>
          {analyzing ? <><Loader2 size={17} className="spin-icon" /> Analyzing…</> : <><CheckCircle size={17} /> Save &amp; Analyze</>}
        </button>
        </div>
      </form>
    </div>
  );
}
