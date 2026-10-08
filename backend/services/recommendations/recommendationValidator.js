/**
 * Recommendation Validator
 *
 * Validates and normalizes personalized recommendation objects.
 * Attaches future-ready validation tags without breaking existing structures.
 */

function validateAndFormatRecommendation(recommendationObj, defaultRole = 'Software Engineer') {
  if (!recommendationObj || typeof recommendationObj !== 'object') {
    return {
      learning_needed: false,
      recommendation_type: 'optional_advancement',
      reason_for_decision: 'No major course-level gap identified at your current readiness level.',
      gap: 'Continuous Learning',
      why: 'Readiness score is high. Keep practicing and reviewing system design.',
      youtube: null,
      other_resources: [],
      roadmap: {
        title: 'Interview & Project Polish',
        objective: 'Maintain peak interview readiness',
        steps: []
      }
    };
  }

  // Ensure supporting sources and validation status are populated
  const validated = { ...recommendationObj };

  if (!validated.supporting_sources) {
    validated.supporting_sources = ['resume', 'github', 'portfolio'];
  }
  if (!validated.validation_status) {
    validated.validation_status = 'pending';
  }
  if (!validated.target_role) {
    validated.target_role = defaultRole;
  }

  return validated;
}

module.exports = {
  validateAndFormatRecommendation
};
