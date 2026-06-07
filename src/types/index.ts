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
