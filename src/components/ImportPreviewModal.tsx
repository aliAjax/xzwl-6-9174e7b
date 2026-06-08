import { useState, useCallback } from 'react';
import { X, Upload, Check, AlertTriangle, FileSpreadsheet, CheckCircle, XCircle, ArrowUpFromLine, Package, Layers, Plus, Info, Edit3, Save, RotateCcw, ChevronDown } from 'lucide-react';
import type { Box, Specimen, CollectionBatch, ImportPreviewData, SpecimenFormData, BoxFormData, CollectionBatchFormData, CsvFieldMapping, CsvRowData } from '../types';
import { readFileAsText } from '../utils/common';
import { validateAndPreviewCsv, convertToSpecimenFormData, createBoxFormData, createBatchFormData, revalidatePreviewData } from '../utils/csv';

interface ImportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  specimens: Specimen[];
  boxes: Box[];
  batches: CollectionBatch[];
  onImport: (data: SpecimenFormData[]) => void;
  onCreateBox: (data: BoxFormData) => Box;
  onCreateBatch: (data: CollectionBatchFormData) => CollectionBatch;
}

type Step = 'upload' | 'preview' | 'confirm-objects';

const ALL_TARGET_FIELDS: { key: keyof CsvRowData | 'boxName' | null; label: string; required?: boolean }[] = [
  { key: null, label: '— 忽略此列 —' },
  { key: 'specimenNo', label: '标本编号', required: true },
  { key: 'species', label: '物种名', required: true },
  { key: 'collectionLocation', label: '采集地点' },
  { key: 'collectionDate', label: '采集日期' },
  { key: 'pinnedStatus', label: '针插状态' },
  { key: 'photographed', label: '拍照状态' },
  { key: 'boxName', label: '展盒名称' },
  { key: 'batchId', label: '采集批次' },
  { key: 'complianceStatus', label: '合规状态' },
  { key: 'permitNumber', label: '许可证编号' },
  { key: 'permitExpiryDate', label: '到期日期' },
  { key: 'complianceNotes', label: '合规备注' },
  { key: 'notes', label: '备注' },
];

const DISPLAY_COLUMNS = ALL_TARGET_FIELDS.filter(f => f.key !== null).map(f => ({
  key: f.key as string,
  label: f.label,
  required: f.required || false,
}));

interface EditingCell {
  rowIndex: number;
  fieldKey: string;
  value: string;
}

