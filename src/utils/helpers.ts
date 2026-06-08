import type {
  CsvFieldMapping,
  CsvRowData,
  ValidationError,
  ValidationErrorType,
  ImportPreviewData,
  ImportPreviewRow,
  SpecimenFormData,
  BackupFileData,
  RestoreCompatibilityCheck,
  RestorePreviewData,
  RestoreOptions,
  RestoreResult,
  SpecimenLabelData,
  LabelFieldCheckResult,
  ComplianceStatus,
  DiffItem,
  DiffItemType,
  DiffConflictType,
  DiffAnalysisResult,
  FieldDiff,
  MergeStrategy,
  MergeResult,
  MergeSnapshot,
  NewBoxInfo,
  NewBatchInfo,
  ImportRelatedObjects,
} from '../types';
import type { Box, Specimen, CollectionBatch, BoxFormData, CollectionBatchFormData } from '../types';
import { LABEL_FIELDS, COMPLIANCE_STATUS_OPTIONS, DEFAULT_COMPLIANCE_STATUS, BACKUP_FILE_VERSION } from '../types';

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
  complianceStatus: ComplianceStatus;
  permitNumber: string;
  permitExpiryDate: string;
  complianceNotes: string;
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
  complianceStatus: {
    exact: ['合规状态', 'compliancestatus', 'compliance_status', 'compliance'],
    contains: ['合规状态', 'compliancestatus', 'compliance_status', 'compliance'],
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

  const existingSpecimenNos = new Set(existingSpecimens.map(s => s.specimenNo.toLowerCase()));
  const existingBoxNames = new Set(existingBoxes.map(b => b.name.toLowerCase()));
  const existingBatchNames = new Set(existingBatches.map(b => b.name.toLowerCase()));
  const existingBatchIds = new Set(existingBatches.map(b => b.id));
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

export const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file, 'UTF-8');
  });
};

export const createBackupData = (
  boxes: Box[],
  specimens: Specimen[],
  batches: CollectionBatch[]
): BackupFileData => {
  return {
    version: BACKUP_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    appName: '昆虫标本管理系统',
    data: {
      boxes: JSON.parse(JSON.stringify(boxes)),
      specimens: JSON.parse(JSON.stringify(specimens)),
      batches: JSON.parse(JSON.stringify(batches)),
    },
    stats: {
      boxCount: boxes.length,
      specimenCount: specimens.length,
      batchCount: batches.length,
    },
  };
};

export const downloadJson = (jsonContent: string, filename: string): void => {
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
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

export const exportBackup = (
  boxes: Box[],
  specimens: Specimen[],
  batches: CollectionBatch[]
): void => {
  const backupData = createBackupData(boxes, specimens, batches);
  const jsonContent = JSON.stringify(backupData, null, 2);
  const today = new Date().toISOString().split('T')[0];
  const filename = `标本数据备份_${today}.json`;
  downloadJson(jsonContent, filename);
};

export const parseBackupFile = (content: string): BackupFileData => {
  try {
    const data = JSON.parse(content);

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('备份文件格式不正确');
    }

    if (!('version' in data) || !('data' in data) || !('stats' in data)) {
      throw new Error('备份文件缺少必要字段');
    }

    if (!data.data || typeof data.data !== 'object' || Array.isArray(data.data)) {
      throw new Error('备份文件数据字段格式不正确');
    }

    if (!('boxes' in data.data) || !('specimens' in data.data) || !('batches' in data.data)) {
      throw new Error('备份文件数据结构不完整');
    }

    return data as BackupFileData;
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error('JSON解析失败，请确保文件是有效的JSON格式');
    }
    if (e instanceof Error) {
      throw e;
    }
    throw new Error('解析备份文件时发生未知错误');
  }
};

export const migrateSpecimenWithCompliance = (specimen: Partial<Specimen>): Specimen => {
  return {
    id: specimen.id || generateId(),
    specimenNo: specimen.specimenNo || '',
    species: specimen.species || '',
    collectionLocation: specimen.collectionLocation || '',
    collectionDate: specimen.collectionDate || '',
    pinnedStatus: specimen.pinnedStatus ?? false,
    boxId: specimen.boxId || '',
    batchId: specimen.batchId || '',
    photographed: specimen.photographed ?? false,
    notes: specimen.notes || '',
    complianceStatus: specimen.complianceStatus ?? DEFAULT_COMPLIANCE_STATUS,
    permitNumber: specimen.permitNumber || '',
    permitExpiryDate: specimen.permitExpiryDate || '',
    complianceNotes: specimen.complianceNotes || '',
    createdAt: specimen.createdAt || new Date().toISOString(),
    updatedAt: specimen.updatedAt || new Date().toISOString(),
  };
};

export const checkCompatibility = (backupData: BackupFileData): RestoreCompatibilityCheck => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const currentVersion = BACKUP_FILE_VERSION;
  const versionMatch = backupData.version === currentVersion;

  if (backupData.version > currentVersion) {
    errors.push(`备份文件版本 (v${backupData.version}) 高于当前系统版本 (v${currentVersion})，请更新系统后再尝试恢复`);
  }

  if (backupData.version < currentVersion) {
    warnings.push(`备份文件版本 (v${backupData.version}) 低于当前系统版本 (v${currentVersion})，可能存在兼容性问题`);
    if (backupData.version < 2) {
      warnings.push('备份文件版本 v1 不包含合规字段数据，恢复后合规字段将使用默认值（无需合规）');
    }
  }

  if (!Array.isArray(backupData.data.boxes)) {
    errors.push('备份文件中的展盒数据格式不正确');
  }

  if (!Array.isArray(backupData.data.specimens)) {
    errors.push('备份文件中的标本数据格式不正确');
  }

  if (!Array.isArray(backupData.data.batches)) {
    errors.push('备份文件中的批次数据格式不正确');
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
      warnings,
      versionMatch,
      canRestore: false,
    };
  }

  const requiredBoxFields = ['id', 'name'];
  backupData.data.boxes.forEach((box, idx) => {
    const missing = requiredBoxFields.filter(f => !(f in box));
    if (missing.length > 0) {
      errors.push(`展盒数据第 ${idx + 1} 条缺少必要字段: ${missing.join(', ')}`);
    }
  });

  const requiredSpecimenFields = ['id', 'specimenNo', 'species'];
  backupData.data.specimens.forEach((specimen, idx) => {
    const missing = requiredSpecimenFields.filter(f => !(f in specimen));
    if (missing.length > 0) {
      errors.push(`标本数据第 ${idx + 1} 条缺少必要字段: ${missing.join(', ')}`);
    }
  });

  const isValid = errors.length === 0;
  const canRestore = errors.length === 0;

  return {
    isValid,
    errors,
    warnings,
    versionMatch,
    canRestore,
  };
};

