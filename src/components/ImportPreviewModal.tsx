import { useState, useCallback } from 'react';
import { X, Upload, Check, AlertTriangle, FileSpreadsheet, CheckCircle, XCircle, ArrowUpFromLine } from 'lucide-react';
import type { Box, Specimen, ImportPreviewData, SpecimenFormData } from '../types';
import { validateAndPreviewCsv, readFileAsText, convertToSpecimenFormData } from '../utils/helpers';

interface ImportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  specimens: Specimen[];
  boxes: Box[];
  onImport: (data: SpecimenFormData[]) => void;
}

type Step = 'upload' | 'preview';

const DISPLAY_COLUMNS = [
  { key: 'specimenNo', label: '标本编号', required: true },
  { key: 'species', label: '物种名', required: true },
  { key: 'collectionLocation', label: '采集地点', required: false },
  { key: 'collectionDate', label: '采集日期', required: false },
  { key: 'pinnedStatus', label: '针插状态', required: false },
  { key: 'photographed', label: '拍照状态', required: false },
  { key: 'boxName', label: '展盒名称', required: false },
  { key: 'notes', label: '备注', required: false },
];

export function ImportPreviewModal({ isOpen, onClose, specimens, boxes, onImport }: ImportPreviewModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [previewData, setPreviewData] = useState<ImportPreviewData | null>(null);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [showOnlyInvalid, setShowOnlyInvalid] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const resetState = useCallback(() => {
    setStep('upload');
    setPreviewData(null);
    setError('');
    setFileName('');
    setShowOnlyInvalid(false);
    setIsImporting(false);
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
      const preview = validateAndPreviewCsv(content, specimens, boxes);
      setPreviewData(preview);
      setFileName(file.name);
      setStep('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : '文件解析失败，请检查CSV格式');
    }
  }, [specimens, boxes]);

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

  const handleImport = async () => {
    if (!previewData) return;
    
    setIsImporting(true);
    
    try {
      const validRows = previewData.rows.filter(r => r.isValid);
      const formDataList: SpecimenFormData[] = [];
      
      for (const row of validRows) {
        const formData = convertToSpecimenFormData(row, boxes);
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
      case 'box_not_found':
      case 'invalid_date':
      case 'invalid_boolean':
        return <XCircle className="w-4 h-4 text-rust-600" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
    }
  };

  const displayedRows = previewData 
    ? (showOnlyInvalid ? previewData.rows.filter(r => !r.isValid) : previewData.rows)
    : [];

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
                  CSV文件应包含以下列，系统将自动识别列名：
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
                      <p className="text-oak-500 text-xs">需与系统中已有的展盒名称一致</p>
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

                  <div className="mt-4 flex items-center gap-3 text-sm">
                    <span className="text-oak-500">字段识别：</span>
                    <div className="flex flex-wrap gap-2">
                      {previewData.headers.map((header) => {
                        const mappedField = previewData.fieldMapping[header];
                        const displayName = mappedField
                          ? DISPLAY_COLUMNS.find(c => c.key === mappedField)?.label || mappedField
                          : '未识别';
                        return (
                          <span
                            key={header}
                            className={`px-2 py-1 rounded-md text-xs ${
                              mappedField
                                ? 'bg-green-100 text-green-800 border border-green-200'
                                : 'bg-oak-100 text-oak-500 border border-oak-200'
                            }`}
                          >
                            {header} → {displayName}
                            {mappedField && <Check className="w-3 h-3 inline ml-1" />}
                          </span>
                        );
                      })}
                    </div>
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
                            {DISPLAY_COLUMNS.map((col) => {
                              const hasError = hasErrorInField(row, col.key);
                              const fieldErrors = getFieldErrors(row, col.key);
                              return (
                                <td
                                  key={col.key}
                                  className={`px-3 py-3 relative ${
                                    hasError ? 'text-rust-700' : 'text-oak-800'
                                  }`}
                                >
                                  <div className="flex items-center gap-1">
                                    {hasError && (
                                      <div className="group relative">
                                        <AlertTriangle className="w-4 h-4 text-rust-600 flex-shrink-0" />
                                        <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-20">
                                          <div className="bg-rust-900 text-white text-xs rounded-md px-2 py-1 whitespace-nowrap shadow-lg">
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
                                    <span className={hasError ? 'font-medium' : ''}>
                                      {getFieldDisplayValue(row, col.key) || (
                                        <span className="text-oak-300">—</span>
                                      )}
                                    </span>
                                  </div>
                                </td>
                              );
                            })}
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
                            以下类型的问题将导致记录无法导入：
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
                              <span>展盒名称在系统中不存在</span>
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
                            请修正问题后重新上传，或直接确认导入有效数据。
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
                将导入 <span className="font-semibold text-green-700">{previewData.validCount}</span> 条有效记录
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {step === 'preview' ? (
              <>
                <button
                  type="button"
                  onClick={handleBackToUpload}
                  className="btn-secondary"
                  disabled={isImporting}
                >
                  重新选择文件
                </button>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={!previewData || previewData.validCount === 0 || isImporting}
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
                      确认导入 {previewData?.validCount || 0} 条
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
