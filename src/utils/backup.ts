import type {
  BackupFileData,
  RestoreCompatibilityCheck,
  RestorePreviewData,
  RestoreOptions,
  RestoreResult,
} from '../types';
import type { Box, Specimen, CollectionBatch } from '../types';
import { BACKUP_FILE_VERSION, DEFAULT_COMPLIANCE_STATUS } from '../types';
import { generateId, downloadJson } from './common';

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
