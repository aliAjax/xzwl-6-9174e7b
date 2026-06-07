import { useState, useMemo } from 'react';
import { Package, MapPin, Camera, Check, ChevronDown, ChevronUp, Calendar, ClipboardList } from 'lucide-react';
import type { Box, Specimen, CollectionBatch } from '../types';
import { formatDate } from '../utils/helpers';

interface PhotographyTaskListProps {
  specimens: Specimen[];
  boxes: Box[];
  batches: CollectionBatch[];
  onTogglePhotographed: (id: string) => void;
  onMarkPhotographed: (ids: string[]) => void;
}

type GroupBy = 'box' | 'location';

interface GroupItem {
  key: string;
  label: string;
  subtitle?: string;
  specimens: Specimen[];
}

export function PhotographyTaskList({
  specimens,
  boxes,
  batches,
  onTogglePhotographed,
  onMarkPhotographed,
}: PhotographyTaskListProps) {
  const [groupBy, setGroupBy] = useState<GroupBy>('box');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const unphotographedSpecimens = useMemo(() => {
    return specimens.filter(s => !s.photographed);
  }, [specimens]);

  const groups = useMemo((): GroupItem[] => {
    if (groupBy === 'box') {
      const grouped = new Map<string, Specimen[]>();
      const unassigned: Specimen[] = [];

      unphotographedSpecimens.forEach(s => {
        if (s.boxId) {
          if (!grouped.has(s.boxId)) {
            grouped.set(s.boxId, []);
          }
          grouped.get(s.boxId)!.push(s);
        } else {
          unassigned.push(s);
        }
      });

      const result: GroupItem[] = [];

      if (unassigned.length > 0) {
        result.push({
          key: '__unassigned__',
          label: '未分配展盒',
          subtitle: '草稿标本',
          specimens: unassigned,
        });
      }

      boxes.forEach(box => {
        if (grouped.has(box.id)) {
          result.push({
            key: box.id,
            label: box.name,
            subtitle: box.location,
            specimens: grouped.get(box.id)!,
          });
        }
      });

      return result;
    } else {
      const grouped = new Map<string, Specimen[]>();
      const unknown: Specimen[] = [];

      unphotographedSpecimens.forEach(s => {
        const location = s.collectionLocation?.trim();
        if (location) {
          if (!grouped.has(location)) {
            grouped.set(location, []);
          }
          grouped.get(location)!.push(s);
        } else {
          unknown.push(s);
        }
      });

      const result: GroupItem[] = Array.from(grouped.entries()).map(([location, specs]) => ({
        key: location,
        label: location,
        subtitle: `${specs.length} 件标本`,
        specimens: specs,
      }));

      if (unknown.length > 0) {
        result.unshift({
          key: '__unknown__',
          label: '未填写采集地点',
          subtitle: `${unknown.length} 件标本`,
          specimens: unknown,
        });
      }

      return result.sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));
    }
  }, [unphotographedSpecimens, groupBy, boxes]);

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleSelectSpecimen = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectGroup = (specimens: Specimen[]) => {
    const allSelected = specimens.every(s => selectedIds.has(s.id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      specimens.forEach(s => {
        if (allSelected) {
          next.delete(s.id);
        } else {
          next.add(s.id);
        }
      });
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === unphotographedSpecimens.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unphotographedSpecimens.map(s => s.id)));
    }
  };

  const handleMarkSelected = () => {
    if (selectedIds.size === 0) return;
    if (confirm(`确定将选中的 ${selectedIds.size} 件标本标记为已拍照吗？`)) {
      onMarkPhotographed(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  const handleMarkGroup = (specimens: Specimen[]) => {
    if (confirm(`确定将本组 ${specimens.length} 件标本全部标记为已拍照吗？`)) {
      onMarkPhotographed(specimens.map(s => s.id));
    }
  };

  const getBoxById = (id: string) => boxes.find(b => b.id === id);
  const getBatchById = (id: string) => batches.find(b => b.id === id);

  if (unphotographedSpecimens.length === 0) {
    return (
      <div className="card p-16 text-center animate-fade-in-up">
        <Camera className="w-20 h-20 text-moss-300 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-oak-700 font-serif mb-2">
          太棒了！所有标本都已拍照
        </h3>
        <p className="text-oak-500">
          暂无待拍照的标本任务
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card p-6 animate-fade-in-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-rust-100 flex items-center justify-center">
              <Camera className="w-6 h-6 text-rust-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-oak-800 font-serif">
                拍照任务清单
              </h2>
              <p className="text-sm text-oak-500">
                共 <span className="font-semibold text-rust-600">{unphotographedSpecimens.length}</span> 件标本待拍照
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm text-oak-600">分组方式：</span>
              <div className="flex rounded-md overflow-hidden border border-oak-300">
                <button
                  type="button"
                  onClick={() => setGroupBy('box')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                    groupBy === 'box'
                      ? 'bg-oak-700 text-parchment-50'
                      : 'bg-parchment-50 text-oak-600 hover:bg-oak-100'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  按展盒
                </button>
                <button
                  type="button"
                  onClick={() => setGroupBy('location')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                    groupBy === 'location'
                      ? 'bg-oak-700 text-parchment-50'
                      : 'bg-parchment-50 text-oak-600 hover:bg-oak-100'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  按地点
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={selectAll}
              className="text-sm text-oak-600 hover:text-oak-800 font-medium"
            >
              {selectedIds.size === unphotographedSpecimens.length ? '取消全选' : '全选'}
            </button>
            <button
              type="button"
              onClick={handleMarkSelected}
              disabled={selectedIds.size === 0}
              className={`btn-primary flex items-center gap-2 ${
                selectedIds.size === 0 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <Check className="w-4 h-4" />
              {selectedIds.size > 0 ? `标记 ${selectedIds.size} 件为已拍照` : '标记选中为已拍照'}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {groups.map((group, groupIndex) => {
          const isExpanded = expandedGroups.has(group.key);
          const allInGroupSelected = group.specimens.every(s => selectedIds.has(s.id));
          const someInGroupSelected = group.specimens.some(s => selectedIds.has(s.id));

          return (
            <section
              key={group.key}
              className="opacity-0 animate-fade-in-up"
              style={{ animationDelay: `${groupIndex * 0.1 + 0.2}s` }}
            >
              <div className="card overflow-hidden">
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-oak-50 transition-colors"
                  onClick={() => toggleGroup(group.key)}
                >
                  <div className="w-10 h-10 rounded-lg bg-oak-100 flex items-center justify-center flex-shrink-0">
                    {groupBy === 'box' ? (
                      <Package className="w-5 h-5 text-oak-700" />
                    ) : (
                      <MapPin className="w-5 h-5 text-oak-700" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-oak-800 font-serif decorative-underline">
                        {group.label}
                      </h3>
                      <span className="tag bg-rust-100 text-rust-700">
                        {group.specimens.length} 件待拍照
                      </span>
                    </div>
                    {group.subtitle && (
                      <p className="text-sm text-oak-500 mt-1">
                        {group.subtitle}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelectGroup(group.specimens);
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-oak-600 hover:text-oak-800 hover:bg-oak-100 rounded-md transition-colors"
                    >
                      <div
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                          allInGroupSelected
                            ? 'bg-oak-700 border-oak-700'
                            : someInGroupSelected
                            ? 'border-oak-400'
                            : 'border-oak-300'
                        }`}
                      >
                        {allInGroupSelected && <Check className="w-3 h-3 text-parchment-50" />}
                        {someInGroupSelected && !allInGroupSelected && (
                          <div className="w-2 h-0.5 bg-oak-500" />
                        )}
                      </div>
                      本组全选
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkGroup(group.specimens);
                      }}
                      className="btn-secondary text-sm py-1.5 px-3 flex items-center gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      全部标记
                    </button>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-oak-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-oak-400" />
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-oak-100">
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {group.specimens.map((specimen, idx) => {
                        const isSelected = selectedIds.has(specimen.id);
                        const box = specimen.boxId ? getBoxById(specimen.boxId) : null;
                        const batch = specimen.batchId ? getBatchById(specimen.batchId) : null;

                        return (
                          <div
                            key={specimen.id}
                            className={`card p-4 opacity-0 animate-fade-in-up ${
                              isSelected ? 'ring-2 ring-oak-500' : ''
                            }`}
                            style={{ animationDelay: `${idx * 0.03}s` }}
                          >
                            <div className="flex items-start gap-3">
                              <button
                                type="button"
                                onClick={() => toggleSelectSpecimen(specimen.id)}
                                className="mt-1 flex-shrink-0"
                              >
                                <div
                                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                    isSelected
                                      ? 'bg-oak-700 border-oak-700'
                                      : 'border-oak-300 hover:border-oak-500'
                                  }`}
                                >
                                  {isSelected && (
                                    <Check className="w-3.5 h-3.5 text-parchment-500" />
                                  )}
                                </div>
                              </button>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="inline-block px-2 py-1 bg-oak-100 text-oak-700 text-xs font-mono rounded">
                                    {specimen.specimenNo}
                                  </span>
                                </div>
                                <h4 className="font-semibold text-oak-900 font-serif leading-tight mb-2">
                                  {specimen.species || (
                                    <span className="text-oak-400 italic">待鉴定物种...</span>
                                  )}
                                </h4>
                                <div className="space-y-1 text-sm text-oak-600">
                                  <div className="flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 text-oak-400 flex-shrink-0" />
                                    <span className="truncate">
                                      {specimen.collectionLocation || (
                                        <span className="text-oak-400 italic">未填写</span>
                                      )}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-oak-400 flex-shrink-0" />
                                    <span>{formatDate(specimen.collectionDate)}</span>
                                  </div>
                                  {box && groupBy !== 'box' && (
                                    <div className="flex items-center gap-1.5">
                                      <Package className="w-3.5 h-3.5 text-oak-400 flex-shrink-0" />
                                      <span className="truncate">{box.name}</span>
                                    </div>
                                  )}
                                  {batch && (
                                    <div className="flex items-center gap-1.5">
                                      <ClipboardList className="w-3.5 h-3.5 text-moss-500 flex-shrink-0" />
                                      <span className="truncate font-medium text-moss-700">
                                        {batch.name}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                {specimen.notes && (
                                  <p className="text-xs text-oak-500 mt-2 line-clamp-2 italic">
                                    "{specimen.notes}"
                                  </p>
                                )}
                                <div className="mt-3 pt-3 border-t border-oak-100">
                                  <button
                                    type="button"
                                    onClick={() => onTogglePhotographed(specimen.id)}
                                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-rust-100 text-rust-700 rounded-md text-sm font-medium hover:bg-rust-200 transition-colors"
                                  >
                                    <Camera className="w-3.5 h-3.5" />
                                    标记为已拍照
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