export function ImportPreviewModal({ isOpen, onClose, specimens, boxes, batches, onImport, onCreateBox, onCreateBatch }: ImportPreviewModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [previewData, setPreviewData] = useState<ImportPreviewData | null>(null);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [showOnlyInvalid, setShowOnlyInvalid] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedBoxesToCreate, setSelectedBoxesToCreate] = useState<Set<string>>(new Set());
  const [selectedBatchesToCreate, setSelectedBatchesToCreate] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [showFieldMapping, setShowFieldMapping] = useState(true);

  const resetState = useCallback(() => {
    setStep('upload');
    setPreviewData(null);
    setError('');
    setFileName('');
    setShowOnlyInvalid(false);
    setIsImporting(false);
    setSelectedBoxesToCreate(new Set());
    setSelectedBatchesToCreate(new Set());
    setEditingCell(null);
    setShowFieldMapping(true);
  }, []);

  const handleClose = () => {
    resetState();
    onClose();
  };

  const processFile = useCallback(async (file: File) => {
    setError('');

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('请上传CSV格式的文件');
      return;
    }

    try {
      const content = await readFileAsText(file);
      const preview = validateAndPreviewCsv(content, specimens, boxes, batches);
      setPreviewData(preview);
      setFileName(file.name);

      const newBoxes = preview.relatedObjects.newBoxes;
      const newBatches = preview.relatedObjects.newBatches;

      if (newBoxes.length > 0 || newBatches.length > 0) {
        setSelectedBoxesToCreate(new Set(newBoxes.map(b => b.name.toLowerCase())));
        setSelectedBatchesToCreate(new Set(newBatches.map(b => b.name.toLowerCase())));
        setStep('confirm-objects');
      } else {
        setStep('preview');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '文件解析失败，请检查CSV格式');
    }
  }, [specimens, boxes, batches]);

  const triggerRevalidation = useCallback((fieldMapping: CsvFieldMapping, rawRows: string[][]) => {
    const newPreview = revalidatePreviewData(
      previewData!.headers,
      fieldMapping,
      rawRows,
      specimens,
      boxes,
      batches
    );
    setPreviewData(newPreview);
    return newPreview;
  }, [previewData, specimens, boxes, batches]);

  const handleFieldMappingChange = (header: string, newTargetField: keyof CsvRowData | 'boxName' | null) => {
    if (!previewData) return;

    const newMapping = { ...previewData.fieldMapping };
    newMapping[header] = newTargetField;

    const newPreview = triggerRevalidation(newMapping, previewData.rawRows);

    const newBoxes = newPreview.relatedObjects.newBoxes;
    const newBatches = newPreview.relatedObjects.newBatches;

    if (newBoxes.length > 0) {
      setSelectedBoxesToCreate(prev => {
        const next = new Set(prev);
        newBoxes.forEach(b => next.add(b.name.toLowerCase()));
        return next;
      });
    }
    if (newBatches.length > 0) {
      setSelectedBatchesToCreate(prev => {
        const next = new Set(prev);
        newBatches.forEach(b => next.add(b.name.toLowerCase()));
        return next;
      });
    }
  };

  const handleCellEditStart = (rowIndex: number, fieldKey: string, currentValue: string) => {
    setEditingCell({
      rowIndex,
      fieldKey,
      value: currentValue,
    });
  };

  const handleCellEditSave = () => {
    if (!editingCell || !previewData) return;

    const { rowIndex, fieldKey, value } = editingCell;
    const dataRowIdx = rowIndex - 2;

    if (dataRowIdx < 0 || dataRowIdx >= previewData.rawRows.length) {
      setEditingCell(null);
      return;
    }

    const headerIdx = getLastHeaderIndexForField(fieldKey);

    if (headerIdx === -1) {
      setEditingCell(null);
      return;
    }

    const newRawRows = previewData.rawRows.map((row, idx) => {
      if (idx === dataRowIdx) {
        const newRow = [...row];
        newRow[headerIdx] = value;
        return newRow;
      }
      return row;
    });

    triggerRevalidation(previewData.fieldMapping, newRawRows);
    setEditingCell(null);
  };

  const getDuplicateMappings = (): Record<string, string[]> => {
    if (!previewData) return {};
    const fieldToHeaders: Record<string, string[]> = {};
    previewData.headers.forEach(h => {
      const field = previewData.fieldMapping[h];
      if (field !== null) {
        if (!fieldToHeaders[field]) {
          fieldToHeaders[field] = [];
        }
        fieldToHeaders[field].push(h);
      }
    });
    const duplicates: Record<string, string[]> = {};
    Object.entries(fieldToHeaders).forEach(([field, headers]) => {
      if (headers.length > 1) {
        duplicates[field] = headers;
      }
    });
    return duplicates;
  };

  const isFieldAlreadyMapped = (field: keyof CsvRowData | 'boxName' | null, currentHeader: string): boolean => {
    if (!previewData || field === null) return false;
    return previewData.headers.some(h =>
      h !== currentHeader && previewData.fieldMapping[h] === field
    );
  };

  const handleCellEditCancel = () => {
    setEditingCell(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      await processFile(file);
    }
  };

  const handleBackToUpload = () => {
    setStep('upload');
    setPreviewData(null);
  };

  const handleConfirmObjects = () => {
    setStep('preview');
  };

  const handleBackToConfirmObjects = () => {
    if (previewData && (previewData.relatedObjects.newBoxes.length > 0 || previewData.relatedObjects.newBatches.length > 0)) {
      setStep('confirm-objects');
    } else {
      setStep('upload');
      setPreviewData(null);
    }
  };

  const toggleBoxSelection = (boxName: string) => {
    setSelectedBoxesToCreate(prev => {
      const next = new Set(prev);
      const lowerName = boxName.toLowerCase();
      if (next.has(lowerName)) {
        next.delete(lowerName);
      } else {
        next.add(lowerName);
      }
      return next;
    });
  };

  const toggleBatchSelection = (batchName: string) => {
    setSelectedBatchesToCreate(prev => {
      const next = new Set(prev);
      const lowerName = batchName.toLowerCase();
      if (next.has(lowerName)) {
        next.delete(lowerName);
      } else {
        next.add(lowerName);
      }
      return next;
    });
  };

  const handleImport = async () => {
    if (!previewData) return;

    setIsImporting(true);

    try {
      const newBoxIdMap: Record<string, string> = {};
      const newBatchIdMap: Record<string, string> = {};

      const { newBoxes, newBatches } = previewData.relatedObjects;

      for (const boxInfo of newBoxes) {
        if (selectedBoxesToCreate.has(boxInfo.name.toLowerCase())) {
          const boxData = createBoxFormData(boxInfo.name);
          const newBox = onCreateBox(boxData);
          newBoxIdMap[boxInfo.name.toLowerCase()] = newBox.id;
        }
      }

      for (const batchInfo of newBatches) {
        if (selectedBatchesToCreate.has(batchInfo.name.toLowerCase())) {
          const batchData = createBatchFormData(batchInfo.name);
          const newBatch = onCreateBatch(batchData);
          newBatchIdMap[batchInfo.name.toLowerCase()] = newBatch.id;
        }
      }

      const validRows = previewData.rows.filter(r => r.isValid);
      const formDataList: SpecimenFormData[] = [];

      const updatedBoxes = [...boxes];
      const updatedBatches = [...batches];

      for (const [lowerName, id] of Object.entries(newBoxIdMap)) {
        const boxInfo = newBoxes.find(b => b.name.toLowerCase() === lowerName);
        if (boxInfo) {
          updatedBoxes.push({ id, name: boxInfo.name, location: '', notes: 'CSV导入时自动创建', createdAt: new Date().toISOString() });
        }
      }

      for (const [lowerName, id] of Object.entries(newBatchIdMap)) {
        const batchInfo = newBatches.find(b => b.name.toLowerCase() === lowerName);
        if (batchInfo) {
          updatedBatches.push({ id, name: batchInfo.name, collectionDate: '', location: '', participants: '', notes: 'CSV导入时自动创建', createdAt: new Date().toISOString() });
        }
      }

      for (const row of validRows) {
        const hasUnselectedBox = row.data.boxName &&
          !previewData.relatedObjects.existingBoxNames.has(row.data.boxName.toLowerCase()) &&
          !selectedBoxesToCreate.has(row.data.boxName.toLowerCase());

        const hasUnselectedBatch = row.data.batchId &&
          !previewData.relatedObjects.existingBatchIds.has(row.data.batchId) &&
          !previewData.relatedObjects.existingBatchNames.has(row.data.batchId.toLowerCase()) &&
          !selectedBatchesToCreate.has(row.data.batchId.toLowerCase());

        if (hasUnselectedBox || hasUnselectedBatch) {
          continue;
        }

        const formData = convertToSpecimenFormData(row, updatedBoxes, updatedBatches, newBoxIdMap, newBatchIdMap);
        if (formData) {
          formDataList.push(formData);
        }
      }

      if (formDataList.length > 0) {
        onImport(formDataList);
      }

      handleClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '导入失败');
    } finally {
      setIsImporting(false);
    }
  };

  const getFieldDisplayValue = (row: ImportPreviewData['rows'][0], key: string): string => {
    const value = row.data[key as keyof typeof row.data];
    if (key === 'pinnedStatus') {
      return value ? '已针插' : '未针插';
    }
    if (key === 'photographed') {
      return value ? '已拍照' : '未拍照';
    }
    return value?.toString() || '';
  };

  const getLastHeaderIndexForField = (fieldKey: string): number => {
    if (!previewData) return -1;
    let lastIdx = -1;
    previewData.headers.forEach((h, idx) => {
      if (previewData.fieldMapping[h] === fieldKey) {
        lastIdx = idx;
      }
    });
    return lastIdx;
  };

  const getFieldRawValue = (row: ImportPreviewData['rows'][0], key: string): string => {
    if (!previewData) return '';
    const dataRowIdx = row.rowIndex - 2;
    if (dataRowIdx < 0 || dataRowIdx >= previewData.rawRows.length) return '';

    const headerIdx = getLastHeaderIndexForField(key);
    if (headerIdx === -1) return '';

    return previewData.rawRows[dataRowIdx][headerIdx] || '';
  };

  const hasErrorInField = (row: ImportPreviewData['rows'][0], key: string): boolean => {
    const columnLabel = DISPLAY_COLUMNS.find(c => c.key === key)?.label;
    return row.errors.some(e => e.field === columnLabel);
  };

  const getFieldErrors = (row: ImportPreviewData['rows'][0], key: string): string[] => {
    const columnLabel = DISPLAY_COLUMNS.find(c => c.key === key)?.label;
    return row.errors.filter(e => e.field === columnLabel).map(e => e.message);
  };

  const getErrorIcon = (type: string) => {
    switch (type) {
      case 'missing_required':
      case 'duplicate_no':
      case 'duplicate_no_in_file':
      case 'invalid_date':
      case 'invalid_boolean':
      case 'invalid_compliance_status':
        return <XCircle className="w-4 h-4 text-rust-600" />;
      case 'box_not_found':
      case 'batch_not_found':
        return <Info className="w-4 h-4 text-blue-600" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
    }
  };

  const getEffectiveValidCount = useCallback(() => {
    if (!previewData) return 0;

    return previewData.rows.filter(row => {
      if (!row.isValid) return false;

      const hasUnselectedBox = row.data.boxName &&
        !previewData.relatedObjects.existingBoxNames.has(row.data.boxName.toLowerCase()) &&
        !selectedBoxesToCreate.has(row.data.boxName.toLowerCase());

      const hasUnselectedBatch = row.data.batchId &&
        !previewData.relatedObjects.existingBatchIds.has(row.data.batchId) &&
        !previewData.relatedObjects.existingBatchNames.has(row.data.batchId.toLowerCase()) &&
        !selectedBatchesToCreate.has(row.data.batchId.toLowerCase());

      return !hasUnselectedBox && !hasUnselectedBatch;
    }).length;
  }, [previewData, selectedBoxesToCreate, selectedBatchesToCreate]);

  const displayedRows = previewData
    ? (showOnlyInvalid ? previewData.rows.filter(r => !r.isValid) : previewData.rows)
    : [];

  const getMappedFieldLabel = (header: string): string => {
    if (!previewData) return '未识别';
    const mappedField = previewData.fieldMapping[header];
    if (mappedField === null) return '— 忽略 —';
    const fieldInfo = ALL_TARGET_FIELDS.find(f => f.key === mappedField);
    return fieldInfo?.label || mappedField;
  };

  const renderFieldMappingDropdown = (header: string) => {
    if (!previewData) return null;
    const currentMapping = previewData.fieldMapping[header];
    const duplicates = getDuplicateMappings();
    const isCurrentDuplicate = currentMapping !== null && duplicates[currentMapping]?.includes(header);
    const duplicateHeaders = currentMapping !== null ? duplicates[currentMapping] : [];
    const isLastOccurrence = currentMapping !== null &&
      duplicateHeaders.length > 0 &&
      duplicateHeaders[duplicateHeaders.length - 1] === header;

    return (
      <div className="relative">
        <select
          value={currentMapping === null ? '' : currentMapping}
          onChange={(e) => {
            const value = e.target.value;
            const newField = value === '' ? null : value as keyof CsvRowData | 'boxName';

            if (newField !== null && isFieldAlreadyMapped(newField, header)) {
              const confirmed = window.confirm(
                `字段 "${ALL_TARGET_FIELDS.find(f => f.key === newField)?.label || newField}" ` +
                `已被映射到其他列。\n\n如果继续，该字段将有多个数据源，` +
                `实际导入时将使用最后一列的值。\n\n是否确认继续？`
              );
              if (!confirmed) {
                e.target.value = currentMapping === null ? '' : currentMapping;
                return;
              }
            }

            handleFieldMappingChange(header, newField);
          }}
          className={`w-full px-2 py-1.5 text-xs border rounded-md bg-parchment-50 text-oak-800 focus:outline-none focus:ring-2 focus:ring-rust-500 focus:border-transparent appearance-none pr-8 ${
            isCurrentDuplicate ? 'border-amber-400 bg-amber-50' : 'border-oak-300'
          }`}
        >
          {ALL_TARGET_FIELDS.map(field => {
            const isMappedElsewhere = field.key !== null &&
              field.key !== currentMapping &&
              isFieldAlreadyMapped(field.key, header);
            return (
              <option
                key={field.key === null ? 'null' : field.key}
                value={field.key === null ? '' : field.key}
                disabled={isMappedElsewhere}
              >
                {field.label}
                {field.required && ' *'}
                {isMappedElsewhere && ' (已映射)'}
              </option>
            );
          })}
        </select>
        <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-oak-500 pointer-events-none" />
        {isCurrentDuplicate && (
          <div className="mt-1 text-[10px] text-amber-700 flex items-center gap-1" title={`该字段也被映射到：${duplicateHeaders.filter(h => h !== header).join('、')}${isLastOccurrence ? '。当前列为最后一列，其值将在导入时使用。' : ''}`}>
            <AlertTriangle className="w-3 h-3" />
            {isLastOccurrence ? '重复映射（当前列生效）' : '重复映射（被覆盖）'}
          </div>
        )}
      </div>
    );
  };

  const renderEditableCell = (row: ImportPreviewData['rows'][0], colKey: string) => {
    const isEditing = editingCell?.rowIndex === row.rowIndex && editingCell?.fieldKey === colKey;
    const hasError = hasErrorInField(row, colKey);
    const fieldErrors = getFieldErrors(row, colKey);
    const rawValue = getFieldRawValue(row, colKey);
    const displayValue = getFieldDisplayValue(row, colKey);
    const isBooleanField = colKey === 'pinnedStatus' || colKey === 'photographed';

    if (isEditing) {
      return (
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={editingCell.value}
            onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCellEditSave();
              } else if (e.key === 'Escape') {
                handleCellEditCancel();
              }
            }}
            autoFocus
            className="flex-1 px-2 py-1 text-sm border-2 border-rust-400 rounded bg-parchment-50 text-oak-800 focus:outline-none min-w-[80px]"
          />
          <button
            type="button"
            onClick={handleCellEditSave}
            className="p-1 text-green-600 hover:bg-green-100 rounded transition-colors"
            title="保存"
          >
            <Save className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleCellEditCancel}
            className="p-1 text-rust-600 hover:bg-rust-100 rounded transition-colors"
            title="取消"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1 group">
        {hasError && (
          <div className="group relative">
            <AlertTriangle className="w-4 h-4 text-rust-600 flex-shrink-0" />
            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-20">
              <div className="bg-rust-900 text-white text-xs rounded-md px-2 py-1 whitespace-nowrap shadow-lg max-w-xs">
                {fieldErrors.map((err, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    {getErrorIcon(row.errors.find(e => e.message === err)?.type || '')}
                    {err}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        <span className={`${hasError ? 'text-rust-700 font-medium' : 'text-oak-800'} flex-1`}>
          {displayValue || (
            <span className="text-oak-300">—</span>
          )}
        </span>
        <button
          type="button"
          onClick={() => handleCellEditStart(row.rowIndex, colKey, isBooleanField ? rawValue : displayValue)}
          className="p-1 text-oak-400 hover:text-oak-600 hover:bg-oak-100 rounded opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
          title="编辑单元格"
        >
          <Edit3 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-oak-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-parchment-50 rounded-xl shadow-hover max-w-7xl w-full max-h-[90vh] overflow-hidden animate-scale-in flex flex-col">
        <div className="bg-parchment-50 border-b border-oak-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-oak-100 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-oak-700" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-oak-800 font-serif">
                {step === 'upload' ? '导入标本数据' : '数据预览与校验'}
              </h2>
              {fileName && step === 'preview' && (
                <p className="text-sm text-oak-500">{fileName}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-oak-100 text-oak-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 'upload' ? (
          <div className="p-8 overflow-y-auto flex-1">
            {error && (
              <div className="mb-6 p-3 bg-rust-100 border border-rust-300 text-rust-800 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="max-w-2xl mx-auto">
              <div
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${
                  isDragging
                    ? 'border-rust-500 bg-rust-50'
                    : 'border-oak-300 hover:border-oak-400 hover:bg-oak-50'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById('csv-file-input')?.click()}
              >
                <input
                  id="csv-file-input"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Upload className="w-12 h-12 text-oak-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-oak-800 mb-2">
                  点击或拖拽CSV文件到此处
                </p>
                <p className="text-sm text-oak-500 mb-4">
                  支持 .csv 格式文件，文件编码请使用 UTF-8
                </p>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-oak-100 text-oak-700 rounded-lg text-sm">
                  <ArrowUpFromLine className="w-4 h-4" />
                  选择文件
                </div>
              </div>

              <div className="mt-8 p-6 bg-parchment-100 border border-oak-200 rounded-xl">
                <h3 className="font-semibold text-oak-800 font-serif mb-3">CSV文件格式说明</h3>
                <p className="text-sm text-oak-600 mb-4">
                  CSV文件应包含以下列，系统将自动识别列名，您也可以在预览时手动调整字段映射：
                </p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="text-rust-600 font-medium">*</span>
                    <div>
                      <span className="font-medium text-oak-800">标本编号</span>
                      <p className="text-oak-500 text-xs">如：COLE-001</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-rust-600 font-medium">*</span>
                    <div>
                      <span className="font-medium text-oak-800">物种名</span>
                      <p className="text-oak-500 text-xs">如：中华大扁锹</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-oak-400">·</span>
                    <div>
                      <span className="font-medium text-oak-800">采集地点</span>
                      <p className="text-oak-500 text-xs">如：浙江天目山</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-oak-400">·</span>
                    <div>
                      <span className="font-medium text-oak-800">采集日期</span>
                      <p className="text-oak-500 text-xs">如：2024-07-15</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-oak-400">·</span>
                    <div>
                      <span className="font-medium text-oak-800">针插状态</span>
                      <p className="text-oak-500 text-xs">已针插/未针插</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-oak-400">·</span>
                    <div>
                      <span className="font-medium text-oak-800">拍照状态</span>
                      <p className="text-oak-500 text-xs">已拍照/未拍照</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-oak-400">·</span>
                    <div>
                      <span className="font-medium text-oak-800">展盒名称</span>
                      <p className="text-oak-500 text-xs">不存在的展盒将在导入时自动创建</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-oak-400">·</span>
                    <div>
                      <span className="font-medium text-oak-800">采集批次</span>
                      <p className="text-oak-500 text-xs">不存在的批次将在导入时自动创建</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-oak-400">·</span>
                    <div>
                      <span className="font-medium text-oak-800">备注</span>
                      <p className="text-oak-500 text-xs">其他说明信息</p>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-oak-500 mt-4">
                  <span className="text-rust-600 font-medium">*</span> 标记的为必填项
                </p>
              </div>

              {previewData && (
                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl">
                  <div className="flex items-center gap-2 text-green-800">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">文件解析成功，共 {previewData.rows.length} 条记录</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : step === 'confirm-objects' && previewData ? (
          <div className="p-8 overflow-y-auto flex-1">
            {error && (
              <div className="mb-6 p-3 bg-rust-100 border border-rust-300 text-rust-800 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="max-w-3xl mx-auto">
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-blue-800 mb-1">发现需要创建的关联对象</h4>
                    <p className="text-sm text-blue-700">
                      文件中包含系统中不存在的展盒和/或采集批次。请选择需要创建的对象，
                      未选择的对象对应的标本记录将被跳过。
                    </p>
                  </div>
                </div>
              </div>

              {previewData.relatedObjects.newBoxes.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Package className="w-5 h-5 text-oak-600" />
                    <h3 className="text-lg font-semibold text-oak-800 font-serif">需要创建的展盒</h3>
                    <span className="text-sm text-oak-500">({previewData.relatedObjects.newBoxes.length} 个)</span>
                  </div>
                  <div className="space-y-2">
                    {previewData.relatedObjects.newBoxes.map((boxInfo) => (
                      <label
                        key={boxInfo.name}
                        className="flex items-start gap-3 p-4 bg-parchment-100 border border-oak-200 rounded-lg cursor-pointer hover:bg-parchment-200 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedBoxesToCreate.has(boxInfo.name.toLowerCase())}
                          onChange={() => toggleBoxSelection(boxInfo.name)}
                          className="w-4 h-4 mt-1 text-rust-600 rounded border-oak-300"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Plus className="w-4 h-4 text-green-600" />
                            <span className="font-medium text-oak-800">{boxInfo.name}</span>
                          </div>
                          <p className="text-xs text-oak-500 mt-1">
                            应用于第 {boxInfo.rowIndices.join('、')} 行的记录
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {previewData.relatedObjects.newBatches.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Layers className="w-5 h-5 text-oak-600" />
                    <h3 className="text-lg font-semibold text-oak-800 font-serif">需要创建的采集批次</h3>
                    <span className="text-sm text-oak-500">({previewData.relatedObjects.newBatches.length} 个)</span>
                  </div>
                  <div className="space-y-2">
                    {previewData.relatedObjects.newBatches.map((batchInfo) => (
                      <label
                        key={batchInfo.name}
                        className="flex items-start gap-3 p-4 bg-parchment-100 border border-oak-200 rounded-lg cursor-pointer hover:bg-parchment-200 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedBatchesToCreate.has(batchInfo.name.toLowerCase())}
                          onChange={() => toggleBatchSelection(batchInfo.name)}
                          className="w-4 h-4 mt-1 text-rust-600 rounded border-oak-300"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Plus className="w-4 h-4 text-green-600" />
                            <span className="font-medium text-oak-800">{batchInfo.name}</span>
                          </div>
                          <p className="text-xs text-oak-500 mt-1">
                            应用于第 {batchInfo.rowIndices.join('、')} 行的记录
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-amber-800 mb-1">说明</h4>
                    <ul className="text-sm text-amber-700 space-y-1">
                      <li>• 新创建的展盒位置、备注等信息可在"管理展盒"中补充完善</li>
                      <li>• 新创建的采集批次日期、地点等信息可在"管理批次"中补充完善</li>
                      <li>• 未勾选创建的对象对应的标本记录将不会被导入</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden flex flex-col flex-1">
            {error && (
              <div className="mx-6 mt-4 p-3 bg-rust-100 border border-rust-300 text-rust-800 rounded-lg text-sm flex-shrink-0">
                {error}
              </div>
            )}

            {previewData && (
              <>
                <div className="px-6 py-4 border-b border-oak-200 flex-shrink-0">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-oak-500" />
                        <span className="text-sm text-oak-600">
                          共 <span className="font-semibold text-oak-800">{previewData.totalCount}</span> 条记录
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-sm text-oak-600">
                          有效 <span className="font-semibold text-green-700">{previewData.validCount}</span> 条
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-rust-600" />
                        <span className="text-sm text-oak-600">
                          无效 <span className="font-semibold text-rust-700">{previewData.invalidCount}</span> 条
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showOnlyInvalid}
                          onChange={(e) => setShowOnlyInvalid(e.target.checked)}
                          className="w-4 h-4 text-rust-600 rounded border-oak-300"
                        />
                        <span className="text-sm text-oak-600">只显示有问题的行</span>
                      </label>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-oak-500">字段映射：</span>
                        <span className="text-xs text-oak-500">点击下拉框可重新映射CSV列到目标字段</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowFieldMapping(!showFieldMapping)}
                        className="text-xs text-oak-500 hover:text-oak-700 flex items-center gap-1"
                      >
                        {showFieldMapping ? '收起' : '展开'}
                        <ChevronDown className={`w-3 h-3 transition-transform ${showFieldMapping ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                    {showFieldMapping && (
                      <div className="bg-parchment-100 border border-oak-200 rounded-lg p-4">
                        {Object.keys(getDuplicateMappings()).length > 0 && (
                          <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-lg">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                              <div>
                                <h4 className="text-sm font-semibold text-amber-800 mb-1">检测到重复字段映射</h4>
                                <p className="text-xs text-amber-700 mb-2">
                                  以下字段被映射到了多个CSV列。实际导入时，每字段将使用<strong>最后一列</strong>的值：
                                </p>
                                <ul className="text-xs text-amber-700 space-y-1">
                                  {Object.entries(getDuplicateMappings()).map(([field, headers]) => {
                                    const fieldInfo = ALL_TARGET_FIELDS.find(f => f.key === field);
                                    const lastHeader = headers[headers.length - 1];
                                    return (
                                      <li key={field} className="flex items-center gap-2">
                                        <span className="font-medium">{fieldInfo?.label || field}:</span>
                                        <span>{headers.map((h, idx) => (
                                          <span key={h}>
                                            {idx > 0 && ' → '}
                                            <span className={h === lastHeader ? 'font-semibold text-amber-800' : ''}>
                                              "{h}"{h === lastHeader && ' (生效)'}
                                            </span>
                                          </span>
                                        ))}</span>
                                      </li>
                                    );
                                  })}
                                </ul>
                                <p className="text-xs text-amber-600 mt-2">
                                  建议：将不需要的列映射改为"— 忽略此列 —"以避免数据不一致。
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          {previewData.headers.map((header) => {
                            const mappedField = previewData.fieldMapping[header];
                            const isMapped = mappedField !== null;
                            const isRequired = ALL_TARGET_FIELDS.find(f => f.key === mappedField)?.required;
                            return (
                              <div key={header} className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-medium text-oak-700 truncate max-w-[120px]" title={header}>
                                    {header}
                                  </span>
                                  <span className="text-oak-400 text-xs">→</span>
                                  {isRequired && <span className="text-rust-600 text-xs">*</span>}
                                </div>
                                {renderFieldMappingDropdown(header)}
                                <div className={`text-[10px] ${isMapped ? 'text-green-600' : 'text-oak-400'}`}>
                                  当前：{getMappedFieldLabel(header)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-3 pt-3 border-t border-oak-200 flex items-center gap-4 text-xs text-oak-500">
                          <div className="flex items-center gap-1">
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>鼠标悬停在单元格上可直接编辑内容</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-rust-500" />
                            <span>每次修改后将自动重新校验</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-auto px-6 py-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-parchment-50 z-10">
                        <tr className="border-b-2 border-oak-200">
                          <th className="px-3 py-3 text-left text-oak-600 font-medium w-16">行号</th>
                          <th className="px-3 py-3 text-left text-oak-600 font-medium w-20">状态</th>
                          {DISPLAY_COLUMNS.map((col) => (
                            <th
                              key={col.key}
                              className="px-3 py-3 text-left text-oak-600 font-medium whitespace-nowrap"
                            >
                              {col.required && (
                                <span className="text-rust-600 mr-1">*</span>
                              )}
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {displayedRows.map((row) => (
                          <tr
                            key={row.rowIndex}
                            className={`border-b border-oak-100 hover:bg-oak-50 transition-colors ${
                              !row.isValid ? 'bg-rust-50/50' : ''
                            }`}
                          >
                            <td className="px-3 py-3 text-oak-500 font-mono text-xs">
                              {row.rowIndex}
                            </td>
                            <td className="px-3 py-3">
                              {row.isValid ? (
                                <CheckCircle className="w-5 h-5 text-green-600" />
                              ) : (
                                <XCircle className="w-5 h-5 text-rust-600" />
                              )}
                            </td>
                            {DISPLAY_COLUMNS.map((col) => (
                              <td
                                key={col.key}
                                className="px-3 py-3"
                              >
                                {renderEditableCell(row, col.key)}
                              </td>
                            ))}
                          </tr>
                        ))}
                        {displayedRows.length === 0 && (
                          <tr>
                            <td
                              colSpan={DISPLAY_COLUMNS.length + 2}
                              className="px-3 py-12 text-center text-oak-500"
                            >
                              {showOnlyInvalid
                                ? '没有发现问题数据'
                                : '没有数据可显示'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {previewData.invalidCount > 0 && (
                    <div className="mt-6 p-4 bg-rust-50 border border-rust-200 rounded-xl">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-rust-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-rust-800 mb-2">
                            发现 {previewData.invalidCount} 条存在问题的记录
                          </h4>
                          <p className="text-sm text-rust-700 mb-2">
                            您可以直接点击单元格编辑修正，或修改字段映射。以下类型的问题将导致记录无法导入：
                          </p>
                          <ul className="text-sm text-rust-600 space-y-1">
                            <li className="flex items-center gap-2">
                              <XCircle className="w-4 h-4" />
                              <span>缺少必填项（标本编号、物种名）</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <XCircle className="w-4 h-4" />
                              <span>标本编号已存在于系统中</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <XCircle className="w-4 h-4" />
                              <span>标本编号在导入文件内重复</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <XCircle className="w-4 h-4" />
                              <span>日期格式不正确</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <XCircle className="w-4 h-4" />
                              <span>状态字段格式不正确（应为"已针插/未针插"等）</span>
                            </li>
                          </ul>
                          <p className="text-sm text-rust-700 mt-3">
                            只有 <span className="font-semibold">有效记录（{previewData.validCount} 条）</span> 将被导入系统。
                            请修正问题后确认导入，或直接确认导入有效数据。
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {(previewData.relatedObjects.newBoxes.length > 0 || previewData.relatedObjects.newBatches.length > 0) && (
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                      <div className="flex items-start gap-3">
                        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-blue-800 mb-2">
                            关联对象信息
                          </h4>
                          <ul className="text-sm text-blue-700 space-y-1">
                            {previewData.relatedObjects.newBoxes.length > 0 && (
                              <li className="flex items-center gap-2">
                                <Package className="w-4 h-4" />
                                <span>
                                  将创建 <span className="font-semibold">{selectedBoxesToCreate.size}</span> / {previewData.relatedObjects.newBoxes.length} 个新展盒
                                </span>
                              </li>
                            )}
                            {previewData.relatedObjects.newBatches.length > 0 && (
                              <li className="flex items-center gap-2">
                                <Layers className="w-4 h-4" />
                                <span>
                                  将创建 <span className="font-semibold">{selectedBatchesToCreate.size}</span> / {previewData.relatedObjects.newBatches.length} 个新采集批次
                                </span>
                              </li>
                            )}
                          </ul>
                          <p className="text-xs text-blue-600 mt-2">
                            可点击"返回"按钮修改要创建的关联对象选择
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <div className="border-t border-oak-200 px-6 py-4 flex items-center justify-between flex-shrink-0 bg-parchment-50">
          <div>
            {step === 'preview' && previewData && (
              <span className="text-sm text-oak-500">
                将导入 <span className="font-semibold text-green-700">{getEffectiveValidCount()}</span> 条有效记录
              </span>
            )}
            {step === 'confirm-objects' && previewData && (
              <span className="text-sm text-oak-500">
                选择需要创建的关联对象
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {step === 'confirm-objects' ? (
              <>
                <button
                  type="button"
                  onClick={handleBackToUpload}
                  className="btn-secondary"
                  disabled={isImporting}
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleConfirmObjects}
                  className="btn-primary flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  继续
                </button>
              </>
            ) : step === 'preview' ? (
              <>
                <button
                  type="button"
                  onClick={handleBackToConfirmObjects}
                  className="btn-secondary"
                  disabled={isImporting}
                >
                  返回
                </button>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={!previewData || getEffectiveValidCount() === 0 || isImporting}
                  className="btn-primary flex items-center gap-2"
                >
                  {isImporting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      导入中...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      确认导入 {getEffectiveValidCount()} 条
                    </>
                  )}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleClose}
                className="btn-secondary"
              >
                取消
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
