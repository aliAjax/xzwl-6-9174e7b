import { useState, useEffect } from 'react';
import { X, Save, Filter } from 'lucide-react';
import type { Filters, FilterView } from '../types';
import { COMPLIANCE_STATUS_OPTIONS } from '../types';

interface SaveViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  currentFilters: Filters;
  views: FilterView[];
  boxes: Array<{ id: string; name: string }>;
  batches: Array<{ id: string; name: string }>;
  existingView?: FilterView | null;
}

export function SaveViewModal({
  isOpen,
  onClose,
  onSave,
  currentFilters,
  views,
  boxes,
  batches,
  existingView,
}: SaveViewModalProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(existingView?.name || '');
      setError('');
    }
  }, [isOpen, existingView]);

  const getBoxName = (id: string) => {
    if (id === '__unassigned__') return '未分配展盒 (草稿)';
    const box = boxes.find(b => b.id === id);
    return box?.name || '未知展盒';
  };

  const getBatchName = (id: string) => {
    const batch = batches.find(b => b.id === id);
    return batch?.name || '未知批次';
  };

  const getComplianceLabel = (status: string) => {
    const option = COMPLIANCE_STATUS_OPTIONS.find(o => o.value === status);
    return option?.label || status;
  };

  const getFilterSummary = () => {
    const parts: string[] = [];
    const f = currentFilters;

    if (f.search) parts.push(`搜索: "${f.search}"`);
    if (f.onlyUnphotographed) parts.push('只看未拍照');
    if (f.boxId) parts.push(`展盒: ${getBoxName(f.boxId)}`);
    if (f.batchId) parts.push(`批次: ${getBatchName(f.batchId)}`);
    if (f.complianceStatus) parts.push(`合规: ${getComplianceLabel(f.complianceStatus)}`);
    if (f.onlyHighRisk) parts.push('只看高风险');

    return parts;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('请输入视图名称');
      return;
    }

    const duplicateName = views.some(
      v => v.name === trimmedName && v.id !== existingView?.id
    );
    if (duplicateName) {
      setError('已存在同名视图，请使用其他名称');
      return;
    }

    onSave(trimmedName);
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const filterSummary = getFilterSummary();

  return (
    <div
      className="fixed inset-0 bg-oak-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-parchment-50 rounded-xl shadow-hover max-w-md w-full overflow-hidden animate-scale-in flex flex-col">
        <div className="bg-parchment-50 border-b border-oak-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <h2 className="text-xl font-semibold text-oak-800 font-serif">
            {existingView ? '更新筛选视图' : '保存为筛选视图'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-oak-100 text-oak-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rust-100 border border-rust-300 text-rust-800 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-oak-700 mb-1.5">
              视图名称 <span className="text-rust-600">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：待拍照标本、高风险标本..."
              className="input-field"
              autoFocus
            />
          </div>

          <div className="p-4 bg-oak-50 border border-oak-200 rounded-xl">
            <h4 className="text-sm font-semibold text-oak-700 mb-3 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              当前筛选条件
            </h4>
            {filterSummary.length > 0 ? (
              <ul className="space-y-1.5">
                {filterSummary.map((part, idx) => (
                  <li key={idx} className="text-sm text-oak-600 flex items-start gap-2">
                    <span className="text-oak-400 mt-0.5">•</span>
                    <span>{part}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-oak-500 italic">无筛选条件（显示全部标本）</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
            >
              取消
            </button>
            <button
              type="submit"
              className="btn-primary flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {existingView ? '更新' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
