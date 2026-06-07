import { useCallback } from 'react';
import type { Box, Specimen, SpecimenFormData, BoxFormData } from '../types';
import { useLocalStorage } from './useLocalStorage';
import { mockBoxes, mockSpecimens } from '../data/mockData';
import { generateId } from '../utils/helpers';

const BOXES_KEY = 'insect_boxes';
const SPECIMENS_KEY = 'insect_specimens';

export function useSpecimens() {
  const [boxes, setBoxes] = useLocalStorage<Box[]>(BOXES_KEY, mockBoxes);
  const [specimens, setSpecimens] = useLocalStorage<Specimen[]>(SPECIMENS_KEY, mockSpecimens);

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

  const stats = {
    totalSpecimens: specimens.length,
    photographed: specimens.filter(s => s.photographed).length,
    unphotographed: specimens.filter(s => !s.photographed).length,
    totalBoxes: boxes.length,
  };

  return {
    boxes,
    specimens,
    stats,
    addSpecimen,
    updateSpecimen,
    deleteSpecimen,
    togglePhotographed,
    togglePinned,
    addBox,
    updateBox,
    deleteBox,
    getBoxById,
    getSpecimensByBoxId,
    getSpecimensCountByBoxId,
  };
}