export const analyzeConflicts = (
  backupData: BackupFileData,
  currentBoxes: Box[],
  currentSpecimens: Specimen[],
  currentBatches: CollectionBatch[]
): RestorePreviewData['conflicts'] => {
  const emptyConflicts: RestorePreviewData['conflicts'] = {
    boxIdConflicts: [],
    specimenIdConflicts: [],
    batchIdConflicts: [],
    specimenNoConflicts: [],
    missingBoxReferences: [],
    missingBatchReferences: [],
  };

  if (
    !backupData?.data ||
    !Array.isArray(backupData.data.boxes) ||
    !Array.isArray(backupData.data.specimens) ||
    !Array.isArray(backupData.data.batches)
  ) {
    return emptyConflicts;
  }

  const currentBoxIds = new Set(currentBoxes.map(b => b.id));
  const currentSpecimenIds = new Set(currentSpecimens.map(s => s.id));
  const currentBatchIds = new Set(currentBatches.map(b => b.id));
  const currentSpecimenNos = new Set(currentSpecimens.map(s => s.specimenNo.toLowerCase()));

  const boxIdConflicts = backupData.data.boxes
    .filter(b => currentBoxIds.has(b.id))
    .map(b => b.id);

  const specimenIdConflicts = backupData.data.specimens
    .filter(s => currentSpecimenIds.has(s.id))
    .map(s => s.id);

  const batchIdConflicts = backupData.data.batches
    .filter(b => currentBatchIds.has(b.id))
    .map(b => b.id);

  const specimenNoConflicts = backupData.data.specimens
    .filter(s => currentSpecimenNos.has(s.specimenNo.toLowerCase()))
    .map(s => s.specimenNo);

  const backupBoxIds = new Set(backupData.data.boxes.map(b => b.id));
  const backupBatchIds = new Set(backupData.data.batches.map(b => b.id));

  const missingBoxReferences = backupData.data.specimens
    .filter(s => s.boxId && !backupBoxIds.has(s.boxId) && !currentBoxIds.has(s.boxId))
    .map(s => `${s.specimenNo} (引用展盒ID: ${s.boxId})`);

  const missingBatchReferences = backupData.data.specimens
    .filter(s => s.batchId && !backupBatchIds.has(s.batchId) && !currentBatchIds.has(s.batchId))
    .map(s => `${s.specimenNo} (引用批次ID: ${s.batchId})`);

  return {
    boxIdConflicts,
    specimenIdConflicts,
    batchIdConflicts,
    specimenNoConflicts,
    missingBoxReferences,
    missingBatchReferences,
  };
};

export const generateIdMappingPlan = (
  backupData: BackupFileData,
  conflicts: RestorePreviewData['conflicts']
): RestorePreviewData['idMappingPlan'] => {
  const boxIdMap: Record<string, string> = {};
  const specimenIdMap: Record<string, string> = {};
  const batchIdMap: Record<string, string> = {};

  if (conflicts?.boxIdConflicts && Array.isArray(conflicts.boxIdConflicts)) {
    conflicts.boxIdConflicts.forEach(oldId => {
      boxIdMap[oldId] = generateId();
    });
  }

  if (conflicts?.specimenIdConflicts && Array.isArray(conflicts.specimenIdConflicts)) {
    conflicts.specimenIdConflicts.forEach(oldId => {
      specimenIdMap[oldId] = generateId();
    });
  }

  if (conflicts?.batchIdConflicts && Array.isArray(conflicts.batchIdConflicts)) {
    conflicts.batchIdConflicts.forEach(oldId => {
      batchIdMap[oldId] = generateId();
    });
  }

  return {
    boxIdMap,
    specimenIdMap,
    batchIdMap,
  };
};

export const generateRestorePreview = (
  backupData: BackupFileData,
  currentBoxes: Box[],
  currentSpecimens: Specimen[],
  currentBatches: CollectionBatch[]
): RestorePreviewData => {
  const compatibility = checkCompatibility(backupData);

  const emptyConflicts: RestorePreviewData['conflicts'] = {
    boxIdConflicts: [],
    specimenIdConflicts: [],
    batchIdConflicts: [],
    specimenNoConflicts: [],
    missingBoxReferences: [],
    missingBatchReferences: [],
  };

  const emptyIdMappingPlan: RestorePreviewData['idMappingPlan'] = {
    boxIdMap: {},
    specimenIdMap: {},
    batchIdMap: {},
  };

  if (!compatibility.canRestore) {
    return {
      backupData,
      compatibility,
      currentStats: {
        boxCount: currentBoxes.length,
        specimenCount: currentSpecimens.length,
        batchCount: currentBatches.length,
      },
      conflicts: emptyConflicts,
      idMappingPlan: emptyIdMappingPlan,
    };
  }

  const conflicts = analyzeConflicts(backupData, currentBoxes, currentSpecimens, currentBatches);
  const idMappingPlan = generateIdMappingPlan(backupData, conflicts);

  return {
    backupData,
    compatibility,
    currentStats: {
      boxCount: currentBoxes.length,
      specimenCount: currentSpecimens.length,
      batchCount: currentBatches.length,
    },
    conflicts,
    idMappingPlan,
  };
};

export const remapIds = (
  backupData: BackupFileData,
  idMappingPlan: RestorePreviewData['idMappingPlan']
): BackupFileData => {
  const { boxIdMap = {}, specimenIdMap = {}, batchIdMap = {} } = idMappingPlan || {};

  const remappedBoxes = Array.isArray(backupData.data.boxes)
    ? backupData.data.boxes.map(box => ({
        ...box,
        id: boxIdMap[box.id] || box.id,
      }))
    : [];

  const remappedBatches = Array.isArray(backupData.data.batches)
    ? backupData.data.batches.map(batch => ({
        ...batch,
        id: batchIdMap[batch.id] || batch.id,
      }))
    : [];

  const remappedSpecimens = Array.isArray(backupData.data.specimens)
    ? backupData.data.specimens.map(specimen => {
        const newSpecimenId = specimenIdMap[specimen.id] || specimen.id;
        const newBoxId = specimen.boxId ? (boxIdMap[specimen.boxId] || specimen.boxId) : '';
        const newBatchId = specimen.batchId ? (batchIdMap[specimen.batchId] || specimen.batchId) : '';

        return {
          ...migrateSpecimenWithCompliance(specimen),
          id: newSpecimenId,
          boxId: newBoxId,
          batchId: newBatchId,
        };
      })
    : [];

  return {
    ...backupData,
    data: {
      boxes: remappedBoxes,
      specimens: remappedSpecimens,
      batches: remappedBatches,
    },
  };
};

