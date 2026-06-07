export interface Box {
  id: string;
  name: string;
  location: string;
  notes: string;
  createdAt: string;
}

export interface CollectionBatch {
  id: string;
  name: string;
  collectionDate: string;
  location: string;
  participants: string;
  notes: string;
  createdAt: string;
}

export interface Specimen {
  id: string;
  specimenNo: string;
  species: string;
  collectionLocation: string;
  collectionDate: string;
  pinnedStatus: boolean;
  boxId: string;
  batchId: string;
  photographed: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Filters {
  search: string;
  onlyUnphotographed: boolean;
  boxId: string;
  batchId: string;
}

export type SpecimenFormData = Omit<Specimen, 'id' | 'createdAt' | 'updatedAt'>;

export type BoxFormData = Omit<Box, 'id' | 'createdAt'>;

export type CollectionBatchFormData = Omit<CollectionBatch, 'id' | 'createdAt'>;

export type CsvFieldMapping = Record<string, keyof SpecimenFormData | 'boxName' | null>;

export interface CsvRowData {
  specimenNo: string;
  species: string;
  collectionLocation: string;
  collectionDate: string;
  pinnedStatus: boolean;
  photographed: boolean;
  boxName: string;
  notes: string;
  batchId: string;
}

export interface BoxTransferData {
  sourceBoxId: string;
  targetBoxId: string;
  specimenIds: string[];
}

export type ValidationErrorType = 
  | 'missing_required' 
  | 'duplicate_no' 
  | 'duplicate_no_in_file' 
  | 'box_not_found' 
  | 'invalid_date' 
  | 'invalid_boolean';

export interface ValidationError {
  rowIndex: number;
  field: string;
  type: ValidationErrorType;
  message: string;
}

export interface ImportPreviewRow {
  rowIndex: number;
  data: Partial<CsvRowData>;
  errors: ValidationError[];
  warnings: ValidationError[];
  isValid: boolean;
}

export interface ImportPreviewData {
  headers: string[];
  fieldMapping: CsvFieldMapping;
  rows: ImportPreviewRow[];
  validCount: number;
  invalidCount: number;
  totalCount: number;
}

export const BACKUP_FILE_VERSION = 1;

export interface BackupFileData {
  version: number;
  exportedAt: string;
  appName: string;
  data: {
    boxes: Box[];
    specimens: Specimen[];
    batches: CollectionBatch[];
  };
  stats: {
    boxCount: number;
    specimenCount: number;
    batchCount: number;
  };
}

export interface RestoreCompatibilityCheck {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  versionMatch: boolean;
  canRestore: boolean;
}

export interface RestorePreviewData {
  backupData: BackupFileData;
  compatibility: RestoreCompatibilityCheck;
  currentStats: {
    boxCount: number;
    specimenCount: number;
    batchCount: number;
  };
  conflicts: {
    boxIdConflicts: string[];
    specimenIdConflicts: string[];
    batchIdConflicts: string[];
    specimenNoConflicts: string[];
    missingBoxReferences: string[];
    missingBatchReferences: string[];
  };
  idMappingPlan: {
    boxIdMap: Record<string, string>;
    specimenIdMap: Record<string, string>;
    batchIdMap: Record<string, string>;
  };
}

export type RestoreMode = 'overwrite' | 'merge';

export interface RestoreOptions {
  mode: RestoreMode;
  importBoxes: boolean;
  importSpecimens: boolean;
  importBatches: boolean;
}

export interface RestoreResult {
  success: boolean;
  message: string;
  stats: {
    boxesAdded: number;
    boxesUpdated: number;
    specimensAdded: number;
    specimensUpdated: number;
    batchesAdded: number;
    batchesUpdated: number;
    skippedDueToMissingRefs: number;
  };
}

export type LabelTemplateType = 'pin' | 'box';

export type PaperSizeType = 'A4' | 'A5';

export interface LabelField {
  key: keyof SpecimenLabelData;
  label: string;
  required: boolean;
}

export interface SpecimenLabelData {
  specimenNo: string;
  species: string;
  collectionLocation: string;
  collectionDate: string;
  boxLocation: string;
  photographed: boolean;
  boxName: string;
}

export interface LabelFieldCheckResult {
  specimenId: string;
  specimenNo: string;
  missingFields: string[];
  isValid: boolean;
}

export interface LabelPrintSettings {
  templateType: LabelTemplateType;
  paperSize: PaperSizeType;
  showGrid: boolean;
  fontSize: 'small' | 'medium' | 'large';
}

export const LABEL_FIELDS: LabelField[] = [
  { key: 'specimenNo', label: '标本编号', required: true },
  { key: 'species', label: '物种名', required: true },
  { key: 'collectionLocation', label: '采集地点', required: true },
  { key: 'collectionDate', label: '采集日期', required: true },
  { key: 'boxLocation', label: '展盒位置', required: true },
  { key: 'photographed', label: '拍照状态', required: false },
];

export const PAPER_SIZES: Record<PaperSizeType, { width: number; height: number; label: string }> = {
  A4: { width: 210, height: 297, label: 'A4 (210mm × 297mm)' },
  A5: { width: 148, height: 210, label: 'A5 (148mm × 210mm)' },
};

export const LABEL_TEMPLATES: Record<LabelTemplateType, {
  label: string;
  description: string;
  width: number;
  height: number;
  perRow: Record<PaperSizeType, number>;
  perPage: Record<PaperSizeType, number>;
}> = {
  pin: {
    label: '针插标本标签',
    description: '适用于针插标本的小尺寸标签，尺寸约 35mm × 25mm',
    width: 35,
    height: 25,
    perRow: { A4: 5, A5: 3 },
    perPage: { A4: 60, A5: 27 },
  },
  box: {
    label: '展盒贴纸标签',
    description: '适用于展盒外贴的较大尺寸标签，通常尺寸约 60mm × 40mm',
    width: 60,
    height: 40,
    perRow: { A4: 3, A5: 2 },
    perPage: { A4: 28, A5: 12 },
  },
};
