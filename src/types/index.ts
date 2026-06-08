export interface Box {
  id: string;
  name: string;
  location: string;
  notes: string;
  createdAt: string;
}

export type ComplianceStatus = 
  | 'not_relevant'
  | 'protected_species'
  | 'invasive_species'
  | 'special_permit'
  | 'expired_permit'
  | 'unknown';

export interface CollectionBatch {
  id: string;
  name: string;
  collectionDate: string;
  location: string;
  participants: string;
  notes: string;
  createdAt: string;
}

export const COMPLIANCE_STATUS_OPTIONS: { value: ComplianceStatus; label: string; color: string; bgColor: string; borderColor: string; description: string }[] = [
  { value: 'not_relevant', label: '无需合规', color: 'text-oak-600', bgColor: 'bg-oak-100', borderColor: 'border-oak-300', description: '普通物种，无需特殊许可' },
  { value: 'protected_species', label: '保护物种', color: 'text-amber-700', bgColor: 'bg-amber-100', borderColor: 'border-amber-300', description: '国家或地方保护动物' },
  { value: 'invasive_species', label: '外来物种', color: 'text-red-700', bgColor: 'bg-red-100', borderColor: 'border-red-300', description: '外来入侵物种，需特别管理' },
  { value: 'special_permit', label: '特许采集', color: 'text-blue-700', bgColor: 'bg-blue-100', borderColor: 'border-blue-300', description: '持有特殊采集许可证' },
  { value: 'expired_permit', label: '许可过期', color: 'text-rust-700', bgColor: 'bg-rust-100', borderColor: 'border-rust-300', description: '许可证已过期，需更新' },
  { value: 'unknown', label: '待确认', color: 'text-purple-700', bgColor: 'bg-purple-100', borderColor: 'border-purple-300', description: '合规状态待确认' },
];

export const HIGH_RISK_STATUSES: ComplianceStatus[] = ['protected_species', 'invasive_species', 'expired_permit', 'unknown'];

export const DEFAULT_COMPLIANCE_STATUS: ComplianceStatus = 'not_relevant';

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
  complianceStatus: ComplianceStatus;
  permitNumber: string;
  permitExpiryDate: string;
  complianceNotes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Filters {
  search: string;
  onlyUnphotographed: boolean;
  boxId: string;
  batchId: string;
  complianceStatus: ComplianceStatus | '';
  onlyHighRisk: boolean;
}

export interface FilterView {
  id: string;
  name: string;
  filters: Filters;
  createdAt: string;
  updatedAt: string;
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
  complianceStatus: string;
  permitNumber: string;
  permitExpiryDate: string;
  complianceNotes: string;
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
  | 'invalid_boolean'
  | 'invalid_compliance_status';

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

export const BACKUP_FILE_VERSION = 2;

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

export type DiffItemType = 'specimen' | 'box' | 'batch';

export type DiffConflictType =
  | 'new_in_backup'
  | 'deleted_in_backup'
  | 'id_conflict'
  | 'specimen_no_conflict'
  | 'field_inconsistent'
  | 'missing_box_ref'
  | 'missing_batch_ref';

export type MergeStrategy = 'keep_current' | 'keep_import' | 'manual';

export interface FieldDiff {
  field: string;
  currentValue: unknown;
  backupValue: unknown;
}

export interface DiffItem {
  type: DiffItemType;
  conflictType: DiffConflictType;
  id: string;
  currentData?: Box | Specimen | CollectionBatch | null;
  backupData?: Box | Specimen | CollectionBatch | null;
  fieldDiffs?: FieldDiff[];
  displayName: string;
  specimenNo?: string;
  selectedStrategy: MergeStrategy;
  manualMergedData?: Box | Specimen | CollectionBatch | null;
  referenceRepair?: ReferenceRepairInfo;
}

export interface DiffAnalysisResult {
  items: DiffItem[];
  stats: {
    total: number;
    newInBackup: number;
    deletedInBackup: number;
    idConflicts: number;
    specimenNoConflicts: number;
    fieldInconsistent: number;
    missingBoxRefs: number;
    missingBatchRefs: number;
  };
  hasConflicts: boolean;
}

export interface MergeResult {
  success: boolean;
  message: string;
  stats: {
    boxesAdded: number;
    boxesUpdated: number;
    boxesDeleted: number;
    specimensAdded: number;
    specimensUpdated: number;
    specimensDeleted: number;
    batchesAdded: number;
    batchesUpdated: number;
    batchesDeleted: number;
    skipped: number;
  };
  snapshot: {
    boxes: Box[];
    specimens: Specimen[];
    batches: CollectionBatch[];
  };
}

export type ReferenceRepairAction = 'skip' | 'clear_ref' | 'create_new' | 'choose_existing';

export interface ReferenceRepairInfo {
  referenceType: 'box' | 'batch';
  missingId: string;
  backupName?: string;
  selectedAction: ReferenceRepairAction;
  selectedExistingId?: string;
  newObjectName?: string;
}

export interface MergeSnapshot {
  boxes: Box[];
  specimens: Specimen[];
  batches: CollectionBatch[];
  timestamp?: string;
  description?: string;
}

export type BatchEditField = 'photographed' | 'pinnedStatus' | 'boxId' | 'batchId' | 'complianceStatus';

export interface BatchEditData {
  photographed?: boolean;
  pinnedStatus?: boolean;
  boxId?: string;
  batchId?: string;
  complianceStatus?: ComplianceStatus;
}

export interface BatchEditFieldChange {
  field: BatchEditField;
  fieldLabel: string;
  oldValue: string;
  newValue: string;
  affectedCount: number;
}

export const BATCH_EDIT_FIELD_LABELS: Record<BatchEditField, string> = {
  photographed: '拍照状态',
  pinnedStatus: '针插状态',
  boxId: '所属展盒',
  batchId: '所属采集批次',
  complianceStatus: '合规状态',
};

export interface NumberTemplatePreset {
  id: string;
  name: string;
  orderPrefix: string;
  customPrefix: string;
  numberPadding: number;
  defaultBoxId: string;
  defaultCollectionDate: string;
  createdAt: string;
  updatedAt: string;
}
