export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

export const getTodayString = (): string => {
  return new Date().toISOString().split('T')[0];
};

export const escapeCsvField = (field: string | number | boolean): string => {
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export interface ExportSpecimenData {
  specimenNo: string;
  species: string;
  collectionLocation: string;
  collectionDate: string;
  pinnedStatus: boolean;
  photographed: boolean;
  boxName: string;
  notes: string;
}

export const generateSpecimenCsv = (specimens: ExportSpecimenData[]): string => {
  const headers = [
    '标本编号',
    '物种名',
    '采集地点',
    '采集日期',
    '针插状态',
    '拍照状态',
    '展盒名称',
    '备注',
  ];

  const rows = specimens.map((s) => [
    s.specimenNo,
    s.species,
    s.collectionLocation,
    s.collectionDate,
    s.pinnedStatus ? '已针插' : '未针插',
    s.photographed ? '已拍照' : '未拍照',
    s.boxName,
    s.notes,
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => escapeCsvField(cell)).join(','))
    .join('\n');

  return '\uFEFF' + csvContent;
};

export const downloadCsv = (csvContent: string, filename: string): void => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
