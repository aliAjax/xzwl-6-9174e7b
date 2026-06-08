import type { SpecimenLabelData, LabelFieldCheckResult } from '../types';
import type { Box, Specimen } from '../types';
import { LABEL_FIELDS } from '../types';

export const getSpecimenLabelData = (
  specimen: Specimen,
  boxes: Box[]
): SpecimenLabelData => {
  const box = boxes.find(b => b.id === specimen.boxId);

  return {
    specimenNo: specimen.specimenNo,
    species: specimen.species,
    collectionLocation: specimen.collectionLocation,
    collectionDate: specimen.collectionDate,
    boxLocation: box?.location || '',
    photographed: specimen.photographed,
    boxName: box?.name || '未分配展盒',
  };
};

export const checkLabelFields = (
  labelData: SpecimenLabelData,
  specimen: Specimen
): LabelFieldCheckResult => {
  const missingFields: string[] = [];

  LABEL_FIELDS.forEach(field => {
    if (field.required) {
      const value = labelData[field.key as keyof SpecimenLabelData];
      if (value === undefined || value === null || value === '') {
        missingFields.push(field.label);
      }
    }
  });

  return {
    specimenId: specimen.id,
    specimenNo: specimen.specimenNo,
    missingFields,
    isValid: missingFields.length === 0,
  };
};

export const batchCheckLabelFields = (
  specimens: Specimen[],
  boxes: Box[]
): { results: LabelFieldCheckResult[]; validCount: number; invalidCount: number } => {
  const results = specimens.map(specimen => {
    const labelData = getSpecimenLabelData(specimen, boxes);
    return checkLabelFields(labelData, specimen);
  });

  const validCount = results.filter(r => r.isValid).length;
  const invalidCount = results.filter(r => !r.isValid).length;

  return { results, validCount, invalidCount };
};

export const getPrintStyles = (): string => {
  return `
    @page {
      margin: 5mm;
      size: auto;
    }

    @media print {
      body * {
        visibility: hidden;
      }

      #label-print-area, #label-print-area * {
        visibility: visible;
      }

      #label-print-area {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
      }

      .label-page {
        page-break-after: always;
        page-break-inside: avoid;
        margin: 0;
        padding: 0;
      }

      .label-page:last-child {
        page-break-after: auto;
      }

      .label-item {
        page-break-inside: avoid;
      }
    }
  `;
};

export const generateLabelPages = <T>(
  items: T[],
  itemsPerPage: number
): T[][] => {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += itemsPerPage) {
    pages.push(items.slice(i, i + itemsPerPage));
  }
  return pages;
};