export const handleSpecimenNoDuplicates = (
  backupData: BackupFileData,
  currentSpecimens: Specimen[]
): { data: BackupFileData; remappedNos: string[] } => {
  const currentNos = new Set(
    currentSpecimens
      .filter(s => s.specimenNo)
      .map(s => s.specimenNo.toLowerCase())
  );
  const remappedNos: string[] = [];

  const remappedSpecimens = Array.isArray(backupData.data.specimens)
    ? backupData.data.specimens.map(specimen => {
        const migratedSpecimen = migrateSpecimenWithCompliance(specimen);

        if (!migratedSpecimen.specimenNo) {
          return migratedSpecimen;
        }

        if (currentNos.has(migratedSpecimen.specimenNo.toLowerCase())) {
          const baseNo = migratedSpecimen.specimenNo;
          let suffix = 1;
          let newNo = `${baseNo}_备份${suffix}`;

          while (currentNos.has(newNo.toLowerCase())) {
            suffix++;
            newNo = `${baseNo}_备份${suffix}`;
          }

          currentNos.add(newNo.toLowerCase());
          remappedNos.push(`${baseNo} → ${newNo}`);

          return {
            ...migratedSpecimen,
            specimenNo: newNo,
          };
        }
        return migratedSpecimen;
      })
    : [];

  return {
    data: {
      ...backupData,
      data: {
        ...backupData.data,
        specimens: remappedSpecimens,
      },
    },
    remappedNos,
  };
};

export const filterSpecimensWithValidReferences = (
  specimens: Specimen[],
  validBoxIds: Set<string>,
  validBatchIds: Set<string>
): { valid: Specimen[]; invalid: Specimen[] } => {
  const valid: Specimen[] = [];
  const invalid: Specimen[] = [];

  if (!Array.isArray(specimens)) {
    return { valid, invalid };
  }

  const safeValidBoxIds = validBoxIds || new Set();
  const safeValidBatchIds = validBatchIds || new Set();

  specimens.forEach(specimen => {
    if (!specimen) return;

    const boxValid = !specimen.boxId || safeValidBoxIds.has(specimen.boxId);
    const batchValid = !specimen.batchId || safeValidBatchIds.has(specimen.batchId);

    if (boxValid && batchValid) {
      valid.push(migrateSpecimenWithCompliance(specimen));
    } else {
      invalid.push(migrateSpecimenWithCompliance(specimen));
    }
  });

  return { valid, invalid };
};

export const performRestore = (
  previewData: RestorePreviewData,
  options: RestoreOptions,
  currentBoxes: Box[],
  currentSpecimens: Specimen[],
  currentBatches: CollectionBatch[],
  setBoxes: (value: Box[] | ((prev: Box[]) => Box[])) => void,
  setSpecimens: (value: Specimen[] | ((prev: Specimen[]) => Specimen[])) => void,
  setBatches: (value: CollectionBatch[] | ((prev: CollectionBatch[]) => CollectionBatch[])) => void
): RestoreResult => {
  if (!previewData.compatibility.canRestore) {
    return {
      success: false,
      message: '备份文件不兼容，无法恢复',
      stats: {
        boxesAdded: 0,
        boxesUpdated: 0,
        specimensAdded: 0,
        specimensUpdated: 0,
        batchesAdded: 0,
        batchesUpdated: 0,
        skippedDueToMissingRefs: 0,
      },
    };
  }

  let processedData = previewData.backupData;

  if (options.mode === 'merge') {
    processedData = remapIds(processedData, previewData.idMappingPlan);

    const noRemapResult = handleSpecimenNoDuplicates(processedData, currentSpecimens);
    processedData = noRemapResult.data;
  }

  if (options.importSpecimens && options.mode === 'overwrite') {
    processedData = {
      ...processedData,
      data: {
        ...processedData.data,
        specimens: processedData.data.specimens.map(s => migrateSpecimenWithCompliance(s)),
      },
    };
  }

  const resultStats: RestoreResult['stats'] = {
    boxesAdded: 0,
    boxesUpdated: 0,
    specimensAdded: 0,
    specimensUpdated: 0,
    batchesAdded: 0,
    batchesUpdated: 0,
    skippedDueToMissingRefs: 0,
  };

  if (options.mode === 'overwrite') {
    if (options.importBoxes) {
      setBoxes(processedData.data.boxes);
      resultStats.boxesAdded = processedData.data.boxes.length;
    }

    if (options.importBatches) {
      setBatches(processedData.data.batches);
      resultStats.batchesAdded = processedData.data.batches.length;
    }

    if (options.importSpecimens) {
      const validBoxIds = options.importBoxes
        ? new Set(processedData.data.boxes.map(b => b.id))
        : new Set(currentBoxes.map(b => b.id));

      const validBatchIds = options.importBatches
        ? new Set(processedData.data.batches.map(b => b.id))
        : new Set(currentBatches.map(b => b.id));

      const { valid, invalid } = filterSpecimensWithValidReferences(
        processedData.data.specimens,
        validBoxIds,
        validBatchIds
      );

      setSpecimens(valid);
      resultStats.specimensAdded = valid.length;
      resultStats.skippedDueToMissingRefs = invalid.length;
    }

    return {
      success: true,
      message: '数据已覆盖恢复',
      stats: resultStats,
    };
  }

  if (options.mode === 'merge') {
    if (options.importBoxes) {
      const currentBoxMap = new Map(currentBoxes.map(b => [b.id, b]));
      const mergedBoxes = [...currentBoxes];

      processedData.data.boxes.forEach(box => {
        if (currentBoxMap.has(box.id)) {
          const idx = mergedBoxes.findIndex(b => b.id === box.id);
          mergedBoxes[idx] = { ...box };
          resultStats.boxesUpdated++;
        } else {
          mergedBoxes.push({ ...box });
          resultStats.boxesAdded++;
        }
      });

      setBoxes(mergedBoxes);
    }

    if (options.importBatches) {
      const currentBatchMap = new Map(currentBatches.map(b => [b.id, b]));
      const mergedBatches = [...currentBatches];

      processedData.data.batches.forEach(batch => {
        if (currentBatchMap.has(batch.id)) {
          const idx = mergedBatches.findIndex(b => b.id === batch.id);
          mergedBatches[idx] = { ...batch };
          resultStats.batchesUpdated++;
        } else {
          mergedBatches.push({ ...batch });
          resultStats.batchesAdded++;
        }
      });

      setBatches(mergedBatches);
    }

    if (options.importSpecimens) {
      const validBoxIds = new Set(currentBoxes.map(b => b.id));
      if (options.importBoxes) {
        processedData.data.boxes.forEach(b => validBoxIds.add(b.id));
      }

      const validBatchIds = new Set(currentBatches.map(b => b.id));
      if (options.importBatches) {
        processedData.data.batches.forEach(b => validBatchIds.add(b.id));
      }

      const { valid, invalid } = filterSpecimensWithValidReferences(
        processedData.data.specimens,
        validBoxIds,
        validBatchIds
      );

      const currentSpecimenMap = new Map(currentSpecimens.map(s => [s.id, s]));
      const mergedSpecimens = [...currentSpecimens];

      valid.forEach(specimen => {
        if (currentSpecimenMap.has(specimen.id)) {
          const idx = mergedSpecimens.findIndex(s => s.id === specimen.id);
          mergedSpecimens[idx] = { ...specimen };
          resultStats.specimensUpdated++;
        } else {
          mergedSpecimens.push({ ...specimen });
          resultStats.specimensAdded++;
        }
      });

      setSpecimens(mergedSpecimens);
      resultStats.skippedDueToMissingRefs = invalid.length;
    }

    return {
      success: true,
      message: '数据已合并恢复',
      stats: resultStats,
    };
  }

  return {
    success: false,
    message: '未知的恢复模式',
    stats: resultStats,
  };
};

