import type {
  CsvFieldMapping,
  CsvRowData,
  ValidationError,
  ValidationErrorType,
  ImportPreviewData,
  ImportPreviewRow,
  SpecimenFormData,
  ComplianceStatus,
  NewBoxInfo,
  NewBatchInfo,
  ImportRelatedObjects,
} from '../types';
import type { Box, Specimen, CollectionBatch, BoxFormData, CollectionBatchFormData } from '../types';
import { COMPLIANCE_STATUS_OPTIONS, DEFAULT_COMPLIANCE_STATUS } from '../types';
import { escapeCsvField } from './common';

export interface ExportSpecimenData {
  specimenNo: string;
  species: string;
  collectionLocation: string;
  collectionDate: string;
  pinnedStatus: boolean;
  photographed: boolean;
  boxName: string;
  notes: string;
  complianceStatus: ComplianceStatus;
  permitNumber: string;
  permitExpiryDate: string;
  complianceNotes: string;
}

const getComplianceStatusLabel = (status: ComplianceStatus): string => {
  const option = COMPLIANCE_STATUS_OPTIONS.find(opt => opt.value === status);
  return option?.label || status;
};

const COMPLIANCE_STATUS_LABEL_TO_VALUE: Record<string, ComplianceStatus> = {
  '无需合规': 'not_relevant',
  '保护物种': 'protected_species',
  '外来物种': 'invasive_species',
  '特许采集': 'special_permit',
  '许可过期': 'expired_permit',
  '待确认': 'unknown',
};

const VALID_COMPLIANCE_VALUES = new Set([
  ...COMPLIANCE_STATUS_OPTIONS.map(opt => opt.value),
  ...COMPLIANCE_STATUS_OPTIONS.map(opt => opt.label),
]);

const parseComplianceStatus = (value: string): ComplianceStatus | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (!VALID_COMPLIANCE_VALUES.has(trimmed) && !VALID_COMPLIANCE_VALUES.has(trimmed.toLowerCase())) {
    return null;
  }

  if (COMPLIANCE_STATUS_LABEL_TO_VALUE[trimmed]) {
    return COMPLIANCE_STATUS_LABEL_TO_VALUE[trimmed];
  }

  const lowerValue = trimmed.toLowerCase();
  const option = COMPLIANCE_STATUS_OPTIONS.find(opt =>
    opt.value === lowerValue || opt.label === trimmed
  );

  return option?.value || null;
};

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
    '合规状态',
    '许可证编号',
    '到期日期',
    '合规备注',
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
    getComplianceStatusLabel(s.complianceStatus),
    s.permitNumber,
    s.permitExpiryDate,
    s.complianceNotes,
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => escapeCsvField(cell)).join(','))
    .join('\n');

  return '\uFEFF' + csvContent;
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
  complianceStatus: {
    exact: ['合规状态', 'compliancestatus', 'compliance_status', 'compliance'],
    contains: ['合规状态', 'compliancestatus', 'compliance_status'],
  },
  permitNumber: {
    exact: ['许可证编号', '许可证号', '许可编号', 'permitnumber', 'permit_number', 'permitno', 'permit_no'],
    contains: ['许可证编号', '许可证号', '许可编号', 'permitnumber', 'permit_number', 'permitno'],
  },
  permitExpiryDate: {
    exact: ['到期日期', '有效期至', '许可到期', 'permitexpirydate', 'permit_expiry_date', 'expirydate'],
    contains: ['到期日期', '有效期至', '许可到期', 'permitexpirydate', 'permit_expiry_date', 'expirydate'],
  },
  complianceNotes: {
    exact: ['合规备注', '合规说明', 'compliancenotes', 'compliance_notes', 'compliance_remark'],
    contains: ['合规备注', '合规说明', 'compliancenotes', 'compliance_notes'],
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
  'complianceStatus',
  'permitNumber',
  'permitExpiryDate',
  'complianceNotes',
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
  const trimmed = dateString.trim();
  
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const altSlashMatch = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  
  let year: number, month: number, day: number;
  
  if (isoMatch) {
    year = parseInt(isoMatch[1], 10);
    month = parseInt(isoMatch[2], 10) - 1;
    day = parseInt(isoMatch[3], 10);
  } else if (slashMatch) {
    month = parseInt(slashMatch[1], 10) - 1;
    day = parseInt(slashMatch[2], 10);
    year = parseInt(slashMatch[3], 10);
  } else if (altSlashMatch) {
    year = parseInt(altSlashMatch[1], 10);
    month = parseInt(altSlashMatch[2], 10) - 1;
    day = parseInt(altSlashMatch[3], 10);
  } else {
    const date = new Date(trimmed);
    if (isNaN(date.getTime())) return false;
    year = date.getFullYear();
    month = date.getMonth();
    day = date.getDate();
  }
  
  const date = new Date(year, month, day);
  return date.getFullYear() === year && 
         date.getMonth() === month && 
         date.getDate() === day;
};

