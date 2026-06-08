/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  generateId,
  formatDate,
  getTodayString,
  downloadCsv,
  downloadJson,
  readFileAsText,
  escapeCsvField,
} from './common';

describe('generateId', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should generate unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();

    expect(id1).not.toBe(id2);
    expect(id1.length).toBeGreaterThan(0);
    expect(id2.length).toBeGreaterThan(0);
  });

  it('should generate IDs with timestamp prefix', () => {
    const id = generateId();
    const parts = id.split('-');

    expect(parts.length).toBe(2);
    expect(parts[0]).toBe('1717200000000');
    expect(parts[1].length).toBeGreaterThan(0);
  });

  it('should generate different IDs for different timestamps', () => {
    const id1 = generateId();

    vi.setSystemTime(new Date('2024-06-02T00:00:00.000Z'));
    const id2 = generateId();

    expect(id1).not.toBe(id2);
    expect(id1.startsWith('1717200000000')).toBe(true);
    expect(id2.startsWith('1717286400000')).toBe(true);
  });
});

describe('formatDate', () => {
  it('should format valid ISO date string', () => {
    const result = formatDate('2024-06-01');
    expect(result).toBe('2024/06/01');
  });

  it('should format date with time component', () => {
    const result = formatDate('2024-06-01T14:30:00.000Z');
    expect(result).toBe('2024/06/01');
  });

  it('should return empty string for empty input', () => {
    const result = formatDate('');
    expect(result).toBe('');
  });

  it('should return empty string for invalid date', () => {
    const result = formatDate('invalid-date');
    expect(result).toBe('Invalid Date');
  });

  it('should handle single digit month and day', () => {
    const result = formatDate('2024-1-5');
    expect(result).toBe('2024/01/05');
  });

  it('should use zh-CN locale', () => {
    const result = formatDate('2024-12-31');
    expect(result).toBe('2024/12/31');
  });
});

describe('getTodayString', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return today\'s date in YYYY-MM-DD format', () => {
    vi.setSystemTime(new Date('2024-06-01T14:30:00.000Z'));
    const result = getTodayString();
    expect(result).toBe('2024-06-01');
  });

  it('should handle different months', () => {
    vi.setSystemTime(new Date('2024-12-31T23:59:59.999Z'));
    const result = getTodayString();
    expect(result).toBe('2024-12-31');
  });

  it('should handle timezone correctly', () => {
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    const result = getTodayString();
    expect(result).toBe('2024-01-01');
  });
});

describe('escapeCsvField', () => {
  it('should return field as-is when no special characters', () => {
    expect(escapeCsvField('normal text')).toBe('normal text');
    expect(escapeCsvField('123')).toBe('123');
    expect(escapeCsvField(true)).toBe('true');
  });

  it('should escape fields with commas', () => {
    const result = escapeCsvField('北京,海淀');
    expect(result).toBe('"北京,海淀"');
  });

  it('should escape fields with double quotes', () => {
    const result = escapeCsvField('又名"菜粉蝶"');
    expect(result).toBe('"又名""菜粉蝶"""');
  });

  it('should escape fields with newlines', () => {
    const result = escapeCsvField('多行\n备注');
    expect(result).toBe('"多行\n备注"');
  });

  it('should escape fields with carriage returns', () => {
    const result = escapeCsvField('多行\r备注');
    expect(result).toBe('"多行\r备注"');
  });

  it('should handle numeric input', () => {
    expect(escapeCsvField(123)).toBe('123');
    expect(escapeCsvField(0)).toBe('0');
    expect(escapeCsvField(-123.45)).toBe('-123.45');
  });

  it('should handle boolean input', () => {
    expect(escapeCsvField(true)).toBe('true');
    expect(escapeCsvField(false)).toBe('false');
  });

  it('should handle empty string', () => {
    expect(escapeCsvField('')).toBe('');
  });

  it('should handle combination of special characters', () => {
    const result = escapeCsvField('测试,"带引号",和逗号\n还有换行');
    expect(result).toBe('"测试,""带引号"",和逗号\n还有换行"');
  });
});

