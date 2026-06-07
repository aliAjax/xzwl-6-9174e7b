import type { 
  CsvFieldMapping, 
  CsvRowData, 
  ValidationError, 
  ValidationErrorType,
  ImportPreviewData,
  ImportPreviewRow,
  SpecimenFormData,
} from '../types';
import type { Box, Specimen } from '../types';

export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

export const getTodayString = (): string => {
  return new Date().toISOString().split('T')[0];
};

export const escapeCsvField = (field: string | number | boolean): string => {
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export interface ExportSpecimenData {
  specimenNo: string;
  species: string;
  collectionLocation: string;
  collectionDate: string;
  pinnedStatus: boolean;
  photographed: boolean;
  boxName: string;
  notes: string;
}

export const generateSpecimenCsv = (specimens: ExportSpecimenData[]): string => {
  const headers = [
    '标本编号',
    '物种名',
    '采集地点',
    '采集日期',
    '针插状态',
    '拍照状态',
    '展盒名称',
    '备注',
  ];

  const rows = specimens.map((s) => [
    s.specimenNo,
    s.species,
    s.collectionLocation,
    s.collectionDate,
    s.pinnedStatus ? '已针插' : '未针插',
    s.photographed ? '已拍照' : '未拍照',
    s.boxName,
    s.notes,
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => escapeCsvField(cell)).join(','))
    .join('\n');

  return '\uFEFF' + csvContent;
};

export const downloadCsv = (csvContent: string, filename: string): void => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

interface FieldPattern {
  exact: string[];
  contains: string[];
}

const FIELD_NAME_PATTERNS: Record<keyof CsvRowData | 'boxName', FieldPattern> = {
  specimenNo: {
    exact: ['标本编号', '编号', 'specimenno', 'specimen_no', 'specimenno', 'id', 'no'],
    contains: ['标本编号', 'specimenno', 'specimen_no'],
  },
  species: {
    exact: ['物种名', '物种', '学名', 'species', 'name'],
    contains: ['物种名', '物种', '学名', 'species'],
  },
  collectionLocation: {
    exact: ['采集地点', '采集地', '地点', 'collectionlocation', 'collection_location', 'location', 'place'],
    contains: ['采集地点', '采集地', 'collectionlocation', 'collection_location'],
  },
  collectionDate: {
    exact: ['采集日期', '日期', 'collectiondate', 'collection_date', 'date'],
    contains: ['采集日期', 'collectiondate', 'collection_date'],
  },
  pinnedStatus: {
    exact: ['针插状态', '针插', 'pinnedstatus', 'pinned_status', 'pinned'],
    contains: ['针插状态', '针插', 'pinnedstatus', 'pinned'],
  },
  photographed: {
    exact: ['拍照状态', '拍照', '已拍照', 'photographed', 'photo'],
    contains: ['拍照状态', '拍照', '已拍照', 'photographed'],
  },
  boxName: {
    exact: ['展盒名称', '展盒', 'boxname', 'box_name', 'box'],
    contains: ['展盒名称', '展盒', 'boxname', 'box_name'],
  },
  notes: {
    exact: ['备注', '说明', 'notes', 'remark', 'description'],
    contains: ['备注', '说明', 'notes', 'remark', 'description'],
  },
  batchId: {
    exact: ['批次', '批次号', 'batchid', 'batch_id', '采集批次', 'batch'],
    contains: ['批次', 'batchid', '采集批次', 'batch_id'],
  },
};

const MATCH_PRIORITY: (keyof CsvRowData | 'boxName')[] = [
  'specimenNo',
  'collectionLocation',
  'collectionDate',
  'pinnedStatus',
  'photographed',
  'boxName',
  'batchId',
  'species',
  'notes',
];

export const autoDetectFieldMapping = (headers: string[]): CsvFieldMapping => {
  const mapping: CsvFieldMapping = {};

  headers.forEach((header) => {
    const normalizedHeader = header.trim().toLowerCase();
    let matchedField: keyof CsvRowData | 'boxName' | null = null;

    for (const field of MATCH_PRIORITY) {
      const patterns = FIELD_NAME_PATTERNS[field];

      const exactMatch = patterns.exact.some((pattern) =>
        normalizedHeader === pattern.toLowerCase()
      );

      if (exactMatch) {
        matchedField = field;
        break;
      }

      const containsMatch = patterns.contains.some((pattern) =>
        normalizedHeader.includes(pattern.toLowerCase())
      );

      if (containsMatch) {
        matchedField = field;
        break;
      }
    }

    mapping[header] = matchedField;
  });

  return mapping;
};

export const parseCsv = (content: string): string[][] => {
  const cleanContent = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < cleanContent.length; i++) {
    const char = cleanContent[i];
    const nextChar = cleanContent[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    rows.push(currentRow);
  }

  return rows.filter(row => row.some(cell => cell.trim() !== ''));
};

const parseBooleanValue = (value: string): boolean | null => {
  const normalized = value.trim().toLowerCase();
  if (['已针插', '是', 'true', '1', 'yes', '已拍照', 'y'].includes(normalized)) {
    return true;
  }
  if (['未针插', '否', 'false', '0', 'no', '未拍照', 'n', ''].includes(normalized)) {
    return false;
  }
  return null;
};

const isValidDate = (dateString: string): boolean => {
  if (!dateString.trim()) return true;
  const timestamp = Date.parse(dateString);
  return !isNaN(timestamp);
};

const normalizeDate = (dateString: string): string => {
  if (!dateString.trim()) return '';
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
};

const createError = (
  rowIndex: number,
  field: string,
  type: ValidationErrorType,
  message: string
): ValidationError => ({
  rowIndex,
  field,
  type,
  message,
});

export const validateAndPreviewCsv = (
  csvContent: string,
  existingSpecimens: Specimen[],
  existingBoxes: Box[]
): ImportPreviewData => {
  const parsedRows = parseCsv(csvContent);
  
  if (parsedRows.length < 1) {
    throw new Error('CSV文件为空或格式不正确');
  }

  const headers = parsedRows[0];
  const dataRows = parsedRows.slice(1);
  const fieldMapping = autoDetectFieldMapping(headers);
  
  const existingSpecimenNos = new Set(existingSpecimens.map(s => s.specimenNo.toLowerCase()));
  const existingBoxNames = new Set(existingBoxes.map(b => b.name.toLowerCase()));
  const fileSpecimenNos = new Map<string, number[]>();

  const rows: ImportPreviewRow[] = dataRows.map((rowData, rowIdx) => {
    const actualRowIndex = rowIdx + 2;
    const data: Partial<CsvRowData> = {};
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    headers.forEach((header, colIdx) => {
      const field = fieldMapping[header];
      const value = rowData[colIdx] || '';

      if (field === null) return;

      switch (field) {
        case 'specimenNo':
          data.specimenNo = value.trim();
          if (data.specimenNo) {
            const lowerNo = data.specimenNo.toLowerCase();
            if (existingSpecimenNos.has(lowerNo)) {
              errors.push(createError(
                actualRowIndex,
                '标本编号',
                'duplicate_no',
                `标本编号 "${data.specimenNo}" 已存在于系统中`
              ));
            }
            if (!fileSpecimenNos.has(lowerNo)) {
              fileSpecimenNos.set(lowerNo, []);
            }
            fileSpecimenNos.get(lowerNo)!.push(actualRowIndex);
          }
          break;
        case 'species':
          data.species = value.trim();
          break;
        case 'collectionLocation':
          data.collectionLocation = value.trim();
          break;
        case 'collectionDate':
          if (value.trim()) {
            if (!isValidDate(value)) {
              errors.push(createError(
                actualRowIndex,
                '采集日期',
                'invalid_date',
                `日期格式不正确: "${value}"`
              ));
            } else {
              data.collectionDate = normalizeDate(value);
            }
          }
          break;
        case 'pinnedStatus': {
          const pinnedBool = parseBooleanValue(value);
          if (pinnedBool === null && value.trim() !== '') {
            errors.push(createError(
              actualRowIndex,
              '针插状态',
              'invalid_boolean',
              `针插状态格式不正确: "${value}"，请使用"已针插"/"未针插"或"是"/"否"`
            ));
          } else {
            data.pinnedStatus = pinnedBool ?? false;
          }
          break;
        }
        case 'photographed': {
          const photoBool = parseBooleanValue(value);
          if (photoBool === null && value.trim() !== '') {
            errors.push(createError(
              actualRowIndex,
              '拍照状态',
              'invalid_boolean',
              `拍照状态格式不正确: "${value}"，请使用"已拍照"/"未拍照"或"是"/"否"`
            ));
          } else {
            data.photographed = photoBool ?? false;
          }
          break;
        }
        case 'boxName':
          data.boxName = value.trim();
          if (data.boxName && !existingBoxNames.has(data.boxName.toLowerCase())) {
            errors.push(createError(
              actualRowIndex,
              '展盒名称',
              'box_not_found',
              `展盒 "${data.boxName}" 不存在，请先创建展盒`
            ));
          }
          break;
        case 'notes':
          data.notes = value.trim();
          break;
        case 'batchId':
          data.batchId = value.trim();
          break;
      }
    });

    if (!data.specimenNo) {
      errors.push(createError(
        actualRowIndex,
        '标本编号',
        'missing_required',
        '缺少必填项：标本编号'
      ));
    }
    if (!data.species) {
      errors.push(createError(
        actualRowIndex,
        '物种名',
        'missing_required',
        '缺少必填项：物种名'
      ));
    }

    return {
      rowIndex: actualRowIndex,
      data,
      errors,
      warnings,
      isValid: errors.length === 0,
    };
  });

  rows.forEach((row) => {
    if (row.data.specimenNo) {
      const lowerNo = row.data.specimenNo.toLowerCase();
      const occurrences = fileSpecimenNos.get(lowerNo) || [];
      if (occurrences.length > 1) {
        const otherRows = occurrences.filter(r => r !== row.rowIndex);
        row.errors.push(createError(
          row.rowIndex,
          '标本编号',
          'duplicate_no_in_file',
          `标本编号在文件内重复，第 ${otherRows.join('、')} 行也使用了该编号`
        ));
        row.isValid = false;
      }
    }
  });

  const validCount = rows.filter(r => r.isValid).length;
  const invalidCount = rows.filter(r => !r.isValid).length;

  return {
    headers,
    fieldMapping,
    rows,
    validCount,
    invalidCount,
    totalCount: rows.length,
  };
};

export const convertToSpecimenFormData = (
  previewRow: ImportPreviewRow,
  boxes: Box[]
): SpecimenFormData | null => {
  if (!previewRow.isValid || !previewRow.data.specimenNo || !previewRow.data.species) {
    return null;
  }

  const { data } = previewRow;
  const box = data.boxName 
    ? boxes.find(b => b.name.toLowerCase() === data.boxName!.toLowerCase())
    : null;

  return {
    specimenNo: data.specimenNo,
    species: data.species,
    collectionLocation: data.collectionLocation || '',
    collectionDate: data.collectionDate || '',
    pinnedStatus: data.pinnedStatus ?? false,
    photographed: data.photographed ?? false,
    boxId: box?.id || '',
    batchId: data.batchId || '',
    notes: data.notes || '',
  };
};

export const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file, 'UTF-8');
  });
};