export const getSpecimenLabelData = (
  specimen: Specimen,
  boxes: Box[]
): SpecimenLabelData => {
  const box = boxes.find(b => b.id === specimen.boxId);

  return {
    specimenNo: specimen.specimenNo,
    species: specimen.species,
    collectionLocation: specimen.collectionLocation,
    collectionDate: specimen.collectionDate,
    boxLocation: box?.location || '',
    photographed: specimen.photographed,
    boxName: box?.name || '未分配展盒',
  };
};

export const checkLabelFields = (
  labelData: SpecimenLabelData,
  specimen: Specimen
): LabelFieldCheckResult => {
  const missingFields: string[] = [];

  LABEL_FIELDS.forEach(field => {
    if (field.required) {
      const value = labelData[field.key as keyof SpecimenLabelData];
      if (value === undefined || value === null || value === '') {
        missingFields.push(field.label);
      }
    }
  });

  return {
    specimenId: specimen.id,
    specimenNo: specimen.specimenNo,
    missingFields,
    isValid: missingFields.length === 0,
  };
};

export const batchCheckLabelFields = (
  specimens: Specimen[],
  boxes: Box[]
): { results: LabelFieldCheckResult[]; validCount: number; invalidCount: number } => {
  const results = specimens.map(specimen => {
    const labelData = getSpecimenLabelData(specimen, boxes);
    return checkLabelFields(labelData, specimen);
  });

  const validCount = results.filter(r => r.isValid).length;
  const invalidCount = results.filter(r => !r.isValid).length;

  return { results, validCount, invalidCount };
};

export const getPrintStyles = (): string => {
  return `
    @page {
      margin: 5mm;
      size: auto;
    }

    @media print {
      body * {
        visibility: hidden;
      }

      #label-print-area, #label-print-area * {
        visibility: visible;
      }

      #label-print-area {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
      }

      .label-page {
        page-break-after: always;
        page-break-inside: avoid;
        margin: 0;
        padding: 0;
      }

      .label-page:last-child {
        page-break-after: auto;
      }

      .label-item {
        page-break-inside: avoid;
      }
    }
  `;
};

export const generateLabelPages = <T>(
  items: T[],
  itemsPerPage: number
): T[][] => {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += itemsPerPage) {
    pages.push(items.slice(i, i + itemsPerPage));
  }
  return pages;
};

const BOX_COMPARE_FIELDS = ['name', 'location', 'notes'];
const BATCH_COMPARE_FIELDS = ['name', 'collectionDate', 'location', 'participants', 'notes'];
const SPECIMEN_COMPARE_FIELDS = [
  'specimenNo', 'species', 'collectionLocation', 'collectionDate',
  'pinnedStatus', 'boxId', 'batchId', 'photographed', 'notes',
  'complianceStatus', 'permitNumber', 'permitExpiryDate', 'complianceNotes'
];

const compareObjects = (
  obj1: Record<string, unknown>,
  obj2: Record<string, unknown>,
  fields: string[]
): FieldDiff[] => {
  const diffs: FieldDiff[] = [];
  fields.forEach(field => {
    const val1 = obj1[field];
    const val2 = obj2[field];
    if (JSON.stringify(val1) !== JSON.stringify(val2)) {
      diffs.push({
        field,
        currentValue: val1,
        backupValue: val2,
      });
    }
  });
  return diffs;
};

const getDisplayName = (item: Box | Specimen | CollectionBatch, type: DiffItemType): string => {
  switch (type) {
    case 'box':
      return (item as Box).name;
    case 'batch':
      return (item as CollectionBatch).name;
    case 'specimen':
      return (item as Specimen).species;
    default:
      return '';
  }
};

const getDefaultStrategy = (conflictType: DiffConflictType): MergeStrategy => {
  switch (conflictType) {
    case 'new_in_backup':
      return 'keep_import';
    case 'deleted_in_backup':
      return 'keep_current';
    case 'id_conflict':
    case 'specimen_no_conflict':
    case 'field_inconsistent':
      return 'keep_current';
    case 'missing_box_ref':
    case 'missing_batch_ref':
      return 'keep_import';
    default:
      return 'keep_current';
  }
};

const createReferenceRepair = (
  referenceType: 'box' | 'batch',
  missingId: string,
  backupData: BackupFileData
): DiffItem['referenceRepair'] => {
  const backupName = referenceType === 'box'
    ? backupData.data.boxes.find(b => b.id === missingId)?.name
    : backupData.data.batches.find(b => b.id === missingId)?.name;

  return {
    referenceType,
    missingId,
    backupName,
    selectedAction: 'skip',
  };
};

