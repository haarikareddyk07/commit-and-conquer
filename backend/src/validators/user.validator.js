const { z } = require('zod');

const createUserSchema = z.object({
  full_name: z.string({ required_error: 'Full name is required' }).min(2, 'Full name must have at least 2 characters'),
  email: z.string({ required_error: 'Email address is required' }).email('Please provide a valid email address'),
  password: z.string({ required_error: 'Password is required' }).min(6, 'Password must be at least 6 characters'),
  role: z.enum(['EMPLOYEE', 'SUPERVISOR', 'MANAGER'], {
    errorMap: () => ({ message: 'Role must be EMPLOYEE, SUPERVISOR, or MANAGER' })
  }),
  department_id: z.coerce.number().int().positive().optional().nullable(),
  is_active: z.coerce.number().int().min(0).max(1).optional().default(1)
});

const updateUserSchema = z.object({
  full_name: z.string().min(2, 'Full name must have at least 2 characters').optional(),
  email: z.string().email('Please provide a valid email address').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  role: z.enum(['EMPLOYEE', 'SUPERVISOR', 'MANAGER'], {
    errorMap: () => ({ message: 'Role must be EMPLOYEE, SUPERVISOR, or MANAGER' })
  }).optional(),
  department_id: z.coerce.number().int().positive().optional().nullable(),
  is_active: z.coerce.number().int().min(0).max(1).optional()
});

module.exports = {
  createUserSchema,
  updateUserSchema
};
