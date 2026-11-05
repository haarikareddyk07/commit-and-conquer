const { z } = require('zod');

const loginSchema = z.object({
  email: z.string({ required_error: 'Email address is required' }).email('Please provide a valid email address'),
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required')
});

module.exports = {
  loginSchema
};
