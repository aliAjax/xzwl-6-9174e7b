import type {
  BackupFileData,
  DiffItem,
  DiffItemType,
  DiffConflictType,
  DiffAnalysisResult,
  FieldDiff,
  MergeStrategy,
  MergeResult,
  MergeSnapshot,
} from '../types';
import type { Box, Specimen, CollectionBatch } from '../types';
import { generateId } from './common';
import { migrateSpecimenWithCompliance } from './backup';

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
