import { describe, it, expect, vi } from 'vitest';
import {
  analyzeDifferences,
  performDiffMerge,
  restoreFromSnapshot,
  getConflictTypeLabel,
  getConflictTypeColor,
  getStrategyLabel,
  getTypeLabel,
} from './diffMerge';
import type { Box, Specimen, CollectionBatch, BackupFileData, MergeSnapshot } from '../types';
import { BACKUP_FILE_VERSION } from '../types';

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

const createMockBackupData = (
  boxes: Box[] = [],
  specimens: Specimen[] = [],
  batches: CollectionBatch[] = []
): BackupFileData => ({
  version: BACKUP_FILE_VERSION,
  exportedAt: '2024-06-01T00:00:00.000Z',
  appName: '昆虫标本管理系统',
  data: { boxes, specimens, batches },
  stats: {
    boxCount: boxes.length,
    specimenCount: specimens.length,
    batchCount: batches.length,
  },
});

describe('analyzeDifferences', () => {
  it('should return empty diff when both sides are identical', () => {
    const boxes = [createMockBox()];
    const specimens = [createMockSpecimen()];
    const batches = [createMockBatch()];
    const backupData = createMockBackupData(boxes, specimens, batches);

    const result = analyzeDifferences(backupData, boxes, specimens, batches);

    expect(result.stats.total).toBe(0);
    expect(result.hasConflicts).toBe(false);
    expect(result.items).toHaveLength(0);
  });

  it('should detect new items in backup', () => {
    const currentBoxes: Box[] = [];
    const currentSpecimens: Specimen[] = [];
    const currentBatches: CollectionBatch[] = [];

    const backupBoxes = [createMockBox({ id: 'new-box', name: 'New Box' })];
    const backupSpecimens = [createMockSpecimen({ id: 'new-specimen', specimenNo: 'SP-NEW' })];
    const backupBatches = [createMockBatch({ id: 'new-batch', name: 'New Batch' })];

    const backupData = createMockBackupData(backupBoxes, backupSpecimens, backupBatches);

    const result = analyzeDifferences(backupData, currentBoxes, currentSpecimens, currentBatches);

    expect(result.stats.total).toBe(3);
    expect(result.stats.newInBackup).toBe(3);
    expect(result.items.filter(i => i.conflictType === 'new_in_backup')).toHaveLength(3);
  });

  it('should detect items deleted in backup', () => {
    const currentBoxes = [createMockBox({ id: 'deleted-box', name: 'Deleted Box' })];
    const currentSpecimens = [createMockSpecimen({ id: 'deleted-specimen', specimenNo: 'SP-DEL' })];
    const currentBatches = [createMockBatch({ id: 'deleted-batch', name: 'Deleted Batch' })];

    const backupData = createMockBackupData([], [], []);

    const result = analyzeDifferences(backupData, currentBoxes, currentSpecimens, currentBatches);

    expect(result.stats.total).toBe(3);
    expect(result.stats.deletedInBackup).toBe(3);
    expect(result.items.filter(i => i.conflictType === 'deleted_in_backup')).toHaveLength(3);
  });

  it('should detect field inconsistencies', () => {
    const currentBox = createMockBox({ id: 'box-1', name: 'Current Name', location: 'Shelf A' });
    const backupBox = createMockBox({ id: 'box-1', name: 'Backup Name', location: 'Shelf B' });

    const currentSpecimen = createMockSpecimen({
      id: 'specimen-1',
      specimenNo: 'SP-001',
      species: 'Current Species',
      notes: 'Current notes',
    });
    const backupSpecimen = createMockSpecimen({
      id: 'specimen-1',
      specimenNo: 'SP-001',
      species: 'Backup Species',
      notes: 'Backup notes',
    });

    const currentBatch = createMockBatch({ id: 'batch-1', name: 'Current Batch', location: 'Current Location' });
    const backupBatch = createMockBatch({ id: 'batch-1', name: 'Backup Batch', location: 'Backup Location' });

    const backupData = createMockBackupData([backupBox], [backupSpecimen], [backupBatch]);

    const result = analyzeDifferences(
      backupData,
      [currentBox],
      [currentSpecimen],
      [currentBatch]
    );

    expect(result.stats.fieldInconsistent).toBe(3);
    const boxDiff = result.items.find(i => i.type === 'box')!;
    expect(boxDiff.fieldDiffs).toHaveLength(2);
    expect(boxDiff.fieldDiffs?.some(d => d.field === 'name')).toBe(true);
    expect(boxDiff.fieldDiffs?.some(d => d.field === 'location')).toBe(true);
  });

  it('should detect specimen number conflicts', () => {
    const currentSpecimen = createMockSpecimen({
      id: 'current-id',
      specimenNo: 'SP-001',
      species: 'Current Species',
    });

    const backupSpecimen = createMockSpecimen({
      id: 'backup-id',
      specimenNo: 'SP-001',
      species: 'Backup Species',
    });

    const backupData = createMockBackupData([], [backupSpecimen], []);

    const result = analyzeDifferences(backupData, [], [currentSpecimen], []);

    expect(result.stats.specimenNoConflicts).toBe(1);
    const conflictItem = result.items.find(i => i.conflictType === 'specimen_no_conflict')!;
    expect(conflictItem).toBeDefined();
    expect(conflictItem.specimenNo).toBe('SP-001');
  });

  it('should detect missing box references', () => {
    const currentBoxes: Box[] = [];
    const currentSpecimens: Specimen[] = [];
    const currentBatches: CollectionBatch[] = [];

    const backupSpecimen = createMockSpecimen({
      id: 'specimen-1',
      specimenNo: 'SP-001',
      boxId: 'non-existent-box',
    });

    const backupData = createMockBackupData([], [backupSpecimen], []);

    const result = analyzeDifferences(backupData, currentBoxes, currentSpecimens, currentBatches);

    expect(result.stats.missingBoxRefs).toBe(1);
    const item = result.items.find(i => i.conflictType === 'missing_box_ref')!;
    expect(item).toBeDefined();
    expect(item.referenceRepair?.referenceType).toBe('box');
    expect(item.referenceRepair?.missingId).toBe('non-existent-box');
  });

  it('should detect missing batch references', () => {
    const currentBoxes: Box[] = [];
    const currentSpecimens: Specimen[] = [];
    const currentBatches: CollectionBatch[] = [];

    const backupSpecimen = createMockSpecimen({
      id: 'specimen-1',
      specimenNo: 'SP-001',
      batchId: 'non-existent-batch',
    });

    const backupData = createMockBackupData([], [backupSpecimen], []);

    const result = analyzeDifferences(backupData, currentBoxes, currentSpecimens, currentBatches);

    expect(result.stats.missingBatchRefs).toBe(1);
    const item = result.items.find(i => i.conflictType === 'missing_batch_ref')!;
    expect(item).toBeDefined();
    expect(item.referenceRepair?.referenceType).toBe('batch');
    expect(item.referenceRepair?.missingId).toBe('non-existent-batch');
  });

  it('should set default merge strategies correctly', () => {
    const backupData = createMockBackupData(
      [createMockBox({ id: 'new-box' })],
      [createMockSpecimen({ id: 'new-specimen', specimenNo: 'SP-NEW' })],
      []
    );

    const result = analyzeDifferences(backupData, [], [], []);

    const newBoxItem = result.items.find(i => i.type === 'box' && i.conflictType === 'new_in_backup')!;
    expect(newBoxItem.selectedStrategy).toBe('keep_import');

    const newSpecimenItem = result.items.find(i => i.type === 'specimen' && i.conflictType === 'new_in_backup')!;
    expect(newSpecimenItem.selectedStrategy).toBe('keep_import');
  });
});

