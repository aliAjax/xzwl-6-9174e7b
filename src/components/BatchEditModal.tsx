import { useState, useMemo } from 'react';
import { X, Edit3, Check, MapPin, Calendar, ClipboardList, Search, Filter, AlertTriangle, ChevronRight } from 'lucide-react';
import type { Box, Specimen, CollectionBatch, Filters, BatchEditData, BatchEditField, BatchEditFieldChange } from '../types';
import { COMPLIANCE_STATUS_OPTIONS, BATCH_EDIT_FIELD_LABELS } from '../types';
import { formatDate } from '../utils/helpers';

interface BatchEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  boxes: Box[];
  specimens: Specimen[];
  batches: CollectionBatch[];
  currentFilters: Filters;
  filteredSpecimens: Specimen[];
  onBatchEdit: (specimenIds: string[], data: BatchEditData) => void;
}

type SelectionMode = 'filtered' | 'manual';

const UNASSIGNED_BOX_SELECT_VALUE = '__unassigned__';

export function BatchEditModal({
  isOpen,
  onClose,
  boxes,
  specimens,
  batches,
  currentFilters,
  filteredSpecimens,
  onBatchEdit,
}: BatchEditModalProps) {
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('filtered');
  const [selectedSpecimenIds, setSelectedSpecimenIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const [editData, setEditData] = useState<{
    photographed: { enabled: boolean; value: boolean };
    pinnedStatus: { enabled: boolean; value: boolean };
    boxId: { enabled: boolean; value: string };
    batchId: { enabled: boolean; value: string };
    complianceStatus: { enabled: boolean; value: string };
  }>({
    photographed: { enabled: false, value: true },
    pinnedStatus: { enabled: false, value: true },
    boxId: { enabled: false, value: '' },
    batchId: { enabled: false, value: '' },
    complianceStatus: { enabled: false, value: '' },
  });

  const hasActiveFilters = currentFilters.search || currentFilters.onlyUnphotographed || currentFilters.boxId || currentFilters.batchId || currentFilters.complianceStatus || currentFilters.onlyHighRisk;

  const allBoxes = useMemo(() => {
    const unassignedExists = specimens.some(s => !s.boxId);
    const result = [...boxes];
    if (unassignedExists) {
      return [{ id: '', name: '未分配展盒', location: '', notes: '', createdAt: '' }, ...result];
    }
    return result;
  }, [boxes, specimens]);

  const targetSpecimens = useMemo(() => {
    if (selectionMode === 'filtered') {
      return filteredSpecimens;
    }
    return specimens.filter(s => selectedSpecimenIds.has(s.id));
  }, [selectionMode, filteredSpecimens, specimens, selectedSpecimenIds]);

  const filteredManualSpecimens = useMemo(() => {
    if (!searchQuery.trim()) return specimens;
    const query = searchQuery.toLowerCase();
    return specimens.filter(s =>
      s.specimenNo.toLowerCase().includes(query) ||
      s.species.toLowerCase().includes(query)
    );
  }, [specimens, searchQuery]);

  const hasAnyFieldEnabled = Object.values(editData).some(v => v.enabled);

  const fieldChanges = useMemo((): BatchEditFieldChange[] => {
    if (!hasAnyFieldEnabled) return [];
    
    const changes: BatchEditFieldChange[] = [];

    if (editData.photographed.enabled) {
      const oldCount = targetSpecimens.filter(s => s.photographed !== editData.photographed.value).length;
      if (oldCount > 0) {
        changes.push({
          field: 'photographed',
          fieldLabel: BATCH_EDIT_FIELD_LABELS.photographed,
          oldValue: targetSpecimens.filter(s => !s.photographed).length > targetSpecimens.filter(s => s.photographed).length ? '多数未拍照' : '多数已拍照',
          newValue: editData.photographed.value ? '已拍照' : '未拍照',
          affectedCount: oldCount,
        });
      }
    }

    if (editData.pinnedStatus.enabled) {
      const oldCount = targetSpecimens.filter(s => s.pinnedStatus !== editData.pinnedStatus.value).length;
      if (oldCount > 0) {
        changes.push({
          field: 'pinnedStatus',
          fieldLabel: BATCH_EDIT_FIELD_LABELS.pinnedStatus,
          oldValue: targetSpecimens.filter(s => !s.pinnedStatus).length > targetSpecimens.filter(s => s.pinnedStatus).length ? '多数未针插' : '多数已针插',
          newValue: editData.pinnedStatus.value ? '已针插' : '未针插',
          affectedCount: oldCount,
        });
      }
    }

    if (editData.boxId.enabled && editData.boxId.value) {
      const targetBoxId = editData.boxId.value === UNASSIGNED_BOX_SELECT_VALUE ? '' : editData.boxId.value;
      const oldCount = targetSpecimens.filter(s => s.boxId !== targetBoxId).length;
      const targetBox = allBoxes.find(b => b.id === targetBoxId);
      if (oldCount > 0) {
        changes.push({
          field: 'boxId',
          fieldLabel: BATCH_EDIT_FIELD_LABELS.boxId,
          oldValue: '当前展盒分布',
          newValue: targetBox ? targetBox.name : '未分配展盒',
          affectedCount: oldCount,
        });
      }
    }

    if (editData.batchId.enabled && editData.batchId.value) {
      const targetBatchId = editData.batchId.value === '__unassigned__' ? '' : editData.batchId.value;
      const oldCount = targetSpecimens.filter(s => s.batchId !== targetBatchId).length;
      const targetBatch = batches.find(b => b.id === targetBatchId);
      if (oldCount > 0) {
        changes.push({
          field: 'batchId',
          fieldLabel: BATCH_EDIT_FIELD_LABELS.batchId,
          oldValue: '当前批次分布',
          newValue: targetBatch ? targetBatch.name : '未关联批次',
          affectedCount: oldCount,
        });
      }
    }

    if (editData.complianceStatus.enabled && editData.complianceStatus.value) {
      const oldCount = targetSpecimens.filter(s => s.complianceStatus !== editData.complianceStatus.value).length;
      const targetStatus = COMPLIANCE_STATUS_OPTIONS.find(o => o.value === editData.complianceStatus.value);
      if (oldCount > 0) {
        changes.push({
          field: 'complianceStatus',
          fieldLabel: BATCH_EDIT_FIELD_LABELS.complianceStatus,
          oldValue: '当前状态分布',
          newValue: targetStatus ? targetStatus.label : editData.complianceStatus.value,
          affectedCount: oldCount,
        });
      }
    }

    return changes;
  }, [editData, targetSpecimens, allBoxes, batches, hasAnyFieldEnabled]);



  const toggleSelectSpecimen = (id: string) => {
    setSelectedSpecimenIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedSpecimenIds(new Set(filteredSpecimens.map(s => s.id)));
  };

  const selectAllManual = () => {
    setSelectedSpecimenIds(new Set(filteredManualSpecimens.map(s => s.id)));
  };

  const clearSelection = () => {
    setSelectedSpecimenIds(new Set());
  };

  const handleFieldToggle = (field: BatchEditField) => {
    setEditData(prev => ({
      ...prev,
      [field]: { ...prev[field], enabled: !prev[field].enabled },
    }));
  };

  const handleFieldValueChange = (field: BatchEditField, value: string | boolean) => {
    setEditData(prev => ({
      ...prev,
      [field]: { ...prev[field], value },
    }));
  };

  const handleSubmit = () => {
    if (targetSpecimens.length === 0) return;
    if (!hasAnyFieldEnabled) return;
    setShowConfirm(true);
  };

  const handleConfirmSubmit = () => {
    const data: BatchEditData = {};
    
    if (editData.photographed.enabled) {
      data.photographed = editData.photographed.value;
    }
    if (editData.pinnedStatus.enabled) {
      data.pinnedStatus = editData.pinnedStatus.value;
    }
    if (editData.boxId.enabled && editData.boxId.value) {
      data.boxId = editData.boxId.value === UNASSIGNED_BOX_SELECT_VALUE ? '' : editData.boxId.value;
    }
    if (editData.batchId.enabled && editData.batchId.value) {
      data.batchId = editData.batchId.value === '__unassigned__' ? '' : editData.batchId.value;
    }
    if (editData.complianceStatus.enabled && editData.complianceStatus.value) {
      data.complianceStatus = editData.complianceStatus.value as Parameters<typeof onBatchEdit>[1]['complianceStatus'];
    }

    onBatchEdit(targetSpecimens.map(s => s.id), data);
    
    setShowConfirm(false);
    setSelectedSpecimenIds(new Set());
    setSearchQuery('');
    setEditData({
      photographed: { enabled: false, value: true },
      pinnedStatus: { enabled: false, value: true },
      boxId: { enabled: false, value: '' },
      batchId: { enabled: false, value: '' },
      complianceStatus: { enabled: false, value: '' },
    });
    onClose();
  };

  const getBatchById = (id: string) => batches.find(b => b.id === id);

  const canSubmit = targetSpecimens.length > 0 && hasAnyFieldEnabled && fieldChanges.length > 0;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-oak-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-parchment-50 rounded-xl shadow-hover max-w-5xl w-full max-h-[85vh] overflow-hidden animate-scale-in flex flex-col">
        <div className="bg-parchment-50 border-b border-oak-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-oak-100 flex items-center justify-center">
              <Edit3 className="w-5 h-5 text-oak-700" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-oak-800 font-serif">
                批量编辑标本
              </h2>
              <p className="text-sm text-oak-500">
                批量修改标本的拍照状态、针插状态、所属展盒等字段
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-oak-100 text-oak-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
          <div className="space-y-3">
            <label className="block text-sm font-medium text-oak-700">
              选择标本范围
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setSelectionMode('filtered')}
                className={`flex-1 p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                  selectionMode === 'filtered'
                    ? 'bg-oak-50 border-oak-500'
                    : 'bg-parchment-50 border-oak-200 hover:border-oak-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Filter className={`w-5 h-5 ${selectionMode === 'filtered' ? 'text-oak-700' : 'text-oak-400'}`} />
                  <span className={`font-semibold ${selectionMode === 'filtered' ? 'text-oak-800' : 'text-oak-600'}`}>
                    使用当前筛选结果
                  </span>
                </div>
                <p className="text-sm text-oak-500 pl-7">
                  将应用到当前筛选条件匹配的 <strong className="text-oak-700">{filteredSpecimens.length}</strong> 件标本
                </p>
              </button>
              <button
                type="button"
                onClick={() => setSelectionMode('manual')}
                className={`flex-1 p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                  selectionMode === 'manual'
                    ? 'bg-oak-50 border-oak-500'
                    : 'bg-parchment-50 border-oak-200 hover:border-oak-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Check className={`w-5 h-5 ${selectionMode === 'manual' ? 'text-oak-700' : 'text-oak-400'}`} />
                  <span className={`font-semibold ${selectionMode === 'manual' ? 'text-oak-800' : 'text-oak-600'}`}>
                    手动勾选标本
                  </span>
                </div>
                <p className="text-sm text-oak-500 pl-7">
                  手动选择要修改的标本，已选 <strong className="text-oak-700">{selectedSpecimenIds.size}</strong> 件
                </p>
              </button>
            </div>
          </div>

          {selectionMode === 'manual' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-oak-800 font-serif">
                    选择要编辑的标本
                  </h3>
                  <span className="tag bg-oak-100 text-oak-700">
                    共 {filteredManualSpecimens.length} 件
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={selectAllFiltered}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-oak-100 text-oak-700 rounded-md hover:bg-oak-200 transition-colors"
                    >
                      <Filter className="w-4 h-4" />
                      选择当前筛选结果 ({filteredSpecimens.length} 件)
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={selectAllManual}
                    className="text-sm text-oak-600 hover:text-oak-800 font-medium"
                  >
                    全选
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="text-sm text-oak-600 hover:text-oak-800 font-medium"
                  >
                    清空
                  </button>
                </div>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-oak-400" />
                <input
                  type="text"
                  placeholder="搜索标本编号或物种名..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field pl-10"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto p-1">
                {filteredManualSpecimens.map((specimen, idx) => {
                  const isSelected = selectedSpecimenIds.has(specimen.id);
                  const batch = specimen.batchId ? getBatchById(specimen.batchId) : null;

                  return (
                    <div
                      key={specimen.id}
                      className={`card p-3 cursor-pointer transition-all ${
                        isSelected ? 'ring-2 ring-oak-500 bg-oak-50' : 'hover:bg-oak-50'
                      }`}
                      onClick={() => toggleSelectSpecimen(specimen.id)}
                      style={{ animationDelay: `${idx * 0.02}s` }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                            isSelected
                              ? 'bg-oak-700 border-oak-700'
                              : 'border-oak-300 hover:border-oak-500'
                          }`}
                        >
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-parchment-50" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="inline-block px-2 py-0.5 bg-oak-100 text-oak-700 text-xs font-mono rounded">
                              {specimen.specimenNo}
                            </span>
                          </div>
                          <h4 className="font-semibold text-oak-900 font-serif text-sm leading-tight mb-1">
                            {specimen.species || (
                              <span className="text-oak-400 italic">待鉴定物种...</span>
                            )}
                          </h4>
                          <div className="space-y-0.5 text-xs text-oak-600">
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-oak-400 flex-shrink-0" />
                              <span className="truncate">
                                {specimen.collectionLocation || (
                                  <span className="text-oak-400 italic">未填写</span>
                                )}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-oak-400 flex-shrink-0" />
                              <span>{formatDate(specimen.collectionDate)}</span>
                            </div>
                            {batch && (
                              <div className="flex items-center gap-1">
                                <ClipboardList className="w-3 h-3 text-moss-500 flex-shrink-0" />
                                <span className="truncate font-medium text-moss-700">
                                  {batch.name}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <label className="block text-sm font-medium text-oak-700">
              选择要修改的字段
            </label>
            <div className="space-y-3">
              <label className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                editData.photographed.enabled ? 'bg-oak-50 border-oak-500' : 'bg-parchment-50 border-oak-200 hover:border-oak-300'
              }`}>
                <input
                  type="checkbox"
                  checked={editData.photographed.enabled}
                  onChange={() => handleFieldToggle('photographed')}
                  className="w-5 h-5 rounded border-oak-300 text-oak-800 focus:ring-oak-500"
                />
                <span className="font-medium text-oak-800 flex-1">
                  拍照状态
                </span>
                <select
                  value={editData.photographed.value ? 'true' : 'false'}
                  onChange={(e) => handleFieldValueChange('photographed', e.target.value === 'true')}
                  disabled={!editData.photographed.enabled}
                  className={`input-field max-w-36 text-sm ${!editData.photographed.enabled ? 'opacity-50' : ''}`}
                >
                  <option value="true">已拍照</option>
                  <option value="false">未拍照</option>
                </select>
              </label>

              <label className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                editData.pinnedStatus.enabled ? 'bg-oak-50 border-oak-500' : 'bg-parchment-50 border-oak-200 hover:border-oak-300'
              }`}>
                <input
                  type="checkbox"
                  checked={editData.pinnedStatus.enabled}
                  onChange={() => handleFieldToggle('pinnedStatus')}
                  className="w-5 h-5 rounded border-oak-300 text-oak-800 focus:ring-oak-500"
                />
                <span className="font-medium text-oak-800 flex-1">
                  针插状态
                </span>
                <select
                  value={editData.pinnedStatus.value ? 'true' : 'false'}
                  onChange={(e) => handleFieldValueChange('pinnedStatus', e.target.value === 'true')}
                  disabled={!editData.pinnedStatus.enabled}
                  className={`input-field max-w-36 text-sm ${!editData.pinnedStatus.enabled ? 'opacity-50' : ''}`}
                >
                  <option value="true">已针插</option>
                  <option value="false">未针插</option>
                </select>
              </label>

              <label className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                editData.boxId.enabled ? 'bg-oak-50 border-oak-500' : 'bg-parchment-50 border-oak-200 hover:border-oak-300'
              }`}>
                <input
                  type="checkbox"
                  checked={editData.boxId.enabled}
                  onChange={() => handleFieldToggle('boxId')}
                  className="w-5 h-5 rounded border-oak-300 text-oak-800 focus:ring-oak-500"
                />
                <span className="font-medium text-oak-800 flex-1">
                  所属展盒
                </span>
                <select
                  value={editData.boxId.value}
                  onChange={(e) => handleFieldValueChange('boxId', e.target.value)}
                  disabled={!editData.boxId.enabled}
                  className={`input-field max-w-48 text-sm ${!editData.boxId.enabled ? 'opacity-50' : ''}`}
                >
                  <option value="">请选择目标展盒</option>
                  <option value={UNASSIGNED_BOX_SELECT_VALUE}>未分配展盒</option>
                  {boxes.map((box) => (
                    <option key={box.id} value={box.id}>
                      {box.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                editData.batchId.enabled ? 'bg-oak-50 border-oak-500' : 'bg-parchment-50 border-oak-200 hover:border-oak-300'
              }`}>
                <input
                  type="checkbox"
                  checked={editData.batchId.enabled}
                  onChange={() => handleFieldToggle('batchId')}
                  className="w-5 h-5 rounded border-oak-300 text-oak-800 focus:ring-oak-500"
                />
                <span className="font-medium text-oak-800 flex-1">
                  所属采集批次
                </span>
                <select
                  value={editData.batchId.value}
                  onChange={(e) => handleFieldValueChange('batchId', e.target.value)}
                  disabled={!editData.batchId.enabled}
                  className={`input-field max-w-48 text-sm ${!editData.batchId.enabled ? 'opacity-50' : ''}`}
                >
                  <option value="">请选择目标批次</option>
                  <option value="__unassigned__">未关联批次</option>
                  {batches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                editData.complianceStatus.enabled ? 'bg-oak-50 border-oak-500' : 'bg-parchment-50 border-oak-200 hover:border-oak-300'
              }`}>
                <input
                  type="checkbox"
                  checked={editData.complianceStatus.enabled}
                  onChange={() => handleFieldToggle('complianceStatus')}
                  className="w-5 h-5 rounded border-oak-300 text-oak-800 focus:ring-oak-500"
                />
                <span className="font-medium text-oak-800 flex-1">
                  合规状态
                </span>
                <select
                  value={editData.complianceStatus.value}
                  onChange={(e) => handleFieldValueChange('complianceStatus', e.target.value)}
                  disabled={!editData.complianceStatus.enabled}
                  className={`input-field max-w-48 text-sm ${!editData.complianceStatus.enabled ? 'opacity-50' : ''}`}
                >
                  <option value="">请选择目标状态</option>
                  {COMPLIANCE_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {targetSpecimens.length > 0 && fieldChanges.length > 0 && (
            <div className="p-4 bg-oak-50 rounded-xl border border-oak-200">
              <h3 className="text-lg font-semibold text-oak-800 font-serif mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                变更预览
              </h3>
              <div className="space-y-2 mb-3">
                <div className="flex items-center justify-between p-3 bg-parchment-50 rounded-lg">
                  <span className="text-sm text-oak-600">影响标本数量</span>
                  <span className="font-semibold text-oak-800 text-lg">{targetSpecimens.length} 件</span>
                </div>
                {fieldChanges.map((change) => (
                  <div key={change.field} className="p-3 bg-parchment-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-oak-700">{change.fieldLabel}</span>
                        <ChevronRight className="w-4 h-4 text-oak-400" />
                        <span className="text-sm text-oak-500">{change.oldValue}</span>
                        <ChevronRight className="w-4 h-4 text-oak-400" />
                        <span className="text-sm font-semibold text-oak-800">{change.newValue}</span>
                      </div>
                      <span className="text-xs text-oak-500">{change.affectedCount} 件受影响</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-oak-500">
                <strong>注意：</strong>已与目标值相同的标本将保持不变，不会被重复更新。
              </p>
            </div>
          )}

          {targetSpecimens.length > 0 && hasAnyFieldEnabled && fieldChanges.length === 0 && (
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
              <p className="text-sm text-amber-700">
                <AlertTriangle className="w-4 h-4 inline mr-1" />
                所选字段的目标值与所有选中标本的当前值相同，没有需要变更的内容。
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-oak-200 bg-parchment-100 px-6 py-4 flex items-center justify-between gap-4 flex-shrink-0">
          <div className="text-sm text-oak-600">
            {targetSpecimens.length > 0 && hasAnyFieldEnabled && fieldChanges.length > 0 && (
              <span>
                将修改 <strong className="text-oak-800">{targetSpecimens.length}</strong> 件标本的{' '}
                <strong className="text-oak-800">{fieldChanges.length}</strong> 个字段
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`btn-primary ${
                !canSubmit ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              开始批量编辑
            </button>
          </div>
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-60 p-4">
          <div className="bg-parchment-50 rounded-xl shadow-hover w-full max-w-md animate-scale-in">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-oak-800 font-serif">
                    确认批量编辑
                  </h3>
                  <p className="text-sm text-oak-500">
                    请确认以下批量编辑操作
                  </p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between p-3 bg-oak-50 rounded-lg">
                  <span className="text-sm text-oak-600">标本数量</span>
                  <span className="font-semibold text-oak-800 text-lg">{targetSpecimens.length} 件</span>
                </div>
                <div className="space-y-2">
                  {fieldChanges.map((change) => (
                    <div key={change.field} className="p-3 bg-oak-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-oak-700">{change.fieldLabel}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-oak-500">{change.oldValue}</span>
                          <ChevronRight className="w-4 h-4 text-oak-400" />
                          <span className="text-sm font-semibold text-oak-800">{change.newValue}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-oak-50 rounded-lg mb-6">
                <p className="text-xs text-oak-600">
                  <strong>注意：</strong>此操作将批量更新选中标本的相关字段，更新时间也会一并更新。已与目标值相同的标本将保持不变。此操作不可撤销，请谨慎操作。
                </p>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  className="btn-secondary"
                >
                  返回修改
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSubmit}
                  className="btn-primary"
                >
                  确认编辑
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
