import React, { useState } from 'react';
import { 
  Globe, FolderGit2, Code, Briefcase, GraduationCap, 
  ExternalLink, AlertCircle, 
  CheckCircle, FileText, ChevronDown, ChevronUp, Sparkles, Mail, MapPin, Award
} from 'lucide-react';

const GithubIcon = ({ size = 14, style }) => (
  <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path>
    <path d="M9 18c-4.51 2-5-2-7-2"></path>
  </svg>
);

const LinkedinIcon = ({ size = 14, style }) => (
  <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
    <rect x="2" y="9" width="4" height="12"></rect>
    <circle cx="4" cy="4" r="2"></circle>
  </svg>
);

const TwitterIcon = ({ size = 14, style }) => (
  <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path>
  </svg>
);

export function PortfolioBreakdown({ data, url }) {
  const [showPlainText, setShowPlainText] = useState(false);

  const isExtracted = Boolean(
    data && 
    (data.extracted === true || 
     (data.projects && data.projects.length > 0) || 
     data.profile?.name || 
     (data.skills?.all && data.skills.all.length > 0) || 
     data.plainTextSummary ||
     data.structured?.projects?.length > 0)
  );

  if (!data || !isExtracted) {
    return (
      <div className="card">
        <div className="empty-state">
          <AlertCircle size={44} style={{ color: 'var(--yellow)' }} />
          <h3>Portfolio Website Data Not Available</h3>
          <p style={{ maxWidth: 500, margin: '8px auto 16px' }}>
            {data?.reason || data?.error || 'Add your portfolio website URL in your profile settings to scrape and extract your projects, skills, and work.'}
          </p>
          {url && (
            <a 
              href={url} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="btn btn-secondary btn-sm"
            >
              <ExternalLink size={14} /> Open Portfolio URL
            </a>
          )}
        </div>
      </div>
    );
  }

  const profile = data.profile || data.structured?.profile || {};
  const projects = data.projects || data.structured?.projects || [];
  const skills = data.skills || data.structured?.skills || {};
  const experience = data.experience || data.structured?.experience || [];
  const education = data.education || data.structured?.education || [];
  const certifications = data.certifications || data.structured?.certifications || [];
  const achievements = data.achievements || data.structured?.achievements || [];
  const plainTextSummary = data.plainTextSummary || data.rawMarkdown || '';
  const sourceQuality = data.sourceQuality || {};
  const method = data.method || 'jina_reader';

  const allSkills = Array.isArray(skills.all) ? skills.all : (Array.isArray(skills) ? skills : []);

  return (
    <div className="anim-fade">
      {/* Header Profile Card */}
      <div className="card" style={{ marginBottom: 20, background: 'linear-gradient(135deg, rgba(66, 114, 255, 0.1) 0%, rgba(22, 26, 34, 0.95) 100%)', border: '1px solid rgba(66, 234, 255, 0.24)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ 
              width: 52, height: 52, borderRadius: 12, 
              background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(66, 114, 255, 0.3)'
            }}>
              <Globe size={28} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '1.3rem' }}>{profile.name || 'Portfolio Developer'}</h3>
                <span className="badge badge-accent" style={{ fontSize: '0.75rem' }}>
                  Scraped via {method.replace('+', ' · ')}
                </span>
              </div>

              {profile.title && (
                <div style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', marginTop: 4, fontWeight: 500 }}>
                  {profile.title}
                </div>
              )}

              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 6, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                {profile.location && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <MapPin size={13} /> {profile.location}
                  </span>
                )}
                {profile.email && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Mail size={13} /> {profile.email}
                  </span>
                )}
                <span>📦 {projects.length} projects</span>
                <span>⚡ {allSkills.length} skills</span>
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
                <ExternalLink size={14} /> Visit Site
              </a>
            )}
            {(profile.socialLinks || []).map((link, idx) => {
              const isGithub = link.platform === 'github' || link.url.includes('github');
              const isLinkedin = link.platform === 'linkedin' || link.url.includes('linkedin');
              const isTwitter = link.platform === 'twitter' || link.url.includes('twitter') || link.url.includes('x.com');
              return (
                <a
                  key={idx}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  {isGithub && <GithubIcon size={13} />}
                  {isLinkedin && <LinkedinIcon size={13} />}
                  {isTwitter && <TwitterIcon size={13} />}
                  {!isGithub && !isLinkedin && !isTwitter && <ExternalLink size={13} />}
                  {link.platform}
                </a>
              );
            })}
          </div>
        </div>

        {profile.bio && (
          <p style={{ marginTop: 14, fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            {profile.bio}
          </p>
        )}
      </div>

      {/* Featured Projects Grid */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <FolderGit2 size={18} style={{ color: 'var(--accent-light)' }} />
          Showcased Projects ({projects.length})
        </div>

        {projects.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No individual project cards detected.</div>
        ) : (
          <div className="grid-2">
            {projects.map((proj, idx) => (
              <div 
                key={idx}
                style={{
                  background: 'var(--bg-surface)',
                  padding: 16,
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                    <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>
                      {proj.name}
                    </h4>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {proj.githubUrl && (
                        <a 
                          href={proj.githubUrl} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '3px 7px' }}
                          title="View Repository"
                        >
                          <GithubIcon size={12} />
                        </a>
                      )}
                      {proj.liveUrl && (
                        <a 
                          href={proj.liveUrl} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="btn btn-primary btn-sm"
                          style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                          title="Live Demo"
                        >
                          <ExternalLink size={12} /> Demo
                        </a>
                      )}
                    </div>
                  </div>

                  {proj.description && (
                    <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>
                      {proj.description}
                    </p>
                  )}
                </div>

                <div>
                  {proj.technologies?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                      {proj.technologies.map((t, i) => (
                        <span key={i} className="tag" style={{ fontSize: '0.72rem' }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  {proj.highlights?.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: '0.76rem', color: 'var(--green)' }}>
                      {proj.highlights.map((h, i) => (
                        <div key={i}>✓ {h}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Categorized Skills Section */}
      {allSkills.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Code size={18} style={{ color: 'var(--yellow)' }} />
            Extracted Skills & Tech Stack ({allSkills.length})
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            {skills.languages?.length > 0 && (
              <div style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Languages</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {skills.languages.map((s, i) => <span key={i} className="badge badge-accent">{s}</span>)}
                </div>
              </div>
            )}

            {skills.frameworks?.length > 0 && (
              <div style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Frameworks & Libraries</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {skills.frameworks.map((s, i) => <span key={i} className="badge badge-green">{s}</span>)}
                </div>
              </div>
            )}

            {skills.databases?.length > 0 && (
              <div style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Databases & Storage</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {skills.databases.map((s, i) => <span key={i} className="badge badge-partial">{s}</span>)}
                </div>
              </div>
            )}

            {skills.tools?.length > 0 && (
              <div style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Tools & Cloud</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {skills.tools.map((s, i) => <span key={i} className="badge" style={{ background: 'var(--bg-card)' }}>{s}</span>)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Experience & Education Grid */}
      {(experience.length > 0 || education.length > 0) && (
        <div className="grid-2" style={{ marginBottom: 20 }}>
          {experience.length > 0 && (
            <div className="card">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Briefcase size={18} style={{ color: 'var(--blue)' }} /> Experience Listed ({experience.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {experience.map((exp, idx) => (
                  <div key={idx} style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{exp.role}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--accent-light)' }}>
                      {exp.company} {exp.duration ? `· ${exp.duration}` : ''}
                    </div>
                    {exp.description && (
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                        {exp.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {education.length > 0 && (
            <div className="card">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <GraduationCap size={18} style={{ color: 'var(--yellow)' }} /> Education ({education.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {education.map((edu, idx) => (
                  <div key={idx} style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{edu.institution}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {edu.degree} {edu.year ? `· ${edu.year}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Plain-Text Evidence Format Preview (for Future AI API Consumption) */}
      {plainTextSummary && (
        <div className="card">
          <div 
            onClick={() => setShowPlainText(!showPlainText)} 
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          >
            <div className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={18} style={{ color: 'var(--purple)' }} />
              <Sparkles size={14} style={{ color: 'var(--yellow)' }} />
              Plain-Text AI Evaluation Format Preview
            </div>
            {showPlainText ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>

          {showPlainText && (
            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                This standardized plain text is serialized for fast, token-efficient AI prompt ingestion in CareerLens evaluations:
              </p>
              <pre style={{ 
                background: 'var(--bg-base)', 
                padding: 14, 
                borderRadius: 8, 
                fontSize: '0.8rem', 
                color: 'var(--text-secondary)', 
                overflowX: 'auto',
                border: '1px solid var(--border)',
                whiteSpace: 'pre-wrap'
              }}>
                {plainTextSummary}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