export const analyzeDifferences = (
  backupData: BackupFileData,
  currentBoxes: Box[],
  currentSpecimens: Specimen[],
  currentBatches: CollectionBatch[]
): DiffAnalysisResult => {
  const items: DiffItem[] = [];

  const currentBoxMap = new Map(currentBoxes.map(b => [b.id, b]));
  const backupBoxMap = new Map(backupData.data.boxes.map(b => [b.id, b]));
  const currentBatchMap = new Map(currentBatches.map(b => [b.id, b]));
  const backupBatchMap = new Map(backupData.data.batches.map(b => [b.id, b]));
  const currentSpecimenMap = new Map(currentSpecimens.map(s => [s.id, s]));
  const backupSpecimenMap = new Map(backupData.data.specimens.map(s => [s.id, s]));
  const currentSpecimenNoMap = new Map(currentSpecimens.map(s => [s.specimenNo.toLowerCase(), s]));

  const allBoxIds = new Set([...currentBoxMap.keys(), ...backupBoxMap.keys()]);
  const allBatchIds = new Set([...currentBatchMap.keys(), ...backupBatchMap.keys()]);
  const allSpecimenIds = new Set([...currentSpecimenMap.keys(), ...backupSpecimenMap.keys()]);

  const validBoxIds = new Set([...currentBoxMap.keys(), ...backupBoxMap.keys()]);
  const validBatchIds = new Set([...currentBatchMap.keys(), ...backupBatchMap.keys()]);

  allBoxIds.forEach(id => {
    const current = currentBoxMap.get(id) || null;
    const backup = backupBoxMap.get(id) || null;

    if (current && !backup) {
      items.push({
        type: 'box',
        conflictType: 'deleted_in_backup',
        id,
        currentData: current,
        backupData: null,
        displayName: getDisplayName(current, 'box'),
        selectedStrategy: getDefaultStrategy('deleted_in_backup'),
      });
    } else if (!current && backup) {
      items.push({
        type: 'box',
        conflictType: 'new_in_backup',
        id,
        currentData: null,
        backupData: backup,
        displayName: getDisplayName(backup, 'box'),
        selectedStrategy: getDefaultStrategy('new_in_backup'),
      });
    } else if (current && backup) {
      const fieldDiffs = compareObjects(
        current as unknown as Record<string, unknown>,
        backup as unknown as Record<string, unknown>,
        BOX_COMPARE_FIELDS
      );
      if (fieldDiffs.length > 0) {
        items.push({
          type: 'box',
          conflictType: 'field_inconsistent',
          id,
          currentData: current,
          backupData: backup,
          fieldDiffs,
          displayName: getDisplayName(current, 'box'),
          selectedStrategy: getDefaultStrategy('field_inconsistent'),
        });
      }
    }
  });

  allBatchIds.forEach(id => {
    const current = currentBatchMap.get(id) || null;
    const backup = backupBatchMap.get(id) || null;

    if (current && !backup) {
      items.push({
        type: 'batch',
        conflictType: 'deleted_in_backup',
        id,
        currentData: current,
        backupData: null,
        displayName: getDisplayName(current, 'batch'),
        selectedStrategy: getDefaultStrategy('deleted_in_backup'),
      });
    } else if (!current && backup) {
      items.push({
        type: 'batch',
        conflictType: 'new_in_backup',
        id,
        currentData: null,
        backupData: backup,
        displayName: getDisplayName(backup, 'batch'),
        selectedStrategy: getDefaultStrategy('new_in_backup'),
      });
    } else if (current && backup) {
      const fieldDiffs = compareObjects(
        current as unknown as Record<string, unknown>,
        backup as unknown as Record<string, unknown>,
        BATCH_COMPARE_FIELDS
      );
      if (fieldDiffs.length > 0) {
        items.push({
          type: 'batch',
          conflictType: 'field_inconsistent',
          id,
          currentData: current,
          backupData: backup,
          fieldDiffs,
          displayName: getDisplayName(current, 'batch'),
          selectedStrategy: getDefaultStrategy('field_inconsistent'),
        });
      }
    }
  });

  const processedSpecimenNos = new Set<string>();

  allSpecimenIds.forEach(id => {
    const current = currentSpecimenMap.get(id) || null;
    const backup = backupSpecimenMap.get(id) || null;

    if (current && !backup) {
      items.push({
        type: 'specimen',
        conflictType: 'deleted_in_backup',
        id,
        currentData: current,
        backupData: null,
        displayName: getDisplayName(current, 'specimen'),
        specimenNo: current.specimenNo,
        selectedStrategy: getDefaultStrategy('deleted_in_backup'),
      });
    } else if (!current && backup) {
      const migratedBackup = migrateSpecimenWithCompliance(backup);
      const noConflict = currentSpecimenNoMap.has(migratedBackup.specimenNo.toLowerCase());

      if (noConflict) {
        const existing = currentSpecimenNoMap.get(migratedBackup.specimenNo.toLowerCase())!;
        processedSpecimenNos.add(existing.id);
        const fieldDiffs = compareObjects(
          existing as unknown as Record<string, unknown>,
          migratedBackup as unknown as Record<string, unknown>,
          SPECIMEN_COMPARE_FIELDS
        );
        items.push({
          type: 'specimen',
          conflictType: 'specimen_no_conflict',
          id: existing.id,
          currentData: existing,
          backupData: migratedBackup,
          fieldDiffs,
          displayName: getDisplayName(existing, 'specimen'),
          specimenNo: existing.specimenNo,
          selectedStrategy: getDefaultStrategy('specimen_no_conflict'),
        });
      } else {
        const missingBox = migratedBackup.boxId && !validBoxIds.has(migratedBackup.boxId);
        const missingBatch = migratedBackup.batchId && !validBatchIds.has(migratedBackup.batchId);

        if (missingBox) {
          items.push({
            type: 'specimen',
            conflictType: 'missing_box_ref',
            id: migratedBackup.id,
            currentData: null,
            backupData: migratedBackup,
            displayName: getDisplayName(migratedBackup, 'specimen'),
            specimenNo: migratedBackup.specimenNo,
            selectedStrategy: getDefaultStrategy('missing_box_ref'),
            referenceRepair: createReferenceRepair('box', migratedBackup.boxId!, backupData),
          });
        } else if (missingBatch) {
          items.push({
            type: 'specimen',
            conflictType: 'missing_batch_ref',
            id: migratedBackup.id,
            currentData: null,
            backupData: migratedBackup,
            displayName: getDisplayName(migratedBackup, 'specimen'),
            specimenNo: migratedBackup.specimenNo,
            selectedStrategy: getDefaultStrategy('missing_batch_ref'),
            referenceRepair: createReferenceRepair('batch', migratedBackup.batchId!, backupData),
          });
        } else {
          items.push({
            type: 'specimen',
            conflictType: 'new_in_backup',
            id: migratedBackup.id,
            currentData: null,
            backupData: migratedBackup,
            displayName: getDisplayName(migratedBackup, 'specimen'),
            specimenNo: migratedBackup.specimenNo,
            selectedStrategy: getDefaultStrategy('new_in_backup'),
          });
        }
      }
    } else if (current && backup) {
      if (processedSpecimenNos.has(current.id)) return;

      const migratedBackup = migrateSpecimenWithCompliance(backup);
      const fieldDiffs = compareObjects(
        current as unknown as Record<string, unknown>,
        migratedBackup as unknown as Record<string, unknown>,
        SPECIMEN_COMPARE_FIELDS
      );

      const missingBox = migratedBackup.boxId && !validBoxIds.has(migratedBackup.boxId) && !current.boxId;
      const missingBatch = migratedBackup.batchId && !validBatchIds.has(migratedBackup.batchId) && !current.batchId;

      if (missingBox) {
        items.push({
          type: 'specimen',
          conflictType: 'missing_box_ref',
          id: current.id,
          currentData: current,
          backupData: migratedBackup,
          fieldDiffs,
          displayName: getDisplayName(current, 'specimen'),
          specimenNo: current.specimenNo,
          selectedStrategy: 'keep_current',
          referenceRepair: createReferenceRepair('box', migratedBackup.boxId!, backupData),
        });
      } else if (missingBatch) {
        items.push({
          type: 'specimen',
          conflictType: 'missing_batch_ref',
          id: current.id,
          currentData: current,
          backupData: migratedBackup,
          fieldDiffs,
          displayName: getDisplayName(current, 'specimen'),
          specimenNo: current.specimenNo,
          selectedStrategy: 'keep_current',
          referenceRepair: createReferenceRepair('batch', migratedBackup.batchId!, backupData),
        });
      } else if (fieldDiffs.length > 0) {
        items.push({
          type: 'specimen',
          conflictType: 'field_inconsistent',
          id: current.id,
          currentData: current,
          backupData: migratedBackup,
          fieldDiffs,
          displayName: getDisplayName(current, 'specimen'),
          specimenNo: current.specimenNo,
          selectedStrategy: getDefaultStrategy('field_inconsistent'),
        });
      }
    }
  });

  const stats = {
    total: items.length,
    newInBackup: items.filter(i => i.conflictType === 'new_in_backup').length,
    deletedInBackup: items.filter(i => i.conflictType === 'deleted_in_backup').length,
    idConflicts: items.filter(i => i.conflictType === 'id_conflict').length,
    specimenNoConflicts: items.filter(i => i.conflictType === 'specimen_no_conflict').length,
    fieldInconsistent: items.filter(i => i.conflictType === 'field_inconsistent').length,
    missingBoxRefs: items.filter(i => i.conflictType === 'missing_box_ref').length,
    missingBatchRefs: items.filter(i => i.conflictType === 'missing_batch_ref').length,
  };

  return {
    items,
    stats,
    hasConflicts: items.some(i =>
      i.conflictType === 'specimen_no_conflict' ||
      i.conflictType === 'field_inconsistent' ||
      i.conflictType === 'missing_box_ref' ||
      i.conflictType === 'missing_batch_ref'
    ),
  };
};

