const { z } = require('zod');

const machineSchema = z.object({
  machine_code: z.string({ required_error: 'Machine code is required' }).min(1),
  name: z.string({ required_error: 'Machine name is required' }).min(1),
  department_id: z.coerce.number().int().positive(),
  machine_type: z.string({ required_error: 'Machine type is required' }).min(1),
  rated_power_kw: z.coerce.number().min(0, 'Rated power must be non-negative'),
  is_active: z.coerce.number().int().min(0).max(1).optional().default(1)
});

const areaSchema = z.object({
  name: z.string({ required_error: 'Area name is required' }).min(1),
  department_id: z.coerce.number().int().positive(),
  area_type: z.enum(['EQUIPMENT', 'FLOOR', 'TANK', 'PIPELINE'])
});

const baseScheduleSchema = z.object({
  area_id: z.coerce.number().int().positive(),
  task_name: z.string({ required_error: 'Task name is required' }).min(1),
  frequency: z.enum(['DAILY', 'WEEKLY', 'PER_SHIFT']),
  shift: z.enum(['MORNING', 'AFTERNOON', 'NIGHT']).optional().nullable(),
  due_time: z.string().regex(/^\d{2}:\d{2}$/, 'Due time must be HH:MM'),
  grace_minutes: z.coerce.number().int().min(0).optional().default(30),
  required_chemical: z.string({ required_error: 'Required chemical is required' }).min(1),
  min_concentration_percent: z.coerce.number().min(0).max(100),
  max_concentration_percent: z.coerce.number().min(0).max(100),
  min_contact_minutes: z.coerce.number().int().min(0)
});

const scheduleSchema = baseScheduleSchema.refine(data => data.max_concentration_percent >= data.min_concentration_percent, {
  message: 'Max concentration must be greater than or equal to min concentration',
  path: ['max_concentration_percent']
});

const scheduleUpdateSchema = baseScheduleSchema.partial().refine(data => {
  if (data.min_concentration_percent !== undefined && data.max_concentration_percent !== undefined) {
    return data.max_concentration_percent >= data.min_concentration_percent;
  }
  return true;
}, {
  message: 'Max concentration must be greater than or equal to min concentration',
  path: ['max_concentration_percent']
});

const productSchema = z.object({
  product_code: z.string({ required_error: 'Product code is required' }).min(1),
  name: z.string({ required_error: 'Product name is required' }).min(1),
  unit: z.enum(['KG', 'LITRE']),
  expected_loss_percent: z.coerce.number().min(0).max(100)
});

const materialSchema = z.object({
  material_code: z.string({ required_error: 'Material code is required' }).min(1),
  name: z.string({ required_error: 'Material name is required' }).min(1),
  unit: z.string({ required_error: 'Unit is required' }).min(1),
  expected_loss_percent: z.coerce.number().min(0).max(100)
});

const departmentSchema = z.object({
  name: z.string({ required_error: 'Department name is required' }).min(1)
});

module.exports = {
  machineSchema,
  areaSchema,
  scheduleSchema,
  scheduleUpdateSchema,
  productSchema,
  materialSchema,
  departmentSchema
};
