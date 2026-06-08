import { AlertTriangle, Search, X } from 'lucide-react';
import type { Box, Filters, CollectionBatch } from '../types';
import { COMPLIANCE_STATUS_OPTIONS } from '../types';

interface FilterBarProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  boxes: Box[];
  batches: CollectionBatch[];
}

export function FilterBar({ filters, onFiltersChange, boxes, batches }: FilterBarProps) {
  const handleSearchChange = (value: string) => {
    onFiltersChange({ ...filters, search: value });
  };

  const handleToggleUnphotographed = () => {
    onFiltersChange({ ...filters, onlyUnphotographed: !filters.onlyUnphotographed });
  };

  const handleBoxChange = (value: string) => {
    onFiltersChange({ ...filters, boxId: value });
  };

  const handleBatchChange = (value: string) => {
    onFiltersChange({ ...filters, batchId: value });
  };

  const handleComplianceChange = (value: string) => {
    onFiltersChange({ ...filters, complianceStatus: value as Filters['complianceStatus'] });
  };

  const handleToggleHighRisk = () => {
    onFiltersChange({ ...filters, onlyHighRisk: !filters.onlyHighRisk });
  };

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      onlyUnphotographed: false,
      boxId: '',
      batchId: '',
      complianceStatus: '',
      onlyHighRisk: false,
    });
  };

  const hasActiveFilters = filters.search || filters.onlyUnphotographed || filters.boxId || filters.batchId || filters.complianceStatus || filters.onlyHighRisk;

  return (
    <div className="bg-parchment-50 border border-oak-200 rounded-xl p-4 shadow-card">
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-oak-400" />
          <input
            type="text"
            placeholder="搜索标本编号或物种名..."
            value={filters.search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="input-field pl-10"
          />
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <button
            type="button"
            onClick={handleToggleUnphotographed}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all duration-200 font-medium text-sm ${
              filters.onlyUnphotographed
                ? 'bg-rust-100 text-rust-800 border-2 border-rust-400'
                : 'bg-parchment-50 text-oak-700 border-2 border-oak-200 hover:border-oak-300'
            }`}
          >
            <span className={`w-4 h-4 rounded-full ${filters.onlyUnphotographed ? 'bg-rust-500' : 'bg-oak-300'}`} />
            只看未拍照
          </button>

          <div className="flex items-center gap-2">
            <label htmlFor="box-filter" className="text-oak-600 text-sm font-medium whitespace-nowrap">
              展盒:
            </label>
            <select
              id="box-filter"
              value={filters.boxId}
              onChange={(e) => handleBoxChange(e.target.value)}
              className="input-field max-w-48"
            >
              <option value="">全部展盒</option>
              <option value="__unassigned__">未分配展盒 (草稿)</option>
              <option value="">---</option>
              {boxes.map((box) => (
                <option key={box.id} value={box.id}>
                  {box.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="batch-filter" className="text-oak-600 text-sm font-medium whitespace-nowrap">
              批次:
            </label>
            <select
              id="batch-filter"
              value={filters.batchId}
              onChange={(e) => handleBatchChange(e.target.value)}
              className="input-field max-w-48"
            >
              <option value="">全部批次</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="compliance-filter" className="text-oak-600 text-sm font-medium whitespace-nowrap">
              合规:
            </label>
            <select
              id="compliance-filter"
              value={filters.complianceStatus}
              onChange={(e) => handleComplianceChange(e.target.value)}
              className="input-field max-w-44"
            >
              <option value="">全部状态</option>
              {COMPLIANCE_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleToggleHighRisk}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all duration-200 font-medium text-sm ${
              filters.onlyHighRisk
                ? 'bg-amber-100 text-amber-800 border-2 border-amber-400'
                : 'bg-parchment-50 text-oak-700 border-2 border-oak-200 hover:border-oak-300'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            只看高风险
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1 text-oak-500 hover:text-oak-700 text-sm font-medium transition-colors"
            >
              <X className="w-4 h-4" />
              清除筛选
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
