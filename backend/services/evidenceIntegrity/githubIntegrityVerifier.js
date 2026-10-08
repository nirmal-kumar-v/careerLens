const axios = require('axios');

/**
 * GitHub Repository & Contribution Integrity Verifier
 * 
 * Inspects forked repositories, upstream contribution records,
 * commit attribution, unique vs inherited changes, and suspicious patterns.
 */

async function verifyGithubIntegrity(githubData, username) {
  if (!githubData || !githubData.repositories || !Array.isArray(githubData.repositories)) {
    return {
      repositories: [],
      integritySummary: {
        totalAnalyzed: 0,
        forksWithUpstreamContributions: 0,
        forksWithIndependentWork: 0,
        suspiciousPatternsCount: 0
      }
    };
  }

  const cleanUsername = (username || githubData.username || '').toLowerCase();
  const headers = { 'Accept': 'application/vnd.github.v3+json' };
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }

  const baseUrl = 'https://api.github.com';
  const enrichedRepos = [];

  let forksWithUpstreamContributions = 0;
  let forksWithIndependentWork = 0;
  let suspiciousPatternsCount = 0;

  for (let i = 0; i < githubData.repositories.length; i++) {
    const repo = { ...githubData.repositories[i] };
    const repoOwner = (repo.url ? repo.url.split('/')[3] : cleanUsername) || cleanUsername;

    const integrityInfo = {
      is_fork: Boolean(repo.isFork),
      parent_repository: null,
      source_repository: null,
      fork_classification: repo.isFork ? 'fork_uninspected' : 'original_repository',
      candidate_contributions: [],
      upstream_contributions: [],
      unique_changes: [],
      inherited_changes: [],
      commit_signals: {
        total_commits_inspected: 0,
        candidate_authored_commits: 0,
        candidate_committed_commits: 0,
        author_committer_matches: true,
        suspicious_timestamp_bursts: false,
        large_sudden_dumps: false
      },
      integrity_status: 'normal',
      verification_status: 'pending',
      personalized_explanation: ''
    };

    // If it's a forked repository, inspect parent/upstream and contributor activity
    if (repo.isFork && i < 15) {
      try {
        const repoDetailRes = await axios.get(`${baseUrl}/repos/${repoOwner}/${repo.name}`, { headers, timeout: 8000 }).catch(() => null);
        if (repoDetailRes?.data?.parent) {
          const parent = repoDetailRes.data.parent;
          const source = repoDetailRes.data.source || parent;

          integrityInfo.parent_repository = {
            name: parent.full_name,
            url: parent.html_url,
            owner: parent.owner?.login,
            default_branch: parent.default_branch || 'main'
          };
          integrityInfo.source_repository = {
            name: source.full_name,
            url: source.html_url,
            owner: source.owner?.login
          };

          // 1. Check candidate's contributions directly in the upstream/parent repo
          const parentOwner = parent.owner?.login;
          const parentName = parent.name;
          if (parentOwner && parentName) {
            // A. Check upstream commits authored by candidate
            const upstreamCommitsRes = await axios.get(`${baseUrl}/repos/${parentOwner}/${parentName}/commits`, {
              headers,
              params: { author: cleanUsername, per_page: 15 },
              timeout: 8000
            }).catch(() => null);

            if (upstreamCommitsRes?.data && Array.isArray(upstreamCommitsRes.data) && upstreamCommitsRes.data.length > 0) {
              integrityInfo.upstream_contributions = upstreamCommitsRes.data.map(c => ({
                sha: c.sha?.substring(0, 7),
                message: c.commit?.message?.split('\n')[0] || 'Commit',
                date: c.commit?.author?.date,
                author: c.commit?.author?.name || c.author?.login
              }));
            }

            // B. Check upstream pull requests opened/merged by candidate
            const upstreamPullsRes = await axios.get(`${baseUrl}/repos/${parentOwner}/${parentName}/pulls`, {
              headers,
              params: { state: 'all', creator: cleanUsername, per_page: 10 },
              timeout: 8000
            }).catch(() => null);

            if (upstreamPullsRes?.data && Array.isArray(upstreamPullsRes.data) && upstreamPullsRes.data.length > 0) {
              upstreamPullsRes.data.forEach(pr => {
                integrityInfo.upstream_contributions.push({
                  type: 'pull_request',
                  number: pr.number,
                  title: pr.title,
                  state: pr.state,
                  merged: Boolean(pr.merged_at),
                  url: pr.html_url
                });
              });
            }
          }
        }
      } catch (err) {
        // Fallback gracefully
      }
    }

    // Inspect commits inside the repository to separate candidate work from inherited commits
    if (i < 20) {
      try {
        const commitsRes = await axios.get(`${baseUrl}/repos/${repoOwner}/${repo.name}/commits`, {
          headers,
          params: { per_page: 30 },
          timeout: 8000
        }).catch(() => null);

        if (commitsRes?.data && Array.isArray(commitsRes.data)) {
          const commits = commitsRes.data;
          integrityInfo.commit_signals.total_commits_inspected = commits.length;

          let candidateAuthored = 0;
          let candidateCommitted = 0;
          let authorCommitterMismatches = 0;
          const timestamps = [];

          commits.forEach(c => {
            const authorLogin = (c.author?.login || '').toLowerCase();
            const committerLogin = (c.committer?.login || '').toLowerCase();
            const authorName = (c.commit?.author?.name || '').toLowerCase();
            const committerName = (c.commit?.committer?.name || '').toLowerCase();
            const commitDate = c.commit?.author?.date || c.commit?.committer?.date;

            if (commitDate) timestamps.push(new Date(commitDate).getTime());

            const isCandidateAuthor = authorLogin === cleanUsername || 
              authorName.includes(cleanUsername) || 
              (githubData.name && authorName.includes(githubData.name.toLowerCase()));
            const isCandidateCommitter = committerLogin === cleanUsername || 
              committerName.includes(cleanUsername) ||
              (githubData.name && committerName.includes(githubData.name.toLowerCase()));

            if (isCandidateAuthor) candidateAuthored++;
            if (isCandidateCommitter) candidateCommitted++;

            if (isCandidateAuthor && !isCandidateCommitter && committerLogin && committerLogin !== 'web-flow') {
              authorCommitterMismatches++;
            }

            if (isCandidateAuthor || isCandidateCommitter) {
              integrityInfo.candidate_contributions.push({
                sha: c.sha?.substring(0, 7),
                message: c.commit?.message?.split('\n')[0] || 'Commit',
                date: commitDate,
                author: c.commit?.author?.name || authorLogin
              });
            } else if (repo.isFork) {
              integrityInfo.inherited_changes.push({
                sha: c.sha?.substring(0, 7),
                message: c.commit?.message?.split('\n')[0] || 'Inherited upstream commit',
                author: c.commit?.author?.name || 'Upstream Author'
              });
            }
          });

          integrityInfo.commit_signals.candidate_authored_commits = candidateAuthored;
          integrityInfo.commit_signals.candidate_committed_commits = candidateCommitted;
          if (authorCommitterMismatches > 3) {
            integrityInfo.commit_signals.author_committer_matches = false;
          }

          // Check for timestamp burst anomalies (e.g. 10+ commits within 60 seconds)
          if (timestamps.length >= 8) {
            const sortedTimes = [...timestamps].sort((a, b) => a - b);
            let closeCount = 0;
            for (let t = 1; t < sortedTimes.length; t++) {
              if (sortedTimes[t] - sortedTimes[t - 1] < 15000) {
                closeCount++;
              }
            }
            if (closeCount >= 6) {
              integrityInfo.commit_signals.suspicious_timestamp_bursts = true;
            }
          }
        }
      } catch (err) {
        // Safe fallback
      }
    }

    // Determine Fork Classification and Explanation
    if (repo.isFork) {
      const hasUpstream = integrityInfo.upstream_contributions.length > 0;
      const candidateCommits = integrityInfo.commit_signals.candidate_authored_commits;

      if (hasUpstream) {
        integrityInfo.fork_classification = 'upstream_contributor';
        forksWithUpstreamContributions++;
        integrityInfo.personalized_explanation = `Your repository is forked from ${integrityInfo.parent_repository?.name || 'upstream'}, and CareerLens identified ${integrityInfo.upstream_contributions.length} direct contribution(s) (commits/PRs) authored by you in the upstream project.`;
      } else if (candidateCommits >= 3) {
        integrityInfo.fork_classification = 'independent_modifications';
        forksWithIndependentWork++;
        integrityInfo.personalized_explanation = `Although this repository is forked from ${integrityInfo.parent_repository?.name || 'upstream'}, CareerLens identified ${candidateCommits} unique commit(s) authored by your account after the fork, confirming meaningful independent work.`;
      } else if (candidateCommits > 0) {
        integrityInfo.fork_classification = 'limited_independent_evidence';
        integrityInfo.personalized_explanation = `This repository is forked from ${integrityInfo.parent_repository?.name || 'upstream'} with preliminary commits. It provides limited independent evidence beyond the upstream codebase.`;
      } else {
        integrityInfo.fork_classification = 'inherited_snapshot';
        integrityInfo.personalized_explanation = `This repository is a snapshot fork of ${integrityInfo.parent_repository?.name || 'an upstream project'}. The inherited upstream code is recognized as reference material rather than candidate-authored evidence.`;
      }
    } else {
      integrityInfo.fork_classification = 'original_repository';
      const cCount = integrityInfo.commit_signals.candidate_authored_commits;
      if (cCount >= 5) {
        integrityInfo.personalized_explanation = `Original repository with active commit attribution across your account profile.`;
      } else {
        integrityInfo.personalized_explanation = `Original repository under your GitHub account.`;
      }
    }

    // Detect and assign integrity status
    if (integrityInfo.commit_signals.suspicious_timestamp_bursts && integrityInfo.commit_signals.total_commits_inspected > 10) {
      integrityInfo.integrity_status = 'needs_corroboration';
      suspiciousPatternsCount++;
    } else if (repo.isFork && integrityInfo.fork_classification === 'inherited_snapshot') {
      integrityInfo.integrity_status = 'limited_evidence';
    } else {
      integrityInfo.integrity_status = 'normal';
    }

    repo.integrity = integrityInfo;
    enrichedRepos.push(repo);
  }

  return {
    repositories: enrichedRepos,
    integritySummary: {
      totalAnalyzed: enrichedRepos.length,
      originalReposCount: enrichedRepos.filter(r => !r.isFork).length,
      forksWithUpstreamContributions,
      forksWithIndependentWork,
      suspiciousPatternsCount
    }
  };
}

module.exports = {
  verifyGithubIntegrity
};
