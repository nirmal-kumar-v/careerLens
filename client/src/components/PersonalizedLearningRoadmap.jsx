import React from 'react';
import { 
  Play, ExternalLink, BookOpen, Clock, CheckCircle2, 
  Sparkles, Target, ArrowRight, Video, FileCode, CheckCircle,
  FolderGit2, TrendingUp, AlertTriangle, Lightbulb
} from 'lucide-react';

export function PersonalizedLearningRoadmap({ analysis, mode = 'all' }) {
  if (!analysis) return (
    <div className="card">
      <div className="empty-state">
        <Sparkles size={40} style={{ color: 'var(--horizon-cyan)', marginBottom: 12 }} />
        <h3>No Analysis Data</h3>
        <p>Please run or select an analysis to view recommendations and roadmap.</p>
      </div>
    </div>
  );

  const {
    alreadyStrongIn = [],
    personSpecificGaps = [],
    learningRecommendations = [],
    roadmapMilestones = [],
    finalLearningSummary = {},
    nextBestAction = '',
    overallProfile = '',
    scores = {},
    roadmap = {},
    recommendations = {},
    recommendationObject = null
  } = analysis;

  const overallScore = scores.overall || analysis.scores?.overall || analysis.jobReadinessScore || 0;
  const isScoreAbove90 = overallScore >= 90;
  const recObj = recommendationObject || analysis.recommendationObject || analysis.evaluation?.recommendationObject || {};
  
  // Learning needed decision logic based on score threshold
  const learningNeeded = recObj.learning_needed !== undefined 
    ? recObj.learning_needed 
    : (isScoreAbove90 ? false : true);
  const isOptionalAdvancement = recObj.recommendation_type === 'optional_advancement' || isScoreAbove90;

  const strongSkills = recObj.already_strong_in?.length > 0
    ? recObj.already_strong_in
    : (alreadyStrongIn.length > 0 
        ? alreadyStrongIn 
        : (analysis.roleAnalysis?.strengths || (analysis.claimValidation || []).filter(c => c.status === 'verified').map(c => c.skill)));

  const rawGaps = personSpecificGaps.length > 0
    ? personSpecificGaps
    : (recObj.gap ? [{
        gap: recObj.gap,
        why_it_matters_for_this_candidate: recObj.why,
        priority: isScoreAbove90 ? 'optional' : 'high',
        evidence_from_candidate: recObj.candidate_evidence || [],
        recommended_action: recObj.practical_application || ''
      }] : (analysis.roleAnalysis?.gaps || []).map(g => ({
        gap: typeof g === 'string' ? g : (g.gap || g.title || 'Skill gap'),
        why_it_matters_for_this_candidate: typeof g === 'string' ? 'High priority requirement for target role alignment.' : (g.why || g.reason || 'High priority requirement for target role alignment.'),
        priority: 'high',
        evidence_from_candidate: ['Missing verified project evidence in connected profiles'],
        recommended_action: 'Build and deploy a proof project to GitHub'
      })));

  // Fallback gaps from unsupported/partial claims if rawGaps is still empty and score < 90
  const gaps = rawGaps.length > 0 
    ? rawGaps 
    : ((analysis.claimValidation || []).filter(c => c.status === 'requires_proof' || c.status === 'partially_supported').slice(0, 4).map(c => ({
        gap: `Demonstrate ${c.skill} implementation`,
        why_it_matters_for_this_candidate: c.explanation || `Resume lists ${c.skill}, but observable code evidence was not detected.`,
        priority: c.status === 'requires_proof' ? 'high' : 'medium',
        evidence_from_candidate: [c.explanation || 'Claimed without matching repository code'],
        recommended_action: `Deploy a project or add verified coding evidence for ${c.skill}`
      })));

  // YouTube / Learning recommendations
  const rawLearningItems = learningRecommendations.length > 0
    ? learningRecommendations
    : (recObj.youtube ? [{
        skill_gap: recObj.gap,
        learning_goal: recObj.learning_goal,
        why_this_resource: recObj.why,
        estimated_time: recObj.estimated_learning_time || '2 hours',
        youtube_resource: recObj.youtube,
        authoritative_doc: recObj.other_resources?.[0] || null
      }] : (recommendations.courses || []).map(c => ({
        skill_gap: c.gap || c.title,
        learning_goal: c.title,
        why_this_resource: c.reason,
        estimated_time: '2-3 hours',
        youtube_resource: c.url ? {
          title: c.title,
          youtube_url: c.url,
          channel_name: 'Recommended Learning',
          thumbnail_url: null,
          duration: '~1-2h'
        } : null
      })));

  // If top single youtube video is attached on recObj, ensure it is represented
  if (recObj.youtube && !rawLearningItems.some(i => i.youtube_resource?.video_id === recObj.youtube.video_id)) {
    rawLearningItems.unshift({
      skill_gap: recObj.gap || 'Target Skill Focus',
      learning_goal: recObj.learning_goal || 'Master practical implementation',
      why_this_resource: recObj.why || 'Curated video tutorial matching your verified profile gaps.',
      estimated_time: recObj.estimated_learning_time || '2 hours',
      youtube_resource: recObj.youtube,
      authoritative_doc: recObj.other_resources?.[0] || null
    });
  }

  const learningItems = rawLearningItems;

  const rawMilestones = roadmapMilestones.length > 0
    ? roadmapMilestones
    : (recObj.roadmap?.steps?.length > 0 ? recObj.roadmap.steps.map((s, i) => ({
        phase: s.step || i + 1,
        title: s.title || s.action,
        goal: s.purpose || s.reason || 'Address skill gap',
        estimated_total_time: recObj.roadmap.estimated_total_time || s.estimated_time || '4 hours',
        tasks: s.tasks || [
          {
            task: s.title || s.action,
            description: s.purpose || s.reason,
            estimated_time: '2 hours',
            type: 'build',
            completion_criteria: 'Deploy or publish observable proof to GitHub'
          }
        ],
        milestone: s.milestone || `Completed ${s.title || s.action}`,
        completion_criteria: ['Working implementation deployed with documentation']
      })) : (roadmap.steps || []).map((s, i) => ({
        phase: i + 1,
        title: s.action || s.title || `Phase ${i + 1}`,
        goal: s.reason || s.milestone || 'Enhance profile readiness',
        estimated_total_time: s.estimatedImpact ? `+${s.estimatedImpact} pts` : '2-4 hours',
        tasks: [
          {
            task: s.action || s.title,
            description: s.reason || 'Demonstrate hands-on implementation',
            estimated_time: '2-3h',
            type: 'build',
            completion_criteria: 'Deploy or publish observable proof to GitHub'
          }
        ],
        milestone: s.milestone || 'Artifact published',
        completion_criteria: ['Working implementation deployed with documentation']
      })));

  // Fallback milestones if still empty but gaps exist
  const milestones = rawMilestones.length > 0
    ? rawMilestones
    : (gaps.length > 0 ? gaps.slice(0, 3).map((g, i) => ({
        phase: i + 1,
        title: `Build & Validate ${g.gap}`,
        goal: g.why_it_matters_for_this_candidate || 'Address evidence gap',
        reason: g.why_it_matters_for_this_candidate || 'Critical for target role readiness',
        estimated_total_time: '3-5 hours',
        tasks: [
          {
            task: `Complete hands-on implementation for ${g.gap}`,
            description: g.recommended_action || 'Build practical code evidence',
            estimated_time: '2-3h',
            type: 'build',
            completion_criteria: 'Push code repository with detailed README'
          }
        ],
        milestone: `Verified code evidence for ${g.gap}`,
        completion_criteria: ['Observable GitHub repo or live demonstration link']
      })) : []);

  const estimatedReadinessAfter = roadmap.estimatedReadinessAfter 
    || Math.min(98, overallScore + Math.min(milestones.length * 5, 20));

  const showRecs = mode === 'recommendations' || mode === 'all';
  const showRoadmap = mode === 'roadmap' || mode === 'all';

  return (
    <div className="anim-fade" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      
      {/* ── RECOMMENDATIONS VIEW ── */}
      {showRecs && (
        <>
          {/* 1. Candidate Strengths & Profile Overview */}
          <div className="card" style={{ 
            background: 'linear-gradient(135deg, rgba(66, 114, 255, 0.12) 0%, rgba(66, 234, 255, 0.04) 50%, var(--bg-card) 100%)', 
            border: '1px solid rgba(66, 114, 255, 0.35)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45), 0 0 24px rgba(66, 114, 255, 0.08)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'linear-gradient(135deg, var(--horizon-cyan), var(--horizon-blue))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={18} color="#ffffff" />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>Personalized Learning Advisor</h3>
              </div>
              <span className={`badge ${overallScore >= 90 ? 'badge-verified' : 'badge-accent'}`} style={{ fontSize: '0.82rem', padding: '5px 12px' }}>
                Job Readiness: {overallScore}/100
              </span>
            </div>

            {overallProfile && (
              <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
                {overallProfile}
              </p>
            )}

            {strongSkills.length > 0 && (
              <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8, fontWeight: 700, letterSpacing: '0.08em' }}>
                  You are already strong in:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {strongSkills.map((skill, idx) => (
                    <span key={idx} className="badge badge-verified" style={{ padding: '5px 12px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <CheckCircle2 size={12} style={{ flexShrink: 0 }} />
                      <span>{skill}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {nextBestAction && (
              <div style={{ 
                marginTop: 16, 
                background: 'rgba(66, 114, 255, 0.12)', 
                padding: '12px 16px', 
                borderRadius: 'var(--radius-sm)', 
                borderLeft: '4px solid var(--horizon-cyan)',
                borderTop: '1px solid rgba(66, 114, 255, 0.2)',
                borderRight: '1px solid rgba(66, 114, 255, 0.2)',
                borderBottom: '1px solid rgba(66, 114, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: 12
              }}>
                <Target size={18} style={{ color: 'var(--horizon-cyan)', flexShrink: 0 }} />
                <div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--horizon-cyan)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Next Best Action: </span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{nextBestAction}</span>
                </div>
              </div>
            )}
          </div>

          {/* Score >= 90 Status Notification */}
          {isScoreAbove90 && !learningNeeded && (
            <div className="card" style={{ background: 'rgba(66, 234, 255, 0.06)', border: '1px solid rgba(66, 234, 255, 0.22)', textAlign: 'center', padding: '24px 20px' }}>
              <CheckCircle size={36} style={{ color: 'var(--green)', margin: '0 auto 12px' }} />
              <h3 style={{ margin: '0 0 8px', fontSize: '1.15rem', color: 'var(--text-primary)' }}>
                No major course-level gap identified at your current readiness level.
              </h3>
              <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-secondary)', maxWidth: 580, marginInline: 'auto', lineHeight: 1.5 }}>
                Your verified technical and project evidence meets the benchmark requirements for {analysis.roleAnalysis?.targetRole || 'your target role'}. Focus on interview execution, system design discussions, and portfolio showcase.
              </p>
            </div>
          )}

          {/* Optional Advancement Banner for High Scorers */}
          {isScoreAbove90 && learningNeeded && (
            <div className="alert alert-info">
              <Sparkles size={18} />
              <div>
                <strong>Optional Advanced Opportunity: </strong>
                <span>No major foundational course is required at your current score ({overallScore}/100). However, this advanced topic would strengthen your profile for competitive interviews.</span>
              </div>
            </div>
          )}

          {/* 2. Top High-Value Person-Specific Gaps */}
          {gaps.length > 0 && (
            <div className="card">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Target size={18} style={{ color: 'var(--yellow)' }} />
                High-Value Employability Gaps ({gaps.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {gaps.map((gapItem, idx) => (
                  <div 
                    key={idx}
                    style={{
                      background: 'var(--bg-surface)',
                      padding: 16,
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                        {gapItem.gap}
                      </div>
                      <span className={`badge badge-${gapItem.priority === 'high' ? 'unsupported' : gapItem.priority === 'medium' ? 'partial' : 'verified'}`}>
                        {gapItem.priority ? `${gapItem.priority} priority` : 'High Priority'}
                      </span>
                    </div>

                    {gapItem.why_it_matters_for_this_candidate && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        <strong style={{ color: 'var(--yellow)' }}>Why this matters: </strong>
                        {gapItem.why_it_matters_for_this_candidate}
                      </div>
                    )}

                    {gapItem.evidence_from_candidate?.length > 0 && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        <strong>Candidate Evidence Signal: </strong>
                        {gapItem.evidence_from_candidate.join(' · ')}
                      </div>
                    )}

                    {gapItem.recommended_action && (
                      <div style={{ fontSize: '0.82rem', color: 'var(--accent-light)', marginTop: 4 }}>
                        <strong>Recommended Action: </strong> {gapItem.recommended_action}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Targeted Learning Resources (YouTube Search & Official Docs) */}
          {learningItems.length > 0 && (
            <div className="card">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Video size={18} style={{ color: 'var(--coral-light)' }} />
                Targeted Learning Resources & Tutorials
              </div>

              <div className="grid-2" style={{ gap: 20 }}>
                {learningItems.map((item, idx) => {
                  const yt = item.youtube_resource || item.youtube || (item.url ? item : null);
                  const ytUrl = yt?.youtube_url || yt?.url || (yt?.video_id ? `https://www.youtube.com/watch?v=${yt.video_id}` : null);
                  const ytThumbnail = yt?.thumbnail_url || yt?.thumbnailUrl || (yt?.video_id ? `https://i.ytimg.com/vi/${yt.video_id}/hqdefault.jpg` : null);
                  const ytTitle = yt?.title || item.skill_gap || item.title || 'Recommended Video';
                  const ytChannel = yt?.channel_name || yt?.channel || 'YouTube Educator';
                  const ytDuration = item.estimated_time || yt?.duration || 'Tutorial';
                  const doc = item.authoritative_doc || item.doc || null;

                  return (
                    <div 
                      key={idx}
                      className="card-interactive"
                      style={{
                        background: 'var(--bg-surface)',
                        borderRadius: 'var(--radius)',
                        border: '1px solid var(--border)',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: 'var(--shadow-sm)'
                      }}
                    >
                      {/* YouTube Video Header & Real Thumbnail */}
                      {ytUrl ? (
                        <div>
                          {ytThumbnail ? (
                            <a 
                              href={ytUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              style={{ 
                                position: 'relative', 
                                display: 'block', 
                                width: '100%', 
                                aspectRatio: '16 / 9',
                                background: '#0a0a0a',
                                overflow: 'hidden'
                              }}
                            >
                              <img 
                                src={ytThumbnail} 
                                alt={ytTitle} 
                                style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.25s ease' }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.04)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1.0)'}
                              />
                              <div style={{
                                position: 'absolute',
                                inset: 0,
                                background: 'rgba(0,0,0,0.32)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                                <div style={{
                                  width: 46,
                                  height: 46,
                                  borderRadius: '50%',
                                  background: 'linear-gradient(135deg, var(--horizon-coral) 0%, var(--horizon-amber) 100%)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  boxShadow: '0 4px 16px rgba(0,0,0,0.6), 0 0 14px rgba(255,126,66,0.4)'
                                }}>
                                  <Play size={20} fill="#ffffff" color="#ffffff" style={{ marginLeft: 3 }} />
                                </div>
                              </div>
                              {ytDuration && (
                                <span style={{
                                  position: 'absolute',
                                  bottom: 8,
                                  right: 8,
                                  background: 'rgba(0,0,0,0.85)',
                                  color: '#fff',
                                  fontSize: '0.72rem',
                                  padding: '3px 7px',
                                  borderRadius: 'var(--radius-xs)',
                                  fontWeight: 600,
                                  border: '1px solid rgba(255,255,255,0.1)'
                                }}>
                                  {ytDuration}
                                </span>
                              )}
                            </a>
                          ) : (
                            <div style={{ 
                              padding: '16px', 
                              background: 'rgba(255, 126, 66, 0.08)', 
                              borderBottom: '1px solid var(--border)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10
                            }}>
                              <Video size={22} style={{ color: 'var(--horizon-coral)' }} />
                              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{ytTitle}</span>
                            </div>
                          )}

                          <div style={{ padding: 18 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {ytChannel} {yt?.published_at ? `· ${yt.published_at}` : ''}
                              </span>
                              <span className="badge badge-accent" style={{ fontSize: '0.7rem' }}>
                                {ytDuration}
                              </span>
                            </div>

                            <h4 style={{ margin: '4px 0 8px', fontSize: '0.98rem', lineHeight: 1.4, color: 'var(--text-primary)' }}>
                              {ytTitle}
                            </h4>

                            {item.learning_goal && (
                              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '6px 0 14px' }}>
                                <strong style={{ color: 'var(--text-primary)' }}>Goal: </strong>{item.learning_goal}
                              </p>
                            )}

                            <a 
                              href={ytUrl} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="btn btn-primary btn-sm"
                              style={{ width: '100%', justifyContent: 'center', gap: 7 }}
                            >
                              <Play size={13} fill="currentColor" /> Watch Video on YouTube <ExternalLink size={13} />
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div style={{ padding: 18 }}>
                          <h4 style={{ margin: '0 0 6px', fontSize: '0.96rem' }}>{item.skill_gap || item.title}</h4>
                          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 12 }}>{item.why_this_resource || item.reason}</p>
                        </div>
                      )}

                      {/* Authoritative Documentation Footnote */}
                      {doc && doc.url && (
                        <div style={{ 
                          padding: '11px 18px', 
                          background: 'var(--bg-card)', 
                          borderTop: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '0.78rem'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
                            <BookOpen size={13} style={{ color: 'var(--horizon-cyan)' }} />
                            <span>{doc.title}</span>
                          </div>
                          <a 
                            href={doc.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            style={{ color: 'var(--horizon-cyan)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}
                          >
                            Docs <ExternalLink size={11} />
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. Recommended Projects if available */}
          {recommendations.projects?.length > 0 && (
            <div className="card">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <FolderGit2 size={18} style={{ color: 'var(--horizon-cyan)' }} />
                Recommended Project Demonstrations
              </div>
              <div className="grid-2" style={{ gap: 16 }}>
                {recommendations.projects.map((proj, pIdx) => (
                  <div key={pIdx} style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--text-primary)', marginBottom: 6 }}>
                      {proj.title}
                    </div>
                    <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 10px' }}>
                      {proj.description || proj.reason}
                    </p>
                    {proj.technologies?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {proj.technologies.map((t, tIdx) => (
                          <span key={tIdx} className="tag">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. Recommended Profile Improvements if available */}
          {recommendations.improvements?.length > 0 && (
            <div className="card">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Lightbulb size={18} style={{ color: 'var(--horizon-amber)' }} />
                Actionable Profile Improvements
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {recommendations.improvements.map((imp, iIdx) => (
                  <div key={iIdx} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.86rem', color: 'var(--text-primary)', background: 'var(--bg-surface)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <ArrowRight size={14} style={{ color: 'var(--horizon-cyan)', flexShrink: 0 }} />
                    <span>{typeof imp === 'string' ? imp : (imp.title || imp.action)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fallback if no recommendations at all */}
          {gaps.length === 0 && learningItems.length === 0 && !strongSkills.length && (
            <div className="card">
              <div className="empty-state">
                <CheckCircle size={36} style={{ color: 'var(--green)', marginBottom: 10 }} />
                <h3>No Outstanding Gaps Identified</h3>
                <p>Your connected profiles show solid evidence alignment. Continue maintaining regular coding streaks!</p>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── ROADMAP VIEW ── */}
      {showRoadmap && (
        <>
          {/* Roadmap Header with Estimated Readiness */}
          <div className="card" style={{ 
            background: 'linear-gradient(135deg, rgba(66, 234, 255, 0.07) 0%, rgba(66, 114, 255, 0.05) 50%, var(--bg-card) 100%)',
            border: '1px solid rgba(66, 234, 255, 0.24)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                  <TrendingUp size={20} style={{ color: 'var(--green-light)' }} />
                  Evidence-Producing Career Roadmap
                </div>
                <p style={{ margin: '6px 0 0', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                  {roadmap.summary || 'Every milestone builds tangible project and repository evidence to prove your skills.'}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Readiness Projection</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{overallScore}</span>
                    <span style={{ margin: '0 6px', color: 'var(--horizon-cyan)' }}>→</span>
                    <span style={{ color: 'var(--green-light)' }}>{estimatedReadinessAfter}/100</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actionable, Evidence-Producing Roadmap Milestones */}
          {milestones.length > 0 ? (
            <div className="card">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                <Clock size={18} style={{ color: 'var(--green)' }} />
                Phased Milestones & Task Breakdown ({milestones.length})
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {milestones.map((milestone, idx) => (
                  <div 
                    key={idx}
                    style={{
                      background: 'var(--bg-surface)',
                      padding: 18,
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--border)',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: 'var(--radius-sm)',
                          background: 'linear-gradient(135deg, var(--horizon-blue) 0%, var(--horizon-cyan) 100%)',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '0.86rem',
                          boxShadow: '0 2px 8px rgba(66, 114, 255, 0.35)'
                        }}>
                          {String(milestone.phase || idx + 1).padStart(2, '0')}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '1.02rem', color: 'var(--text-primary)' }}>
                          {milestone.title}
                        </div>
                      </div>
                      {milestone.estimated_total_time && (
                        <span className="badge" style={{ background: 'var(--bg-card)', color: 'var(--horizon-orange)', border: '1px solid rgba(255, 179, 67, 0.25)', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <Clock size={12} />
                          <span>{milestone.estimated_total_time}</span>
                        </span>
                      )}
                    </div>

                    {milestone.reason && (
                      <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
                        {milestone.reason}
                      </div>
                    )}

                    {/* Task Checklist */}
                    {milestone.tasks?.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10, paddingLeft: 6 }}>
                        {milestone.tasks.map((task, tIdx) => (
                          <div key={tIdx} style={{ 
                            background: 'var(--bg-card)', 
                            padding: '12px 14px', 
                            borderRadius: 8, 
                            border: '1px solid var(--border)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                              <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                                {task.task || task.title}
                              </span>
                              {task.estimated_time && (
                                <span style={{ fontSize: '0.72rem', color: 'var(--accent-light)', fontWeight: 600 }}>
                                  {task.estimated_time}
                                </span>
                              )}
                            </div>
                            {task.description && (
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                                {task.description}
                              </div>
                            )}
                            {task.completion_criteria && (
                              <div style={{ fontSize: '0.76rem', color: 'var(--green)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                                <CheckCircle2 size={13} style={{ flexShrink: 0 }} /> 
                                <span>Completion Criteria: {task.completion_criteria}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Milestone Completion Deliverables */}
                    {milestone.completion_criteria?.length > 0 && (
                      <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        <strong>Proof of Work Outcome: </strong> 
                        {Array.isArray(milestone.completion_criteria) 
                          ? milestone.completion_criteria.join(' · ') 
                          : milestone.completion_criteria}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="empty-state">
                <CheckCircle size={36} style={{ color: 'var(--green)', marginBottom: 10 }} />
                <h3>Roadmap Complete</h3>
                <p>No further action items are required for your current target role.</p>
              </div>
            </div>
          )}

          {/* Expected Improvement Summary */}
          {finalLearningSummary.expected_improvement && (
            <div className="alert alert-info">
              <CheckCircle size={16} />
              <div>
                <strong>Expected Employability Outcome: </strong>
                <span>{finalLearningSummary.expected_improvement}</span>
              </div>
            </div>
          )}
        </>
      )}

    </div>
  );
}

