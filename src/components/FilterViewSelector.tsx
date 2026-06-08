import { useState, useRef, useEffect } from 'react';
import { BookmarkPlus, BookOpen, Trash2, Edit2, Check, X, ChevronDown } from 'lucide-react';
import type { FilterView, Filters } from '../types';
import { COMPLIANCE_STATUS_OPTIONS } from '../types';

interface FilterViewSelectorProps {
  views: FilterView[];
  currentFilters: Filters;
  activeViewId: string | null;
  onSelectView: (view: FilterView) => void;
  onSaveView: () => void;
  onDeleteView: (id: string) => void;
  onUpdateView: (view: FilterView) => void;
  boxes: Array<{ id: string; name: string }>;
  batches: Array<{ id: string; name: string }>;
}

export function FilterViewSelector({
  views,
  currentFilters,
  activeViewId,
  onSelectView,
  onSaveView,
  onDeleteView,
  onUpdateView,
  boxes,
  batches,
}: FilterViewSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setEditingId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getBoxName = (id: string) => {
    if (id === '__unassigned__') return '未分配展盒';
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

  const getFilterDescription = (filters: Filters): string => {
    const parts: string[] = [];

    if (filters.search) parts.push(`"${filters.search}"`);
    if (filters.onlyUnphotographed) parts.push('未拍照');
    if (filters.boxId) parts.push(getBoxName(filters.boxId));
    if (filters.batchId) parts.push(getBatchName(filters.batchId));
    if (filters.complianceStatus) parts.push(getComplianceLabel(filters.complianceStatus));
    if (filters.onlyHighRisk) parts.push('高风险');

    return parts.length > 0 ? parts.join(' · ') : '全部标本';
  };

  const activeView = views.find(v => v.id === activeViewId);

  const handleRenameStart = (view: FilterView) => {
    setEditingId(view.id);
    setEditingName(view.name);
  };

  const handleRenameSubmit = (id: string) => {
    const trimmedName = editingName.trim();
    if (trimmedName && trimmedName !== views.find(v => v.id === id)?.name) {
      const view = views.find(v => v.id === id);
      if (view) {
        onUpdateView({ ...view, name: trimmedName });
      }
    }
    setEditingId(null);
    setEditingName('');
  };

  const handleRenameCancel = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      handleRenameSubmit(id);
    } else if (e.key === 'Escape') {
      handleRenameCancel();
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-4 py-2 bg-parchment-50 border-2 border-oak-200 rounded-md hover:border-oak-300 transition-all duration-200 text-sm font-medium text-oak-700 min-w-[180px] justify-between"
        >
          <span className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-oak-500" />
            {activeView ? (
              <span className="font-medium text-oak-800">{activeView.name}</span>
            ) : (
              <span className="text-oak-500">常用视图</span>
            )}
          </span>
          <ChevronDown className={`w-4 h-4 text-oak-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        <button
          type="button"
          onClick={onSaveView}
          className="flex items-center gap-1.5 px-3 py-2 bg-oak-100 text-oak-700 rounded-md hover:bg-oak-200 transition-colors text-sm font-medium"
          title="保存当前筛选为视图"
        >
          <BookmarkPlus className="w-4 h-4" />
          保存视图
        </button>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-[320px] bg-white border border-oak-200 rounded-xl shadow-hover z-40 overflow-hidden">
          <div className="px-4 py-3 bg-oak-50 border-b border-oak-200">
            <h4 className="text-sm font-semibold text-oak-700">常用筛选视图</h4>
          </div>

          {views.length === 0 ? (
            <div className="p-6 text-center">
              <BookOpen className="w-10 h-10 text-oak-300 mx-auto mb-2" />
              <p className="text-sm text-oak-500">暂无保存的视图</p>
              <p className="text-xs text-oak-400 mt-1">调整筛选条件后点击"保存视图"</p>
            </div>
          ) : (
            <ul className="max-h-[320px] overflow-y-auto scrollbar-thin">
              {views.map(view => (
                <li
                  key={view.id}
                  className={`group border-b border-oak-100 last:border-b-0 ${
                    activeViewId === view.id ? 'bg-oak-50' : 'hover:bg-oak-50'
                  }`}
                >
                  {editingId === view.id ? (
                    <div className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, view.id)}
                          className="flex-1 px-2 py-1 text-sm border border-oak-300 rounded focus:outline-none focus:border-moss-500"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleRenameSubmit(view.id)}
                          className="p-1 text-moss-600 hover:bg-moss-50 rounded"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={handleRenameCancel}
                          className="p-1 text-oak-500 hover:bg-oak-100 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectView(view);
                            setIsOpen(false);
                          }}
                          className="flex-1 text-left min-w-0"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                activeViewId === view.id ? 'bg-moss-500' : 'bg-oak-300'
                              }`}
                            />
                            <span
                              className={`text-sm font-medium truncate ${
                                activeViewId === view.id ? 'text-moss-700' : 'text-oak-800'
                              }`}
                            >
                              {view.name}
                            </span>
                          </div>
                          <div className="ml-4 mt-1 text-xs text-oak-500 truncate">
                            {getFilterDescription(view.filters)}
                          </div>
                        </button>

                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRenameStart(view);
                            }}
                            className="p-1.5 text-oak-400 hover:text-oak-600 hover:bg-oak-100 rounded transition-colors"
                            title="重命名"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`确定要删除视图 "${view.name}" 吗？`)) {
                                onDeleteView(view.id);
                              }
                            }}
                            className="p-1.5 text-oak-400 hover:text-rust-600 hover:bg-rust-50 rounded transition-colors"
                            title="删除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="px-4 py-3 bg-oak-50 border-t border-oak-200">
            <div className="text-xs text-oak-500">
              <div className="flex items-center justify-between">
                <span>当前筛选:</span>
                <span className="text-oak-600 ml-2 text-right truncate">
                  {getFilterDescription(currentFilters)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
