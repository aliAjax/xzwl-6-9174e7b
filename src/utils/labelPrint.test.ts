import { describe, it, expect } from 'vitest';
import {
  getSpecimenLabelData,
  checkLabelFields,
  batchCheckLabelFields,
  getPrintStyles,
  generateLabelPages,
} from './labelPrint';
import type { Box, Specimen, SpecimenLabelData } from '../types';

const createMockBox = (overrides: Partial<Box> = {}): Box => ({
  id: 'box-1',
  name: 'Box 1',
  location: 'Shelf A',
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

describe('getSpecimenLabelData', () => {
  it('should return complete label data for specimen with box', () => {
    const specimen = createMockSpecimen({
      id: 'sp-1',
      specimenNo: 'SP-001',
      species: '凤蝶',
      collectionLocation: '北京香山',
      collectionDate: '2024-05-01',
      boxId: 'box-1',
      photographed: true,
    });

    const boxes = [
      createMockBox({ id: 'box-1', name: '展盒A', location: '第一层-左侧' }),
    ];

    const result = getSpecimenLabelData(specimen, boxes);

    expect(result).toEqual({
      specimenNo: 'SP-001',
      species: '凤蝶',
      collectionLocation: '北京香山',
      collectionDate: '2024-05-01',
      boxLocation: '第一层-左侧',
      photographed: true,
      boxName: '展盒A',
    });
  });

  it('should handle specimen without box assignment', () => {
    const specimen = createMockSpecimen({
      id: 'sp-1',
      specimenNo: 'SP-001',
      species: '凤蝶',
      collectionLocation: '北京香山',
      collectionDate: '2024-05-01',
      boxId: '',
      photographed: false,
    });

    const result = getSpecimenLabelData(specimen, []);

    expect(result.boxName).toBe('未分配展盒');
    expect(result.boxLocation).toBe('');
  });

  it('should handle box not found in boxes array', () => {
    const specimen = createMockSpecimen({
      id: 'sp-1',
      specimenNo: 'SP-001',
      boxId: 'non-existent-box',
    });

    const boxes = [createMockBox({ id: 'box-1', name: 'Other Box' })];

    const result = getSpecimenLabelData(specimen, boxes);

    expect(result.boxName).toBe('未分配展盒');
    expect(result.boxLocation).toBe('');
  });
});

describe('checkLabelFields', () => {
  const createLabelData = (overrides: Partial<SpecimenLabelData> = {}): SpecimenLabelData => ({
    specimenNo: 'SP-001',
    species: '凤蝶',
    collectionLocation: '北京香山',
    collectionDate: '2024-05-01',
    boxLocation: '第一层-左侧',
    photographed: true,
    boxName: '展盒A',
    ...overrides,
  });

  it('should return valid for complete label data', () => {
    const labelData = createLabelData();
    const specimen = createMockSpecimen({ id: 'sp-1', specimenNo: 'SP-001' });

    const result = checkLabelFields(labelData, specimen);

    expect(result.isValid).toBe(true);
    expect(result.missingFields).toHaveLength(0);
    expect(result.specimenId).toBe('sp-1');
    expect(result.specimenNo).toBe('SP-001');
  });

  it('should detect missing specimenNo', () => {
    const labelData = createLabelData({ specimenNo: '' });
    const specimen = createMockSpecimen({ id: 'sp-1', specimenNo: 'SP-001' });

    const result = checkLabelFields(labelData, specimen);

    expect(result.isValid).toBe(false);
    expect(result.missingFields).toContain('标本编号');
  });

  it('should detect missing species', () => {
    const labelData = createLabelData({ species: '' });
    const specimen = createMockSpecimen({ id: 'sp-1', specimenNo: 'SP-001' });

    const result = checkLabelFields(labelData, specimen);

    expect(result.isValid).toBe(false);
    expect(result.missingFields).toContain('物种名');
  });

  it('should detect missing collectionLocation', () => {
    const labelData = createLabelData({ collectionLocation: '' });
    const specimen = createMockSpecimen({ id: 'sp-1', specimenNo: 'SP-001' });

    const result = checkLabelFields(labelData, specimen);

    expect(result.isValid).toBe(false);
    expect(result.missingFields).toContain('采集地点');
  });

  it('should detect missing collectionDate', () => {
    const labelData = createLabelData({ collectionDate: '' });
    const specimen = createMockSpecimen({ id: 'sp-1', specimenNo: 'SP-001' });

    const result = checkLabelFields(labelData, specimen);

    expect(result.isValid).toBe(false);
    expect(result.missingFields).toContain('采集日期');
  });

  it('should detect missing boxLocation', () => {
    const labelData = createLabelData({ boxLocation: '' });
    const specimen = createMockSpecimen({ id: 'sp-1', specimenNo: 'SP-001' });

    const result = checkLabelFields(labelData, specimen);

    expect(result.isValid).toBe(false);
    expect(result.missingFields).toContain('展盒位置');
  });

  it('should allow missing optional fields', () => {
    const labelData = createLabelData({ photographed: false });
    const specimen = createMockSpecimen({ id: 'sp-1', specimenNo: 'SP-001' });

    const result = checkLabelFields(labelData, specimen);

    expect(result.isValid).toBe(true);
    expect(result.missingFields).not.toContain('拍照状态');
  });

  it('should detect multiple missing fields', () => {
    const labelData = createLabelData({
      specimenNo: '',
      species: '',
      collectionLocation: '',
    });
    const specimen = createMockSpecimen({ id: 'sp-1', specimenNo: '' });

    const result = checkLabelFields(labelData, specimen);

    expect(result.isValid).toBe(false);
    expect(result.missingFields).toContain('标本编号');
    expect(result.missingFields).toContain('物种名');
    expect(result.missingFields).toContain('采集地点');
    expect(result.missingFields.length).toBeGreaterThanOrEqual(3);
  });
});

describe('batchCheckLabelFields', () => {
  it('should check multiple specimens and return summary', () => {
    const specimens = [
      createMockSpecimen({
        id: 'sp-1',
        specimenNo: 'SP-001',
        species: '凤蝶',
        collectionLocation: '北京香山',
        collectionDate: '2024-05-01',
        boxId: 'box-1',
      }),
      createMockSpecimen({
        id: 'sp-2',
        specimenNo: 'SP-002',
        species: '',
        collectionLocation: '上海植物园',
        collectionDate: '2024-06-01',
        boxId: 'box-1',
      }),
      createMockSpecimen({
        id: 'sp-3',
        specimenNo: 'SP-003',
        species: '粉蝶',
        collectionLocation: '',
        collectionDate: '',
        boxId: '',
      }),
    ];

    const boxes = [
      createMockBox({ id: 'box-1', name: '展盒A', location: '第一层' }),
    ];

    const result = batchCheckLabelFields(specimens, boxes);

    expect(result.results).toHaveLength(3);
    expect(result.validCount).toBe(1);
    expect(result.invalidCount).toBe(2);

    expect(result.results[0].isValid).toBe(true);
    expect(result.results[1].isValid).toBe(false);
    expect(result.results[2].isValid).toBe(false);

    expect(result.results[1].missingFields).toContain('物种名');
    expect(result.results[2].missingFields).toContain('采集地点');
    expect(result.results[2].missingFields).toContain('采集日期');
    expect(result.results[2].missingFields).toContain('展盒位置');
  });

  it('should handle empty specimens array', () => {
    const result = batchCheckLabelFields([], []);

    expect(result.results).toHaveLength(0);
    expect(result.validCount).toBe(0);
    expect(result.invalidCount).toBe(0);
  });

  it('should return all valid when all specimens are complete', () => {
    const specimens = [
      createMockSpecimen({
        id: 'sp-1',
        specimenNo: 'SP-001',
        species: '凤蝶',
        collectionLocation: '北京香山',
        collectionDate: '2024-05-01',
        boxId: 'box-1',
      }),
      createMockSpecimen({
        id: 'sp-2',
        specimenNo: 'SP-002',
        species: '粉蝶',
        collectionLocation: '上海植物园',
        collectionDate: '2024-06-01',
        boxId: 'box-1',
      }),
    ];

    const boxes = [
      createMockBox({ id: 'box-1', name: '展盒A', location: '第一层' }),
    ];

    const result = batchCheckLabelFields(specimens, boxes);

    expect(result.validCount).toBe(2);
    expect(result.invalidCount).toBe(0);
  });
});

describe('getPrintStyles', () => {
  it('should return valid CSS styles', () => {
    const styles = getPrintStyles();

    expect(typeof styles).toBe('string');
    expect(styles.length).toBeGreaterThan(0);
    expect(styles).toContain('@page');
    expect(styles).toContain('@media print');
    expect(styles).toContain('label-print-area');
    expect(styles).toContain('page-break-after');
    expect(styles).toContain('page-break-inside');
  });

  it('should include print visibility rules', () => {
    const styles = getPrintStyles();

    expect(styles).toContain('visibility: hidden');
    expect(styles).toContain('visibility: visible');
  });
});

describe('generateLabelPages', () => {
  it('should split items into pages correctly', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    const pages = generateLabelPages(items, 3);

    expect(pages).toHaveLength(4);
    expect(pages[0]).toEqual([1, 2, 3]);
    expect(pages[1]).toEqual([4, 5, 6]);
    expect(pages[2]).toEqual([7, 8, 9]);
    expect(pages[3]).toEqual([10]);
  });

  it('should handle items that fit exactly into pages', () => {
    const items = [1, 2, 3, 4, 5, 6];

    const pages = generateLabelPages(items, 3);

    expect(pages).toHaveLength(2);
    expect(pages[0]).toEqual([1, 2, 3]);
    expect(pages[1]).toEqual([4, 5, 6]);
  });

  it('should handle single page', () => {
    const items = [1, 2, 3];

    const pages = generateLabelPages(items, 5);

    expect(pages).toHaveLength(1);
    expect(pages[0]).toEqual([1, 2, 3]);
  });

  it('should handle empty array', () => {
    const pages = generateLabelPages([], 5);

    expect(pages).toHaveLength(0);
  });

  it('should work with custom types', () => {
    type TestItem = { id: number; name: string };
    const items: TestItem[] = [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
      { id: 3, name: 'C' },
      { id: 4, name: 'D' },
    ];

    const pages = generateLabelPages(items, 2);

    expect(pages).toHaveLength(2);
    expect(pages[0]).toEqual([
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ]);
    expect(pages[1]).toEqual([
      { id: 3, name: 'C' },
      { id: 4, name: 'D' },
    ]);
  });
});
