import { useState, useRef } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { X, Upload, Link as LinkIcon, FileText, CheckCircle2, AlertCircle, Loader2, Sparkles, Globe, FileUp } from 'lucide-react';

export function AddProofModal({ claim, analysisId, studentId, onClose, onSuccess }) {
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'url'
  const [files, setFiles] = useState([]);
  const [url, setUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files);
      setFiles(prev => [...prev, ...selected]);
    }
  };

  const removeFile = (idx) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (activeTab === 'upload' && files.length === 0) {
      setErrorMessage('Please select at least one proof file to upload.');
      return;
    }
    if (activeTab === 'url' && (!url || !url.trim())) {
      setErrorMessage('Please enter a valid proof URL (e.g. LeetCode, GitHub, portfolio, certificate).');
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('claim', claim.skill || claim.claim || claim);
    if (claim.id || claim._id) formData.append('claimId', claim.id || claim._id);
    if (analysisId) formData.append('analysisId', analysisId);
    if (studentId) formData.append('studentId', studentId);

    if (url && url.trim()) {
      formData.append('url', url.trim());
    }

    files.forEach(file => {
      formData.append('proofFile', file);
    });

    try {
      const { data } = await api.post('/analysis/add-proof', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const scoreDelta = data.score_change;
      const scoreMsg = scoreDelta > 0 
        ? `Readiness score increased by +${scoreDelta} pts! (${data.previous_score} → ${data.new_score})` 
        : `Proof evaluated. Score: ${data.new_score}`;

      toast.success(
        <div>
          <strong>Proof Accepted!</strong>
          <div style={{ fontSize: '0.84rem', marginTop: 4 }}>{scoreMsg}</div>
        </div>,
        { duration: 6000 }
      );

      if (onSuccess) {
        onSuccess(data);
      }
      onClose();
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.details || err.message || 'Failed to submit proof';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="modal-overlay" 
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(5, 7, 12, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px'
      }}
    >
      <div 
        className="anim-fade-up"
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: '520px',
          boxShadow: 'var(--shadow-lg), 0 0 30px rgba(66, 234, 255, 0.12)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 22px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="badge badge-proof" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                Add Evidence
              </span>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                {claim.skill || claim}
              </h3>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Supply verifiable proof to strengthen this claim.
            </p>
          </div>
          <button 
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 'var(--radius-sm)'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 22px' }}>
          {/* Mode Selector Tabs */}
          <div style={{
            display: 'flex',
            gap: 8,
            background: 'var(--bg-base)',
            padding: 4,
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            marginBottom: 16
          }}>
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 'var(--radius-xs)',
                border: 'none',
                background: activeTab === 'upload' ? 'var(--bg-card)' : 'transparent',
                color: activeTab === 'upload' ? 'var(--cyan)' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.84rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                boxShadow: activeTab === 'upload' ? 'var(--shadow-sm)' : 'none'
              }}
            >
              <FileUp size={15} /> Upload File / PDF
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('url')}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 'var(--radius-xs)',
                border: 'none',
                background: activeTab === 'url' ? 'var(--bg-card)' : 'transparent',
                color: activeTab === 'url' ? 'var(--cyan)' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.84rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                boxShadow: activeTab === 'url' ? 'var(--shadow-sm)' : 'none'
              }}
            >
              <Globe size={15} /> Website / Profile URL
            </button>
          </div>

          {/* Tab 1: Upload File */}
          {activeTab === 'upload' && (
            <div>
              <div 
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed var(--border-strong)',
                  borderRadius: 'var(--radius)',
                  padding: '24px 16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: 'rgba(255, 255, 255, 0.01)',
                  transition: 'var(--transition)'
                }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.length) {
                    setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
                  }
                }}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  multiple 
                  accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg"
                  style={{ display: 'none' }} 
                />
                <Upload size={28} style={{ color: 'var(--horizon-cyan)', marginBottom: 8 }} />
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  Click or drag files here to upload
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Accepted: PDF, DOC/DOCX, TXT, or images (Certificate, project report, etc.)
                </div>
              </div>

              {/* Selected Files List */}
              {files.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {files.map((file, idx) => (
                    <div 
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: 'var(--bg-card)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '0.82rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                        <FileText size={15} style={{ color: 'var(--cyan)', flexShrink: 0 }} />
                        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {file.name}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                          ({(file.size / 1024).toFixed(0)} KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: 4
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: URL */}
          {activeTab === 'url' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>
                Evidence URL
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="url"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://leetcode.com/u/yourname or GitHub / Project URL"
                  className="input"
                  style={{
                    width: '100%',
                    paddingLeft: '36px',
                    fontSize: '0.88rem'
                  }}
                />
                <LinkIcon 
                  size={16} 
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)'
                  }} 
                />
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.4 }}>
                Examples: LeetCode profile URL, GitHub repository, live deployed project, or online certificate URL.
              </div>
            </div>
          )}

          {/* Error display */}
          {errorMessage && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 14,
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--red-bg)',
              border: '1px solid var(--red)',
              color: 'var(--red-light)',
              fontSize: '0.82rem'
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 10,
            marginTop: 20,
            paddingTop: 16,
            borderTop: '1px solid var(--border-subtle)'
          }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary btn-sm"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={isSubmitting}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={15} className="spin-icon" />
                  Extracting & Re-evaluating…
                </>
              ) : (
                <>
                  <Sparkles size={15} />
                  Submit & Re-analyze
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