const normalizeDate = (dateString: string): string => {
  if (!dateString.trim()) return '';
  const trimmed = dateString.trim();
  
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const altSlashMatch = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  
  let year: number, month: number, day: number;
  
  if (isoMatch) {
    year = parseInt(isoMatch[1], 10);
    month = parseInt(isoMatch[2], 10) - 1;
    day = parseInt(isoMatch[3], 10);
  } else if (slashMatch) {
    month = parseInt(slashMatch[1], 10) - 1;
    day = parseInt(slashMatch[2], 10);
    year = parseInt(slashMatch[3], 10);
  } else if (altSlashMatch) {
    year = parseInt(altSlashMatch[1], 10);
    month = parseInt(altSlashMatch[2], 10) - 1;
    day = parseInt(altSlashMatch[3], 10);
  } else {
    const date = new Date(trimmed);
    year = date.getFullYear();
    month = date.getMonth();
    day = date.getDate();
  }
  
  const date = new Date(year, month, day);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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

const buildPreviewRows = (
  headers: string[],
  fieldMapping: CsvFieldMapping,
  rawRows: string[][],
  existingSpecimens: Specimen[],
  existingBoxes: Box[],
  existingBatches: CollectionBatch[]
): { rows: ImportPreviewRow[]; relatedObjects: ImportRelatedObjects } => {
  const existingSpecimenNos = new Set(existingSpecimens.map(s => s.specimenNo.toLowerCase()));
  const existingBoxNames = new Set(existingBoxes.map(b => b.name.toLowerCase()));
  const existingBatchNames = new Set(existingBatches.map(b => b.name.toLowerCase()));
  const existingBatchIds = new Set(existingBatches.map(b => b.id));
  const fileSpecimenNos = new Map<string, number[]>();

  const rows: ImportPreviewRow[] = rawRows.map((rowData, rowIdx) => {
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
          } else {
            data.collectionDate = '';
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
          break;
        case 'notes':
          data.notes = value.trim();
          break;
        case 'batchId': {
          const batchValue = value.trim();
          data.batchId = batchValue;
          break;
        }
        case 'complianceStatus': {
          const statusValue = value.trim();
          if (statusValue) {
            const parsedStatus = parseComplianceStatus(statusValue);
            if (parsedStatus === null) {
              errors.push(createError(
                actualRowIndex,
                '合规状态',
                'invalid_compliance_status',
                `合规状态格式不正确: "${statusValue}"，有效值包括：无需合规、保护物种、外来物种、特许采集、许可过期、待确认`
              ));
            } else {
              data.complianceStatus = parsedStatus;
            }
          }
          break;
        }
        case 'permitNumber':
          data.permitNumber = value.trim();
          break;
        case 'permitExpiryDate':
          if (value.trim()) {
            if (!isValidDate(value)) {
              errors.push(createError(
                actualRowIndex,
                '到期日期',
                'invalid_date',
                `日期格式不正确: "${value}"`
              ));
            } else {
              data.permitExpiryDate = normalizeDate(value);
            }
          } else {
            data.permitExpiryDate = '';
          }
          break;
        case 'complianceNotes':
          data.complianceNotes = value.trim();
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

  const newBoxMap = new Map<string, number[]>();
  const newBatchMap = new Map<string, number[]>();

  rows.forEach((row) => {
    if (!row.isValid) return;

    if (row.data.boxName) {
      const lowerBoxName = row.data.boxName.toLowerCase();
      if (!existingBoxNames.has(lowerBoxName)) {
        row.warnings.push(createError(
          row.rowIndex,
          '展盒名称',
          'box_not_found',
          `展盒 "${row.data.boxName}" 将在导入时自动创建`
        ));
        if (!newBoxMap.has(lowerBoxName)) {
          newBoxMap.set(lowerBoxName, []);
        }
        newBoxMap.get(lowerBoxName)!.push(row.rowIndex);
      }
    }

    if (row.data.batchId) {
      const batchValue = row.data.batchId;
      const isExistingId = existingBatchIds.has(batchValue);
      const lowerBatchName = batchValue.toLowerCase();
      const isExistingName = existingBatchNames.has(lowerBatchName);

      if (!isExistingId && !isExistingName) {
        row.warnings.push(createError(
          row.rowIndex,
          '采集批次',
          'batch_not_found',
          `采集批次 "${batchValue}" 将在导入时自动创建`
        ));
        if (!newBatchMap.has(lowerBatchName)) {
          newBatchMap.set(lowerBatchName, []);
        }
        newBatchMap.get(lowerBatchName)!.push(row.rowIndex);
      }
    }
  });

  const newBoxes: NewBoxInfo[] = Array.from(newBoxMap.entries()).map(([lowerName, rowIndices]) => {
    const firstRowWithBox = rows.find(r => r.data.boxName?.toLowerCase() === lowerName);
    const displayName = firstRowWithBox?.data.boxName || lowerName;
    return { name: displayName, rowIndices };
  });

  const newBatches: NewBatchInfo[] = Array.from(newBatchMap.entries()).map(([lowerName, rowIndices]) => {
    const firstRowWithBatch = rows.find(r => r.data.batchId?.toLowerCase() === lowerName);
    const displayName = firstRowWithBatch?.data.batchId || lowerName;
    return { name: displayName, rowIndices };
  });

  const relatedObjects: ImportRelatedObjects = {
    newBoxes,
    newBatches,
    existingBoxNames,
    existingBatchNames,
    existingBatchIds,
  };

  return { rows, relatedObjects };
};

export const validateAndPreviewCsv = (
  csvContent: string,
  existingSpecimens: Specimen[],
  existingBoxes: Box[],
  existingBatches: CollectionBatch[]
): ImportPreviewData => {
  const parsedRows = parseCsv(csvContent);

  if (parsedRows.length < 1) {
    throw new Error('CSV文件为空或格式不正确');
  }

  const headers = parsedRows[0];
  const dataRows = parsedRows.slice(1);
  const fieldMapping = autoDetectFieldMapping(headers);

  const { rows, relatedObjects } = buildPreviewRows(
    headers, fieldMapping, dataRows,
    existingSpecimens, existingBoxes, existingBatches
  );

  const validCount = rows.filter(r => r.isValid).length;
  const invalidCount = rows.filter(r => !r.isValid).length;

  return {
    headers,
    fieldMapping,
    rows,
    validCount,
    invalidCount,
    totalCount: rows.length,
    relatedObjects,
    rawRows: dataRows,
  };
};

export const revalidatePreviewData = (
  headers: string[],
  fieldMapping: CsvFieldMapping,
  rawRows: string[][],
  existingSpecimens: Specimen[],
  existingBoxes: Box[],
  existingBatches: CollectionBatch[]
): ImportPreviewData => {
  const { rows, relatedObjects } = buildPreviewRows(
    headers, fieldMapping, rawRows,
    existingSpecimens, existingBoxes, existingBatches
  );

  const validCount = rows.filter(r => r.isValid).length;
  const invalidCount = rows.filter(r => !r.isValid).length;

  return {
    headers,
    fieldMapping,
    rows,
    validCount,
    invalidCount,
    totalCount: rows.length,
    relatedObjects,
    rawRows,
  };
};

export const convertToSpecimenFormData = (
  previewRow: ImportPreviewRow,
  boxes: Box[],
  batches: CollectionBatch[],
  newBoxIdMap: Record<string, string> = {},
  newBatchIdMap: Record<string, string> = {}
): SpecimenFormData | null => {
  if (!previewRow.isValid || !previewRow.data.specimenNo || !previewRow.data.species) {
    return null;
  }

  const { data } = previewRow;

  let boxId = '';
  if (data.boxName) {
    const lowerBoxName = data.boxName.toLowerCase();
    if (newBoxIdMap[lowerBoxName]) {
      boxId = newBoxIdMap[lowerBoxName];
    } else {
      const box = boxes.find(b => b.name.toLowerCase() === lowerBoxName);
      boxId = box?.id || '';
    }
  }

  let batchId = '';
  if (data.batchId) {
    const lowerBatchName = data.batchId.toLowerCase();
    if (newBatchIdMap[lowerBatchName]) {
      batchId = newBatchIdMap[lowerBatchName];
    } else if (batches.some(b => b.id === data.batchId)) {
      batchId = data.batchId;
    } else {
      const batch = batches.find(b => b.name.toLowerCase() === lowerBatchName);
      batchId = batch?.id || '';
    }
  }

  return {
    specimenNo: data.specimenNo,
    species: data.species,
    collectionLocation: data.collectionLocation || '',
    collectionDate: data.collectionDate || '',
    pinnedStatus: data.pinnedStatus ?? false,
    photographed: data.photographed ?? false,
    boxId,
    batchId,
    notes: data.notes || '',
    complianceStatus: (data.complianceStatus as ComplianceStatus) ?? DEFAULT_COMPLIANCE_STATUS,
    permitNumber: data.permitNumber || '',
    permitExpiryDate: data.permitExpiryDate || '',
    complianceNotes: data.complianceNotes || '',
  };
};

export const createBoxFormData = (boxName: string): BoxFormData => ({
  name: boxName,
  location: '',
  notes: 'CSV导入时自动创建',
});

export const createBatchFormData = (batchName: string): CollectionBatchFormData => ({
  name: batchName,
  collectionDate: '',
  location: '',
  participants: '',
  notes: 'CSV导入时自动创建',
});
