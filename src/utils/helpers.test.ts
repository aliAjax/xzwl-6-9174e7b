import { describe, it, expect } from 'vitest';
import {
  parseCsv,
  autoDetectFieldMapping,
  validateAndPreviewCsv,
  convertToSpecimenFormData,
} from './helpers';
import type { Specimen, Box, CollectionBatch, ImportPreviewRow } from '../types';

const createMockSpecimen = (overrides: Partial<Specimen> = {}): Specimen => ({
  id: 'mock-id',
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

describe('parseCsv', () => {
  it('should parse simple CSV with Chinese headers', () => {
    const csv = '标本编号,物种名,采集地点\nSP-001,凤蝶,北京';
    const result = parseCsv(csv);
    expect(result).toEqual([
      ['标本编号', '物种名', '采集地点'],
      ['SP-001', '凤蝶', '北京'],
    ]);
  });

  it('should parse CSV with BOM', () => {
    const csv = '\uFEFF标本编号,物种名\nSP-001,凤蝶';
    const result = parseCsv(csv);
    expect(result).toEqual([
      ['标本编号', '物种名'],
      ['SP-001', '凤蝶'],
    ]);
  });

  it('should handle CRLF line endings', () => {
    const csv = '标本编号,物种名\r\nSP-001,凤蝶\r\nSP-002,粉蝶';
    const result = parseCsv(csv);
    expect(result).toEqual([
      ['标本编号', '物种名'],
      ['SP-001', '凤蝶'],
      ['SP-002', '粉蝶'],
    ]);
  });

  it('should handle quoted fields with commas', () => {
    const csv = '标本编号,物种名,采集地点\nSP-001,凤蝶,"北京,海淀"';
    const result = parseCsv(csv);
    expect(result).toEqual([
      ['标本编号', '物种名', '采集地点'],
      ['SP-001', '凤蝶', '北京,海淀'],
    ]);
  });

  it('should handle quoted fields with quotes', () => {
    const csv = '标本编号,物种名,备注\nSP-001,凤蝶,"又名""菜粉蝶"""';
    const result = parseCsv(csv);
    expect(result).toEqual([
      ['标本编号', '物种名', '备注'],
      ['SP-001', '凤蝶', '又名"菜粉蝶"'],
    ]);
  });

  it('should handle quoted fields with newlines', () => {
    const csv = '标本编号,物种名,备注\nSP-001,凤蝶,"多行\n备注"';
    const result = parseCsv(csv);
    expect(result).toEqual([
      ['标本编号', '物种名', '备注'],
      ['SP-001', '凤蝶', '多行\n备注'],
    ]);
  });

  it('should trim whitespace from fields', () => {
    const csv = '标本编号, 物种名 ,采集地点\n  SP-001 , 凤蝶 , 北京 ';
    const result = parseCsv(csv);
    expect(result).toEqual([
      ['标本编号', '物种名', '采集地点'],
      ['SP-001', '凤蝶', '北京'],
    ]);
  });

  it('should filter out empty rows', () => {
    const csv = '标本编号,物种名\nSP-001,凤蝶\n\n\nSP-002,粉蝶\n';
    const result = parseCsv(csv);
    expect(result).toEqual([
      ['标本编号', '物种名'],
      ['SP-001', '凤蝶'],
      ['SP-002', '粉蝶'],
    ]);
  });

  it('should handle English headers', () => {
    const csv = 'specimenNo,species,collectionLocation\nSP-001,Papilio,Beijing';
    const result = parseCsv(csv);
    expect(result).toEqual([
      ['specimenNo', 'species', 'collectionLocation'],
      ['SP-001', 'Papilio', 'Beijing'],
    ]);
  });

  it('should handle empty CSV', () => {
    const csv = '';
    const result = parseCsv(csv);
    expect(result).toEqual([]);
  });

  it('should handle only headers', () => {
    const csv = '标本编号,物种名';
    const result = parseCsv(csv);
    expect(result).toEqual([['标本编号', '物种名']]);
  });
});

describe('autoDetectFieldMapping', () => {
  it('should map Chinese headers correctly', () => {
    const headers = [
      '标本编号', '物种名', '采集地点', '采集日期', '针插状态',
      '拍照状态', '展盒名称', '备注', '批次', '合规状态',
      '许可证编号', '到期日期', '合规备注',
    ];
    const mapping = autoDetectFieldMapping(headers);
    expect(mapping['标本编号']).toBe('specimenNo');
    expect(mapping['物种名']).toBe('species');
    expect(mapping['采集地点']).toBe('collectionLocation');
    expect(mapping['采集日期']).toBe('collectionDate');
    expect(mapping['针插状态']).toBe('pinnedStatus');
    expect(mapping['拍照状态']).toBe('photographed');
    expect(mapping['展盒名称']).toBe('boxName');
    expect(mapping['备注']).toBe('notes');
    expect(mapping['批次']).toBe('batchId');
    expect(mapping['合规状态']).toBe('complianceStatus');
    expect(mapping['许可证编号']).toBe('permitNumber');
    expect(mapping['到期日期']).toBe('permitExpiryDate');
    expect(mapping['合规备注']).toBe('complianceNotes');
  });

  it('should map English headers correctly', () => {
    const headers = [
      'specimenNo', 'species', 'collectionLocation', 'collectionDate', 'pinnedStatus',
      'photographed', 'boxName', 'notes', 'batchId', 'complianceStatus',
      'permitNumber', 'permitExpiryDate', 'complianceNotes',
    ];
    const mapping = autoDetectFieldMapping(headers);
    expect(mapping['specimenNo']).toBe('specimenNo');
    expect(mapping['species']).toBe('species');
    expect(mapping['collectionLocation']).toBe('collectionLocation');
    expect(mapping['collectionDate']).toBe('collectionDate');
    expect(mapping['pinnedStatus']).toBe('pinnedStatus');
    expect(mapping['photographed']).toBe('photographed');
    expect(mapping['boxName']).toBe('boxName');
    expect(mapping['notes']).toBe('notes');
    expect(mapping['batchId']).toBe('batchId');
    expect(mapping['complianceStatus']).toBe('complianceStatus');
    expect(mapping['permitNumber']).toBe('permitNumber');
    expect(mapping['permitExpiryDate']).toBe('permitExpiryDate');
    expect(mapping['complianceNotes']).toBe('complianceNotes');
  });

  it('should map alternative Chinese headers', () => {
    const headers = ['编号', '物种', '采集地', '日期', '针插', '拍照', '展盒', '说明', '采集批次'];
    const mapping = autoDetectFieldMapping(headers);
    expect(mapping['编号']).toBe('specimenNo');
    expect(mapping['物种']).toBe('species');
    expect(mapping['采集地']).toBe('collectionLocation');
    expect(mapping['日期']).toBe('collectionDate');
    expect(mapping['针插']).toBe('pinnedStatus');
    expect(mapping['拍照']).toBe('photographed');
    expect(mapping['展盒']).toBe('boxName');
    expect(mapping['说明']).toBe('notes');
    expect(mapping['采集批次']).toBe('batchId');
  });

  it('should map alternative English headers', () => {
    const headers = ['id', 'name', 'location', 'date', 'pinned', 'photo', 'box', 'remark', 'batch'];
    const mapping = autoDetectFieldMapping(headers);
    expect(mapping['id']).toBe('specimenNo');
    expect(mapping['name']).toBe('species');
    expect(mapping['location']).toBe('collectionLocation');
    expect(mapping['date']).toBe('collectionDate');
    expect(mapping['pinned']).toBe('pinnedStatus');
    expect(mapping['photo']).toBe('photographed');
    expect(mapping['box']).toBe('boxName');
    expect(mapping['remark']).toBe('notes');
    expect(mapping['batch']).toBe('batchId');
  });

  it('should handle unknown headers', () => {
    const headers = ['标本编号', '未知字段', '物种名', '另一未知'];
    const mapping = autoDetectFieldMapping(headers);
    expect(mapping['标本编号']).toBe('specimenNo');
    expect(mapping['未知字段']).toBeNull();
    expect(mapping['物种名']).toBe('species');
    expect(mapping['另一未知']).toBeNull();
  });

  it('should handle headers with whitespace', () => {
    const headers = [' 标本编号 ', ' 物种名 '];
    const mapping = autoDetectFieldMapping(headers);
    expect(mapping[' 标本编号 ']).toBe('specimenNo');
    expect(mapping[' 物种名 ']).toBe('species');
  });

  it('should handle mixed case English headers', () => {
    const headers = ['SpecimenNo', 'Species', 'COLLECTIONLOCATION'];
    const mapping = autoDetectFieldMapping(headers);
    expect(mapping['SpecimenNo']).toBe('specimenNo');
    expect(mapping['Species']).toBe('species');
    expect(mapping['COLLECTIONLOCATION']).toBe('collectionLocation');
  });
});

describe('validateAndPreviewCsv', () => {
  const emptyExisting = {
    existingSpecimens: [] as Specimen[],
    existingBoxes: [] as Box[],
    existingBatches: [] as CollectionBatch[],
  };

  it('should throw error for empty CSV', () => {
    expect(() => validateAndPreviewCsv('', [], [], [])).toThrow('CSV文件为空或格式不正确');
  });

  it('should validate correct Chinese CSV data', () => {
    const csv = `标本编号,物种名,采集地点,采集日期,针插状态,拍照状态,展盒名称,备注,合规状态
SP-001,凤蝶,北京香山,2024-05-01,已针插,已拍照,展盒A,测试备注,无需合规
SP-002,粉蝶,上海植物园,2024-06-15,未针插,未拍照,展盒B,,保护物种`;

    const result = validateAndPreviewCsv(csv, [], [], []);

    expect(result.totalCount).toBe(2);
    expect(result.validCount).toBe(2);
    expect(result.invalidCount).toBe(0);
    expect(result.rows[0].data.specimenNo).toBe('SP-001');
    expect(result.rows[0].data.species).toBe('凤蝶');
    expect(result.rows[0].data.collectionLocation).toBe('北京香山');
    expect(result.rows[0].data.collectionDate).toBe('2024-05-01');
    expect(result.rows[0].data.pinnedStatus).toBe(true);
    expect(result.rows[0].data.photographed).toBe(true);
    expect(result.rows[0].data.boxName).toBe('展盒A');
    expect(result.rows[0].data.notes).toBe('测试备注');
    expect(result.rows[0].data.complianceStatus).toBe('not_relevant');
  });

  it('should validate correct English CSV data', () => {
    const csv = `specimenNo,species,collectionLocation,collectionDate,pinnedStatus,photographed,boxName,notes,complianceStatus
SP-001,Papilio,Beijing,2024-05-01,true,true,BoxA,Test note,not_relevant
SP-002,Pieris,Shanghai,2024-06-15,false,false,BoxB,,protected_species`;

    const result = validateAndPreviewCsv(csv, [], [], []);

    expect(result.totalCount).toBe(2);
    expect(result.validCount).toBe(2);
    expect(result.invalidCount).toBe(0);
    expect(result.rows[0].data.specimenNo).toBe('SP-001');
    expect(result.rows[0].data.pinnedStatus).toBe(true);
    expect(result.rows[0].data.photographed).toBe(true);
  });

  it('should detect duplicate specimen numbers in file', () => {
    const csv = `标本编号,物种名
SP-001,凤蝶
SP-001,粉蝶`;

    const result = validateAndPreviewCsv(csv, [], [], []);

    expect(result.validCount).toBe(0);
    expect(result.invalidCount).toBe(2);
    expect(result.rows[0].errors.some(e => e.type === 'duplicate_no_in_file')).toBe(true);
    expect(result.rows[1].errors.some(e => e.type === 'duplicate_no_in_file')).toBe(true);
  });

  it('should detect duplicate specimen numbers in existing system', () => {
    const csv = `标本编号,物种名
SP-001,凤蝶
SP-002,粉蝶`;

    const existingSpecimens = [
      createMockSpecimen({ specimenNo: 'SP-001' }),
    ];

    const result = validateAndPreviewCsv(csv, existingSpecimens, [], []);

    expect(result.validCount).toBe(1);
    expect(result.invalidCount).toBe(1);
    expect(result.rows[0].errors.some(e => e.type === 'duplicate_no')).toBe(true);
    expect(result.rows[1].isValid).toBe(true);
  });

  it('should detect invalid date format', () => {
    const csv = `标本编号,物种名,采集日期
SP-001,凤蝶,2024-13-01
SP-002,粉蝶,invalid-date
SP-003,蛱蝶,2024-06-31`;

    const result = validateAndPreviewCsv(csv, [], [], []);

    expect(result.validCount).toBe(0);
    expect(result.invalidCount).toBe(3);
    expect(result.rows[0].errors.some(e => e.type === 'invalid_date')).toBe(true);
    expect(result.rows[1].errors.some(e => e.type === 'invalid_date')).toBe(true);
    expect(result.rows[2].errors.some(e => e.type === 'invalid_date')).toBe(true);
  });

  it('should handle empty date as valid', () => {
    const csv = `标本编号,物种名,采集日期
SP-001,凤蝶,
SP-002,粉蝶, `;

    const result = validateAndPreviewCsv(csv, [], [], []);

    expect(result.validCount).toBe(2);
    expect(result.rows[0].data.collectionDate).toBe('');
  });

  it('should normalize valid date formats', () => {
    const csv = `标本编号,物种名,采集日期
SP-001,凤蝶,2024/05/01
SP-002,粉蝶,05/01/2024
SP-003,蛱蝶,2024-05-01T12:00:00Z`;

    const result = validateAndPreviewCsv(csv, [], [], []);

    expect(result.validCount).toBe(3);
    expect(result.rows[0].data.collectionDate).toBe('2024-05-01');
    expect(result.rows[1].data.collectionDate).toBe('2024-05-01');
    expect(result.rows[2].data.collectionDate).toBe('2024-05-01');
  });

  it('should parse boolean values correctly', () => {
    const csv = `标本编号,物种名,针插状态,拍照状态
SP-001,凤蝶,已针插,已拍照
SP-002,粉蝶,未针插,未拍照
SP-003,蛱蝶,是,是
SP-004,眼蝶,否,否
SP-005,灰蝶,true,true
SP-006,弄蝶,false,false
SP-007,蚬蝶,1,1
SP-008,斑蝶,0,0
SP-009,珍蝶,,
SP-010,环蝶,yes,yes
SP-011,绡蝶,no,no`;

    const result = validateAndPreviewCsv(csv, [], [], []);

    expect(result.validCount).toBe(11);
    expect(result.rows[0].data.pinnedStatus).toBe(true);
    expect(result.rows[0].data.photographed).toBe(true);
    expect(result.rows[1].data.pinnedStatus).toBe(false);
    expect(result.rows[1].data.photographed).toBe(false);
    expect(result.rows[2].data.pinnedStatus).toBe(true);
    expect(result.rows[3].data.pinnedStatus).toBe(false);
    expect(result.rows[4].data.pinnedStatus).toBe(true);
    expect(result.rows[5].data.pinnedStatus).toBe(false);
    expect(result.rows[6].data.pinnedStatus).toBe(true);
    expect(result.rows[7].data.pinnedStatus).toBe(false);
    expect(result.rows[8].data.pinnedStatus).toBe(false);
    expect(result.rows[8].data.photographed).toBe(false);
    expect(result.rows[9].data.pinnedStatus).toBe(true);
    expect(result.rows[10].data.pinnedStatus).toBe(false);
  });

  it('should detect invalid boolean values', () => {
    const csv = `标本编号,物种名,针插状态,拍照状态
SP-001,凤蝶,不确定,已拍照
SP-002,粉蝶,已针插,maybe`;

    const result = validateAndPreviewCsv(csv, [], [], []);

    expect(result.validCount).toBe(0);
    expect(result.invalidCount).toBe(2);
    expect(result.rows[0].errors.some(e => e.type === 'invalid_boolean')).toBe(true);
    expect(result.rows[1].errors.some(e => e.type === 'invalid_boolean')).toBe(true);
  });

  it('should validate compliance status values', () => {
    const csv = `标本编号,物种名,合规状态
SP-001,凤蝶,无需合规
SP-002,粉蝶,保护物种
SP-003,蛱蝶,外来物种
SP-004,眼蝶,特许采集
SP-005,灰蝶,许可过期
SP-006,弄蝶,待确认
SP-007,蚬蝶,not_relevant
SP-008,斑蝶,protected_species`;

    const result = validateAndPreviewCsv(csv, [], [], []);

    expect(result.validCount).toBe(8);
    expect(result.rows[0].data.complianceStatus).toBe('not_relevant');
    expect(result.rows[1].data.complianceStatus).toBe('protected_species');
    expect(result.rows[2].data.complianceStatus).toBe('invasive_species');
    expect(result.rows[3].data.complianceStatus).toBe('special_permit');
    expect(result.rows[4].data.complianceStatus).toBe('expired_permit');
    expect(result.rows[5].data.complianceStatus).toBe('unknown');
    expect(result.rows[6].data.complianceStatus).toBe('not_relevant');
    expect(result.rows[7].data.complianceStatus).toBe('protected_species');
  });

  it('should detect invalid compliance status', () => {
    const csv = `标本编号,物种名,合规状态
SP-001,凤蝶,未知状态
SP-002,粉蝶,validated`;

    const result = validateAndPreviewCsv(csv, [], [], []);

    expect(result.validCount).toBe(0);
    expect(result.invalidCount).toBe(2);
    expect(result.rows[0].errors.some(e => e.type === 'invalid_compliance_status')).toBe(true);
    expect(result.rows[1].errors.some(e => e.type === 'invalid_compliance_status')).toBe(true);
  });

  it('should handle empty compliance status as valid', () => {
    const csv = `标本编号,物种名,合规状态
SP-001,凤蝶,
SP-002,粉蝶, `;

    const result = validateAndPreviewCsv(csv, [], [], []);

    expect(result.validCount).toBe(2);
    expect(result.rows[0].data.complianceStatus).toBeUndefined();
  });

  it('should detect missing required fields', () => {
    const csv = `标本编号,物种名
SP-001,
,凤蝶
,
SP-003,`;

    const result = validateAndPreviewCsv(csv, [], [], []);

    expect(result.validCount).toBe(0);
    expect(result.invalidCount).toBe(3);
    expect(result.rows[0].errors.some(e => e.type === 'missing_required' && e.field === '物种名')).toBe(true);
    expect(result.rows[1].errors.some(e => e.type === 'missing_required' && e.field === '标本编号')).toBe(true);
    expect(result.rows[2].errors.some(e => e.type === 'missing_required' && e.field === '物种名')).toBe(true);
  });

  it('should warn about non-existent boxes to be auto-created', () => {
    const csv = `标本编号,物种名,展盒名称
SP-001,凤蝶,新展盒
SP-002,粉蝶,ExistingBox
SP-003,蛱蝶,`;

    const existingBoxes = [createMockBox({ name: 'ExistingBox' })];

    const result = validateAndPreviewCsv(csv, [], existingBoxes, []);

    expect(result.validCount).toBe(3);
    expect(result.rows[0].warnings.some(e => e.type === 'box_not_found')).toBe(true);
    expect(result.rows[1].warnings).toEqual([]);
    expect(result.rows[2].warnings).toEqual([]);
    expect(result.relatedObjects.newBoxes).toHaveLength(1);
    expect(result.relatedObjects.newBoxes[0].name).toBe('新展盒');
  });

  it('should warn about non-existent batches to be auto-created', () => {
    const csv = `标本编号,物种名,批次
SP-001,凤蝶,NewBatch
SP-002,粉蝶,ExistingBatch
SP-003,蛱蝶,`;

    const existingBatches = [createMockBatch({ id: 'batch-1', name: 'ExistingBatch' })];

    const result = validateAndPreviewCsv(csv, [], [], existingBatches);

    expect(result.validCount).toBe(3);
    expect(result.rows[0].warnings.some(e => e.type === 'batch_not_found')).toBe(true);
    expect(result.rows[1].warnings).toEqual([]);
    expect(result.rows[2].warnings).toEqual([]);
    expect(result.relatedObjects.newBatches).toHaveLength(1);
    expect(result.relatedObjects.newBatches[0].name).toBe('NewBatch');
  });

  it('should recognize batch by ID', () => {
    const csv = `标本编号,物种名,批次
SP-001,凤蝶,batch-1
SP-002,粉蝶,UnknownBatch`;

    const existingBatches = [createMockBatch({ id: 'batch-1', name: 'ExistingBatch' })];

    const result = validateAndPreviewCsv(csv, [], [], existingBatches);

    expect(result.validCount).toBe(2);
    expect(result.rows[0].warnings).toEqual([]);
    expect(result.rows[1].warnings.some(e => e.type === 'batch_not_found')).toBe(true);
  });

  it('should validate permit expiry date', () => {
    const csv = `标本编号,物种名,到期日期
SP-001,凤蝶,2024-12-31
SP-002,粉蝶,invalid-date
SP-003,蛱蝶,`;

    const result = validateAndPreviewCsv(csv, [], [], []);

    expect(result.validCount).toBe(2);
    expect(result.invalidCount).toBe(1);
    expect(result.rows[0].data.permitExpiryDate).toBe('2024-12-31');
    expect(result.rows[1].errors.some(e => e.type === 'invalid_date')).toBe(true);
    expect(result.rows[2].data.permitExpiryDate).toBe('');
  });

  it('should track row indices correctly', () => {
    const csv = `标本编号,物种名
SP-001,凤蝶
SP-002,粉蝶
SP-003,蛱蝶`;

    const result = validateAndPreviewCsv(csv, [], [], []);

    expect(result.rows[0].rowIndex).toBe(2);
    expect(result.rows[1].rowIndex).toBe(3);
    expect(result.rows[2].rowIndex).toBe(4);
  });

  it('should handle mixed valid and invalid rows', () => {
    const csv = `标本编号,物种名,采集日期,针插状态
SP-001,凤蝶,2024-05-01,已针插
SP-002,粉蝶,bad-date,已针插
SP-003,,2024-05-01,已针插
SP-004,蛱蝶,2024-05-01,不确定
SP-005,眼蝶,2024-05-01,未针插`;

    const result = validateAndPreviewCsv(csv, [], [], []);

    expect(result.totalCount).toBe(5);
    expect(result.validCount).toBe(2);
    expect(result.invalidCount).toBe(3);
    expect(result.rows[0].isValid).toBe(true);
    expect(result.rows[1].isValid).toBe(false);
    expect(result.rows[2].isValid).toBe(false);
    expect(result.rows[3].isValid).toBe(false);
    expect(result.rows[4].isValid).toBe(true);
  });
});

describe('convertToSpecimenFormData', () => {
  const createPreviewRow = (data: Partial<ImportPreviewRow['data']>, isValid = true): ImportPreviewRow => ({
    rowIndex: 2,
    data,
    errors: [],
    warnings: [],
    isValid,
  });

  const existingBoxes = [
    createMockBox({ id: 'box-1', name: '展盒A' }),
    createMockBox({ id: 'box-2', name: '展盒B' }),
  ];

  const existingBatches = [
    createMockBatch({ id: 'batch-1', name: '2024春季采集' }),
    createMockBatch({ id: 'batch-2', name: '2024夏季采集' }),
  ];

  it('should return null for invalid row', () => {
    const row = createPreviewRow({ specimenNo: 'SP-001', species: '凤蝶' }, false);
    const result = convertToSpecimenFormData(row, [], []);
    expect(result).toBeNull();
  });

  it('should return null when specimenNo is missing', () => {
    const row = createPreviewRow({ species: '凤蝶' });
    const result = convertToSpecimenFormData(row, [], []);
    expect(result).toBeNull();
  });

  it('should return null when species is missing', () => {
    const row = createPreviewRow({ specimenNo: 'SP-001' });
    const result = convertToSpecimenFormData(row, [], []);
    expect(result).toBeNull();
  });

  it('should convert valid row with all fields', () => {
    const row = createPreviewRow({
      specimenNo: 'SP-001',
      species: '凤蝶',
      collectionLocation: '北京香山',
      collectionDate: '2024-05-01',
      pinnedStatus: true,
      photographed: true,
      notes: '测试备注',
      complianceStatus: 'protected_species',
      permitNumber: 'PERMIT-001',
      permitExpiryDate: '2025-12-31',
      complianceNotes: '国家二级保护动物',
    });

    const result = convertToSpecimenFormData(row, existingBoxes, existingBatches);

    expect(result).not.toBeNull();
    expect(result?.specimenNo).toBe('SP-001');
    expect(result?.species).toBe('凤蝶');
    expect(result?.collectionLocation).toBe('北京香山');
    expect(result?.collectionDate).toBe('2024-05-01');
    expect(result?.pinnedStatus).toBe(true);
    expect(result?.photographed).toBe(true);
    expect(result?.notes).toBe('测试备注');
    expect(result?.complianceStatus).toBe('protected_species');
    expect(result?.permitNumber).toBe('PERMIT-001');
    expect(result?.permitExpiryDate).toBe('2025-12-31');
    expect(result?.complianceNotes).toBe('国家二级保护动物');
    expect(result?.boxId).toBe('');
    expect(result?.batchId).toBe('');
  });

  it('should map existing box by name', () => {
    const row = createPreviewRow({
      specimenNo: 'SP-001',
      species: '凤蝶',
      boxName: '展盒A',
    });

    const result = convertToSpecimenFormData(row, existingBoxes, existingBatches);

    expect(result?.boxId).toBe('box-1');
  });

  it('should map existing box by name case insensitive', () => {
    const row = createPreviewRow({
      specimenNo: 'SP-001',
      species: '凤蝶',
      boxName: '展盒a',
    });

    const result = convertToSpecimenFormData(row, existingBoxes, existingBatches);

    expect(result?.boxId).toBe('box-1');
  });

  it('should use newBoxIdMap for auto-created boxes', () => {
    const row = createPreviewRow({
      specimenNo: 'SP-001',
      species: '凤蝶',
      boxName: '新展盒',
    });

    const newBoxIdMap = { '新展盒': 'new-box-id' };

    const result = convertToSpecimenFormData(row, existingBoxes, existingBatches, newBoxIdMap);

    expect(result?.boxId).toBe('new-box-id');
  });

  it('should map existing batch by ID', () => {
    const row = createPreviewRow({
      specimenNo: 'SP-001',
      species: '凤蝶',
      batchId: 'batch-1',
    });

    const result = convertToSpecimenFormData(row, existingBoxes, existingBatches);

    expect(result?.batchId).toBe('batch-1');
  });

  it('should map existing batch by name', () => {
    const row = createPreviewRow({
      specimenNo: 'SP-001',
      species: '凤蝶',
      batchId: '2024春季采集',
    });

    const result = convertToSpecimenFormData(row, existingBoxes, existingBatches);

    expect(result?.batchId).toBe('batch-1');
  });

  it('should use newBatchIdMap for auto-created batches', () => {
    const row = createPreviewRow({
      specimenNo: 'SP-001',
      species: '凤蝶',
      batchId: '新批次',
    });

    const newBatchIdMap = { '新批次': 'new-batch-id' };

    const result = convertToSpecimenFormData(row, existingBoxes, existingBatches, {}, newBatchIdMap);

    expect(result?.batchId).toBe('new-batch-id');
  });

  it('should use default compliance status when not provided', () => {
    const row = createPreviewRow({
      specimenNo: 'SP-001',
      species: '凤蝶',
    });

    const result = convertToSpecimenFormData(row, [], []);

    expect(result?.complianceStatus).toBe('not_relevant');
  });

  it('should default boolean fields to false when not provided', () => {
    const row = createPreviewRow({
      specimenNo: 'SP-001',
      species: '凤蝶',
    });

    const result = convertToSpecimenFormData(row, [], []);

    expect(result?.pinnedStatus).toBe(false);
    expect(result?.photographed).toBe(false);
  });

  it('should handle empty optional fields', () => {
    const row = createPreviewRow({
      specimenNo: 'SP-001',
      species: '凤蝶',
      collectionLocation: '',
      collectionDate: '',
      notes: '',
      permitNumber: '',
      permitExpiryDate: '',
      complianceNotes: '',
    });

    const result = convertToSpecimenFormData(row, [], []);

    expect(result?.collectionLocation).toBe('');
    expect(result?.collectionDate).toBe('');
    expect(result?.notes).toBe('');
    expect(result?.permitNumber).toBe('');
    expect(result?.permitExpiryDate).toBe('');
    expect(result?.complianceNotes).toBe('');
  });
});
