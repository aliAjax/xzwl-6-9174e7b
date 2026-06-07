import { useState, useCallback, useMemo } from 'react';
import { X, Download, Upload, Database, AlertTriangle, CheckCircle, XCircle, FileJson, Archive, RefreshCw, Merge, Trash2, Info, ArrowLeft, Check } from 'lucide-react';
import type { Box, Specimen, CollectionBatch, RestorePreviewData, RestoreOptions, RestoreResult, RestoreMode } from '../types';
import { exportBackup, readFileAsText, parseBackupFile, generateRestorePreview, performRestore } from '../utils/helpers';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  boxes: Box[];
  specimens: Specimen[];
  batches: CollectionBatch[];
  setBoxes: (value: Box[] | ((prev: Box[]) => Box[])) => void;
  setSpecimens: (value: Specimen[] | ((prev: Specimen[]) => Specimen[])) => void;
  setBatches: (value: CollectionBatch[] | ((prev: CollectionBatch[]) => CollectionBatch[])) => void;
}

type TabType = 'backup' | 'restore';
type RestoreStep = 'upload' | 'preview' | 'options' | 'result';

export function BackupRestoreModal({
  isOpen,
  onClose,
  boxes,
  specimens,
  batches,
  setBoxes,
  setSpecimens,
  setBatches,
}: BackupRestoreModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('backup');
  const [restoreStep, setRestoreStep] = useState<RestoreStep>('upload');
  const [restorePreview, setRestorePreview] = useState<RestorePreviewData | null>(null);
  const [restoreOptions, setRestoreOptions] = useState<RestoreOptions>({
    mode: 'merge',
    importBoxes: true,
    importSpecimens: true,
    importBatches: true,
  });
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConflictDetails, setShowConflictDetails] = useState(false);

  const resetState = useCallback(() => {
    setActiveTab('backup');
    setRestoreStep('upload');
    setRestorePreview(null);
    setRestoreOptions({
      mode: 'merge',
      importBoxes: true,
      importSpecimens: true,
      importBatches: true,
    });
    setRestoreResult(null);
    setError('');
    setFileName('');
    setIsProcessing(false);
    setShowConflictDetails(false);
  }, []);

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleBackup = () => {
    try {
      exportBackup(boxes, specimens, batches);
    } catch (e) {
      setError(e instanceof Error ? e.message : '备份导出失败');
    }
  };

  const processFile = useCallback(async (file: File) => {
    setError('');
    
    if (!file.name.toLowerCase().endsWith('.json')) {
      setError('请上传JSON格式的备份文件');
      return;
    }

    setIsProcessing(true);
    
    try {
      const content = await readFileAsText(file);
      const backupData = parseBackupFile(content);
      const preview = generateRestorePreview(backupData, boxes, specimens, batches);
      
      setRestorePreview(preview);
      setFileName(file.name);
      setRestoreStep('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : '文件解析失败');
    } finally {
      setIsProcessing(false);
    }
  }, [boxes, specimens, batches]);

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

  const handleContinueToOptions = () => {
    if (!restorePreview?.compatibility.canRestore) {
      return;
    }
    setRestoreStep('options');
  };

  const handleBackToPreview = () => {
    setRestoreStep('preview');
  };

  const handleBackToUpload = () => {
    setRestoreStep('upload');
    setRestorePreview(null);
    setFileName('');
  };

  const handleRestore = async () => {
    if (!restorePreview) return;
    
    setIsProcessing(true);
    setError('');
    
    try {
      const result = performRestore(
        restorePreview,
        restoreOptions,
        boxes,
        specimens,
        batches,
        setBoxes,
        setSpecimens,
        setBatches
      );
      
      setRestoreResult(result);
      setRestoreStep('result');
    } catch (e) {
      setError(e instanceof Error ? e.message : '恢复失败');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const conflictSummary = useMemo(() => {
    if (!restorePreview) return null;
    const { conflicts } = restorePreview;
    return {
      totalConflicts: 
        conflicts.boxIdConflicts.length +
        conflicts.specimenIdConflicts.length +
        conflicts.batchIdConflicts.length +
        conflicts.specimenNoConflicts.length +
        conflicts.missingBoxReferences.length +
        conflicts.missingBatchReferences.length,
      hasConflicts: 
        conflicts.boxIdConflicts.length > 0 ||
        conflicts.specimenIdConflicts.length > 0 ||
        conflicts.batchIdConflicts.length > 0 ||
        conflicts.specimenNoConflicts.length > 0 ||
        conflicts.missingBoxReferences.length > 0 ||
        conflicts.missingBatchReferences.length > 0,
    };
  }, [restorePreview]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-oak-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-parchment-50 rounded-xl shadow-hover max-w-4xl w-full max-h-[90vh] overflow-hidden animate-scale-in flex flex-col">
        <div className="bg-parchment-50 border-b border-oak-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-oak-100 flex items-center justify-center">
              <Database className="w-5 h-5 text-oak-700" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-oak-800 font-serif">
                数据备份与恢复
              </h2>
              <p className="text-sm text-oak-500">导出或导入标本数据备份</p>
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

        <div className="border-b border-oak-200 flex-shrink-0">
          <div className="flex">
            <button
              type="button"
              onClick={() => {
                setActiveTab('backup');
                setRestoreStep('upload');
              }}
              className={`flex-1 px-6 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'backup'
                  ? 'text-rust-700 border-b-2 border-rust-600 bg-rust-50'
                  : 'text-oak-600 hover:text-oak-800 hover:bg-oak-50'
              }`}
            >
              <Archive className="w-4 h-4" />
              备份导出
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('restore');
                setRestoreStep('upload');
              }}
              className={`flex-1 px-6 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'restore'
                  ? 'text-rust-700 border-b-2 border-rust-600 bg-rust-50'
                  : 'text-oak-600 hover:text-oak-800 hover:bg-oak-50'
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              恢复导入
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 bg-rust-100 border border-rust-300 text-rust-800 rounded-lg text-sm flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'backup' && (
            <div className="space-y-6">
              <div className="p-6 bg-oak-50 border border-oak-200 rounded-xl">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 rounded-lg bg-oak-100 flex items-center justify-center flex-shrink-0">
                    <FileJson className="w-6 h-6 text-oak-700" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-oak-800 font-serif text-lg mb-1">
                      导出完整数据备份
                    </h3>
                    <p className="text-sm text-oak-600">
                      将所有展盒、标本和采集批次数据打包为JSON文件，保存在本地。
                      建议定期备份以防数据丢失。
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="p-4 bg-parchment-50 border border-oak-200 rounded-lg text-center">
                    <div className="text-2xl font-bold text-oak-800">{boxes.length}</div>
                    <div className="text-sm text-oak-500">展盒</div>
                  </div>
                  <div className="p-4 bg-parchment-50 border border-oak-200 rounded-lg text-center">
                    <div className="text-2xl font-bold text-oak-800">{specimens.length}</div>
                    <div className="text-sm text-oak-500">标本</div>
                  </div>
                  <div className="p-4 bg-parchment-50 border border-oak-200 rounded-lg text-center">
                    <div className="text-2xl font-bold text-oak-800">{batches.length}</div>
                    <div className="text-sm text-oak-500">采集批次</div>
                  </div>
                </div>

                <div className="p-4 bg-parchment-100 border border-oak-200 rounded-lg">
                  <h4 className="font-medium text-oak-800 mb-2 flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    备份文件说明
                  </h4>
                  <ul className="text-sm text-oak-600 space-y-1">
                    <li>• 文件格式：JSON (UTF-8 编码)</li>
                    <li>• 包含数据：展盒、标本、采集批次的完整信息</li>
                    <li>• 文件名格式：标本数据备份_YYYY-MM-DD.json</li>
                    <li>• 请妥善保管备份文件，注意数据隐私</li>
                  </ul>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleBackup}
                  disabled={boxes.length === 0 && specimens.length === 0 && batches.length === 0}
                  className="btn-primary flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  导出备份文件
                </button>
              </div>
            </div>
          )}

          {activeTab === 'restore' && restoreStep === 'upload' && (
            <div className="space-y-6">
              <div
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${
                  isDragging 
                    ? 'border-rust-500 bg-rust-50' 
                    : 'border-oak-300 hover:border-oak-400 hover:bg-oak-50'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById('backup-file-input')?.click()}
              >
                <input
                  id="backup-file-input"
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {isProcessing ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-oak-200 border-t-oak-600 rounded-full animate-spin" />
                    <p className="text-lg font-medium text-oak-800">正在解析文件...</p>
                  </div>
                ) : (
                  <>
                    <Upload className="w-12 h-12 text-oak-400 mx-auto mb-4" />
                    <p className="text-lg font-medium text-oak-800 mb-2">
                      点击或拖拽JSON备份文件到此处
                    </p>
                    <p className="text-sm text-oak-500 mb-4">
                      支持 .json 格式的备份文件
                    </p>
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-oak-100 text-oak-700 rounded-lg text-sm">
                      <Upload className="w-4 h-4" />
                      选择备份文件
                    </div>
                  </>
                )}
              </div>

              <div className="p-6 bg-parchment-100 border border-oak-200 rounded-xl">
                <h3 className="font-semibold text-oak-800 font-serif mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  恢复前注意事项
                </h3>
                <ul className="text-sm text-oak-600 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-rust-600 font-medium">•</span>
                    <span>恢复前建议先导出当前数据作为备份，以防数据丢失</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rust-600 font-medium">•</span>
                    <span>系统会自动检查备份文件的兼容性和数据完整性</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rust-600 font-medium">•</span>
                    <span>可以选择"覆盖模式"替换当前数据，或"合并模式"将备份数据添加到当前数据</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rust-600 font-medium">•</span>
                    <span>合并模式会自动处理ID冲突、标本编号重复等问题</span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'restore' && restoreStep === 'preview' && restorePreview && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <button
                  type="button"
                  onClick={handleBackToUpload}
                  className="flex items-center gap-1 text-oak-600 hover:text-oak-800 text-sm transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  重新选择文件
                </button>
              </div>

              <div className="p-4 bg-oak-50 border border-oak-200 rounded-lg">
                <h4 className="font-medium text-oak-800 mb-3">备份文件信息</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-oak-500">文件名：</span>
                    <span className="text-oak-800 font-medium">{fileName}</span>
                  </div>
                  <div>
                    <span className="text-oak-500">导出版本：</span>
                    <span className="text-oak-800 font-medium">v{restorePreview.backupData.version}</span>
                  </div>
                  <div>
                    <span className="text-oak-500">导出时间：</span>
                    <span className="text-oak-800 font-medium">{formatDate(restorePreview.backupData.exportedAt)}</span>
                  </div>
                  <div>
                    <span className="text-oak-500">导出应用：</span>
                    <span className="text-oak-800 font-medium">{restorePreview.backupData.appName}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-oak-50 border border-oak-200 rounded-lg">
                <h4 className="font-medium text-oak-800 mb-3">数据对比</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-oak-200">
                        <th className="text-left py-2 px-3 text-oak-600 font-medium">数据类型</th>
                        <th className="text-right py-2 px-3 text-oak-600 font-medium">当前系统</th>
                        <th className="text-right py-2 px-3 text-oak-600 font-medium">备份文件</th>
                        <th className="text-right py-2 px-3 text-oak-600 font-medium">变化</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-oak-100">
                        <td className="py-2 px-3 text-oak-800">展盒</td>
                        <td className="text-right py-2 px-3 text-oak-700">{restorePreview.currentStats.boxCount}</td>
                        <td className="text-right py-2 px-3 text-oak-700">{restorePreview.backupData.stats.boxCount}</td>
                        <td className={`text-right py-2 px-3 font-medium ${
                          restorePreview.backupData.stats.boxCount > restorePreview.currentStats.boxCount
                            ? 'text-green-600'
                            : restorePreview.backupData.stats.boxCount < restorePreview.currentStats.boxCount
                            ? 'text-rust-600'
                            : 'text-oak-500'
                        }`}>
                          {restorePreview.backupData.stats.boxCount - restorePreview.currentStats.boxCount > 0 ? '+' : ''}
                          {restorePreview.backupData.stats.boxCount - restorePreview.currentStats.boxCount}
                        </td>
                      </tr>
                      <tr className="border-b border-oak-100">
                        <td className="py-2 px-3 text-oak-800">标本</td>
                        <td className="text-right py-2 px-3 text-oak-700">{restorePreview.currentStats.specimenCount}</td>
                        <td className="text-right py-2 px-3 text-oak-700">{restorePreview.backupData.stats.specimenCount}</td>
                        <td className={`text-right py-2 px-3 font-medium ${
                          restorePreview.backupData.stats.specimenCount > restorePreview.currentStats.specimenCount
                            ? 'text-green-600'
                            : restorePreview.backupData.stats.specimenCount < restorePreview.currentStats.specimenCount
                            ? 'text-rust-600'
                            : 'text-oak-500'
                        }`}>
                          {restorePreview.backupData.stats.specimenCount - restorePreview.currentStats.specimenCount > 0 ? '+' : ''}
                          {restorePreview.backupData.stats.specimenCount - restorePreview.currentStats.specimenCount}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 text-oak-800">采集批次</td>
                        <td className="text-right py-2 px-3 text-oak-700">{restorePreview.currentStats.batchCount}</td>
                        <td className="text-right py-2 px-3 text-oak-700">{restorePreview.backupData.stats.batchCount}</td>
                        <td className={`text-right py-2 px-3 font-medium ${
                          restorePreview.backupData.stats.batchCount > restorePreview.currentStats.batchCount
                            ? 'text-green-600'
                            : restorePreview.backupData.stats.batchCount < restorePreview.currentStats.batchCount
                            ? 'text-rust-600'
                            : 'text-oak-500'
                        }`}>
                          {restorePreview.backupData.stats.batchCount - restorePreview.currentStats.batchCount > 0 ? '+' : ''}
                          {restorePreview.backupData.stats.batchCount - restorePreview.currentStats.batchCount}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className={`p-4 border rounded-lg ${
                restorePreview.compatibility.canRestore
                  ? 'bg-green-50 border-green-200'
                  : 'bg-rust-50 border-rust-200'
              }`}>
                <div className="flex items-start gap-3">
                  {restorePreview.compatibility.canRestore ? (
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rust-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h4 className={`font-medium ${
                      restorePreview.compatibility.canRestore ? 'text-green-800' : 'text-rust-800'
                    }`}>
                      {restorePreview.compatibility.canRestore ? '兼容性检查通过' : '兼容性检查失败'}
                    </h4>
                    {!restorePreview.compatibility.versionMatch && (
                      <p className="text-sm text-amber-700 mt-1">
                        版本不匹配：当前系统 v1，备份文件 v{restorePreview.backupData.version}
                      </p>
                    )}
                    {restorePreview.compatibility.errors.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm text-rust-700 font-medium">错误：</p>
                        <ul className="text-sm text-rust-600 list-disc list-inside">
                          {restorePreview.compatibility.errors.map((err, idx) => (
                            <li key={idx}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {restorePreview.compatibility.warnings.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm text-amber-700 font-medium">警告：</p>
                        <ul className="text-sm text-amber-600 list-disc list-inside">
                          {restorePreview.compatibility.warnings.map((warn, idx) => (
                            <li key={idx}>{warn}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {conflictSummary && conflictSummary.hasConflicts && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium text-amber-800 mb-2">
                        检测到 {conflictSummary.totalConflicts} 个潜在问题
                      </h4>
                      <button
                        type="button"
                        onClick={() => setShowConflictDetails(!showConflictDetails)}
                        className="text-sm text-amber-700 hover:text-amber-900 underline"
                      >
                        {showConflictDetails ? '收起详情' : '查看详情'}
                      </button>
                      
                      {showConflictDetails && (
                        <div className="mt-3 space-y-3 text-sm">
                          {restorePreview.conflicts.boxIdConflicts.length > 0 && (
                            <div>
                              <p className="font-medium text-amber-800">
                                展盒ID冲突 ({restorePreview.conflicts.boxIdConflicts.length} 个)
                              </p>
                              <p className="text-amber-600">
                                合并时将自动生成新ID，不会覆盖现有数据
                              </p>
                            </div>
                          )}
                          {restorePreview.conflicts.specimenIdConflicts.length > 0 && (
                            <div>
                              <p className="font-medium text-amber-800">
                                标本ID冲突 ({restorePreview.conflicts.specimenIdConflicts.length} 个)
                              </p>
                              <p className="text-amber-600">
                                合并时将自动生成新ID，不会覆盖现有数据
                              </p>
                            </div>
                          )}
                          {restorePreview.conflicts.batchIdConflicts.length > 0 && (
                            <div>
                              <p className="font-medium text-amber-800">
                                批次ID冲突 ({restorePreview.conflicts.batchIdConflicts.length} 个)
                              </p>
                              <p className="text-amber-600">
                                合并时将自动生成新ID，不会覆盖现有数据
                              </p>
                            </div>
                          )}
                          {restorePreview.conflicts.specimenNoConflicts.length > 0 && (
                            <div>
                              <p className="font-medium text-amber-800">
                                标本编号重复 ({restorePreview.conflicts.specimenNoConflicts.length} 个)
                              </p>
                              <p className="text-amber-600">
                                合并时将自动重命名重复编号（添加"_备份"后缀）
                              </p>
                              <div className="mt-1 max-h-24 overflow-y-auto bg-amber-100/50 p-2 rounded text-xs">
                                {restorePreview.conflicts.specimenNoConflicts.slice(0, 10).map((no, idx) => (
                                  <span key={idx} className="inline-block mr-2 text-amber-700">
                                    {no}
                                  </span>
                                ))}
                                {restorePreview.conflicts.specimenNoConflicts.length > 10 && (
                                  <span className="text-amber-600">
                                    ...还有 {restorePreview.conflicts.specimenNoConflicts.length - 10} 个
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                          {restorePreview.conflicts.missingBoxReferences.length > 0 && (
                            <div>
                              <p className="font-medium text-rust-800">
                                缺失展盒引用 ({restorePreview.conflicts.missingBoxReferences.length} 个)
                              </p>
                              <p className="text-rust-600">
                                这些标本引用的展盒在备份和当前系统中都不存在，恢复时将被跳过
                              </p>
                              <div className="mt-1 max-h-24 overflow-y-auto bg-rust-100/50 p-2 rounded text-xs">
                                {restorePreview.conflicts.missingBoxReferences.slice(0, 5).map((ref, idx) => (
                                  <div key={idx} className="text-rust-700">{ref}</div>
                                ))}
                                {restorePreview.conflicts.missingBoxReferences.length > 5 && (
                                  <span className="text-rust-600">
                                    ...还有 {restorePreview.conflicts.missingBoxReferences.length - 5} 个
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                          {restorePreview.conflicts.missingBatchReferences.length > 0 && (
                            <div>
                              <p className="font-medium text-rust-800">
                                缺失批次引用 ({restorePreview.conflicts.missingBatchReferences.length} 个)
                              </p>
                              <p className="text-rust-600">
                                这些标本引用的批次在备份和当前系统中都不存在，恢复时将被跳过
                              </p>
                              <div className="mt-1 max-h-24 overflow-y-auto bg-rust-100/50 p-2 rounded text-xs">
                                {restorePreview.conflicts.missingBatchReferences.slice(0, 5).map((ref, idx) => (
                                  <div key={idx} className="text-rust-700">{ref}</div>
                                ))}
                                {restorePreview.conflicts.missingBatchReferences.length > 5 && (
                                  <span className="text-rust-600">
                                    ...还有 {restorePreview.conflicts.missingBatchReferences.length - 5} 个
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'restore' && restoreStep === 'options' && restorePreview && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <button
                  type="button"
                  onClick={handleBackToPreview}
                  className="flex items-center gap-1 text-oak-600 hover:text-oak-800 text-sm transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  返回预览
                </button>
              </div>

              <div className="p-6 bg-oak-50 border border-oak-200 rounded-xl">
                <h3 className="font-semibold text-oak-800 font-serif mb-4">选择恢复模式</h3>
                
                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all hover:bg-oak-100 bg-parchment-50">
                    <input
                      type="radio"
                      name="restoreMode"
                      checked={restoreOptions.mode === 'merge'}
                      onChange={() => setRestoreOptions(prev => ({ ...prev, mode: 'merge' as RestoreMode }))}
                      className="w-4 h-4 text-rust-600 mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Merge className="w-5 h-5 text-oak-600" />
                        <span className="font-medium text-oak-800">合并模式</span>
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">推荐</span>
                      </div>
                      <p className="text-sm text-oak-600 mt-1">
                        将备份数据合并到当前数据中。系统会自动处理ID冲突、标本编号重复等问题。
                        现有数据不会被删除。
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all hover:bg-oak-100 bg-parchment-50">
                    <input
                      type="radio"
                      name="restoreMode"
                      checked={restoreOptions.mode === 'overwrite'}
                      onChange={() => setRestoreOptions(prev => ({ ...prev, mode: 'overwrite' as RestoreMode }))}
                      className="w-4 h-4 text-rust-600 mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Trash2 className="w-5 h-5 text-rust-600" />
                        <span className="font-medium text-oak-800">覆盖模式</span>
                        <span className="px-2 py-0.5 bg-rust-100 text-rust-700 text-xs rounded-full">危险</span>
                      </div>
                      <p className="text-sm text-oak-600 mt-1">
                        用备份数据替换当前数据。选中的数据类型将被完全替换为备份中的内容，
                        <span className="text-rust-600 font-medium">未选中的数据类型将保留</span>。
                        此操作不可撤销，请确保已备份当前数据。
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="p-6 bg-oak-50 border border-oak-200 rounded-xl">
                <h3 className="font-semibold text-oak-800 font-serif mb-4">选择要导入的数据</h3>
                
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-3 bg-parchment-50 border border-oak-200 rounded-lg cursor-pointer hover:bg-oak-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={restoreOptions.importBoxes}
                      onChange={(e) => setRestoreOptions(prev => ({ ...prev, importBoxes: e.target.checked }))}
                      className="w-4 h-4 text-rust-600 rounded border-oak-300"
                    />
                    <div>
                      <span className="font-medium text-oak-800">展盒数据</span>
                      <span className="text-sm text-oak-500 ml-2">
                        ({restorePreview.backupData.stats.boxCount} 个展盒)
                      </span>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-parchment-50 border border-oak-200 rounded-lg cursor-pointer hover:bg-oak-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={restoreOptions.importSpecimens}
                      onChange={(e) => setRestoreOptions(prev => ({ ...prev, importSpecimens: e.target.checked }))}
                      className="w-4 h-4 text-rust-600 rounded border-oak-300"
                    />
                    <div>
                      <span className="font-medium text-oak-800">标本数据</span>
                      <span className="text-sm text-oak-500 ml-2">
                        ({restorePreview.backupData.stats.specimenCount} 件标本)
                      </span>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-parchment-50 border border-oak-200 rounded-lg cursor-pointer hover:bg-oak-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={restoreOptions.importBatches}
                      onChange={(e) => setRestoreOptions(prev => ({ ...prev, importBatches: e.target.checked }))}
                      className="w-4 h-4 text-rust-600 rounded border-oak-300"
                    />
                    <div>
                      <span className="font-medium text-oak-800">采集批次数据</span>
                      <span className="text-sm text-oak-500 ml-2">
                        ({restorePreview.backupData.stats.batchCount} 个批次)
                      </span>
                    </div>
                  </label>
                </div>

                {restoreOptions.mode === 'overwrite' && (
                  <div className="mt-4 p-3 bg-rust-50 border border-rust-200 rounded-lg">
                    <p className="text-sm text-rust-700 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>
                        覆盖模式下，未选中的数据类型将保持不变。
                        如果只导入标本而不导入展盒，标本中的展盒引用可能会失效。
                      </span>
                    </p>
                  </div>
                )}
              </div>

              {restoreOptions.mode === 'merge' && conflictSummary?.hasConflicts && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <h4 className="font-medium text-amber-800 mb-2">合并时将自动执行以下处理：</h4>
                  <ul className="text-sm text-amber-700 space-y-1">
                    {restorePreview.conflicts.boxIdConflicts.length > 0 && (
                      <li>• 为 {restorePreview.conflicts.boxIdConflicts.length} 个冲突的展盒ID生成新ID</li>
                    )}
                    {restorePreview.conflicts.specimenIdConflicts.length > 0 && (
                      <li>• 为 {restorePreview.conflicts.specimenIdConflicts.length} 个冲突的标本ID生成新ID</li>
                    )}
                    {restorePreview.conflicts.batchIdConflicts.length > 0 && (
                      <li>• 为 {restorePreview.conflicts.batchIdConflicts.length} 个冲突的批次ID生成新ID</li>
                    )}
                    {restorePreview.conflicts.specimenNoConflicts.length > 0 && (
                      <li>• 为 {restorePreview.conflicts.specimenNoConflicts.length} 个重复的标本编号添加后缀</li>
                    )}
                    {(restorePreview.conflicts.missingBoxReferences.length > 0 || restorePreview.conflicts.missingBatchReferences.length > 0) && (
                      <li className="text-rust-700">
                        • 跳过 {restorePreview.conflicts.missingBoxReferences.length + restorePreview.conflicts.missingBatchReferences.length} 
                        个引用缺失的标本
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          {activeTab === 'restore' && restoreStep === 'result' && restoreResult && (
            <div className="space-y-6">
              <div className={`p-6 border-2 rounded-xl text-center ${
                restoreResult.success
                  ? 'bg-green-50 border-green-300'
                  : 'bg-rust-50 border-rust-300'
              }`}>
                {restoreResult.success ? (
                  <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                ) : (
                  <XCircle className="w-16 h-16 text-rust-600 mx-auto mb-4" />
                )}
                <h3 className={`text-xl font-semibold font-serif mb-2 ${
                  restoreResult.success ? 'text-green-800' : 'text-rust-800'
                }`}>
                  {restoreResult.success ? '恢复成功' : '恢复失败'}
                </h3>
                <p className={restoreResult.success ? 'text-green-700' : 'text-rust-700'}>
                  {restoreResult.message}
                </p>
              </div>

              {restoreResult.success && (
                <div className="p-6 bg-oak-50 border border-oak-200 rounded-xl">
                  <h4 className="font-semibold text-oak-800 font-serif mb-4">恢复统计</h4>
                  <div className="grid grid-cols-3 gap-4">
                    {restoreOptions.importBoxes && (
                      <div className="p-4 bg-parchment-50 border border-oak-200 rounded-lg text-center">
                        <div className="text-sm text-oak-500 mb-1">展盒</div>
                        <div className="flex justify-center gap-4 text-sm">
                          <div>
                            <span className="text-green-600 font-bold text-lg">+{restoreResult.stats.boxesAdded}</span>
                            <span className="text-oak-500"> 新增</span>
                          </div>
                          {restoreResult.stats.boxesUpdated > 0 && (
                            <div>
                              <span className="text-amber-600 font-bold text-lg">{restoreResult.stats.boxesUpdated}</span>
                              <span className="text-oak-500"> 更新</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {restoreOptions.importSpecimens && (
                      <div className="p-4 bg-parchment-50 border border-oak-200 rounded-lg text-center">
                        <div className="text-sm text-oak-500 mb-1">标本</div>
                        <div className="flex justify-center gap-4 text-sm">
                          <div>
                            <span className="text-green-600 font-bold text-lg">+{restoreResult.stats.specimensAdded}</span>
                            <span className="text-oak-500"> 新增</span>
                          </div>
                          {restoreResult.stats.specimensUpdated > 0 && (
                            <div>
                              <span className="text-amber-600 font-bold text-lg">{restoreResult.stats.specimensUpdated}</span>
                              <span className="text-oak-500"> 更新</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {restoreOptions.importBatches && (
                      <div className="p-4 bg-parchment-50 border border-oak-200 rounded-lg text-center">
                        <div className="text-sm text-oak-500 mb-1">采集批次</div>
                        <div className="flex justify-center gap-4 text-sm">
                          <div>
                            <span className="text-green-600 font-bold text-lg">+{restoreResult.stats.batchesAdded}</span>
                            <span className="text-oak-500"> 新增</span>
                          </div>
                          {restoreResult.stats.batchesUpdated > 0 && (
                            <div>
                              <span className="text-amber-600 font-bold text-lg">{restoreResult.stats.batchesUpdated}</span>
                              <span className="text-oak-500"> 更新</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {restoreResult.stats.skippedDueToMissingRefs > 0 && (
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-700 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        <span>
                          有 {restoreResult.stats.skippedDueToMissingRefs} 件标本因引用的展盒或批次不存在而被跳过。
                          请检查备份文件的完整性。
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-oak-200 px-6 py-4 flex items-center justify-between flex-shrink-0 bg-parchment-50">
          <div>
            {activeTab === 'restore' && restoreStep === 'options' && (
              <span className="text-sm text-oak-500">
                模式：{restoreOptions.mode === 'merge' ? '合并模式' : '覆盖模式'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {activeTab === 'restore' && restoreStep === 'preview' && (
              <button
                type="button"
                onClick={handleBackToUpload}
                className="btn-secondary"
                disabled={isProcessing}
              >
                重新选择
              </button>
            )}
            {activeTab === 'restore' && restoreStep === 'options' && (
              <button
                type="button"
                onClick={handleBackToPreview}
                className="btn-secondary"
                disabled={isProcessing}
              >
                返回
              </button>
            )}
            {activeTab === 'restore' && restoreStep === 'result' && (
              <button
                type="button"
                onClick={handleBackToUpload}
                className="btn-secondary"
              >
                恢复更多
              </button>
            )}
            
            {activeTab === 'backup' && (
              <button
                type="button"
                onClick={handleClose}
                className="btn-secondary"
              >
                关闭
              </button>
            )}
            
            {activeTab === 'restore' && restoreStep === 'preview' && (
              <button
                type="button"
                onClick={handleContinueToOptions}
                disabled={!restorePreview?.compatibility.canRestore || isProcessing}
                className="btn-primary flex items-center gap-2"
              >
                继续
              </button>
            )}
            {activeTab === 'restore' && restoreStep === 'options' && (
              <button
                type="button"
                onClick={handleRestore}
                disabled={
                  isProcessing ||
                  (!restoreOptions.importBoxes && !restoreOptions.importSpecimens && !restoreOptions.importBatches)
                }
                className={`flex items-center gap-2 ${
                  restoreOptions.mode === 'overwrite'
                    ? 'bg-rust-600 hover:bg-rust-700 text-white px-4 py-2 rounded-md transition-colors font-medium'
                    : 'btn-primary'
                }`}
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    恢复中...
                  </>
                ) : (
                  <>
                    {restoreOptions.mode === 'overwrite' ? (
                      <>
                        <Trash2 className="w-4 h-4" />
                        确认覆盖恢复
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        确认合并恢复
                      </>
                    )}
                  </>
                )}
              </button>
            )}
            {activeTab === 'restore' && restoreStep === 'result' && (
              <button
                type="button"
                onClick={handleClose}
                className="btn-primary"
              >
                完成
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
