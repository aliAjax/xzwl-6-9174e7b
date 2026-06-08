import { useState, useCallback, useMemo } from 'react';
import {
  X, Upload, Database, AlertTriangle, CheckCircle, ArrowLeft,
  GitMerge, RotateCcw, ChevronDown, ChevronRight,
  Edit3, Save, Filter, Plus, Link2Off
} from 'lucide-react';
import type {
  Box, Specimen, CollectionBatch, BackupFileData,
  DiffAnalysisResult, DiffItem, DiffConflictType, MergeStrategy,
  MergeResult, DiffItemType, ReferenceRepairAction
} from '../types';
import { COMPLIANCE_STATUS_OPTIONS } from '../types';
import {
  readFileAsText, parseBackupFile, checkCompatibility, analyzeDifferences,
  performDiffMerge, restoreFromSnapshot, getConflictTypeLabel,
  getConflictTypeColor, getTypeLabel
} from '../utils/helpers';

interface BackupDiffMergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  boxes: Box[];
  specimens: Specimen[];
  batches: CollectionBatch[];
  setBoxes: (value: Box[] | ((prev: Box[]) => Box[])) => void;
  setSpecimens: (value: Specimen[] | ((prev: Specimen[]) => Specimen[])) => void;
  setBatches: (value: CollectionBatch[] | ((prev: CollectionBatch[]) => CollectionBatch[])) => void;
}

type MergeStep = 'upload' | 'analysis' | 'review' | 'result';
type FilterType = 'all' | DiffConflictType;

const FIELD_LABELS: Record<string, string> = {
  name: '名称',
  location: '位置',
  notes: '备注',
  collectionDate: '采集日期',
  participants: '参与人员',
  specimenNo: '标本编号',
  species: '物种名',
  collectionLocation: '采集地点',
  pinnedStatus: '针插状态',
  boxId: '所属展盒',
  batchId: '所属批次',
  photographed: '拍照状态',
  complianceStatus: '合规状态',
  permitNumber: '许可证编号',
  permitExpiryDate: '许可到期日',
  complianceNotes: '合规备注',
};