const buildIdRemapping = (
  items: DiffItem[]
): { boxIdMap: Record<string, string>; batchIdMap: Record<string, string>; specimenIdMap: Record<string, string> } => {
  const boxIdMap: Record<string, string> = {};
  const batchIdMap: Record<string, string> = {};
  const specimenIdMap: Record<string, string> = {};

  items.forEach(item => {
    const isNewItem = item.conflictType === 'new_in_backup' ||
                      item.conflictType === 'missing_box_ref' ||
                      item.conflictType === 'missing_batch_ref';

    const shouldGenerateNewId =
      (item.selectedStrategy === 'keep_import' && item.conflictType === 'new_in_backup') ||
      (item.selectedStrategy === 'manual' && isNewItem);

    if (!shouldGenerateNewId) return;

    const sourceData = item.selectedStrategy === 'manual' && item.manualMergedData
      ? item.manualMergedData
      : item.backupData;

    if (!sourceData) return;

    const newId = generateId();
    if (item.type === 'box') {
      boxIdMap[sourceData.id] = newId;
    } else if (item.type === 'batch') {
      batchIdMap[sourceData.id] = newId;
    } else if (item.type === 'specimen') {
      specimenIdMap[sourceData.id] = newId;
    }
  });

  return { boxIdMap, batchIdMap, specimenIdMap };
};

const applyIdRemappingToSpecimen = (
  specimen: Specimen,
  boxIdMap: Record<string, string>,
  batchIdMap: Record<string, string>
): Specimen => {
  return {
    ...specimen,
    boxId: specimen.boxId ? (boxIdMap[specimen.boxId] || specimen.boxId) : '',
    batchId: specimen.batchId ? (batchIdMap[specimen.batchId] || specimen.batchId) : '',
  };
};

const clearDanglingSpecimenReferences = (
  specimens: Specimen[],
  boxes: Box[],
  batches: CollectionBatch[]
): Specimen[] => {
  const validBoxIds = new Set(boxes.map(box => box.id));
  const validBatchIds = new Set(batches.map(batch => batch.id));

  return specimens.map(specimen => ({
    ...specimen,
    boxId: specimen.boxId && validBoxIds.has(specimen.boxId) ? specimen.boxId : '',
    batchId: specimen.batchId && validBatchIds.has(specimen.batchId) ? specimen.batchId : '',
  }));
};

const applyReferenceRepair = (
  specimen: Specimen,
  repairInfo: DiffItem['referenceRepair'],
  mergedBoxes: Box[],
  mergedBatches: CollectionBatch[],
  boxIdMap: Record<string, string>,
  batchIdMap: Record<string, string>,
  resultStats: MergeResult['stats']
): { specimen: Specimen; skip: boolean } => {
  if (!repairInfo) {
    return { specimen, skip: false };
  }

  const result = { ...specimen };
  const action = repairInfo.selectedAction;

  if (action === 'skip') {
    return { specimen: result, skip: true };
  }

  if (action === 'clear_ref') {
    if (repairInfo.referenceType === 'box') {
      result.boxId = '';
    } else {
      result.batchId = '';
    }
  } else if (action === 'create_new') {
    const newId = generateId();
    if (repairInfo.referenceType === 'box') {
      const newBox: Box = {
        id: newId,
        name: repairInfo.newObjectName || `修复: ${repairInfo.backupName || '未知展盒'}`,
        location: '',
        notes: '由差异合并自动创建，用于修复引用',
        createdAt: new Date().toISOString(),
      };
      mergedBoxes.push(newBox);
      resultStats.boxesAdded++;
      result.boxId = newId;
      if (repairInfo.missingId) {
        boxIdMap[repairInfo.missingId] = newId;
      }
    } else {
      const newBatch: CollectionBatch = {
        id: newId,
        name: repairInfo.newObjectName || `修复: ${repairInfo.backupName || '未知批次'}`,
        collectionDate: '',
        location: '',
        participants: '',
        notes: '由差异合并自动创建，用于修复引用',
        createdAt: new Date().toISOString(),
      };
      mergedBatches.push(newBatch);
      resultStats.batchesAdded++;
      result.batchId = newId;
      if (repairInfo.missingId) {
        batchIdMap[repairInfo.missingId] = newId;
      }
    }
  } else if (action === 'choose_existing' && repairInfo.selectedExistingId) {
    if (repairInfo.referenceType === 'box') {
      result.boxId = repairInfo.selectedExistingId;
      if (repairInfo.missingId) {
        boxIdMap[repairInfo.missingId] = repairInfo.selectedExistingId;
      }
    } else {
      result.batchId = repairInfo.selectedExistingId;
      if (repairInfo.missingId) {
        batchIdMap[repairInfo.missingId] = repairInfo.selectedExistingId;
      }
    }
  }

  return { specimen: result, skip: false };
};

