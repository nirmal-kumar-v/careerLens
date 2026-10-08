import React, { useState } from 'react';
import { 
  Briefcase, GraduationCap, Award, 
  Code, Globe, CheckCircle, ExternalLink, AlertCircle, MapPin, Building,
  Upload, FileText, Check, AlertTriangle, ShieldCheck, ChevronDown, ChevronUp
} from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';

export function LinkedInBreakdown({ data, url, onPdfUploaded }) {
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [showEvidenceList, setShowEvidenceList] = useState(false);

  const handlePdfUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please select a PDF file exported from LinkedIn');
      return;
    }

    const formData = new FormData();
    formData.append('linkedinPdf', file);

    setUploadingPdf(true);
    const toastId = toast.loading('Uploading & processing LinkedIn PDF…');
    try {
      await api.post('/student/linkedin-pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('LinkedIn PDF uploaded successfully! Run analysis to refresh.', { id: toastId });
      if (onPdfUploaded) onPdfUploaded();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to upload LinkedIn PDF', { id: toastId });
    } finally {
      setUploadingPdf(false);
    }
  };

  if (!data || !data.extracted) {
    return (
      <div className="card">
        <div className="empty-state">
          <AlertCircle size={44} style={{ color: 'var(--yellow)' }} />
          <h3>LinkedIn Profile Evidence Not Available</h3>
          <p style={{ maxWidth: 520, margin: '8px auto 16px' }}>
            {data?.reason || 'LinkedIn profiles often require authentication for full public access. Connect your profile link or upload your LinkedIn Profile PDF.'}
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            {url && (
              <a 
                href={url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="btn btn-secondary btn-sm"
              >
                <ExternalLink size={14} /> Open Public Link
              </a>
            )}

            <label className="btn btn-primary btn-sm" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Upload size={14} />
              {uploadingPdf ? 'Processing PDF…' : 'Upload LinkedIn PDF (Export)'}
              <input 
                type="file" 
                accept=".pdf" 
                onChange={handlePdfUpload} 
                disabled={uploadingPdf} 
                style={{ display: 'none' }} 
              />
            </label>
          </div>

          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 14 }}>
            💡 Tip: On your LinkedIn profile, click <strong>More</strong> → <strong>Save to PDF</strong> to download your official profile.
          </div>
        </div>
      </div>
    );
  }

  const {
    profile = {},
    name = profile.name,
    headline = profile.headline,
    location = profile.location,
    about = profile.about,
    currentRole,
    currentCompany,
    connections,
    experience = [],
    education = [],
    skills = [],
    certifications = [],
    projects = [],
    languages = [],
    honorsAndAwards = [],
    volunteerExperience = [],
    evidence = [],
    sourceQuality = {},
    warnings = []
  } = data;

  const isAiUnavailable = warnings?.some(w => w.includes('AI structuring')) || data.method?.includes('deterministic');
  const isPartial = (experience.length === 0 && education.length === 0 && skills.length < 3) || sourceQuality.contentLength < 300;

  return (
    <div className="anim-fade">
      {/* Status Banner */}
      {isAiUnavailable ? (
        <div className="alert alert-warning" style={{ marginBottom: 18 }}>
          <AlertTriangle size={18} />
          <div>
            <strong>LinkedIn Evidence Extracted (Deterministic Mode)</strong>
            <div style={{ fontSize: '0.82rem', marginTop: 2 }}>
              External AI structuring was temporarily busy. All observable profile details and skills have been captured directly from your retrieved LinkedIn evidence.
            </div>
          </div>
        </div>
      ) : isPartial ? (
        <div className="alert alert-info" style={{ marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <AlertCircle size={18} />
            <div>
              <strong>LinkedIn Publicly Visible Summary Captured</strong>
              <div style={{ fontSize: '0.82rem' }}>
                Some sections are protected by LinkedIn's sign-in wall. For 100% complete analysis of your past roles and certifications, upload your LinkedIn PDF.
              </div>
            </div>
          </div>
          <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <Upload size={13} /> {uploadingPdf ? 'Uploading…' : 'Upload Profile PDF'}
            <input type="file" accept=".pdf" onChange={handlePdfUpload} disabled={uploadingPdf} style={{ display: 'none' }} />
          </label>
        </div>
      ) : (
        <div className="alert alert-success" style={{ marginBottom: 18 }}>
          <ShieldCheck size={18} />
          <div>
            <strong>✓ LinkedIn Analyzed & Verified</strong>
            <div style={{ fontSize: '0.82rem', marginTop: 2 }}>
              {experience.length} experience entries · {skills.length} skills · {education.length} education records · {certifications.length} certifications
            </div>
          </div>
        </div>
      )}

      {/* Header Profile Card */}
      <div className="card" style={{ marginBottom: 20, background: 'linear-gradient(135deg, rgba(66, 234, 255, 0.08) 0%, rgba(22, 26, 34, 0.9) 100%)', border: '1px solid rgba(66, 234, 255, 0.22)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ 
              width: 52, height: 52, borderRadius: 12, 
              background: 'var(--horizon-blue)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(66, 114, 255, 0.3)'
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="#ffffff">
                <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
              </svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.3rem' }}>{name || 'LinkedIn Professional'}</h3>
              {headline && (
                <div style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', marginTop: 4, fontWeight: 500 }}>
                  {headline}
                </div>
              )}
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 6, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                {location && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <MapPin size={13} /> {location}
                  </span>
                )}
                {currentCompany && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Building size={13} /> {currentRole ? `${currentRole} at ` : ''}{currentCompany}
                  </span>
                )}
                {connections && <span>👥 {connections} connections</span>}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {url && (
              <a 
                href={url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="btn btn-secondary btn-sm"
              >
                <ExternalLink size={14} /> Open Link
              </a>
            )}
            <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
              <Upload size={13} /> {uploadingPdf ? 'Processing…' : 'Upload PDF'}
              <input type="file" accept=".pdf" onChange={handlePdfUpload} disabled={uploadingPdf} style={{ display: 'none' }} />
            </label>
          </div>
        </div>
      </div>

      {/* Summary / About */}
      {about && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title" style={{ marginBottom: 10 }}>About / Professional Summary</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
            {about}
          </p>
        </div>
      )}

      {/* Experience Section */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Briefcase size={18} style={{ color: 'var(--accent-light)' }} /> Work Experience ({experience.length})
        </div>
        {experience.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No work experience records observed in public profile snippets.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {experience.map((exp, idx) => (
              <div 
                key={idx} 
                style={{ 
                  background: 'var(--bg-surface)', 
                  padding: 16, 
                  borderRadius: 10, 
                  border: '1px solid var(--border)' 
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {exp.role || 'Position'}
                    </div>
                    <div style={{ fontSize: '0.88rem', color: 'var(--accent-light)', fontWeight: 500, marginTop: 2 }}>
                      {exp.company} {exp.location ? `· ${exp.location}` : ''}
                    </div>
                  </div>
                  {exp.duration && (
                    <span className="badge badge-accent" style={{ fontSize: '0.75rem' }}>
                      {exp.duration}
                    </span>
                  )}
                </div>

                {exp.description && (
                  <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5 }}>
                    {exp.description}
                  </p>
                )}

                {exp.skills?.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                    {exp.skills.map((s, i) => (
                      <span key={i} className="badge badge-green" style={{ fontSize: '0.72rem' }}>
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Two Column Grid: Education & Certifications */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* Education */}
        <div className="card">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <GraduationCap size={18} style={{ color: 'var(--yellow)' }} /> Education ({education.length})
          </div>
          {education.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No education records observed in public profile.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {education.map((edu, idx) => (
                <div 
                  key={idx}
                  style={{
                    background: 'var(--bg-surface)',
                    padding: 12,
                    borderRadius: 8,
                    border: '1px solid var(--border)'
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{edu.institution || 'University'}</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                    {edu.degree} {edu.fieldOfStudy ? `in ${edu.fieldOfStudy}` : ''}
                  </div>
                  {(edu.startYear || edu.endYear || edu.grade) && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      {edu.startYear && edu.endYear ? `${edu.startYear} – ${edu.endYear}` : (edu.endYear || '')}
                      {edu.grade ? ` · Grade: ${edu.grade}` : ''}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Certifications & Licenses */}
        <div className="card">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Award size={18} style={{ color: 'var(--green)' }} /> Certifications ({certifications.length})
          </div>
          {certifications.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No certifications observed.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {certifications.map((cert, idx) => (
                <div 
                  key={idx}
                  style={{
                    background: 'var(--bg-surface)',
                    padding: 12,
                    borderRadius: 8,
                    border: '1px solid var(--border)'
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{cert.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                    {cert.issuer} {cert.issueDate ? `· ${cert.issueDate}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Skills Extracted */}
      {skills.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Code size={18} style={{ color: 'var(--blue)' }} /> Observed Skills & Technologies ({skills.length})
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {skills.map((s, idx) => (
              <span 
                key={idx} 
                className="badge badge-accent" 
                style={{ fontSize: '0.8rem', padding: '4px 10px' }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Evidence Explorer Accordion */}
      {evidence.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div 
            onClick={() => setShowEvidenceList(!showEvidenceList)} 
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          >
            <div className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={18} style={{ color: 'var(--purple)' }} />
              Observable Evidence Items ({evidence.length})
            </div>
            {showEvidenceList ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>

          {showEvidenceList && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
              {evidence.map((ev, i) => (
                <div 
                  key={i} 
                  style={{ 
                    background: 'var(--bg-surface)', 
                    padding: '8px 12px', 
                    borderRadius: 6, 
                    border: '1px solid var(--border)',
                    fontSize: '0.82rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <strong>{ev.skill || ev.claim}</strong>
                    <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{ev.evidence || ev.role}</span>
                  </div>
                  <span className="badge badge-verified" style={{ fontSize: '0.7rem' }}>
                    {Math.round((ev.confidence || 0.9) * 100)}% confidence
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
