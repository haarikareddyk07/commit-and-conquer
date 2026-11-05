const { parse } = require('csv-parse/sync');
const xlsx = require('xlsx');
const recordService = require('./record.service');
const { energyRecordSchema, productionRecordSchema, wasteRecordSchema } = require('../validators/record.validator');
const { ValidationError } = require('../utils/errors');
const auditService = require('./audit.service');

const schemaMap = {
  energy: energyRecordSchema,
  production: productionRecordSchema,
  waste: wasteRecordSchema
};

const importService = {
  parseRows(buffer, filename) {
    const ext = filename.toLowerCase();
    if (ext.endsWith('.csv')) {
      const content = buffer.toString('utf8');
      const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });
      return records;
    } else if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      const firstSheet = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheet];
      const records = xlsx.utils.sheet_to_json(sheet, { defval: null });
      return records;
    }
    throw new ValidationError('Invalid file format. Please upload a CSV or Excel (.xlsx/.xls) file.');
  },

  preview(type, buffer, filename) {
    const schema = schemaMap[type];
    if (!schema) {
      throw new ValidationError(`Unsupported import type "${type}". Allowed types: energy, production, waste.`);
    }

    const rawRows = this.parseRows(buffer, filename);
    const previewRows = [];
    let validCount = 0;
    let errorCount = 0;

    rawRows.forEach((row, idx) => {
      const rowNumber = idx + 1;
      const parseResult = schema.safeParse(row);

      if (parseResult.success) {
        validCount++;
        previewRows.push({
          row_number: rowNumber,
          data: parseResult.data,
          is_valid: true,
          errors: []
        });
      } else {
        errorCount++;
        const errors = parseResult.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        previewRows.push({
          row_number: rowNumber,
          data: row,
          is_valid: false,
          errors
        });
      }
    });

    return {
      type,
      total_rows: rawRows.length,
      valid_rows: validCount,
      error_rows: errorCount,
      rows: previewRows
    };
  },

  async commit(type, validRows, user, ipAddress) {
    const schema = schemaMap[type];
    if (!schema) {
      throw new ValidationError(`Unsupported import type: ${type}`);
    }

    if (!Array.isArray(validRows) || validRows.length === 0) {
      throw new ValidationError('No valid rows provided to commit.');
    }

    let committedCount = 0;
    let rejectedCount = 0;
    const committedRecords = [];

    for (const raw of validRows) {
      const parseResult = schema.safeParse(raw);
      if (parseResult.success) {
        try {
          const rec = await recordService.createRecord(type, parseResult.data, user, ipAddress);
          committedRecords.push(rec);
          committedCount++;
        } catch (e) {
          rejectedCount++;
        }
      } else {
        rejectedCount++;
      }
    }

    auditService.log(
      user.id,
      `IMPORT_COMMIT_${type.toUpperCase()}`,
      `${type}_records`,
      null,
      ipAddress
    );

    return {
      committed_count: committedCount,
      rejected_count: rejectedCount,
      records: committedRecords
    };
  }
};

module.exports = importService;
