/**
 * Domain Resource Service
 * Generates verified, real Unstop search destination URLs for internships and hackathons.
 * Never fabricates individual fake companies or fake hackathon events.
 */

function generateInternshipRecommendation(domain, personalizedWhy, bestSuitedRole) {
  const cleanDomain = domain || 'Full Stack Web Development';
  const encodedQuery = encodeURIComponent(cleanDomain.trim());
  const searchUrl = `https://unstop.com/internships?searchTerm=${encodedQuery}`;

  return {
    domain: cleanDomain,
    why_recommended: personalizedWhy || `Gaining hands-on internship experience in ${cleanDomain} directly addresses target employability gaps and provides observable production contributions.`,
    best_suited_for: bestSuitedRole || 'Software Engineering & Development Roles',
    search_url: searchUrl,
    platform: 'Unstop',
    platform_label: 'Explore on Unstop'
  };
}

function generateHackathonRecommendation(category, personalizedWhy, demonstrationGoal) {
  const cleanCategory = category || 'Full Stack & Web Innovation';
  const encodedQuery = encodeURIComponent(cleanCategory.trim());
  const searchUrl = `https://unstop.com/hackathons?searchTerm=${encodedQuery}`;

  return {
    category: cleanCategory,
    why_fits_you: personalizedWhy || `Participating in ${cleanCategory} hackathons lets you build and showcase end-to-end evidence under competitive evaluation.`,
    what_you_could_demonstrate: demonstrationGoal || 'Demonstrate rapid full-stack architecture, collaboration, and working deployed prototype evidence.',
    search_url: searchUrl,
    platform: 'Unstop',
    platform_label: 'Explore on Unstop'
  };
}

module.exports = {
  generateInternshipRecommendation,
  generateHackathonRecommendation
};
