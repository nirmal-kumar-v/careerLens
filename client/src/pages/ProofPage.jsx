import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { Upload, FileText, Loader2, Clock, CheckCircle, XCircle } from 'lucide-react';

const PROOF_TYPES = [
  { value: 'project_link', label: 'Project Link' },
  { value: 'repository', label: 'Repository' },
  { value: 'screenshot', label: 'Screenshot' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'demo', label: 'Demo Video/Link' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'other', label: 'Other' },
];

const STATUS_ICONS = {
  pending: { icon: Clock, color: 'var(--yellow)', label: 'Pending Review' },
  reviewing: { icon: Clock, color: 'var(--blue)', label: 'Under Review' },
  accepted: { icon: CheckCircle, color: 'var(--green)', label: 'Accepted' },
  rejected: { icon: XCircle, color: 'var(--red)', label: 'Rejected' },
};

export default function ProofPage() {
  const fileRef = useRef();
  const [searchParams] = useSearchParams();
  const requestedClaim = searchParams.get('claim') || '';
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ claim: requestedClaim, proofType: '', proofData: '' });
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(Boolean(requestedClaim));

  const load = () => {
    api.get('/proof/')
      .then(r => setSubmissions(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.claim.trim() || !form.proofType) {
      return toast.error('Claim and proof type are required');
    }
    setSubmitting(true);
    const fd = new FormData();
    fd.append('claim', form.claim);
    fd.append('proofType', form.proofType);
    fd.append('proofData', form.proofData);
    if (file) fd.append('proofFile', file);

    try {
      await api.post('/proof/submit', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Proof submitted!');
      setForm({ claim: '', proofType: '', proofData: '' });
      setFile(null);
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="anim-fade-up">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Proof of Work</h1>
          <p className="page-subtitle">Submit evidence for claims that need verification</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
          <Upload size={16} /> Submit Proof
        </button>
      </div>

      {/* Submit form */}
      {showForm && (
        <div className="card anim-fade-up" style={{ marginBottom: 24 }}>
          <div className="card-title" style={{ marginBottom: 20 }}>New Proof Submission</div>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Claim to Prove <span className="required">*</span></label>
              <input
                className="form-input"
                placeholder="e.g. Java — used in full-stack project"
                value={form.claim}
                onChange={e => setForm(f => ({ ...f, claim: e.target.value }))}
                required
              />
              <span className="form-hint">Which specific skill or claim are you providing evidence for?</span>
            </div>

            <div className="form-group">
              <label className="form-label">Proof Type <span className="required">*</span></label>
              <select className="form-select" value={form.proofType} onChange={e => setForm(f => ({ ...f, proofType: e.target.value }))} required>
                <option value="">— Select type —</option>
                {PROOF_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Link or Description</label>
              <input
                className="form-input"
                placeholder="https://github.com/username/project  or describe your evidence"
                value={form.proofData}
                onChange={e => setForm(f => ({ ...f, proofData: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Attach File (optional)</label>
              <div
                className="upload-zone"
                style={{ padding: '20px', cursor: 'pointer' }}
                onClick={() => fileRef.current.click()}
              >
                <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={e => setFile(e.target.files[0])} />
                <div style={{ fontSize: '0.875rem' }}>
                  {file ? `📎 ${file.name}` : 'Click to attach a file (screenshot, certificate, PDF, etc.)'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? <><Loader2 size={16} /> Submitting…</> : 'Submit Proof'}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Submissions list */}
      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : submissions.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <FileText size={44} />
            <h3>No proof submissions</h3>
            <p>When a claim needs verification, submit a project link, repository, or other work sample for review.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {submissions.map(s => {
            const si = STATUS_ICONS[s.status] || STATUS_ICONS.pending;
            const Icon = si.icon;
            return (
              <div key={s._id} className="card" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{s.claim}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                      Type: <span className="tag">{s.proofType.replace(/_/g, ' ')}</span>
                    </div>
                    {s.proofData && <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 4 }}>{s.proofData}</div>}
                    {s.reviewResult?.explanation && (
                      <div className="alert alert-info" style={{ marginTop: 8 }}>
                        <span style={{ fontSize: '0.8rem' }}>{s.reviewResult.explanation}</span>
                      </div>
                    )}
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6 }}>
                      Submitted: {new Date(s.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: si.color, fontSize: '0.8rem', fontWeight: 600, flexShrink: 0 }}>
                    <Icon size={15} />
                    {si.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
