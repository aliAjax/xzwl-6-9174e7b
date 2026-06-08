import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createBackupData,
  parseBackupFile,
  migrateSpecimenWithCompliance,
  checkCompatibility,
  analyzeConflicts,
  generateIdMappingPlan,
  generateRestorePreview,
  remapIds,
  handleSpecimenNoDuplicates,
  filterSpecimensWithValidReferences,
  performRestore,
} from './backup';
import type { Box, Specimen, CollectionBatch, BackupFileData, RestoreOptions } from '../types';
import { BACKUP_FILE_VERSION, DEFAULT_COMPLIANCE_STATUS } from '../types';

const createMockBox = (overrides: Partial<Box> = {}): Box => ({
  id: 'box-1',
  name: 'Box 1',
  location: 'Shelf A',
  notes: '',
  createdAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

const createMockBatch = (overrides: Partial<CollectionBatch> = {}): CollectionBatch => ({
  id: 'batch-1',
  name: 'Batch 2024',
  collectionDate: '2024-01-01',
  location: 'Forest',
  participants: 'John Doe',
  notes: '',
  createdAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

const createMockSpecimen = (overrides: Partial<Specimen> = {}): Specimen => ({
  id: 'specimen-1',
  specimenNo: 'SP-001',
  species: 'Test Species',
  collectionLocation: 'Test Location',
  collectionDate: '2024-01-01',
  pinnedStatus: false,
  boxId: '',
  batchId: '',
  photographed: false,
  notes: '',
  complianceStatus: 'not_relevant',
  permitNumber: '',
  permitExpiryDate: '',
  complianceNotes: '',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

describe('createBackupData', () => {
  it('should create valid backup data structure', () => {
    const boxes = [createMockBox()];
    const specimens = [createMockSpecimen()];
    const batches = [createMockBatch()];

    const result = createBackupData(boxes, specimens, batches);

    expect(result.version).toBe(BACKUP_FILE_VERSION);
    expect(result.appName).toBe('昆虫标本管理系统');
    expect(result.data.boxes).toHaveLength(1);
    expect(result.data.specimens).toHaveLength(1);
    expect(result.data.batches).toHaveLength(1);
    expect(result.stats.boxCount).toBe(1);
    expect(result.stats.specimenCount).toBe(1);
    expect(result.stats.batchCount).toBe(1);
    expect(result.exportedAt).toBeDefined();
  });

  it('should create deep copy of data', () => {
    const boxes = [createMockBox({ name: 'Original' })];
    const result = createBackupData(boxes, [], []);
    
    boxes[0].name = 'Modified';
    expect(result.data.boxes[0].name).toBe('Original');
  });
});

describe('parseBackupFile', () => {
  it('should parse valid backup JSON', () => {
    const backupData: BackupFileData = {
      version: BACKUP_FILE_VERSION,
      exportedAt: '2024-06-01T00:00:00.000Z',
      appName: '昆虫标本管理系统',
      data: { boxes: [], specimens: [], batches: [] },
      stats: { boxCount: 0, specimenCount: 0, batchCount: 0 },
    };

    const json = JSON.stringify(backupData);
    const result = parseBackupFile(json);

    expect(result).toEqual(backupData);
  });

  it('should throw error for invalid JSON', () => {
    expect(() => parseBackupFile('invalid json')).toThrow('JSON解析失败');
  });

  it('should throw error for missing required fields', () => {
    const invalidData = { version: 1, data: {} };
    expect(() => parseBackupFile(JSON.stringify(invalidData))).toThrow('缺少必要字段');
  });

  it('should throw error for invalid data structure', () => {
    const invalidData = {
      version: 1,
      data: { boxes: 'not an array' },
      stats: { boxCount: 0, specimenCount: 0, batchCount: 0 },
    };
    expect(() => parseBackupFile(JSON.stringify(invalidData))).toThrow('数据结构不完整');
  });

  it('should throw error for non-object data', () => {
    expect(() => parseBackupFile('"just a string"')).toThrow('格式不正确');
  });
});

describe('migrateSpecimenWithCompliance', () => {
  it('should add default compliance fields to old specimen data', () => {
    const oldSpecimen: Partial<Specimen> = {
      id: 'old-1',
      specimenNo: 'SP-OLD',
      species: 'Old Species',
    };

    const result = migrateSpecimenWithCompliance(oldSpecimen);

    expect(result.complianceStatus).toBe(DEFAULT_COMPLIANCE_STATUS);
    expect(result.permitNumber).toBe('');
    expect(result.permitExpiryDate).toBe('');
    expect(result.complianceNotes).toBe('');
    expect(result.pinnedStatus).toBe(false);
    expect(result.photographed).toBe(false);
    expect(result.createdAt).toBeDefined();
    expect(result.updatedAt).toBeDefined();
  });

  it('should preserve existing compliance fields', () => {
    const specimen: Partial<Specimen> = {
      id: 'sp-1',
      specimenNo: 'SP-001',
      species: 'Test',
      complianceStatus: 'protected_species',
      permitNumber: 'PERMIT-001',
    };

    const result = migrateSpecimenWithCompliance(specimen);

    expect(result.complianceStatus).toBe('protected_species');
    expect(result.permitNumber).toBe('PERMIT-001');
  });

  it('should generate id if missing', () => {
    const specimen: Partial<Specimen> = {
      specimenNo: 'SP-001',
      species: 'Test',
    };

    const result = migrateSpecimenWithCompliance(specimen);
    expect(result.id).toBeDefined();
    expect(result.id.length).toBeGreaterThan(0);
  });
});

describe('checkCompatibility', () => {
  it('should return valid for matching version', () => {
    const backupData: BackupFileData = {
      version: BACKUP_FILE_VERSION,
      exportedAt: '2024-06-01T00:00:00.000Z',
      appName: '昆虫标本管理系统',
      data: { boxes: [], specimens: [], batches: [] },
      stats: { boxCount: 0, specimenCount: 0, batchCount: 0 },
    };

    const result = checkCompatibility(backupData);

    expect(result.isValid).toBe(true);
    expect(result.canRestore).toBe(true);
    expect(result.versionMatch).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should return error for newer version', () => {
    const backupData: BackupFileData = {
      version: BACKUP_FILE_VERSION + 1,
      exportedAt: '2024-06-01T00:00:00.000Z',
      appName: '昆虫标本管理系统',
      data: { boxes: [], specimens: [], batches: [] },
      stats: { boxCount: 0, specimenCount: 0, batchCount: 0 },
    };

    const result = checkCompatibility(backupData);

    expect(result.isValid).toBe(false);
    expect(result.canRestore).toBe(false);
    expect(result.errors.some(e => e.includes('高于当前系统版本'))).toBe(true);
  });

  it('should return warning for older version', () => {
    const backupData: BackupFileData = {
      version: 1,
      exportedAt: '2024-06-01T00:00:00.000Z',
      appName: '昆虫标本管理系统',
      data: { boxes: [], specimens: [], batches: [] },
      stats: { boxCount: 0, specimenCount: 0, batchCount: 0 },
    };

    const result = checkCompatibility(backupData);

    expect(result.isValid).toBe(true);
    expect(result.canRestore).toBe(true);
    expect(result.warnings.some(w => w.includes('低于当前系统版本'))).toBe(true);
  });

  it('should detect missing required fields in boxes', () => {
    const backupData: BackupFileData = {
      version: BACKUP_FILE_VERSION,
      exportedAt: '2024-06-01T00:00:00.000Z',
      appName: '昆虫标本管理系统',
      data: {
        boxes: [{ name: 'No ID' } as Box],
        specimens: [],
        batches: [],
      },
      stats: { boxCount: 1, specimenCount: 0, batchCount: 0 },
    };

    const result = checkCompatibility(backupData);

    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('缺少必要字段'))).toBe(true);
  });

  it('should detect missing required fields in specimens', () => {
    const backupData: BackupFileData = {
      version: BACKUP_FILE_VERSION,
      exportedAt: '2024-06-01T00:00:00.000Z',
      appName: '昆虫标本管理系统',
      data: {
        boxes: [],
        specimens: [{ species: 'No No' } as Specimen],
        batches: [],
      },
      stats: { boxCount: 0, specimenCount: 1, batchCount: 0 },
    };

    const result = checkCompatibility(backupData);

    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('缺少必要字段'))).toBe(true);
  });
});

describe('analyzeConflicts', () => {
  it('should detect ID conflicts', () => {
    const currentBoxes = [createMockBox({ id: 'conflict-id' })];
    const currentSpecimens = [createMockSpecimen({ id: 'conflict-sp-id', specimenNo: 'SP-CURRENT' })];
    const currentBatches = [createMockBatch({ id: 'conflict-batch-id' })];

    const backupData: BackupFileData = {
      version: BACKUP_FILE_VERSION,
      exportedAt: '2024-06-01T00:00:00.000Z',
      appName: '昆虫标本管理系统',
      data: {
        boxes: [createMockBox({ id: 'conflict-id' })],
        specimens: [createMockSpecimen({ id: 'conflict-sp-id', specimenNo: 'SP-BACKUP' })],
        batches: [createMockBatch({ id: 'conflict-batch-id' })],
      },
      stats: { boxCount: 1, specimenCount: 1, batchCount: 1 },
    };

    const result = analyzeConflicts(backupData, currentBoxes, currentSpecimens, currentBatches);

    expect(result.boxIdConflicts).toContain('conflict-id');
    expect(result.specimenIdConflicts).toContain('conflict-sp-id');
    expect(result.batchIdConflicts).toContain('conflict-batch-id');
  });

  it('should detect specimen number conflicts', () => {
    const currentSpecimens = [createMockSpecimen({ id: 'current-1', specimenNo: 'SP-001' })];

    const backupData: BackupFileData = {
      version: BACKUP_FILE_VERSION,
      exportedAt: '2024-06-01T00:00:00.000Z',
      appName: '昆虫标本管理系统',
      data: {
        boxes: [],
        specimens: [createMockSpecimen({ id: 'backup-1', specimenNo: 'SP-001' })],
        batches: [],
      },
      stats: { boxCount: 0, specimenCount: 1, batchCount: 0 },
    };

    const result = analyzeConflicts(backupData, [], currentSpecimens, []);

    expect(result.specimenNoConflicts).toContain('SP-001');
  });

  it('should detect missing references', () => {
    const backupData: BackupFileData = {
      version: BACKUP_FILE_VERSION,
      exportedAt: '2024-06-01T00:00:00.000Z',
      appName: '昆虫标本管理系统',
      data: {
        boxes: [],
        specimens: [
          createMockSpecimen({ id: 'sp-1', specimenNo: 'SP-001', boxId: 'missing-box' }),
          createMockSpecimen({ id: 'sp-2', specimenNo: 'SP-002', batchId: 'missing-batch' }),
        ],
        batches: [],
      },
      stats: { boxCount: 0, specimenCount: 2, batchCount: 0 },
    };

    const result = analyzeConflicts(backupData, [], [], []);

    expect(result.missingBoxReferences.length).toBe(1);
    expect(result.missingBoxReferences[0]).toContain('SP-001');
    expect(result.missingBatchReferences.length).toBe(1);
    expect(result.missingBatchReferences[0]).toContain('SP-002');
  });

  it('should return empty conflicts when backup data is invalid', () => {
    const backupData = {
      version: BACKUP_FILE_VERSION,
      exportedAt: '2024-06-01T00:00:00.000Z',
      appName: '昆虫标本管理系统',
      data: null,
      stats: { boxCount: 0, specimenCount: 0, batchCount: 0 },
    } as unknown as BackupFileData;

    const result = analyzeConflicts(backupData, [], [], []);

    expect(result.boxIdConflicts).toHaveLength(0);
    expect(result.specimenIdConflicts).toHaveLength(0);
    expect(result.batchIdConflicts).toHaveLength(0);
  });
});

describe('generateIdMappingPlan', () => {
  it('should generate new IDs for conflicting IDs', () => {
    const conflicts = {
      boxIdConflicts: ['box-1', 'box-2'],
      specimenIdConflicts: ['sp-1'],
      batchIdConflicts: ['batch-1'],
      specimenNoConflicts: [],
      missingBoxReferences: [],
      missingBatchReferences: [],
    };

    const backupData: BackupFileData = {
      version: BACKUP_FILE_VERSION,
      exportedAt: '2024-06-01T00:00:00.000Z',
      appName: '昆虫标本管理系统',
      data: { boxes: [], specimens: [], batches: [] },
      stats: { boxCount: 0, specimenCount: 0, batchCount: 0 },
    };

    const result = generateIdMappingPlan(backupData, conflicts);

    expect(Object.keys(result.boxIdMap)).toHaveLength(2);
    expect(result.boxIdMap['box-1']).not.toBe('box-1');
    expect(Object.keys(result.specimenIdMap)).toHaveLength(1);
    expect(result.specimenIdMap['sp-1']).not.toBe('sp-1');
    expect(Object.keys(result.batchIdMap)).toHaveLength(1);
    expect(result.batchIdMap['batch-1']).not.toBe('batch-1');
  });

  it('should handle empty conflicts', () => {
    const conflicts = {
      boxIdConflicts: [],
      specimenIdConflicts: [],
      batchIdConflicts: [],
      specimenNoConflicts: [],
      missingBoxReferences: [],
      missingBatchReferences: [],
    };

    const backupData: BackupFileData = {
      version: BACKUP_FILE_VERSION,
      exportedAt: '2024-06-01T00:00:00.000Z',
      appName: '昆虫标本管理系统',
      data: { boxes: [], specimens: [], batches: [] },
      stats: { boxCount: 0, specimenCount: 0, batchCount: 0 },
    };

    const result = generateIdMappingPlan(backupData, conflicts);

    expect(Object.keys(result.boxIdMap)).toHaveLength(0);
    expect(Object.keys(result.specimenIdMap)).toHaveLength(0);
    expect(Object.keys(result.batchIdMap)).toHaveLength(0);
  });
});

describe('generateRestorePreview', () => {
  it('should generate complete preview data', () => {
    const currentBoxes = [createMockBox({ id: 'current-box' })];
    const currentSpecimens = [createMockSpecimen({ id: 'current-sp', specimenNo: 'SP-CURRENT' })];
    const currentBatches = [createMockBatch({ id: 'current-batch' })];

    const backupData: BackupFileData = {
      version: BACKUP_FILE_VERSION,
      exportedAt: '2024-06-01T00:00:00.000Z',
      appName: '昆虫标本管理系统',
      data: {
        boxes: [createMockBox({ id: 'backup-box' })],
        specimens: [createMockSpecimen({ id: 'backup-sp', specimenNo: 'SP-BACKUP' })],
        batches: [createMockBatch({ id: 'backup-batch' })],
      },
      stats: { boxCount: 1, specimenCount: 1, batchCount: 1 },
    };

    const result = generateRestorePreview(backupData, currentBoxes, currentSpecimens, currentBatches);

    expect(result.compatibility.isValid).toBe(true);
    expect(result.currentStats.boxCount).toBe(1);
    expect(result.currentStats.specimenCount).toBe(1);
    expect(result.currentStats.batchCount).toBe(1);
    expect(result.conflicts).toBeDefined();
    expect(result.idMappingPlan).toBeDefined();
  });

  it('should handle incompatible backup', () => {
    const backupData: BackupFileData = {
      version: BACKUP_FILE_VERSION + 1,
      exportedAt: '2024-06-01T00:00:00.000Z',
      appName: '昆虫标本管理系统',
      data: { boxes: [], specimens: [], batches: [] },
      stats: { boxCount: 0, specimenCount: 0, batchCount: 0 },
    };

    const result = generateRestorePreview(backupData, [], [], []);

    expect(result.compatibility.canRestore).toBe(false);
    expect(result.conflicts.boxIdConflicts).toHaveLength(0);
  });
});

describe('remapIds', () => {
  it('should remap conflicting IDs', () => {
    const backupData: BackupFileData = {
      version: BACKUP_FILE_VERSION,
      exportedAt: '2024-06-01T00:00:00.000Z',
      appName: '昆虫标本管理系统',
      data: {
        boxes: [createMockBox({ id: 'old-box-id' })],
        specimens: [
          createMockSpecimen({
            id: 'old-sp-id',
            specimenNo: 'SP-001',
            boxId: 'old-box-id',
            batchId: 'old-batch-id',
          }),
        ],
        batches: [createMockBatch({ id: 'old-batch-id' })],
      },
      stats: { boxCount: 1, specimenCount: 1, batchCount: 1 },
    };

    const idMappingPlan = {
      boxIdMap: { 'old-box-id': 'new-box-id' },
      specimenIdMap: { 'old-sp-id': 'new-sp-id' },
      batchIdMap: { 'old-batch-id': 'new-batch-id' },
    };

    const result = remapIds(backupData, idMappingPlan);

    expect(result.data.boxes[0].id).toBe('new-box-id');
    expect(result.data.specimens[0].id).toBe('new-sp-id');
    expect(result.data.specimens[0].boxId).toBe('new-box-id');
    expect(result.data.specimens[0].batchId).toBe('new-batch-id');
    expect(result.data.batches[0].id).toBe('new-batch-id');
  });

  it('should keep non-conflicting IDs', () => {
    const backupData: BackupFileData = {
      version: BACKUP_FILE_VERSION,
      exportedAt: '2024-06-01T00:00:00.000Z',
      appName: '昆虫标本管理系统',
      data: {
        boxes: [createMockBox({ id: 'keep-this-id' })],
        specimens: [],
        batches: [],
      },
      stats: { boxCount: 1, specimenCount: 0, batchCount: 0 },
    };

    const idMappingPlan = {
      boxIdMap: {},
      specimenIdMap: {},
      batchIdMap: {},
    };

    const result = remapIds(backupData, idMappingPlan);

    expect(result.data.boxes[0].id).toBe('keep-this-id');
  });
});

describe('handleSpecimenNoDuplicates', () => {
  it('should rename duplicate specimen numbers', () => {
    const currentSpecimens = [
      createMockSpecimen({ id: 'current-1', specimenNo: 'SP-001' }),
    ];

    const backupData: BackupFileData = {
      version: BACKUP_FILE_VERSION,
      exportedAt: '2024-06-01T00:00:00.000Z',
      appName: '昆虫标本管理系统',
      data: {
        boxes: [],
        specimens: [
          createMockSpecimen({ id: 'backup-1', specimenNo: 'SP-001' }),
          createMockSpecimen({ id: 'backup-2', specimenNo: 'SP-002' }),
        ],
        batches: [],
      },
      stats: { boxCount: 0, specimenCount: 2, batchCount: 0 },
    };

    const result = handleSpecimenNoDuplicates(backupData, currentSpecimens);

    expect(result.remappedNos).toHaveLength(1);
    expect(result.remappedNos[0]).toContain('SP-001');
    expect(result.data.data.specimens[0].specimenNo).not.toBe('SP-001');
    expect(result.data.data.specimens[1].specimenNo).toBe('SP-002');
  });

  it('should handle multiple duplicates of same number', () => {
    const currentSpecimens = [
      createMockSpecimen({ id: 'current-1', specimenNo: 'SP-001' }),
    ];

    const backupData: BackupFileData = {
      version: BACKUP_FILE_VERSION,
      exportedAt: '2024-06-01T00:00:00.000Z',
      appName: '昆虫标本管理系统',
      data: {
        boxes: [],
        specimens: [
          createMockSpecimen({ id: 'backup-1', specimenNo: 'SP-001' }),
          createMockSpecimen({ id: 'backup-2', specimenNo: 'SP-001' }),
        ],
        batches: [],
      },
      stats: { boxCount: 0, specimenCount: 2, batchCount: 0 },
    };

    const result = handleSpecimenNoDuplicates(backupData, currentSpecimens);

    expect(result.remappedNos).toHaveLength(2);
    expect(result.data.data.specimens[0].specimenNo).toContain('备份1');
    expect(result.data.data.specimens[1].specimenNo).toContain('备份2');
  });
});

describe('filterSpecimensWithValidReferences', () => {
  it('should separate valid and invalid specimens', () => {
    const specimens = [
      createMockSpecimen({ id: 'sp-1', specimenNo: 'SP-001', boxId: 'valid-box' }),
      createMockSpecimen({ id: 'sp-2', specimenNo: 'SP-002', boxId: 'invalid-box' }),
      createMockSpecimen({ id: 'sp-3', specimenNo: 'SP-003', batchId: 'invalid-batch' }),
      createMockSpecimen({ id: 'sp-4', specimenNo: 'SP-004' }),
    ];

    const validBoxIds = new Set(['valid-box']);
    const validBatchIds = new Set<string>();

    const result = filterSpecimensWithValidReferences(specimens, validBoxIds, validBatchIds);

    expect(result.valid).toHaveLength(2);
    expect(result.valid.some(s => s.id === 'sp-1')).toBe(true);
    expect(result.valid.some(s => s.id === 'sp-4')).toBe(true);
    expect(result.invalid).toHaveLength(2);
    expect(result.invalid.some(s => s.id === 'sp-2')).toBe(true);
    expect(result.invalid.some(s => s.id === 'sp-3')).toBe(true);
  });

  it('should handle empty arrays', () => {
    const result = filterSpecimensWithValidReferences([], new Set(), new Set());
    expect(result.valid).toHaveLength(0);
    expect(result.invalid).toHaveLength(0);
  });
});

describe('performRestore', () => {
  let setBoxes: (value: Box[] | ((prev: Box[]) => Box[])) => void;
  let setSpecimens: (value: Specimen[] | ((prev: Specimen[]) => Specimen[])) => void;
  let setBatches: (value: CollectionBatch[] | ((prev: CollectionBatch[]) => CollectionBatch[])) => void;
  let currentBoxes: Box[];
  let currentSpecimens: Specimen[];
  let currentBatches: CollectionBatch[];

  beforeEach(() => {
    currentBoxes = [createMockBox({ id: 'current-box', name: 'Current Box' })];
    currentSpecimens = [createMockSpecimen({ id: 'current-sp', specimenNo: 'SP-CURRENT' })];
    currentBatches = [createMockBatch({ id: 'current-batch', name: 'Current Batch' })];

    setBoxes = vi.fn();
    setSpecimens = vi.fn();
    setBatches = vi.fn();
  });

  it('should return error for incompatible backup', () => {
    const backupData: BackupFileData = {
      version: BACKUP_FILE_VERSION + 1,
      exportedAt: '2024-06-01T00:00:00.000Z',
      appName: '昆虫标本管理系统',
      data: { boxes: [], specimens: [], batches: [] },
      stats: { boxCount: 0, specimenCount: 0, batchCount: 0 },
    };

    const previewData = generateRestorePreview(backupData, currentBoxes, currentSpecimens, currentBatches);
    const options: RestoreOptions = {
      mode: 'overwrite',
      importBoxes: true,
      importSpecimens: true,
      importBatches: true,
    };

    const result = performRestore(
      previewData,
      options,
      currentBoxes,
      currentSpecimens,
      currentBatches,
      setBoxes,
      setSpecimens,
      setBatches
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain('不兼容');
  });

  it('should perform overwrite restore', () => {
    const backupData: BackupFileData = {
      version: BACKUP_FILE_VERSION,
      exportedAt: '2024-06-01T00:00:00.000Z',
      appName: '昆虫标本管理系统',
      data: {
        boxes: [createMockBox({ id: 'backup-box', name: 'Backup Box' })],
        specimens: [createMockSpecimen({ id: 'backup-sp', specimenNo: 'SP-BACKUP' })],
        batches: [createMockBatch({ id: 'backup-batch', name: 'Backup Batch' })],
      },
      stats: { boxCount: 1, specimenCount: 1, batchCount: 1 },
    };

    const previewData = generateRestorePreview(backupData, currentBoxes, currentSpecimens, currentBatches);
    const options: RestoreOptions = {
      mode: 'overwrite',
      importBoxes: true,
      importSpecimens: true,
      importBatches: true,
    };

    const result = performRestore(
      previewData,
      options,
      currentBoxes,
      currentSpecimens,
      currentBatches,
      setBoxes,
      setSpecimens,
      setBatches
    );

    expect(result.success).toBe(true);
    expect(result.stats.boxesAdded).toBe(1);
    expect(result.stats.specimensAdded).toBe(1);
    expect(result.stats.batchesAdded).toBe(1);
    expect(setBoxes).toHaveBeenCalled();
    expect(setSpecimens).toHaveBeenCalled();
    expect(setBatches).toHaveBeenCalled();
  });

  it('should perform merge restore adding new items', () => {
    const backupData: BackupFileData = {
      version: BACKUP_FILE_VERSION,
      exportedAt: '2024-06-01T00:00:00.000Z',
      appName: '昆虫标本管理系统',
      data: {
        boxes: [createMockBox({ id: 'new-box', name: 'New Box' })],
        specimens: [createMockSpecimen({ id: 'new-sp', specimenNo: 'SP-NEW' })],
        batches: [createMockBatch({ id: 'new-batch', name: 'New Batch' })],
      },
      stats: { boxCount: 1, specimenCount: 1, batchCount: 1 },
    };

    const previewData = generateRestorePreview(backupData, currentBoxes, currentSpecimens, currentBatches);
    const options: RestoreOptions = {
      mode: 'merge',
      importBoxes: true,
      importSpecimens: true,
      importBatches: true,
    };

    const result = performRestore(
      previewData,
      options,
      currentBoxes,
      currentSpecimens,
      currentBatches,
      setBoxes,
      setSpecimens,
      setBatches
    );

    expect(result.success).toBe(true);
    expect(result.stats.boxesAdded).toBe(1);
    expect(result.stats.specimensAdded).toBe(1);
    expect(result.stats.batchesAdded).toBe(1);
  });

  it('should perform merge restore with remapped IDs for conflicts', () => {
    const backupData: BackupFileData = {
      version: BACKUP_FILE_VERSION,
      exportedAt: '2024-06-01T00:00:00.000Z',
      appName: '昆虫标本管理系统',
      data: {
        boxes: [createMockBox({ id: 'current-box', name: 'Updated Box' })],
        specimens: [createMockSpecimen({ id: 'current-sp', specimenNo: 'SP-CURRENT-2', species: 'Updated Species' })],
        batches: [createMockBatch({ id: 'current-batch', name: 'Updated Batch' })],
      },
      stats: { boxCount: 1, specimenCount: 1, batchCount: 1 },
    };

    const previewData = generateRestorePreview(backupData, currentBoxes, currentSpecimens, currentBatches);
    const options: RestoreOptions = {
      mode: 'merge',
      importBoxes: true,
      importSpecimens: true,
      importBatches: true,
    };

    const result = performRestore(
      previewData,
      options,
      currentBoxes,
      currentSpecimens,
      currentBatches,
      setBoxes,
      setSpecimens,
      setBatches
    );

    expect(result.success).toBe(true);
    expect(result.stats.boxesAdded).toBe(1);
    expect(result.stats.specimensAdded).toBe(1);
    expect(result.stats.batchesAdded).toBe(1);
    expect(setBoxes).toHaveBeenCalled();
    expect(setSpecimens).toHaveBeenCalled();
    expect(setBatches).toHaveBeenCalled();
  });

  it('should skip items with missing references in overwrite mode', () => {
    const backupData: BackupFileData = {
      version: BACKUP_FILE_VERSION,
      exportedAt: '2024-06-01T00:00:00.000Z',
      appName: '昆虫标本管理系统',
      data: {
        boxes: [],
        specimens: [
          createMockSpecimen({ id: 'sp-valid', specimenNo: 'SP-VALID' }),
          createMockSpecimen({ id: 'sp-invalid', specimenNo: 'SP-INVALID', boxId: 'missing-box' }),
        ],
        batches: [],
      },
      stats: { boxCount: 0, specimenCount: 2, batchCount: 0 },
    };

    const previewData = generateRestorePreview(backupData, [], [], []);
    const options: RestoreOptions = {
      mode: 'overwrite',
      importBoxes: false,
      importSpecimens: true,
      importBatches: false,
    };

    const result = performRestore(
      previewData,
      options,
      [],
      [],
      [],
      setBoxes,
      setSpecimens,
      setBatches
    );

    expect(result.success).toBe(true);
    expect(result.stats.specimensAdded).toBe(1);
    expect(result.stats.skippedDueToMissingRefs).toBe(1);
  });

  it('should respect import options', () => {
    const backupData: BackupFileData = {
      version: BACKUP_FILE_VERSION,
      exportedAt: '2024-06-01T00:00:00.000Z',
      appName: '昆虫标本管理系统',
      data: {
        boxes: [createMockBox({ id: 'box-1' })],
        specimens: [createMockSpecimen({ id: 'sp-1', specimenNo: 'SP-001' })],
        batches: [createMockBatch({ id: 'batch-1' })],
      },
      stats: { boxCount: 1, specimenCount: 1, batchCount: 1 },
    };

    const previewData = generateRestorePreview(backupData, [], [], []);
    const options: RestoreOptions = {
      mode: 'overwrite',
      importBoxes: false,
      importSpecimens: true,
      importBatches: false,
    };

    const result = performRestore(
      previewData,
      options,
      [],
      [],
      [],
      setBoxes,
      setSpecimens,
      setBatches
    );

    expect(result.success).toBe(true);
    expect(result.stats.boxesAdded).toBe(0);
    expect(result.stats.specimensAdded).toBe(1);
    expect(result.stats.batchesAdded).toBe(0);
    expect(setBoxes).not.toHaveBeenCalled();
    expect(setSpecimens).toHaveBeenCalled();
    expect(setBatches).not.toHaveBeenCalled();
  });
});
