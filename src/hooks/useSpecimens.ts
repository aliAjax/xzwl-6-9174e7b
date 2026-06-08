import { useCallback } from 'react';
import type { Box, Specimen, SpecimenFormData, BoxFormData, CollectionBatch, CollectionBatchFormData, BoxTransferData } from '../types';
import { useLocalStorage } from './useLocalStorage';
import { mockBoxes, mockSpecimens, mockBatches } from '../data/mockData';
import { generateId, migrateSpecimenData, isHighRiskCompliance } from '../utils/helpers';

const BOXES_KEY = 'insect_boxes';
const SPECIMENS_KEY = 'insect_specimens';
const BATCHES_KEY = 'insect_batches';

export function useSpecimens() {
  const [boxes, setBoxes] = useLocalStorage<Box[]>(BOXES_KEY, mockBoxes);
  const [specimens, setSpecimens] = useLocalStorage<Specimen[]>(SPECIMENS_KEY, mockSpecimens);
  const [batches, setBatches] = useLocalStorage<CollectionBatch[]>(BATCHES_KEY, mockBatches);

  const addSpecimen = useCallback((data: SpecimenFormData) => {
    const now = new Date().toISOString();
    const newSpecimen: Specimen = {
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    setSpecimens(prev => [...prev, newSpecimen]);
    return newSpecimen;
  }, [setSpecimens]);

  const checkSpecimenNoExists = useCallback((specimenNo: string) => {
    return specimens.some(s => s.specimenNo === specimenNo);
  }, [specimens]);

  const addSpecimensBatch = useCallback((dataList: SpecimenFormData[]) => {
    const now = new Date().toISOString();
    const newSpecimens: Specimen[] = dataList.map(data => ({
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    }));
    setSpecimens(prev => [...prev, ...newSpecimens]);
    return newSpecimens;
  }, [setSpecimens]);

  const updateSpecimen = useCallback((id: string, data: Partial<SpecimenFormData>) => {
    const now = new Date().toISOString();
    setSpecimens(prev =>
      prev.map(s =>
        s.id === id ? { ...s, ...data, updatedAt: now } : s
      )
    );
  }, [setSpecimens]);

  const deleteSpecimen = useCallback((id: string) => {
    setSpecimens(prev => prev.filter(s => s.id !== id));
  }, [setSpecimens]);

  const togglePhotographed = useCallback((id: string) => {
    const now = new Date().toISOString();
    setSpecimens(prev =>
      prev.map(s =>
        s.id === id ? { ...s, photographed: !s.photographed, updatedAt: now } : s
      )
    );
  }, [setSpecimens]);

  const markPhotographed = useCallback((ids: string[], photographed: boolean = true) => {
    const now = new Date().toISOString();
    const idSet = new Set(ids);
    setSpecimens(prev =>
      prev.map(s =>
        idSet.has(s.id) ? { ...s, photographed, updatedAt: now } : s
      )
    );
  }, [setSpecimens]);

  const transferSpecimens = useCallback((data: BoxTransferData) => {
    const now = new Date().toISOString();
    const idSet = new Set(data.specimenIds);
    setSpecimens(prev =>
      prev.map(s =>
        idSet.has(s.id)
          ? {
              ...s,
              boxId: data.targetBoxId,
              updatedAt: now,
            }
          : s
      )
    );
  }, [setSpecimens]);

  const togglePinned = useCallback((id: string) => {
    const now = new Date().toISOString();
    setSpecimens(prev =>
      prev.map(s =>
        s.id === id ? { ...s, pinnedStatus: !s.pinnedStatus, updatedAt: now } : s
      )
    );
  }, [setSpecimens]);

  const addBox = useCallback((data: BoxFormData) => {
    const newBox: Box = {
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    setBoxes(prev => [...prev, newBox]);
    return newBox;
  }, [setBoxes]);

  const updateBox = useCallback((id: string, data: Partial<BoxFormData>) => {
    setBoxes(prev =>
      prev.map(b => (b.id === id ? { ...b, ...data } : b))
    );
  }, [setBoxes]);

  const deleteBox = useCallback((id: string) => {
    const hasSpecimens = specimens.some(s => s.boxId === id);
    if (hasSpecimens) {
      throw new Error('无法删除包含标本的展盒');
    }
    setBoxes(prev => prev.filter(b => b.id !== id));
  }, [setBoxes, specimens]);

  const getBoxById = useCallback((id: string) => {
    return boxes.find(b => b.id === id);
  }, [boxes]);

  const getSpecimensByBoxId = useCallback((boxId: string) => {
    return specimens.filter(s => s.boxId === boxId);
  }, [specimens]);

  const getSpecimensCountByBoxId = useCallback((boxId: string) => {
    return specimens.filter(s => s.boxId === boxId).length;
  }, [specimens]);

  const addBatch = useCallback((data: CollectionBatchFormData) => {
    const newBatch: CollectionBatch = {
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    setBatches(prev => [...prev, newBatch]);
    return newBatch;
  }, [setBatches]);

  const updateBatch = useCallback((id: string, data: Partial<CollectionBatchFormData>) => {
    setBatches(prev =>
      prev.map(b => (b.id === id ? { ...b, ...data } : b))
    );
  }, [setBatches]);

  const deleteBatch = useCallback((id: string) => {
    const hasSpecimens = specimens.some(s => s.batchId === id);
    if (hasSpecimens) {
      throw new Error('无法删除包含标本的采集批次');
    }
    setBatches(prev => prev.filter(b => b.id !== id));
  }, [setBatches, specimens]);

  const getBatchById = useCallback((id: string) => {
    return batches.find(b => b.id === id);
  }, [batches]);

  const getSpecimensByBatchId = useCallback((batchId: string) => {
    return specimens.filter(s => s.batchId === batchId);
  }, [specimens]);

  const getSpecimensCountByBatchId = useCallback((batchId: string) => {
    return specimens.filter(s => s.batchId === batchId).length;
  }, [specimens]);

  const stats = {
    totalSpecimens: specimens.length,
    photographed: specimens.filter(s => s.photographed).length,
    unphotographed: specimens.filter(s => !s.photographed).length,
    totalBoxes: boxes.length,
    totalBatches: batches.length,
  };

  return {
    boxes,
    specimens,
    batches,
    stats,
    setBoxes,
    setSpecimens,
    setBatches,
    addSpecimen,
    updateSpecimen,
    deleteSpecimen,
    togglePhotographed,
    markPhotographed,
    transferSpecimens,
    togglePinned,
    addBox,
    updateBox,
    deleteBox,
    getBoxById,
    getSpecimensByBoxId,
    getSpecimensCountByBoxId,
    addBatch,
    updateBatch,
    deleteBatch,
    getBatchById,
    getSpecimensByBatchId,
    getSpecimensCountByBatchId,
    checkSpecimenNoExists,
    addSpecimensBatch,
  };
}