const processBoxes = (
  items: DiffItem[],
  mergedBoxes: Box[],
  boxIdMap: Record<string, string>,
  resultStats: MergeResult['stats']
): Box[] => {
  const result = [...mergedBoxes];
  const processedIds = new Set<string>();

  items.forEach(item => {
    if (item.type !== 'box') return;
    if (processedIds.has(item.id)) return;
    processedIds.add(item.id);

    const strategy = item.selectedStrategy;

    if (strategy === 'keep_import' && item.backupData) {
      const backupBox = item.backupData as Box;
      const newId = boxIdMap[backupBox.id] || backupBox.id;

      if (item.conflictType === 'new_in_backup') {
        result.push({ ...backupBox, id: newId });
        resultStats.boxesAdded++;
      } else {
        const idx = result.findIndex(b => b.id === item.id);
        if (idx >= 0) {
          result[idx] = { ...backupBox, id: item.id };
          resultStats.boxesUpdated++;
        }
      }
    } else if (strategy === 'manual' && item.manualMergedData) {
      const manualData = item.manualMergedData as Box;
      const isNewItem = item.conflictType === 'new_in_backup';

      if (isNewItem) {
        const newId = boxIdMap[manualData.id] || generateId();
        if (!boxIdMap[manualData.id]) {
          boxIdMap[manualData.id] = newId;
        }
        result.push({ ...manualData, id: newId });
        resultStats.boxesAdded++;
      } else {
        const idx = result.findIndex(b => b.id === item.id);
        if (idx >= 0) {
          result[idx] = manualData;
          resultStats.boxesUpdated++;
        }
      }
    } else if (item.conflictType === 'deleted_in_backup' && strategy === 'keep_import') {
      const filtered = result.filter(b => b.id !== item.id);
      result.length = 0;
      result.push(...filtered);
      resultStats.boxesDeleted++;
    }
  });

  return result;
};

const processBatches = (
  items: DiffItem[],
  mergedBatches: CollectionBatch[],
  batchIdMap: Record<string, string>,
  resultStats: MergeResult['stats']
): CollectionBatch[] => {
  const result = [...mergedBatches];
  const processedIds = new Set<string>();

  items.forEach(item => {
    if (item.type !== 'batch') return;
    if (processedIds.has(item.id)) return;
    processedIds.add(item.id);

    const strategy = item.selectedStrategy;

    if (strategy === 'keep_import' && item.backupData) {
      const backupBatch = item.backupData as CollectionBatch;
      const newId = batchIdMap[backupBatch.id] || backupBatch.id;

      if (item.conflictType === 'new_in_backup') {
        result.push({ ...backupBatch, id: newId });
        resultStats.batchesAdded++;
      } else {
        const idx = result.findIndex(b => b.id === item.id);
        if (idx >= 0) {
          result[idx] = { ...backupBatch, id: item.id };
          resultStats.batchesUpdated++;
        }
      }
    } else if (strategy === 'manual' && item.manualMergedData) {
      const manualData = item.manualMergedData as CollectionBatch;
      const isNewItem = item.conflictType === 'new_in_backup';

      if (isNewItem) {
        const newId = batchIdMap[manualData.id] || generateId();
        if (!batchIdMap[manualData.id]) {
          batchIdMap[manualData.id] = newId;
        }
        result.push({ ...manualData, id: newId });
        resultStats.batchesAdded++;
      } else {
        const idx = result.findIndex(b => b.id === item.id);
        if (idx >= 0) {
          result[idx] = manualData;
          resultStats.batchesUpdated++;
        }
      }
    } else if (item.conflictType === 'deleted_in_backup' && strategy === 'keep_import') {
      const filtered = result.filter(b => b.id !== item.id);
      result.length = 0;
      result.push(...filtered);
      resultStats.batchesDeleted++;
    }
  });

  return result;
};

const processSpecimens = (
  items: DiffItem[],
  mergedBoxes: Box[],
  mergedBatches: CollectionBatch[],
  mergedSpecimens: Specimen[],
  boxIdMap: Record<string, string>,
  batchIdMap: Record<string, string>,
  specimenIdMap: Record<string, string>,
  resultStats: MergeResult['stats']
): Specimen[] => {
  const result = [...mergedSpecimens];
  const processedIds = new Set<string>();

  items.forEach(item => {
    if (item.type !== 'specimen') return;
    if (processedIds.has(item.id)) return;
    processedIds.add(item.id);

    const strategy = item.selectedStrategy;
    const isNewItem = item.conflictType === 'new_in_backup' ||
                      item.conflictType === 'missing_box_ref' ||
                      item.conflictType === 'missing_batch_ref';

    if (strategy === 'keep_import' && item.backupData) {
      const backupSpecimen = migrateSpecimenWithCompliance(item.backupData as Partial<Specimen>);
      const sourceId = backupSpecimen.id;
      const newId = specimenIdMap[sourceId] || sourceId;

      let specimenToProcess: Specimen = { ...backupSpecimen, id: newId };

      if (item.conflictType === 'missing_box_ref' || item.conflictType === 'missing_batch_ref') {
        const repairResult = applyReferenceRepair(
          specimenToProcess,
          item.referenceRepair,
          mergedBoxes,
          mergedBatches,
          boxIdMap,
          batchIdMap,
          resultStats
        );
        if (repairResult.skip) {
          resultStats.skipped++;
          return;
        }
        specimenToProcess = repairResult.specimen;
      }

      const remappedSpecimen = applyIdRemappingToSpecimen(
        specimenToProcess,
        boxIdMap,
        batchIdMap
      );

      if (isNewItem) {
        result.push(remappedSpecimen);
        resultStats.specimensAdded++;
      } else {
        const idx = result.findIndex(s => s.id === item.id);
        if (idx >= 0) {
          result[idx] = { ...remappedSpecimen, id: item.id };
          resultStats.specimensUpdated++;
        }
      }
    } else if (strategy === 'manual' && item.manualMergedData) {
      const manualData = item.manualMergedData as Specimen;
      const sourceId = manualData.id;
      let newId = specimenIdMap[sourceId];

      if (!newId && isNewItem) {
        newId = generateId();
        specimenIdMap[sourceId] = newId;
      }

      let specimenToProcess: Specimen = { ...manualData, id: newId || manualData.id };

      if (item.conflictType === 'missing_box_ref' || item.conflictType === 'missing_batch_ref') {
        const repairResult = applyReferenceRepair(
          specimenToProcess,
          item.referenceRepair,
          mergedBoxes,
          mergedBatches,
          boxIdMap,
          batchIdMap,
          resultStats
        );
        if (repairResult.skip) {
          resultStats.skipped++;
          return;
        }
        specimenToProcess = repairResult.specimen;
      }

      const remappedSpecimen = applyIdRemappingToSpecimen(
        specimenToProcess,
        boxIdMap,
        batchIdMap
      );

      if (isNewItem) {
        result.push(remappedSpecimen);
        resultStats.specimensAdded++;
      } else {
        const idx = result.findIndex(s => s.id === item.id);
        if (idx >= 0) {
          result[idx] = { ...remappedSpecimen, id: item.id };
          resultStats.specimensUpdated++;
        }
      }
    } else if (item.conflictType === 'deleted_in_backup' && strategy === 'keep_import') {
      const filtered = result.filter(s => s.id !== item.id);
      result.length = 0;
      result.push(...filtered);
      resultStats.specimensDeleted++;
    } else if ((item.conflictType === 'missing_box_ref' || item.conflictType === 'missing_batch_ref')
               && item.referenceRepair?.selectedAction === 'skip') {
      resultStats.skipped++;
    }
  });

  return result;
};