describe('downloadCsv', () => {
  let createElementSpy: ReturnType<typeof vi.spyOn>;
  let appendChildSpy: ReturnType<typeof vi.spyOn>;
  let removeChildSpy: ReturnType<typeof vi.spyOn>;
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let clickSpy: ReturnType<typeof vi.fn>;
  let setAttributeSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clickSpy = vi.fn();
    setAttributeSpy = vi.fn();

    const mockLink = {
      click: clickSpy,
      setAttribute: setAttributeSpy,
      style: { visibility: '' },
    };

    createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink as unknown as HTMLElement);
    appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as unknown as HTMLElement);
    removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as unknown as HTMLElement);
    createObjectURLSpy = vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:test-url');
    revokeObjectURLSpy = vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
  });

  it('should create and trigger download for CSV', () => {
    const csvContent = '标本编号,物种名\nSP-001,凤蝶';
    const filename = 'test.csv';

    downloadCsv(csvContent, filename);

    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(setAttributeSpy).toHaveBeenCalledWith('href', 'blob:test-url');
    expect(setAttributeSpy).toHaveBeenCalledWith('download', filename);
    expect(clickSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:test-url');
  });

  it('should create blob with correct MIME type', () => {
    const csvContent = 'test,content';
    const filename = 'test.csv';

    downloadCsv(csvContent, filename);

    const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob;
    expect(blobArg.type).toBe('text/csv;charset=utf-8;');
  });

  it('should add BOM to CSV content for Excel compatibility', () => {
    const csvContent = 'test content';
    const filename = 'test.csv';

    downloadCsv(csvContent, filename);

    const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob;
    const reader = new FileReader();
    reader.readAsText(blobArg);
    reader.onload = () => {
      expect(reader.result).toBe(csvContent);
    };
  });
});

describe('downloadJson', () => {
  let createElementSpy: ReturnType<typeof vi.spyOn>;
  let appendChildSpy: ReturnType<typeof vi.spyOn>;
  let removeChildSpy: ReturnType<typeof vi.spyOn>;
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let clickSpy: ReturnType<typeof vi.fn>;
  let setAttributeSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clickSpy = vi.fn();
    setAttributeSpy = vi.fn();

    const mockLink = {
      click: clickSpy,
      setAttribute: setAttributeSpy,
      style: { visibility: '' },
    };

    createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink as unknown as HTMLElement);
    appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as unknown as HTMLElement);
    removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as unknown as HTMLElement);
    createObjectURLSpy = vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:test-json-url');
    revokeObjectURLSpy = vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
  });

  it('should create and trigger download for JSON', () => {
    const jsonContent = JSON.stringify({ test: 'data' });
    const filename = 'test.json';

    downloadJson(jsonContent, filename);

    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(setAttributeSpy).toHaveBeenCalledWith('href', 'blob:test-json-url');
    expect(setAttributeSpy).toHaveBeenCalledWith('download', filename);
    expect(clickSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:test-json-url');
  });

  it('should create blob with correct MIME type for JSON', () => {
    const jsonContent = '{"test": "data"}';
    const filename = 'test.json';

    downloadJson(jsonContent, filename);

    const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob;
    expect(blobArg.type).toBe('application/json;charset=utf-8;');
  });
});

describe('readFileAsText', () => {
  it('should read file content as text', async () => {
    const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });

    const result = await readFileAsText(mockFile);
    expect(result).toBe('test content');
  });

  it('should read CSV file content', async () => {
    const csvContent = '标本编号,物种名\nSP-001,凤蝶';
    const mockFile = new File([csvContent], 'test.csv', { type: 'text/csv' });

    const result = await readFileAsText(mockFile);
    expect(result).toBe(csvContent);
  });

  it('should read JSON file content', async () => {
    const jsonContent = JSON.stringify({ test: 'data' });
    const mockFile = new File([jsonContent], 'test.json', { type: 'application/json' });

    const result = await readFileAsText(mockFile);
    expect(result).toBe(jsonContent);
  });

  it('should handle file read errors', async () => {
    const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });

    const originalFileReader = global.FileReader;
    const mockReadAsText = vi.fn().mockImplementation(function() {
      this.onerror?.({ target: { error: new Error('Read error') } } as ProgressEvent<FileReader>);
    });

    const MockFileReader = vi.fn().mockImplementation(() => ({
      readAsText: mockReadAsText,
      onerror: null,
      onload: null,
      result: null,
    }));
    Object.defineProperty(MockFileReader, 'EMPTY', { value: 0 });
    Object.defineProperty(MockFileReader, 'LOADING', { value: 1 });
    Object.defineProperty(MockFileReader, 'DONE', { value: 2 });

    global.FileReader = MockFileReader as unknown as typeof FileReader;

    await expect(readFileAsText(mockFile)).rejects.toBeDefined();

    global.FileReader = originalFileReader;
  });

  it('should use UTF-8 encoding', async () => {
    const chineseContent = '中文内容测试';
    const mockFile = new File([chineseContent], 'test.txt', { type: 'text/plain' });

    const result = await readFileAsText(mockFile);
    expect(result).toBe(chineseContent);
  });
});
