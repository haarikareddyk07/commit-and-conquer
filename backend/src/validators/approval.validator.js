const { z } = require('zod');

const approvalDecisionSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT', 'REQUEST_CORRECTION'], {
    errorMap: () => ({ message: 'Decision must be one of APPROVE, REJECT, or REQUEST_CORRECTION' })
  }),
  comment: z.string().optional()
}).refine(data => {
  if (data.decision !== 'APPROVE') {
    return typeof data.comment === 'string' && data.comment.trim().length > 0;
  }
  return true;
}, {
  message: 'A comment explaining the decision is required when rejecting or requesting correction',
  path: ['comment']
});

module.exports = {
  approvalDecisionSchema
};
