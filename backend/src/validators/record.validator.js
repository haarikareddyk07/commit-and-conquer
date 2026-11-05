const { z } = require('zod');

// Helper to check future dates
const notInFuture = (dateStr) => {
  const inputDate = new Date(dateStr);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return inputDate <= today;
};

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const baseEnergyRecordSchema = z.object({
  machine_id: z.coerce.number().int().positive('Please select a valid machine'),
  record_date: z.string({ required_error: 'Record date is required' })
    .regex(dateRegex, 'Date must be formatted as YYYY-MM-DD')
    .refine(notInFuture, { message: 'Record date cannot be in the future' }),
  shift: z.enum(['MORNING', 'AFTERNOON', 'NIGHT'], { errorMap: () => ({ message: 'Shift must be MORNING, AFTERNOON, or NIGHT' }) }),
  reading_start_kwh: z.coerce.number().min(0, 'Start meter reading cannot be negative'),
  reading_end_kwh: z.coerce.number().min(0, 'End meter reading cannot be negative'),
  runtime_hours: z.coerce.number()
    .min(0, 'Runtime hours cannot be negative')
    .max(24, 'Runtime hours cannot exceed 24 hours in a single day'),
  notes: z.string().optional().nullable()
});

const energyRecordSchema = baseEnergyRecordSchema.refine(data => data.reading_end_kwh >= data.reading_start_kwh, {
  message: 'End reading cannot be less than start reading',
  path: ['reading_end_kwh']
});

const energyRecordUpdateSchema = baseEnergyRecordSchema.partial().refine(data => {
  if (data.reading_start_kwh !== undefined && data.reading_end_kwh !== undefined) {
    return data.reading_end_kwh >= data.reading_start_kwh;
  }
  return true;
}, {
  message: 'End reading cannot be less than start reading',
  path: ['reading_end_kwh']
});

const hygieneRecordSchema = z.object({
  schedule_id: z.coerce.number().int().positive('Please select a valid sanitation schedule'),
  area_id: z.coerce.number().int().positive('Please select a valid area'),
  scheduled_date: z.string({ required_error: 'Scheduled date is required' })
    .regex(dateRegex, 'Scheduled date must be in YYYY-MM-DD format')
    .refine(notInFuture, { message: 'Scheduled date cannot be in the future' }),
  completed_at: z.string({ required_error: 'Completed timestamp is required' }),
  chemical_used: z.string({ required_error: 'Chemical used is required' }).min(1, 'Chemical name cannot be blank'),
  concentration_percent: z.coerce.number()
    .min(0, 'Chemical concentration cannot be negative')
    .max(100, 'Chemical concentration cannot exceed 100%'),
  contact_minutes: z.coerce.number().int().min(0, 'Contact minutes cannot be negative'),
  checklist_json: z.union([z.string(), z.record(z.any())]).optional().nullable(),
  upload_id: z.coerce.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable()
});

const hygieneRecordUpdateSchema = hygieneRecordSchema.partial();

const productionRecordSchema = z.object({
  product_id: z.coerce.number().int().positive('Please select a valid product'),
  batch_no: z.string({ required_error: 'Batch number is required' }).min(1, 'Batch number cannot be blank'),
  production_date: z.string({ required_error: 'Production date is required' })
    .regex(dateRegex, 'Production date must be in YYYY-MM-DD format')
    .refine(notInFuture, { message: 'Production date cannot be in the future' }),
  shift: z.enum(['MORNING', 'AFTERNOON', 'NIGHT'], { errorMap: () => ({ message: 'Shift must be MORNING, AFTERNOON, or NIGHT' }) }),
  raw_input_qty: z.coerce.number().positive('Raw input quantity must be greater than zero'),
  actual_output_qty: z.coerce.number().min(0, 'Actual output quantity cannot be negative'),
  unit: z.enum(['KG', 'LITRE'], { errorMap: () => ({ message: 'Unit must be either KG or LITRE' }) }),
  notes: z.string().optional().nullable()
});

const productionRecordUpdateSchema = productionRecordSchema.partial();

const wasteRecordSchema = z.object({
  production_record_id: z.coerce.number().int().positive().optional().nullable(),
  material_id: z.coerce.number().int().positive('Please select a valid material'),
  record_date: z.string({ required_error: 'Record date is required' })
    .regex(dateRegex, 'Record date must be in YYYY-MM-DD format')
    .refine(notInFuture, { message: 'Record date cannot be in the future' }),
  shift: z.enum(['MORNING', 'AFTERNOON', 'NIGHT'], { errorMap: () => ({ message: 'Shift must be MORNING, AFTERNOON, or NIGHT' }) }),
  waste_type: z.enum(['SPILLAGE', 'SPOILAGE', 'REJECT', 'CLEANING_LOSS', 'OTHER'], {
    errorMap: () => ({ message: 'Waste type must be SPILLAGE, SPOILAGE, REJECT, CLEANING_LOSS, or OTHER' })
  }),
  quantity: z.coerce.number().min(0, 'Waste quantity cannot be negative'),
  unit: z.string({ required_error: 'Unit is required' }).min(1, 'Unit cannot be blank'),
  cause: z.string().optional().nullable()
});

const wasteRecordUpdateSchema = wasteRecordSchema.partial();

module.exports = {
  energyRecordSchema,
  energyRecordUpdateSchema,
  hygieneRecordSchema,
  hygieneRecordUpdateSchema,
  productionRecordSchema,
  productionRecordUpdateSchema,
  wasteRecordSchema,
  wasteRecordUpdateSchema
};