describe('performDiffMerge', () => {
  it('should merge new items from backup with keep_import strategy', () => {
    const currentBoxes: Box[] = [];
    const currentSpecimens: Specimen[] = [];
    const currentBatches: CollectionBatch[] = [];

    const newBox = createMockBox({ id: 'new-box', name: 'New Box' });
    const newSpecimen = createMockSpecimen({ id: 'new-specimen', specimenNo: 'SP-NEW' });
    const newBatch = createMockBatch({ id: 'new-batch', name: 'New Batch' });

    const backupData = createMockBackupData([newBox], [newSpecimen], [newBatch]);
    const analysis = analyzeDifferences(backupData, currentBoxes, currentSpecimens, currentBatches);

    let mergedBoxes: Box[] = [];
    let mergedSpecimens: Specimen[] = [];
    let mergedBatches: CollectionBatch[] = [];

    const setBoxes = vi.fn((value: Box[] | ((prev: Box[]) => Box[])) => {
      mergedBoxes = typeof value === 'function' ? value(mergedBoxes) : value;
    });
    const setSpecimens = vi.fn((value: Specimen[] | ((prev: Specimen[]) => Specimen[])) => {
      mergedSpecimens = typeof value === 'function' ? value(mergedSpecimens) : value;
    });
    const setBatches = vi.fn((value: CollectionBatch[] | ((prev: CollectionBatch[]) => CollectionBatch[])) => {
      mergedBatches = typeof value === 'function' ? value(mergedBatches) : value;
    });

    const result = performDiffMerge(
      analysis.items,
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
    expect(mergedBoxes).toHaveLength(1);
    expect(mergedSpecimens).toHaveLength(1);
    expect(mergedBatches).toHaveLength(1);
  });

  it('should keep current items when strategy is keep_current for deleted items', () => {
    const currentBoxes = [createMockBox({ id: 'box-1', name: 'Keep Me' })];
    const currentSpecimens = [createMockSpecimen({ id: 'specimen-1', specimenNo: 'SP-KEEP' })];
    const currentBatches = [createMockBatch({ id: 'batch-1', name: 'Keep Batch' })];

    const backupData = createMockBackupData([], [], []);
    const analysis = analyzeDifferences(backupData, currentBoxes, currentSpecimens, currentBatches);

    const itemsWithKeepCurrent = analysis.items.map(item => ({
      ...item,
      selectedStrategy: 'keep_current' as const,
    }));

    let mergedBoxes = [...currentBoxes];
    let mergedSpecimens = [...currentSpecimens];
    let mergedBatches = [...currentBatches];

    const setBoxes = vi.fn((value: Box[] | ((prev: Box[]) => Box[])) => {
      mergedBoxes = typeof value === 'function' ? value(mergedBoxes) : value;
    });
    const setSpecimens = vi.fn((value: Specimen[] | ((prev: Specimen[]) => Specimen[])) => {
      mergedSpecimens = typeof value === 'function' ? value(mergedSpecimens) : value;
    });
    const setBatches = vi.fn((value: CollectionBatch[] | ((prev: CollectionBatch[]) => CollectionBatch[])) => {
      mergedBatches = typeof value === 'function' ? value(mergedBatches) : value;
    });

    const result = performDiffMerge(
      itemsWithKeepCurrent,
      currentBoxes,
      currentSpecimens,
      currentBatches,
      setBoxes,
      setSpecimens,
      setBatches
    );

    expect(result.success).toBe(true);
    expect(result.stats.boxesDeleted).toBe(0);
    expect(result.stats.specimensDeleted).toBe(0);
    expect(result.stats.batchesDeleted).toBe(0);
    expect(mergedBoxes).toHaveLength(1);
    expect(mergedSpecimens).toHaveLength(1);
    expect(mergedBatches).toHaveLength(1);
  });

  it('should update fields with keep_import strategy for inconsistent items', () => {
    const currentBox = createMockBox({ id: 'box-1', name: 'Old Name', location: 'Old Location' });
    const backupBox = createMockBox({ id: 'box-1', name: 'New Name', location: 'New Location' });

    const backupData = createMockBackupData([backupBox], [], []);
    const analysis = analyzeDifferences(backupData, [currentBox], [], []);

    const itemsWithKeepImport = analysis.items.map(item => ({
      ...item,
      selectedStrategy: 'keep_import' as const,
    }));

    let mergedBoxes = [currentBox];

    const setBoxes = vi.fn((value: Box[] | ((prev: Box[]) => Box[])) => {
      mergedBoxes = typeof value === 'function' ? value(mergedBoxes) : value;
    });
    const setSpecimens = vi.fn();
    const setBatches = vi.fn();

    const result = performDiffMerge(
      itemsWithKeepImport,
      [currentBox],
      [],
      [],
      setBoxes,
      setSpecimens,
      setBatches
    );

    expect(result.success).toBe(true);
    expect(result.stats.boxesUpdated).toBe(1);
    expect(mergedBoxes[0].name).toBe('New Name');
    expect(mergedBoxes[0].location).toBe('New Location');
  });

  it('should create snapshot before merge', () => {
    const currentBoxes = [createMockBox({ id: 'box-1', name: 'Original' })];
    const backupData = createMockBackupData([], [], []);
    const analysis = analyzeDifferences(backupData, currentBoxes, [], []);

    const setBoxes = vi.fn((value: Box[] | ((prev: Box[]) => Box[])) => {
      if (typeof value === 'function') {
        value([...currentBoxes]);
      }
    });
    const setSpecimens = vi.fn((value: Specimen[] | ((prev: Specimen[]) => Specimen[])) => {
      if (typeof value === 'function') {
        value([]);
      }
    });
    const setBatches = vi.fn((value: CollectionBatch[] | ((prev: CollectionBatch[]) => CollectionBatch[])) => {
      if (typeof value === 'function') {
        value([]);
      }
    });

    const result = performDiffMerge(
      analysis.items,
      currentBoxes,
      [],
      [],
      setBoxes,
      setSpecimens,
      setBatches
    );

    expect(result.snapshot).toBeDefined();
    expect(result.snapshot.boxes).toHaveLength(1);
    expect(result.snapshot.boxes[0].name).toBe('Original');
  });
});

describe('restoreFromSnapshot', () => {
  it('should restore data from snapshot', () => {
    const snapshot: MergeSnapshot = {
      boxes: [createMockBox({ id: 'box-1', name: 'Snapshot Box' })],
      specimens: [createMockSpecimen({ id: 'specimen-1', specimenNo: 'SP-SNAP' })],
      batches: [createMockBatch({ id: 'batch-1', name: 'Snapshot Batch' })],
    };

    let restoredBoxes: Box[] = [];
    let restoredSpecimens: Specimen[] = [];
    let restoredBatches: CollectionBatch[] = [];

    const setBoxes = vi.fn((data: Box[]) => {
      restoredBoxes = data;
    });
    const setSpecimens = vi.fn((data: Specimen[]) => {
      restoredSpecimens = data;
    });
    const setBatches = vi.fn((data: CollectionBatch[]) => {
      restoredBatches = data;
    });

    const result = restoreFromSnapshot(snapshot, setBoxes, setSpecimens, setBatches);

    expect(result).toBe(true);
    expect(restoredBoxes[0].name).toBe('Snapshot Box');
    expect(restoredSpecimens[0].specimenNo).toBe('SP-SNAP');
    expect(restoredBatches[0].name).toBe('Snapshot Batch');
  });

  it('should return false on restore failure', () => {
    const snapshot: MergeSnapshot = {
      boxes: [],
      specimens: [],
      batches: [],
    };

    const setBoxes = vi.fn(() => {
      throw new Error('Restore failed');
    });
    const setSpecimens = vi.fn();
    const setBatches = vi.fn();

    const result = restoreFromSnapshot(snapshot, setBoxes, setSpecimens, setBatches);

    expect(result).toBe(false);
  });
});

describe('helper functions', () => {
  it('getConflictTypeLabel should return Chinese labels', () => {
    expect(getConflictTypeLabel('new_in_backup')).toBe('备份新增');
    expect(getConflictTypeLabel('deleted_in_backup')).toBe('备份删除');
    expect(getConflictTypeLabel('specimen_no_conflict')).toBe('标本编号冲突');
    expect(getConflictTypeLabel('field_inconsistent')).toBe('字段不一致');
    expect(getConflictTypeLabel('missing_box_ref')).toBe('展盒引用丢失');
    expect(getConflictTypeLabel('missing_batch_ref')).toBe('批次引用丢失');
  });

  it('getConflictTypeColor should return tailwind classes', () => {
    expect(getConflictTypeColor('new_in_backup')).toContain('green');
    expect(getConflictTypeColor('deleted_in_backup')).toContain('rust');
    expect(getConflictTypeColor('field_inconsistent')).toContain('blue');
    expect(getConflictTypeColor('missing_box_ref')).toContain('purple');
  });

  it('getStrategyLabel should return Chinese labels', () => {
    expect(getStrategyLabel('keep_current')).toBe('保留当前');
    expect(getStrategyLabel('keep_import')).toBe('使用导入');
    expect(getStrategyLabel('manual')).toBe('手动合并');
  });

  it('getTypeLabel should return Chinese labels', () => {
    expect(getTypeLabel('specimen')).toBe('标本');
    expect(getTypeLabel('box')).toBe('展盒');
    expect(getTypeLabel('batch')).toBe('批次');
  });
});
