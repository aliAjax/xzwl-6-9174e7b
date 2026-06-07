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
} from '../types';
import type { Box, Specimen, CollectionBatch } from '../types';

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

export const createBackupData = (
  boxes: Box[],
  specimens: Specimen[],
  batches: CollectionBatch[]
): BackupFileData => {
  return {
    version: 1,
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

export const checkCompatibility = (backupData: BackupFileData): RestoreCompatibilityCheck => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const currentVersion = 1;
  const versionMatch = backupData.version === currentVersion;
  
  if (backupData.version > currentVersion) {
    errors.push(`备份文件版本 (v${backupData.version}) 高于当前系统版本 (v${currentVersion})，请更新系统后再尝试恢复`);
  }
  
  if (backupData.version < currentVersion) {
    warnings.push(`备份文件版本 (v${backupData.version}) 低于当前系统版本 (v${currentVersion})，可能存在兼容性问题`);
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
          ...specimen,
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
        if (!specimen.specimenNo) {
          return specimen;
        }
        
        if (currentNos.has(specimen.specimenNo.toLowerCase())) {
          const baseNo = specimen.specimenNo;
          let suffix = 1;
          let newNo = `${baseNo}_备份${suffix}`;
          
          while (currentNos.has(newNo.toLowerCase())) {
            suffix++;
            newNo = `${baseNo}_备份${suffix}`;
          }
          
          currentNos.add(newNo.toLowerCase());
          remappedNos.push(`${baseNo} → ${newNo}`);
          
          return {
            ...specimen,
            specimenNo: newNo,
          };
        }
        return specimen;
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
      valid.push(specimen);
    } else {
      invalid.push(specimen);
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