export const performDiffMerge = (
  diffItems: DiffItem[],
  currentBoxes: Box[],
  currentSpecimens: Specimen[],
  currentBatches: CollectionBatch[],
  setBoxes: (value: Box[] | ((prev: Box[]) => Box[])) => void,
  setSpecimens: (value: Specimen[] | ((prev: Specimen[]) => Specimen[])) => void,
  setBatches: (value: CollectionBatch[] | ((prev: CollectionBatch[]) => CollectionBatch[])) => void
): MergeResult => {
  const snapshot = {
    boxes: JSON.parse(JSON.stringify(currentBoxes)),
    specimens: JSON.parse(JSON.stringify(currentSpecimens)),
    batches: JSON.parse(JSON.stringify(currentBatches)),
  };

  const idMaps = buildIdRemapping(diffItems);
  const boxIdMap = { ...idMaps.boxIdMap };
  const batchIdMap = { ...idMaps.batchIdMap };
  const specimenIdMap = { ...idMaps.specimenIdMap };

  const resultStats: MergeResult['stats'] = {
    boxesAdded: 0,
    boxesUpdated: 0,
    boxesDeleted: 0,
    specimensAdded: 0,
    specimensUpdated: 0,
    specimensDeleted: 0,
    batchesAdded: 0,
    batchesUpdated: 0,
    batchesDeleted: 0,
    skipped: 0,
  };

  let mergedBoxes = [...currentBoxes];
  let mergedBatches = [...currentBatches];
  let mergedSpecimens = [...currentSpecimens];

  mergedBoxes = processBoxes(diffItems, mergedBoxes, boxIdMap, resultStats);
  mergedBatches = processBatches(diffItems, mergedBatches, batchIdMap, resultStats);
  mergedSpecimens = processSpecimens(
    diffItems, mergedBoxes, mergedBatches, mergedSpecimens,
    boxIdMap, batchIdMap, specimenIdMap, resultStats
  );
  mergedSpecimens = clearDanglingSpecimenReferences(mergedSpecimens, mergedBoxes, mergedBatches);

  setBoxes(mergedBoxes);
  setBatches(mergedBatches);
  setSpecimens(mergedSpecimens);

  return {
    success: true,
    message: '差异合并完成',
    stats: resultStats,
    snapshot,
  };
};

export const restoreFromSnapshot = (
  snapshot: MergeSnapshot,
  setBoxes: (value: Box[] | ((prev: Box[]) => Box[])) => void,
  setSpecimens: (value: Specimen[] | ((prev: Specimen[]) => Specimen[])) => void,
  setBatches: (value: CollectionBatch[] | ((prev: CollectionBatch[]) => CollectionBatch[])) => void
): boolean => {
  try {
    setBoxes(JSON.parse(JSON.stringify(snapshot.boxes)));
    setSpecimens(JSON.parse(JSON.stringify(snapshot.specimens)));
    setBatches(JSON.parse(JSON.stringify(snapshot.batches)));
    return true;
  } catch (e) {
    console.error('Failed to restore from snapshot:', e);
    return false;
  }
};

export const getConflictTypeLabel = (type: DiffConflictType): string => {
  const labels: Record<DiffConflictType, string> = {
    new_in_backup: '备份新增',
    deleted_in_backup: '备份删除',
    id_conflict: 'ID冲突',
    specimen_no_conflict: '标本编号冲突',
    field_inconsistent: '字段不一致',
    missing_box_ref: '展盒引用丢失',
    missing_batch_ref: '批次引用丢失',
  };
  return labels[type] || type;
};

export const getConflictTypeColor = (type: DiffConflictType): string => {
  const colors: Record<DiffConflictType, string> = {
    new_in_backup: 'text-green-700 bg-green-100 border-green-300',
    deleted_in_backup: 'text-rust-700 bg-rust-100 border-rust-300',
    id_conflict: 'text-amber-700 bg-amber-100 border-amber-300',
    specimen_no_conflict: 'text-amber-700 bg-amber-100 border-amber-300',
    field_inconsistent: 'text-blue-700 bg-blue-100 border-blue-300',
    missing_box_ref: 'text-purple-700 bg-purple-100 border-purple-300',
    missing_batch_ref: 'text-purple-700 bg-purple-100 border-purple-300',
  };
  return colors[type] || 'text-oak-700 bg-oak-100 border-oak-300';
};

export const getStrategyLabel = (strategy: MergeStrategy): string => {
  const labels: Record<MergeStrategy, string> = {
    keep_current: '保留当前',
    keep_import: '使用导入',
    manual: '手动合并',
  };
  return labels[strategy] || strategy;
};

export const getTypeLabel = (type: DiffItemType): string => {
  const labels: Record<DiffItemType, string> = {
    specimen: '标本',
    box: '展盒',
    batch: '批次',
  };
  return labels[type] || type;
};
