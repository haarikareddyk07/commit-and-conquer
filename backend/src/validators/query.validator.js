const { z } = require('zod');

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  from: z.string().regex(dateRegex, 'From date must be formatted as YYYY-MM-DD').optional(),
  to: z.string().regex(dateRegex, 'To date must be formatted as YYYY-MM-DD').optional(),
  machine_id: z.coerce.number().int().positive().optional(),
  area_id: z.coerce.number().int().positive().optional(),
  product_id: z.coerce.number().int().positive().optional(),
  material_id: z.coerce.number().int().positive().optional(),
  department_id: z.coerce.number().int().positive().optional()
});

module.exports = {
  paginationQuerySchema
};