export function BackupDiffMergeModal({
  isOpen,
  onClose,
  boxes,
  specimens,
  batches,
  setBoxes,
  setSpecimens,
  setBatches,
}: BackupDiffMergeModalProps) {
  const [mergeStep, setMergeStep] = useState<MergeStep>('upload');
  const [backupData, setBackupData] = useState<BackupFileData | null>(null);
  const [diffAnalysis, setDiffAnalysis] = useState<DiffAnalysisResult | null>(null);
  const [diffItems, setDiffItems] = useState<DiffItem[]>([]);
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [manualEditData, setManualEditData] = useState<Record<string, unknown>>({});
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [activeTypeFilter, setActiveTypeFilter] = useState<'all' | DiffItemType>('all');

  const resetState = useCallback(() => {
    setMergeStep('upload');
    setBackupData(null);
    setDiffAnalysis(null);
    setDiffItems([]);
    setMergeResult(null);
    setError('');
    setFileName('');
    setIsProcessing(false);
    setExpandedItems(new Set());
    setEditingItemId(null);
    setManualEditData({});
    setActiveFilter('all');
    setActiveTypeFilter('all');
  }, []);

  const handleClose = () => {
    resetState();
    onClose();
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
      const parsed = parseBackupFile(content);
      const compatibility = checkCompatibility(parsed);
      
      if (!compatibility.canRestore) {
        setError(compatibility.errors.join('; ') || '备份文件不兼容');
        setIsProcessing(false);
        return;
      }

      setBackupData(parsed);
      setFileName(file.name);

      const analysis = analyzeDifferences(parsed, boxes, specimens, batches);
      setDiffAnalysis(analysis);
      setDiffItems(analysis.items);
      setMergeStep('analysis');
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

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const updateStrategy = (itemId: string, strategy: MergeStrategy) => {
    setDiffItems(prev =>
      prev.map(item =>
        item.id === itemId
          ? { ...item, selectedStrategy: strategy, manualMergedData: null }
          : item
      )
    );
    if (editingItemId === itemId && strategy !== 'manual') {
      setEditingItemId(null);
      setManualEditData({});
    }
  };

  const updateReferenceRepair = (itemId: string, action: ReferenceRepairAction) => {
    setDiffItems(prev =>
      prev.map(item =>
        item.id === itemId && item.referenceRepair
          ? {
              ...item,
              referenceRepair: {
                ...item.referenceRepair,
                selectedAction: action,
                selectedExistingId: undefined,
                newObjectName: item.referenceRepair.backupName,
              },
            }
          : item
      )
    );
  };

  const updateRepairExistingId = (itemId: string, existingId: string) => {
    setDiffItems(prev =>
      prev.map(item =>
        item.id === itemId && item.referenceRepair
          ? {
              ...item,
              referenceRepair: {
                ...item.referenceRepair,
                selectedExistingId: existingId,
              },
            }
          : item
      )
    );
  };

  const updateRepairNewName = (itemId: string, newName: string) => {
    setDiffItems(prev =>
      prev.map(item =>
        item.id === itemId && item.referenceRepair
          ? {
              ...item,
              referenceRepair: {
                ...item.referenceRepair,
                newObjectName: newName,
              },
            }
          : item
      )
    );
  };

  const getRepairActionLabel = (action: ReferenceRepairAction): string => {
    const labels: Record<ReferenceRepairAction, string> = {
      skip: '跳过此记录',
      clear_ref: '清空引用字段',
      create_new: '新建关联对象',
      choose_existing: '选择现有对象',
    };
    return labels[action];
  };

  const bulkUpdateStrategy = (conflictType: DiffConflictType, strategy: MergeStrategy) => {
    setDiffItems(prev =>
      prev.map(item =>
        item.conflictType === conflictType
          ? { ...item, selectedStrategy: strategy, manualMergedData: null }
          : item
      )
    );
  };

  const bulkRepairReferences = (conflictType: DiffConflictType, action: ReferenceRepairAction) => {
    setDiffItems(prev =>
      prev.map(item =>
        item.conflictType === conflictType && item.referenceRepair
          ? {
              ...item,
              referenceRepair: {
                ...item.referenceRepair,
                selectedAction: action,
                selectedExistingId: undefined,
                newObjectName: item.referenceRepair.backupName,
              },
            }
          : item
      )
    );
  };

  const startManualEdit = (item: DiffItem) => {
    setEditingItemId(item.id);
    const baseData = item.currentData || item.backupData || {};
    setManualEditData({ ...baseData });
  };

  const updateManualField = (field: string, value: unknown) => {
    setManualEditData(prev => ({ ...prev, [field]: value }));
  };

  const saveManualEdit = (item: DiffItem) => {
    const mergedData = {
      ...(item.currentData || item.backupData || {}),
      ...manualEditData,
    } as Box | Specimen | CollectionBatch;

    setDiffItems(prev =>
      prev.map(i =>
        i.id === item.id
          ? { ...i, manualMergedData: mergedData, selectedStrategy: 'manual' }
          : i
      )
    );
    setEditingItemId(null);
    setManualEditData({});
  };

  const cancelManualEdit = () => {
    setEditingItemId(null);
    setManualEditData({});
  };

  const validateMerge = (): string | null => {
    for (const item of diffItems) {
      if (!item.referenceRepair) continue;
      
      const repair = item.referenceRepair;
      if (repair.selectedAction === 'choose_existing' && !repair.selectedExistingId) {
        return `标本「${item.displayName}」的${repair.referenceType === 'box' ? '展盒' : '批次'}引用修复未完成：请选择一个现有${repair.referenceType === 'box' ? '展盒' : '批次'}。`;
      }
      if (repair.selectedAction === 'create_new' && !repair.newObjectName?.trim()) {
        return `标本「${item.displayName}」的${repair.referenceType === 'box' ? '展盒' : '批次'}引用修复未完成：请输入新建${repair.referenceType === 'box' ? '展盒' : '批次'}的名称。`;
      }
    }
    return null;
  };

  const handleMerge = () => {
    const validationError = validateMerge();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      const result = performDiffMerge(
        diffItems,
        boxes,
        specimens,
        batches,
        setBoxes,
        setSpecimens,
        setBatches
      );
      setMergeResult(result);
      setMergeStep('result');
    } catch (e) {
      setError(e instanceof Error ? e.message : '合并失败');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUndo = () => {
    if (!mergeResult) return;
    
    const success = restoreFromSnapshot(
      mergeResult.snapshot,
      setBoxes,
      setSpecimens,
      setBatches
    );

    if (success) {
      setMergeResult(null);
      setMergeStep('review');
    } else {
      setError('撤销失败');
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const filteredItems = useMemo(() => {
    return diffItems.filter(item => {
      if (activeFilter !== 'all' && item.conflictType !== activeFilter) {
        return false;
      }
      if (activeTypeFilter !== 'all' && item.type !== activeTypeFilter) {
        return false;
      }
      return true;
    });
  }, [diffItems, activeFilter, activeTypeFilter]);

  const groupedItems = useMemo(() => {
    const groups: Record<DiffConflictType, DiffItem[]> = {
      new_in_backup: [],
      deleted_in_backup: [],
      id_conflict: [],
      specimen_no_conflict: [],
      field_inconsistent: [],
      missing_box_ref: [],
      missing_batch_ref: [],
    };
    filteredItems.forEach(item => {
      groups[item.conflictType].push(item);
    });
    return groups;
  }, [filteredItems]);

  const formatValue = (value: unknown, field: string): string => {
    if (value === null || value === undefined || value === '') {
      return '(空)';
    }
    if (field === 'complianceStatus') {
      const opt = COMPLIANCE_STATUS_OPTIONS.find(o => o.value === value);
      return opt?.label || String(value);
    }
    if (typeof value === 'boolean') {
      return value ? '是' : '否';
    }
    if (field === 'boxId' && typeof value === 'string') {
      const box = boxes.find(b => b.id === value);
      return box ? box.name : (backupData ? backupData.data.boxes.find(b => b.id === value)?.name : '') || String(value);
    }
    if (field === 'batchId' && typeof value === 'string') {
      const batch = batches.find(b => b.id === value);
      return batch ? batch.name : (backupData ? backupData.data.batches.find(b => b.id === value)?.name : '') || String(value);
    }
    return String(value);
  };

  const renderFieldDiff = (item: DiffItem) => {
    if (!item.fieldDiffs || item.fieldDiffs.length === 0) return null;

    return (
      <div className="mt-3 space-y-2">
        <div className="text-sm font-medium text-oak-700">字段差异：</div>
        <div className="space-y-2">
          {item.fieldDiffs.map((diff, idx) => (
            <div key={idx} className="bg-parchment-50 border border-oak-200 rounded-lg p-3">
              <div className="text-sm font-medium text-oak-700 mb-2">
                {FIELD_LABELS[diff.field] || diff.field}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-oak-500 mb-1">当前版本</div>
                  <div className="text-oak-800 bg-oak-50 px-2 py-1 rounded">
                    {formatValue(diff.currentValue, diff.field)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-oak-500 mb-1">导入版本</div>
                  <div className="text-oak-800 bg-oak-50 px-2 py-1 rounded">
                    {formatValue(diff.backupValue, diff.field)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderFieldEditor = (field: string, value: unknown) => {
    const fieldValue = manualEditData[field] ?? value;
    
    if (field === 'complianceStatus') {
      return (
        <select
          value={String(fieldValue ?? '')}
          onChange={(e) => updateManualField(field, e.target.value)}
          className="w-full px-3 py-2 border border-oak-300 rounded-md text-sm focus:ring-2 focus:ring-rust-500 focus:border-rust-500"
        >
          {COMPLIANCE_STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );
    }
    if (field === 'boxId') {
      return (
        <select
          value={String(fieldValue ?? '')}
          onChange={(e) => updateManualField(field, e.target.value)}
          className="w-full px-3 py-2 border border-oak-300 rounded-md text-sm focus:ring-2 focus:ring-rust-500 focus:border-rust-500"
        >
          <option value="">(空)</option>
          {boxes.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
          {backupData?.data.boxes.filter(b => !boxes.find(cb => cb.id === b.id)).map(b => (
            <option key={b.id} value={b.id}>{b.name} (备份)</option>
          ))}
        </select>
      );
    }
    if (field === 'batchId') {
      return (
        <select
          value={String(fieldValue ?? '')}
          onChange={(e) => updateManualField(field, e.target.value)}
          className="w-full px-3 py-2 border border-oak-300 rounded-md text-sm focus:ring-2 focus:ring-rust-500 focus:border-rust-500"
        >
          <option value="">(空)</option>
          {batches.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
          {backupData?.data.batches.filter(b => !batches.find(cb => cb.id === b.id)).map(b => (
            <option key={b.id} value={b.id}>{b.name} (备份)</option>
          ))}
        </select>
      );
    }
    if (typeof fieldValue === 'boolean') {
      return (
        <select
          value={String(fieldValue ?? false)}
          onChange={(e) => updateManualField(field, e.target.value === 'true')}
          className="w-full px-3 py-2 border border-oak-300 rounded-md text-sm focus:ring-2 focus:ring-rust-500 focus:border-rust-500"
        >
          <option value="true">是</option>
          <option value="false">否</option>
        </select>
      );
    }
    return (
      <input
        type="text"
        value={String(fieldValue ?? '')}
        onChange={(e) => updateManualField(field, e.target.value)}
        className="w-full px-3 py-2 border border-oak-300 rounded-md text-sm focus:ring-2 focus:ring-rust-500 focus:border-rust-500"
      />
    );
  };

  const renderManualEditor = (item: DiffItem) => {
    if (editingItemId !== item.id) return null;

    const baseData = item.currentData || item.backupData;
    if (!baseData) return null;

    let editableFields: string[] = [];
    if (item.type === 'box') {
      editableFields = ['name', 'location', 'notes'];
    } else if (item.type === 'batch') {
      editableFields = ['name', 'collectionDate', 'location', 'participants', 'notes'];
    } else {
      editableFields = [
        'specimenNo', 'species', 'collectionLocation', 'collectionDate',
        'pinnedStatus', 'boxId', 'batchId', 'photographed', 'notes',
        'complianceStatus', 'permitNumber', 'permitExpiryDate', 'complianceNotes'
      ];
    }

    const isNewRecord = !item.currentData;

    return (
      <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="text-sm font-medium text-amber-800 mb-3 flex items-center gap-2">
          <Edit3 className="w-4 h-4" />
          {isNewRecord ? '编辑新记录' : '手动合并编辑'}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {editableFields.map((field) => {
            const fieldDiff = item.fieldDiffs?.find(d => d.field === field);
            const hasConflict = !!fieldDiff;
            
            return (
              <div key={field} className={hasConflict ? 'md:col-span-2' : ''}>
                <label className="block text-sm font-medium text-oak-700 mb-1">
                  {FIELD_LABELS[field] || field}
                  {hasConflict && <span className="text-xs text-amber-600 ml-2">(存在差异)</span>}
                </label>
                {renderFieldEditor(field, (baseData as unknown as Record<string, unknown>)[field])}
                {hasConflict && (
                  <div className="flex gap-2 mt-2 text-xs text-oak-500">
                    <button
                      type="button"
                      onClick={() => updateManualField(field, fieldDiff!.currentValue)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      使用当前值: {formatValue(fieldDiff!.currentValue, field)}
                    </button>
                    <span>|</span>
                    <button
                      type="button"
                      onClick={() => updateManualField(field, fieldDiff!.backupValue)}
                      className="text-green-600 hover:text-green-800"
                    >
                      使用导入值: {formatValue(fieldDiff!.backupValue, field)}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={() => saveManualEdit(item)}
            className="btn-primary text-sm px-4 py-2 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            保存
          </button>
          <button
            type="button"
            onClick={cancelManualEdit}
            className="btn-secondary text-sm px-4 py-2"
          >
            取消
          </button>
        </div>
      </div>
    );
  };

  const renderReferenceRepair = (item: DiffItem) => {
    if (!item.referenceRepair) return null;

    const repair = item.referenceRepair;
    const availableOptions = repair.referenceType === 'box' 
      ? boxes 
      : batches;

    return (
      <div className="mt-3 bg-purple-50 border border-purple-200 rounded-lg p-4">
        <div className="text-sm font-medium text-purple-800 mb-3 flex items-center gap-2">
          <Link2Off className="w-4 h-4" />
          {repair.referenceType === 'box' ? '展盒引用丢失' : '批次引用丢失'}修复选项
        </div>
        
        {repair.backupName && (
          <p className="text-sm text-purple-700 mb-3">
            原引用{repair.referenceType === 'box' ? '展盒' : '批次'}名称：
            <strong className="ml-1">{repair.backupName}</strong>
          </p>
        )}

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(['skip', 'clear_ref', 'create_new', 'choose_existing'] as ReferenceRepairAction[]).map(action => (
              <button
                key={action}
                type="button"
                onClick={() => updateReferenceRepair(item.id, action)}
                className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                  repair.selectedAction === action
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white text-purple-700 border-purple-300 hover:bg-purple-100'
                }`}
              >
                {getRepairActionLabel(action)}
              </button>
            ))}
          </div>

          {repair.selectedAction === 'choose_existing' && (
            <div className="pt-2">
              <label className="block text-sm font-medium text-oak-700 mb-1">
                选择现有{repair.referenceType === 'box' ? '展盒' : '批次'}：
              </label>
              <select
                value={repair.selectedExistingId || ''}
                onChange={(e) => updateRepairExistingId(item.id, e.target.value)}
                className="w-full px-3 py-2 border border-oak-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="">请选择...</option>
                {availableOptions.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.name}</option>
                ))}
              </select>
              {!repair.selectedExistingId && (
                <p className="text-xs text-rust-600 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  请选择一个现有{repair.referenceType === 'box' ? '展盒' : '批次'}
                </p>
              )}
            </div>
          )}

          {repair.selectedAction === 'create_new' && (
            <div className="pt-2">
              <label className="block text-sm font-medium text-oak-700 mb-1">
                新建{repair.referenceType === 'box' ? '展盒' : '批次'}名称：
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={repair.newObjectName || repair.backupName || ''}
                  onChange={(e) => updateRepairNewName(item.id, e.target.value)}
                  placeholder={`输入新${repair.referenceType === 'box' ? '展盒' : '批次'}名称`}
                  className="flex-1 px-3 py-2 border border-oak-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
                <div className="flex items-center gap-1 text-xs text-oak-500">
                  <Plus className="w-3 h-3" />
                  将自动创建
                </div>
              </div>
            </div>
          )}

          {repair.selectedAction === 'clear_ref' && (
            <p className="text-sm text-oak-600 pt-1">
              将清空该标本的{repair.referenceType === 'box' ? '展盒' : '批次'}引用字段。
            </p>
          )}

          {repair.selectedAction === 'skip' && (
            <p className="text-sm text-oak-600 pt-1">
              这条记录将被跳过，不会导入到系统中。
            </p>
          )}
        </div>
      </div>
    );
  };

  const renderDiffItem = (item: DiffItem) => {
    const isExpanded = expandedItems.has(item.id);
    const conflictColor = getConflictTypeColor(item.conflictType);

    return (
      <div
        key={`${item.type}-${item.id}`}
        className="border border-oak-200 rounded-lg overflow-hidden bg-parchment-50"
      >
        <div
          className="p-4 cursor-pointer hover:bg-oak-50 transition-colors"
          onClick={() => toggleExpand(item.id)}
        >
          <div className="flex items-start gap-3">
            <button
              type="button"
              className="mt-1 text-oak-400 hover:text-oak-600"
              onClick={(e) => { e.stopPropagation(); toggleExpand(item.id); }}
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${conflictColor}`}>
                  {getConflictTypeLabel(item.conflictType)}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-oak-100 text-oak-700 border border-oak-300">
                  {getTypeLabel(item.type)}
                </span>
                {item.specimenNo && (
                  <span className="text-sm text-oak-600 font-mono">
                    {item.specimenNo}
                  </span>
                )}
              </div>
              <div className="font-medium text-oak-800 mt-1">{item.displayName}</div>
              {item.currentData && item.backupData && (
                <div className="text-xs text-oak-500 mt-1">
                  ID: {item.id}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <select
                value={item.selectedStrategy}
                onChange={(e) => updateStrategy(item.id, e.target.value as MergeStrategy)}
                className="text-sm px-2 py-1.5 border border-oak-300 rounded-md bg-white focus:ring-2 focus:ring-rust-500 focus:border-rust-500"
              >
                <option value="keep_current">保留当前</option>
                <option value="keep_import">使用导入</option>
                {(item.conflictType === 'field_inconsistent' || 
                  item.conflictType === 'specimen_no_conflict' ||
                  item.conflictType === 'new_in_backup' ||
                  item.conflictType === 'missing_box_ref' ||
                  item.conflictType === 'missing_batch_ref') && (
                  <option value="manual">手动编辑</option>
                )}
              </select>
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="px-4 pb-4 border-t border-oak-100">
            {renderFieldDiff(item)}
            
            {!item.currentData && item.backupData && (
              <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="text-sm font-medium text-green-800 mb-2">导入版本数据：</div>
                <pre className="text-xs text-oak-600 bg-white p-2 rounded overflow-x-auto">
                  {JSON.stringify(item.backupData, null, 2)}
                </pre>
              </div>
            )}

            {item.currentData && !item.backupData && (
              <div className="mt-3 bg-rust-50 border border-rust-200 rounded-lg p-3">
                <div className="text-sm font-medium text-rust-800 mb-2">当前版本数据（备份中已删除）：</div>
                <pre className="text-xs text-oak-600 bg-white p-2 rounded overflow-x-auto">
                  {JSON.stringify(item.currentData, null, 2)}
                </pre>
              </div>
            )}

            {renderReferenceRepair(item)}

            {renderManualEditor(item)}

            {(item.conflictType === 'field_inconsistent' || 
              item.conflictType === 'specimen_no_conflict' ||
              item.conflictType === 'new_in_backup') && (
              <div className="mt-3">
                {item.selectedStrategy === 'manual' && editingItemId !== item.id && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-amber-700 bg-amber-50 px-2 py-1 rounded">
                      已保存手动编辑结果
                    </span>
                    <button
                      type="button"
                      onClick={() => startManualEdit(item)}
                      className="text-sm text-oak-600 hover:text-oak-800 underline"
                    >
                      重新编辑
                    </button>
                  </div>
                )}
                {item.selectedStrategy !== 'manual' && (
                  <button
                    type="button"
                    onClick={() => startManualEdit(item)}
                    className="text-sm text-oak-600 hover:text-oak-800 flex items-center gap-1"
                  >
                    <Edit3 className="w-3 h-3" />
                    {item.conflictType === 'new_in_backup' ? '编辑导入内容' : '手动合并字段'}
                  </button>
                )}
              </div>
            )}

            {item.referenceRepair && item.selectedStrategy === 'manual' && editingItemId !== item.id && !item.manualMergedData && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => startManualEdit(item)}
                  className="text-sm text-oak-600 hover:text-oak-800 flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" />
                  编辑导入内容
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderConflictGroup = (conflictType: DiffConflictType, items: DiffItem[]) => {
    if (items.length === 0) return null;

    const conflictColor = getConflictTypeColor(conflictType);

    const isReferenceConflict = conflictType === 'missing_box_ref' || conflictType === 'missing_batch_ref';

    return (
      <div key={conflictType} className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className={`text-sm px-3 py-1 rounded-full border font-medium ${conflictColor}`}>
              {getConflictTypeLabel(conflictType)}
            </span>
            <span className="text-sm text-oak-500">
              {items.length} 条
            </span>
          </div>
          {isReferenceConflict ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-oak-500">批量修复：</span>
              {(['skip', 'clear_ref', 'create_new', 'choose_existing'] as ReferenceRepairAction[]).map(action => (
                <button
                  key={action}
                  type="button"
                  onClick={() => bulkRepairReferences(conflictType, action)}
                  className="text-xs px-2 py-1 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded transition-colors"
                >
                  {getRepairActionLabel(action)}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-oak-500">批量选择：</span>
              <button
                type="button"
                onClick={() => bulkUpdateStrategy(conflictType, 'keep_current')}
                className="text-xs px-2 py-1 bg-oak-100 hover:bg-oak-200 text-oak-700 rounded transition-colors"
              >
                全部保留当前
              </button>
              <button
                type="button"
                onClick={() => bulkUpdateStrategy(conflictType, 'keep_import')}
                className="text-xs px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded transition-colors"
              >
                全部使用导入
              </button>
            </div>
          )}
        </div>
        <div className="space-y-2">
          {items.map(item => renderDiffItem(item))}
        </div>
      </div>
    );
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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-oak-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-parchment-50 rounded-xl shadow-hover max-w-5xl w-full max-h-[90vh] overflow-hidden animate-scale-in flex flex-col">
        <div className="bg-parchment-50 border-b border-oak-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-oak-100 flex items-center justify-center">
              <GitMerge className="w-5 h-5 text-oak-700" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-oak-800 font-serif">
                备份差异合并
              </h2>
              <p className="text-sm text-oak-500">智能对比并合并多份备份数据</p>
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

        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 bg-rust-100 border border-rust-300 text-rust-800 rounded-lg text-sm flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {mergeStep === 'upload' && (
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
                onClick={() => document.getElementById('diff-merge-file-input')?.click()}
              >
                <input
                  id="diff-merge-file-input"
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {isProcessing ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-oak-200 border-t-oak-600 rounded-full animate-spin" />
                    <p className="text-lg font-medium text-oak-800">正在分析文件...</p>
                  </div>
                ) : (
                  <>
                    <Upload className="w-12 h-12 text-oak-400 mx-auto mb-4" />
                    <p className="text-lg font-medium text-oak-800 mb-2">
                      点击或拖拽备份文件到此处
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

              <div className="p-6 bg-oak-50 border border-oak-200 rounded-xl">
                <h3 className="font-semibold text-oak-800 font-serif mb-4">功能说明</h3>
                <div className="grid grid-cols-2 gap-4 text-sm text-oak-600">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>智能识别新增、删除的记录</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>检测同编号或同ID冲突</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>对比字段级差异</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>检测引用完整性问题</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>按记录选择合并策略</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>合并后可一键撤销</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>提示：</strong>建议在合并前先导出当前数据作为备份，
                    合并过程中系统会自动创建快照，合并后可撤销。
                  </span>
                </p>
              </div>
            </div>
          )}

          {mergeStep === 'analysis' && diffAnalysis && backupData && (
            <div className="space-y-6">
              <div className="p-4 bg-oak-50 border border-oak-200 rounded-lg">
                <h4 className="font-medium text-oak-800 mb-3">备份文件信息</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-oak-500">文件名：</span>
                    <span className="text-oak-800 font-medium">{fileName}</span>
                  </div>
                  <div>
                    <span className="text-oak-500">导出时间：</span>
                    <span className="text-oak-800 font-medium">{formatDate(backupData.exportedAt)}</span>
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
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-oak-100">
                        <td className="py-2 px-3 text-oak-800">展盒</td>
                        <td className="text-right py-2 px-3 text-oak-700">{boxes.length}</td>
                        <td className="text-right py-2 px-3 text-oak-700">{backupData.stats.boxCount}</td>
                      </tr>
                      <tr className="border-b border-oak-100">
                        <td className="py-2 px-3 text-oak-800">标本</td>
                        <td className="text-right py-2 px-3 text-oak-700">{specimens.length}</td>
                        <td className="text-right py-2 px-3 text-oak-700">{backupData.stats.specimenCount}</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 text-oak-800">采集批次</td>
                        <td className="text-right py-2 px-3 text-oak-700">{batches.length}</td>
                        <td className="text-right py-2 px-3 text-oak-700">{backupData.stats.batchCount}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-4 bg-oak-50 border border-oak-200 rounded-lg">
                <h4 className="font-medium text-oak-800 mb-3">差异分析结果</h4>
                <div className="grid grid-cols-4 gap-3">
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-700">{diffAnalysis.stats.newInBackup}</div>
                    <div className="text-xs text-green-600">备份新增</div>
                  </div>
                  <div className="p-3 bg-rust-50 border border-rust-200 rounded-lg text-center">
                    <div className="text-2xl font-bold text-rust-700">{diffAnalysis.stats.deletedInBackup}</div>
                    <div className="text-xs text-rust-600">备份删除</div>
                  </div>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-center">
                    <div className="text-2xl font-bold text-amber-700">
                      {diffAnalysis.stats.specimenNoConflicts + diffAnalysis.stats.fieldInconsistent}
                    </div>
                    <div className="text-xs text-amber-600">存在冲突</div>
                  </div>
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-center">
                    <div className="text-2xl font-bold text-purple-700">
                      {diffAnalysis.stats.missingBoxRefs + diffAnalysis.stats.missingBatchRefs}
                    </div>
                    <div className="text-xs text-purple-600">引用丢失</div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-parchment-50 border border-oak-200 rounded-lg">
                <div className="flex items-start gap-3">
                  {diffAnalysis.hasConflicts ? (
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <h4 className={`font-medium ${diffAnalysis.hasConflicts ? 'text-amber-800' : 'text-green-800'}`}>
                      {diffAnalysis.hasConflicts 
                        ? `检测到 ${diffAnalysis.stats.total} 处差异，其中 ${diffAnalysis.stats.specimenNoConflicts + diffAnalysis.stats.fieldInconsistent + diffAnalysis.stats.missingBoxRefs + diffAnalysis.stats.missingBatchRefs} 处需要关注`
                        : `检测到 ${diffAnalysis.stats.total} 处差异，无严重冲突`}
                    </h4>
                    <p className="text-sm text-oak-600 mt-1">
                      点击"继续"可逐条查看差异详情并选择合并策略。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {mergeStep === 'review' && diffAnalysis && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-4 pb-4 border-b border-oak-200">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-oak-500" />
                  <span className="text-sm text-oak-600">筛选：</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveFilter('all')}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      activeFilter === 'all'
                        ? 'bg-rust-100 text-rust-700 border-rust-300'
                        : 'bg-white text-oak-600 border-oak-300 hover:bg-oak-50'
                    }`}
                  >
                    全部 ({diffItems.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('new_in_backup')}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      activeFilter === 'new_in_backup'
                        ? 'bg-green-100 text-green-700 border-green-300'
                        : 'bg-white text-oak-600 border-oak-300 hover:bg-oak-50'
                    }`}
                  >
                    备份新增 ({diffAnalysis.stats.newInBackup})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('deleted_in_backup')}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      activeFilter === 'deleted_in_backup'
                        ? 'bg-rust-100 text-rust-700 border-rust-300'
                        : 'bg-white text-oak-600 border-oak-300 hover:bg-oak-50'
                    }`}
                  >
                    备份删除 ({diffAnalysis.stats.deletedInBackup})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('field_inconsistent')}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      activeFilter === 'field_inconsistent'
                        ? 'bg-blue-100 text-blue-700 border-blue-300'
                        : 'bg-white text-oak-600 border-oak-300 hover:bg-oak-50'
                    }`}
                  >
                    字段不一致 ({diffAnalysis.stats.fieldInconsistent})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('specimen_no_conflict')}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      activeFilter === 'specimen_no_conflict'
                        ? 'bg-amber-100 text-amber-700 border-amber-300'
                        : 'bg-white text-oak-600 border-oak-300 hover:bg-oak-50'
                    }`}
                  >
                    编号冲突 ({diffAnalysis.stats.specimenNoConflicts})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('missing_box_ref')}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      activeFilter === 'missing_box_ref'
                        ? 'bg-purple-100 text-purple-700 border-purple-300'
                        : 'bg-white text-oak-600 border-oak-300 hover:bg-oak-50'
                    }`}
                  >
                    展盒引用丢失 ({diffAnalysis.stats.missingBoxRefs})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('missing_batch_ref')}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      activeFilter === 'missing_batch_ref'
                        ? 'bg-purple-100 text-purple-700 border-purple-300'
                        : 'bg-white text-oak-600 border-oak-300 hover:bg-oak-50'
                    }`}
                  >
                    批次引用丢失 ({diffAnalysis.stats.missingBatchRefs})
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pb-4">
                <span className="text-sm text-oak-600">类型筛选：</span>
                <button
                  type="button"
                  onClick={() => setActiveTypeFilter('all')}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    activeTypeFilter === 'all'
                      ? 'bg-oak-200 text-oak-700 border-oak-400'
                      : 'bg-white text-oak-600 border-oak-300 hover:bg-oak-50'
                  }`}
                >
                  全部类型
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTypeFilter('specimen')}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    activeTypeFilter === 'specimen'
                      ? 'bg-oak-200 text-oak-700 border-oak-400'
                      : 'bg-white text-oak-600 border-oak-300 hover:bg-oak-50'
                  }`}
                >
                  标本
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTypeFilter('box')}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    activeTypeFilter === 'box'
                      ? 'bg-oak-200 text-oak-700 border-oak-400'
                      : 'bg-white text-oak-600 border-oak-300 hover:bg-oak-50'
                  }`}
                >
                  展盒
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTypeFilter('batch')}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    activeTypeFilter === 'batch'
                      ? 'bg-oak-200 text-oak-700 border-oak-400'
                      : 'bg-white text-oak-600 border-oak-300 hover:bg-oak-50'
                  }`}
                >
                  批次
                </button>
              </div>

              {filteredItems.length === 0 ? (
                <div className="p-12 text-center bg-oak-50 rounded-xl">
                  <Database className="w-12 h-12 text-oak-300 mx-auto mb-4" />
                  <p className="text-oak-500">没有符合筛选条件的差异项</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {(['new_in_backup', 'deleted_in_backup', 'specimen_no_conflict', 'field_inconsistent', 'missing_box_ref', 'missing_batch_ref'] as DiffConflictType[]).map(type =>
                    renderConflictGroup(type, groupedItems[type])
                  )}
                </div>
              )}
            </div>
          )}

          {mergeStep === 'result' && mergeResult && (
            <div className="space-y-6">
              <div className={`p-6 border-2 rounded-xl text-center ${
                mergeResult.success
                  ? 'bg-green-50 border-green-300'
                  : 'bg-rust-50 border-rust-300'
              }`}>
                {mergeResult.success ? (
                  <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                ) : (
                  <AlertTriangle className="w-16 h-16 text-rust-600 mx-auto mb-4" />
                )}
                <h3 className={`text-xl font-semibold font-serif mb-2 ${
                  mergeResult.success ? 'text-green-800' : 'text-rust-800'
                }`}>
                  {mergeResult.success ? '合并完成' : '合并失败'}
                </h3>
                <p className={mergeResult.success ? 'text-green-700' : 'text-rust-700'}>
                  {mergeResult.message}
                </p>
              </div>

              {mergeResult.success && (
                <>
                  <div className="p-6 bg-oak-50 border border-oak-200 rounded-xl">
                    <h4 className="font-semibold text-oak-800 font-serif mb-4">合并统计</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-4 bg-parchment-50 border border-oak-200 rounded-lg text-center">
                        <div className="text-sm text-oak-500 mb-1">展盒</div>
                        <div className="flex justify-center gap-3 text-sm flex-wrap">
                          {mergeResult.stats.boxesAdded > 0 && (
                            <div>
                              <span className="text-green-600 font-bold text-lg">+{mergeResult.stats.boxesAdded}</span>
                              <span className="text-oak-500"> 新增</span>
                            </div>
                          )}
                          {mergeResult.stats.boxesUpdated > 0 && (
                            <div>
                              <span className="text-amber-600 font-bold text-lg">{mergeResult.stats.boxesUpdated}</span>
                              <span className="text-oak-500"> 更新</span>
                            </div>
                          )}
                          {mergeResult.stats.boxesDeleted > 0 && (
                            <div>
                              <span className="text-rust-600 font-bold text-lg">-{mergeResult.stats.boxesDeleted}</span>
                              <span className="text-oak-500"> 删除</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="p-4 bg-parchment-50 border border-oak-200 rounded-lg text-center">
                        <div className="text-sm text-oak-500 mb-1">标本</div>
                        <div className="flex justify-center gap-3 text-sm flex-wrap">
                          {mergeResult.stats.specimensAdded > 0 && (
                            <div>
                              <span className="text-green-600 font-bold text-lg">+{mergeResult.stats.specimensAdded}</span>
                              <span className="text-oak-500"> 新增</span>
                            </div>
                          )}
                          {mergeResult.stats.specimensUpdated > 0 && (
                            <div>
                              <span className="text-amber-600 font-bold text-lg">{mergeResult.stats.specimensUpdated}</span>
                              <span className="text-oak-500"> 更新</span>
                            </div>
                          )}
                          {mergeResult.stats.specimensDeleted > 0 && (
                            <div>
                              <span className="text-rust-600 font-bold text-lg">-{mergeResult.stats.specimensDeleted}</span>
                              <span className="text-oak-500"> 删除</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="p-4 bg-parchment-50 border border-oak-200 rounded-lg text-center">
                        <div className="text-sm text-oak-500 mb-1">采集批次</div>
                        <div className="flex justify-center gap-3 text-sm flex-wrap">
                          {mergeResult.stats.batchesAdded > 0 && (
                            <div>
                              <span className="text-green-600 font-bold text-lg">+{mergeResult.stats.batchesAdded}</span>
                              <span className="text-oak-500"> 新增</span>
                            </div>
                          )}
                          {mergeResult.stats.batchesUpdated > 0 && (
                            <div>
                              <span className="text-amber-600 font-bold text-lg">{mergeResult.stats.batchesUpdated}</span>
                              <span className="text-oak-500"> 更新</span>
                            </div>
                          )}
                          {mergeResult.stats.batchesDeleted > 0 && (
                            <div>
                              <span className="text-rust-600 font-bold text-lg">-{mergeResult.stats.batchesDeleted}</span>
                              <span className="text-oak-500"> 删除</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {mergeResult.stats.skipped > 0 && (
                      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-sm text-amber-700 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          <span>
                            有 {mergeResult.stats.skipped} 件标本因引用的展盒或批次不存在而被跳过。
                          </span>
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800 flex items-start gap-2">
                      <RotateCcw className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>可撤销：</strong>系统已自动保存合并前的快照。
                        如果对结果不满意，可以点击下方"撤销合并"按钮恢复到合并前的状态。
                      </span>
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-oak-200 px-6 py-4 flex items-center justify-between flex-shrink-0 bg-parchment-50">
          <div>
            {mergeStep === 'review' && (
              <div className="text-sm text-oak-500">
                共 {filteredItems.length} 条差异 · 显示 {filteredItems.length} 条
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {mergeStep === 'analysis' && (
              <button
                type="button"
                onClick={() => { setMergeStep('upload'); setBackupData(null); setFileName(''); }}
                className="btn-secondary"
                disabled={isProcessing}
              >
                重新选择
              </button>
            )}
            {mergeStep === 'review' && (
              <button
                type="button"
                onClick={() => setMergeStep('analysis')}
                className="btn-secondary"
                disabled={isProcessing}
              >
                <ArrowLeft className="w-4 h-4" />
                返回概览
              </button>
            )}
            {mergeStep === 'result' && (
              <button
                type="button"
                onClick={handleUndo}
                className="btn-secondary flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                撤销合并
              </button>
            )}
            
            {mergeStep === 'result' && (
              <button
                type="button"
                onClick={handleClose}
                className="btn-primary"
              >
                完成
              </button>
            )}
            
            {mergeStep === 'analysis' && diffAnalysis && (
              <button
                type="button"
                onClick={() => setMergeStep('review')}
                className="btn-primary flex items-center gap-2"
              >
                继续查看详情
              </button>
            )}
            {mergeStep === 'review' && (
              <button
                type="button"
                onClick={handleMerge}
                disabled={isProcessing}
                className="btn-primary flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    合并中...
                  </>
                ) : (
                  <>
                    <GitMerge className="w-4 h-4" />
                    执行合并
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
