import { useState, useMemo } from 'react';
import { X, Package, ArrowRight, Check, MapPin, Calendar, ClipboardList, Search, Filter, AlertTriangle } from 'lucide-react';
import type { Box, Specimen, CollectionBatch, Filters } from '../types';
import { formatDate } from '../utils/helpers';

interface BoxTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  boxes: Box[];
  specimens: Specimen[];
  batches: CollectionBatch[];
  currentFilters: Filters;
  filteredSpecimens: Specimen[];
  onTransfer: (sourceBoxId: string, targetBoxId: string, specimenIds: string[]) => void;
}

const UNASSIGNED_BOX: Box = {
  id: '',
  name: '未分配展盒',
  location: '草稿标本',
  notes: '暂未指定展盒的标本草稿',
  createdAt: new Date().toISOString(),
};

const UNASSIGNED_BOX_SELECT_VALUE = '__unassigned__';

const getBoxSelectValue = (box: Box) => box.id || UNASSIGNED_BOX_SELECT_VALUE;

const getBoxIdFromSelectValue = (value: string) =>
  value === UNASSIGNED_BOX_SELECT_VALUE ? '' : value;

export function BoxTransferModal({
  isOpen,
  onClose,
  boxes,
  specimens,
  batches,
  currentFilters,
  filteredSpecimens,
  onTransfer,
}: BoxTransferModalProps) {
  const [sourceBoxId, setSourceBoxId] = useState<string>('');
  const [targetBoxId, setTargetBoxId] = useState<string>('');
  const [selectedSpecimenIds, setSelectedSpecimenIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const allBoxes = useMemo(() => {
    const unassignedExists = specimens.some(s => !s.boxId);
    return unassignedExists ? [UNASSIGNED_BOX, ...boxes] : boxes;
  }, [boxes, specimens]);

  const sourceBox = useMemo(() => {
    if (sourceBoxId === UNASSIGNED_BOX_SELECT_VALUE) {
      return allBoxes.find(b => b.id === '') || null;
    }
    return allBoxes.find(b => b.id === sourceBoxId) || null;
  }, [sourceBoxId, allBoxes]);

  const targetBox = useMemo(() => {
    if (targetBoxId === UNASSIGNED_BOX_SELECT_VALUE) {
      return allBoxes.find(b => b.id === '') || null;
    }
    return allBoxes.find(b => b.id === targetBoxId) || null;
  }, [targetBoxId, allBoxes]);

  const availableSpecimens = useMemo(() => {
    const actualSourceBoxId = getBoxIdFromSelectValue(sourceBoxId);
    return specimens.filter(s => s.boxId === actualSourceBoxId);
  }, [specimens, sourceBoxId]);

  const filteredAvailableSpecimens = useMemo(() => {
    if (!searchQuery.trim()) return availableSpecimens;
    const query = searchQuery.toLowerCase();
    return availableSpecimens.filter(s =>
      s.specimenNo.toLowerCase().includes(query) ||
      s.species.toLowerCase().includes(query)
    );
  }, [availableSpecimens, searchQuery]);

  const hasActiveFilters = currentFilters.search || currentFilters.onlyUnphotographed || currentFilters.boxId || currentFilters.batchId;

  const selectAllFromFiltered = () => {
    const actualSourceBoxId = getBoxIdFromSelectValue(sourceBoxId);
    const filteredFromSource = filteredSpecimens.filter(s => s.boxId === actualSourceBoxId);
    setSelectedSpecimenIds(new Set(filteredFromSource.map(s => s.id)));
  };

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

  const selectAll = () => {
    setSelectedSpecimenIds(new Set(filteredAvailableSpecimens.map(s => s.id)));
  };

  const clearSelection = () => {
    setSelectedSpecimenIds(new Set());
  };

  const handleSourceBoxChange = (value: string) => {
    setSourceBoxId(value);
    setSelectedSpecimenIds(new Set());
  };

  const handleTransferClick = () => {
    if (selectedSpecimenIds.size === 0) return;
    if (!sourceBoxId) return;
    if (!targetBoxId) return;
    if (sourceBoxId === targetBoxId) return;
    setShowConfirm(true);
  };

  const handleConfirmTransfer = () => {
    onTransfer(
      getBoxIdFromSelectValue(sourceBoxId),
      getBoxIdFromSelectValue(targetBoxId),
      Array.from(selectedSpecimenIds)
    );
    setShowConfirm(false);
    setSourceBoxId('');
    setTargetBoxId('');
    setSelectedSpecimenIds(new Set());
    setSearchQuery('');
    onClose();
  };

  const getBatchById = (id: string) => batches.find(b => b.id === id);

  const canTransfer = selectedSpecimenIds.size > 0 &&
    sourceBoxId !== '' &&
    sourceBoxId !== targetBoxId &&
    targetBoxId !== '';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-parchment-50 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-fade-in">
        <div className="flex items-center justify-between p-6 border-b border-oak-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-oak-100 flex items-center justify-center">
              <Package className="w-5 h-5 text-oak-700" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-oak-800 font-serif">
                展盒迁移
              </h2>
              <p className="text-sm text-oak-500">
                将一批标本从一个展盒移动到另一个展盒
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-oak-100 text-oak-500 hover:text-oak-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="block text-sm font-medium text-oak-700">
                来源展盒
              </label>
              <select
                value={sourceBoxId}
                onChange={(e) => handleSourceBoxChange(e.target.value)}
                className="input-field"
              >
                <option value="">请选择来源展盒</option>
                {allBoxes.map((box) => (
                  <option key={box.id || UNASSIGNED_BOX_SELECT_VALUE} value={getBoxSelectValue(box)}>
                    {box.name} ({specimens.filter(s => s.boxId === box.id).length} 件标本)
                  </option>
                ))}
              </select>
              {sourceBox && (
                <div className="p-3 bg-oak-50 rounded-lg border border-oak-200">
                  <div className="flex items-center gap-2 text-sm text-oak-600">
                    <MapPin className="w-4 h-4 text-oak-400" />
                    {sourceBox.location}
                  </div>
                  {sourceBox.notes && (
                    <p className="text-xs text-oak-500 mt-2 italic">
                      {sourceBox.notes}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-oak-700">
                目标展盒
              </label>
              <select
                value={targetBoxId}
                onChange={(e) => setTargetBoxId(e.target.value)}
                className="input-field"
              >
                <option value="">请选择目标展盒</option>
                {allBoxes
                  .filter(b => getBoxSelectValue(b) !== sourceBoxId)
                  .map((box) => (
                    <option key={box.id || UNASSIGNED_BOX_SELECT_VALUE} value={getBoxSelectValue(box)}>
                      {box.name} ({specimens.filter(s => s.boxId === box.id).length} 件标本)
                    </option>
                  ))}
              </select>
              {targetBox && (
                <div className="p-3 bg-moss-50 rounded-lg border border-moss-200">
                  <div className="flex items-center gap-2 text-sm text-moss-700">
                    <MapPin className="w-4 h-4 text-moss-500" />
                    {targetBox.location}
                  </div>
                  {targetBox.notes && (
                    <p className="text-xs text-moss-600 mt-2 italic">
                      {targetBox.notes}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {sourceBox ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-oak-800 font-serif">
                    选择要迁移的标本
                  </h3>
                  <span className="tag bg-oak-100 text-oak-700">
                    共 {availableSpecimens.length} 件
                  </span>
                  {selectedSpecimenIds.size > 0 && (
                    <span className="tag bg-rust-100 text-rust-700">
                      已选 {selectedSpecimenIds.size} 件
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={selectAllFromFiltered}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-oak-100 text-oak-700 rounded-md hover:bg-oak-200 transition-colors"
                    >
                      <Filter className="w-4 h-4" />
                      选择当前筛选结果 ({filteredSpecimens.filter(s => s.boxId === getBoxIdFromSelectValue(sourceBoxId)).length} 件)
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={selectAll}
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

              {filteredAvailableSpecimens.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto p-1">
                  {filteredAvailableSpecimens.map((specimen, idx) => {
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
                            {specimen.notes && (
                              <p className="text-xs text-oak-500 mt-1 line-clamp-1 italic">
                                "{specimen.notes}"
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="card p-8 text-center">
                  <Package className="w-12 h-12 text-oak-300 mx-auto mb-2" />
                  <p className="text-oak-500">
                    {searchQuery ? '未找到匹配的标本' : '此展盒暂无标本'}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="card p-8 text-center">
              <Package className="w-12 h-12 text-oak-300 mx-auto mb-2" />
              <p className="text-oak-500">请先选择来源展盒</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-oak-200 bg-parchment-100">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-oak-600">
              {selectedSpecimenIds.size > 0 && sourceBox && targetBox && (
                <span>
                  将 <strong className="text-oak-800">{selectedSpecimenIds.size}</strong> 件标本从{' '}
                  <strong className="text-oak-800">{sourceBox.name}</strong>{' '}
                  <ArrowRight className="w-4 h-4 inline mx-1" />{' '}
                  <strong className="text-moss-700">{targetBox.name}</strong>
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
                onClick={handleTransferClick}
                disabled={!canTransfer}
                className={`btn-primary ${
                  !canTransfer ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                开始迁移
              </button>
            </div>
          </div>
        </div>
      </div>

      {showConfirm && sourceBox && targetBox && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-60 p-4">
          <div className="bg-parchment-50 rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-oak-800 font-serif">
                    确认展盒迁移
                  </h3>
                  <p className="text-sm text-oak-500">
                    请确认以下迁移信息
                  </p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between p-3 bg-oak-50 rounded-lg">
                  <span className="text-sm text-oak-600">来源展盒</span>
                  <span className="font-medium text-oak-800">{sourceBox.name}</span>
                </div>
                <div className="flex justify-center">
                  <ArrowRight className="w-5 h-5 text-oak-400" />
                </div>
                <div className="flex items-center justify-between p-3 bg-moss-50 rounded-lg">
                  <span className="text-sm text-moss-600">目标展盒</span>
                  <span className="font-medium text-moss-800">{targetBox.name}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-rust-50 rounded-lg">
                  <span className="text-sm text-rust-600">迁移数量</span>
                  <span className="font-semibold text-rust-800 text-lg">{selectedSpecimenIds.size} 件标本</span>
                </div>
              </div>

              <div className="p-3 bg-oak-50 rounded-lg mb-6">
                <p className="text-xs text-oak-600">
                  <strong>注意：</strong>迁移后标本的拍照状态、针插状态、备注等信息将保持不变，仅更新展盒归属和更新时间。
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
                  onClick={handleConfirmTransfer}
                  className="btn-primary"
                >
                  确认迁移
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
