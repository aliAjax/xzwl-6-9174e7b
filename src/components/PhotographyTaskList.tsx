import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Package,
  MapPin,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Calendar,
  ClipboardList,
  AlertTriangle,
  Flag,
  StickyNote,
  Edit3,
  X,
  AlertOctagon,
  Layers,
  ArrowLeft,
  Plus,
  Download,
  CheckSquare,
  Clock,
} from 'lucide-react';
import type {
  Box,
  Specimen,
  CollectionBatch,
  PhotographyGroupMetadata,
  PhotographyGroupPriority,
  ComplianceStatus,
  PhotographySession,
  PhotographySessionFormData,
  PhotographySessionTarget,
} from '../types';
import { HIGH_RISK_STATUSES, COMPLIANCE_STATUS_OPTIONS } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { formatDate } from '../utils/helpers';
import { PhotographySessionList } from './PhotographySessionList';
import { PhotographySessionModal } from './PhotographySessionModal';

interface PhotographyTaskListProps {
  specimens: Specimen[];
  boxes: Box[];
  batches: CollectionBatch[];
  onTogglePhotographed: (id: string) => void;
  onMarkPhotographed: (ids: string[]) => void;
  sessions: PhotographySession[];
  activeSessions: PhotographySession[];
  completedSessions: PhotographySession[];
  cancelledSessions: PhotographySession[];
  getSessionProgress: (id: string) => { total: number; completed: number; percentage: number };
  getSessionSpecimens: (id: string) => Specimen[];
  getAvailableTargets: () => {
    boxes: { id: string; name: string; count: number }[];
    batches: { id: string; name: string; count: number }[];
    highRisk: { id: string; name: string; count: number }[];
  };
  getSpecimensForTargets: (targets: PhotographySessionTarget[]) => Specimen[];
  onCreateSession: (data: PhotographySessionFormData) => void;
  onUpdateSession: (id: string, data: Partial<PhotographySessionFormData>) => void;
  onDeleteSession: (id: string) => void;
  onCompleteSession: (id: string) => void;
  onCancelSession: (id: string) => void;
  onReactiveSession: (id: string) => void;
  onExportSession: (id: string) => void;
  updateAllSessionsProgress: () => void;
  updateSessionProgress: (id: string) => void;
}

type PhotographyViewMode = 'groups' | 'sessions' | 'sessionDetail';

type GroupBy = 'box' | 'location' | 'batch' | 'highRisk' | 'unassignedBox';

interface GroupItem {
  key: string;
  label: string;
  subtitle?: string;
  specimens: Specimen[];
  icon: 'box' | 'location' | 'batch' | 'highRisk' | 'unassigned';
}

const GROUP_METADATA_KEY = 'photography_group_metadata';

const PRIORITY_OPTIONS: {
  value: PhotographyGroupPriority;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}[] = [
  { value: 'high', label: '高优先级', color: 'text-red-700', bgColor: 'bg-red-100', borderColor: 'border-red-300' },
  { value: 'medium', label: '中优先级', color: 'text-amber-700', bgColor: 'bg-amber-100', borderColor: 'border-amber-300' },
  { value: 'low', label: '低优先级', color: 'text-oak-600', bgColor: 'bg-oak-100', borderColor: 'border-oak-300' },
];

const getComplianceStatusInfo = (status: ComplianceStatus) => {
  return COMPLIANCE_STATUS_OPTIONS.find(opt => opt.value === status) || COMPLIANCE_STATUS_OPTIONS[0];
};

export function PhotographyTaskList({
  specimens,
  boxes,
  batches,
  onTogglePhotographed,
  onMarkPhotographed,
  sessions,
  activeSessions,
  completedSessions,
  cancelledSessions,
  getSessionProgress,
  getSessionSpecimens,
  getAvailableTargets,
  getSpecimensForTargets,
  onCreateSession,
  onUpdateSession,
  onDeleteSession,
  onCompleteSession,
  onCancelSession,
  onReactiveSession,
  onExportSession,
  updateAllSessionsProgress,
  updateSessionProgress,
}: PhotographyTaskListProps) {
  const [viewMode, setViewMode] = useState<PhotographyViewMode>('groups');
  const [selectedSession, setSelectedSession] = useState<PhotographySession | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>('box');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [groupMetadata, setGroupMetadata] = useLocalStorage<PhotographyGroupMetadata[]>(
    GROUP_METADATA_KEY,
    []
  );
  const [editingGroup, setEditingGroup] = useState<{ groupKey: string; groupBy: GroupBy } | null>(null);
  const [editPriority, setEditPriority] = useState<PhotographyGroupPriority>('medium');
  const [editNotes, setEditNotes] = useState('');
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<PhotographySession | null>(null);

  useEffect(() => {
    updateAllSessionsProgress();
  }, [specimens, updateAllSessionsProgress]);

  const handleViewSession = (session: PhotographySession) => {
    setSelectedSession(session);
    updateSessionProgress(session.id);
    setViewMode('sessionDetail');
  };

  const handleEditSession = (session: PhotographySession) => {
    setEditingSession(session);
    setSessionModalOpen(true);
  };

  const handleNewSession = () => {
    setEditingSession(null);
    setSessionModalOpen(true);
  };

  const handleSessionSubmit = (data: PhotographySessionFormData) => {
    if (editingSession) {
      onUpdateSession(editingSession.id, data);
    } else {
      onCreateSession(data);
    }
  };

  const handleBackToSessions = () => {
    setSelectedSession(null);
    setViewMode('sessions');
  };

  const sessionDetailSpecimens = useMemo(() => {
    if (!selectedSession) return [];
    return getSessionSpecimens(selectedSession.id);
  }, [selectedSession, getSessionSpecimens]);

  const sessionDetailUnphotographed = useMemo(() => {
    return sessionDetailSpecimens.filter((s) => !s.photographed);
  }, [sessionDetailSpecimens]);

  const unphotographedSpecimens = useMemo(() => {
    return specimens.filter((s) => !s.photographed);
  }, [specimens]);

  const highRiskUnphotographedCount = useMemo(() => {
    return unphotographedSpecimens.filter((s) =>
      HIGH_RISK_STATUSES.includes(s.complianceStatus)
    ).length;
  }, [unphotographedSpecimens]);

  const getGroupKey = (groupKey: string, groupByType: string): string => {
    return `${groupByType}__${groupKey}`;
  };

  const getMetadata = useCallback(
    (groupKey: string, groupByType: string): PhotographyGroupMetadata | undefined => {
      const fullKey = getGroupKey(groupKey, groupByType);
      return groupMetadata.find((m) => m.groupKey === fullKey && m.groupBy === groupByType);
    },
    [groupMetadata]
  );

  const updateMetadata = useCallback(
    (groupKey: string, groupByType: string, priority: PhotographyGroupPriority, notes: string) => {
      const fullKey = getGroupKey(groupKey, groupByType);
      const now = new Date().toISOString();
      setGroupMetadata((prev) => {
        const existing = prev.find((m) => m.groupKey === fullKey && m.groupBy === groupByType);
        if (existing) {
          return prev.map((m) =>
            m.groupKey === fullKey && m.groupBy === groupByType
              ? { ...m, priority, notes, updatedAt: now }
              : m
          );
        } else {
          return [
            ...prev,
            {
              groupKey: fullKey,
              groupBy: groupByType,
              priority,
              notes,
              updatedAt: now,
            },
          ];
        }
      });
    },
    [setGroupMetadata]
  );

  const groups = useMemo((): GroupItem[] => {
    if (groupBy === 'box') {
      const grouped = new Map<string, Specimen[]>();
      const unassigned: Specimen[] = [];

      unphotographedSpecimens.forEach((s) => {
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
          icon: 'unassigned',
        });
      }

      boxes.forEach((box) => {
        if (grouped.has(box.id)) {
          result.push({
            key: box.id,
            label: box.name,
            subtitle: box.location,
            specimens: grouped.get(box.id)!,
            icon: 'box',
          });
        }
      });

      return result;
    } else if (groupBy === 'location') {
      const grouped = new Map<string, Specimen[]>();
      const unknown: Specimen[] = [];

      unphotographedSpecimens.forEach((s) => {
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
        icon: 'location',
      }));

      if (unknown.length > 0) {
        result.unshift({
          key: '__unknown__',
          label: '未填写采集地点',
          subtitle: `${unknown.length} 件标本`,
          specimens: unknown,
          icon: 'location',
        });
      }

      return result.sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));
    } else if (groupBy === 'batch') {
      const grouped = new Map<string, Specimen[]>();
      const noBatch: Specimen[] = [];

      unphotographedSpecimens.forEach((s) => {
        if (s.batchId) {
          if (!grouped.has(s.batchId)) {
            grouped.set(s.batchId, []);
          }
          grouped.get(s.batchId)!.push(s);
        } else {
          noBatch.push(s);
        }
      });

      const result: GroupItem[] = [];

      batches.forEach((batch) => {
        if (grouped.has(batch.id)) {
          result.push({
            key: batch.id,
            label: batch.name,
            subtitle: `${formatDate(batch.collectionDate)} · ${batch.location}`,
            specimens: grouped.get(batch.id)!,
            icon: 'batch',
          });
        }
      });

      if (noBatch.length > 0) {
        result.push({
          key: '__no_batch__',
          label: '未分配采集批次',
          subtitle: '未关联采集批次的标本',
          specimens: noBatch,
          icon: 'batch',
        });
      }

      return result;
    } else if (groupBy === 'highRisk') {
      const highRisk: Specimen[] = [];
      const normal: Specimen[] = [];

      unphotographedSpecimens.forEach((s) => {
        if (HIGH_RISK_STATUSES.includes(s.complianceStatus)) {
          highRisk.push(s);
        } else {
          normal.push(s);
        }
      });

      const result: GroupItem[] = [];

      if (highRisk.length > 0) {
        result.push({
          key: '__high_risk__',
          label: '合规高风险',
          subtitle: '保护物种、外来物种、许可过期或待确认',
          specimens: highRisk,
          icon: 'highRisk',
        });
      }

      if (normal.length > 0) {
        result.push({
          key: '__normal_risk__',
          label: '普通合规',
          subtitle: '无需特殊许可的普通物种',
          specimens: normal,
          icon: 'highRisk',
        });
      }

      return result;
    } else if (groupBy === 'unassignedBox') {
      const unassigned: Specimen[] = unphotographedSpecimens.filter((s) => !s.boxId);
      const assigned: Specimen[] = unphotographedSpecimens.filter((s) => s.boxId);

      const result: GroupItem[] = [];

      if (unassigned.length > 0) {
        result.push({
          key: '__unassigned_box__',
          label: '未分配展盒',
          subtitle: '草稿标本，待整理',
          specimens: unassigned,
          icon: 'unassigned',
        });
      }

      if (assigned.length > 0) {
        result.push({
          key: '__assigned_box__',
          label: '已分配展盒',
          subtitle: '已归入展盒的标本',
          specimens: assigned,
          icon: 'box',
        });
      }

      return result;
    }

    return [];
  }, [unphotographedSpecimens, groupBy, boxes, batches]);

  const groupsSorted = useMemo(() => {
    return [...groups].sort((a, b) => {
      const metaA = getMetadata(a.key, groupBy);
      const metaB = getMetadata(b.key, groupBy);

      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const orderA = metaA ? priorityOrder[metaA.priority] : 1;
      const orderB = metaB ? priorityOrder[metaB.priority] : 1;

      if (orderA !== orderB) {
        return orderA - orderB;
      }

      return a.label.localeCompare(b.label, 'zh-CN');
    });
  }, [groups, groupBy, getMetadata]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
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
    setSelectedIds((prev) => {
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
    const allSelected = specimens.every((s) => selectedIds.has(s.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      specimens.forEach((s) => {
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
      setSelectedIds(new Set(unphotographedSpecimens.map((s) => s.id)));
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
      onMarkPhotographed(specimens.map((s) => s.id));
    }
  };

  const handleOpenEditModal = (groupKey: string, groupByType: GroupBy) => {
    const metadata = getMetadata(groupKey, groupByType);
    setEditingGroup({ groupKey, groupBy: groupByType });
    setEditPriority(metadata?.priority || 'medium');
    setEditNotes(metadata?.notes || '');
  };

  const handleSaveMetadata = () => {
    if (!editingGroup) return;
    updateMetadata(editingGroup.groupKey, editingGroup.groupBy, editPriority, editNotes);
    setEditingGroup(null);
  };

  const handleCloseEditModal = () => {
    setEditingGroup(null);
  };

  const getBoxById = (id: string) => boxes.find((b) => b.id === id);
  const getBatchById = (id: string) => batches.find((b) => b.id === id);

  const getGroupIcon = (iconType: GroupItem['icon']) => {
    switch (iconType) {
      case 'box':
        return <Package className="w-5 h-5 text-oak-700" />;
      case 'location':
        return <MapPin className="w-5 h-5 text-oak-700" />;
      case 'batch':
        return <ClipboardList className="w-5 h-5 text-moss-600" />;
      case 'highRisk':
        return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      case 'unassigned':
        return <Layers className="w-5 h-5 text-oak-500" />;
    }
  };

  const getPriorityBadge = (priority?: PhotographyGroupPriority) => {
    if (!priority) return null;
    const option = PRIORITY_OPTIONS.find((opt) => opt.value === priority);
    if (!option) return null;
    return (
      <span
        className={`tag ${option.bgColor} ${option.color} border ${option.borderColor} flex items-center gap-1`}
      >
        <Flag className="w-3 h-3" />
        {option.label}
      </span>
    );
  };

  const renderSpecimenCard = (specimen: Specimen, idx: number, showAllInfo: boolean = false) => {
    const isSelected = selectedIds.has(specimen.id);
    const box = specimen.boxId ? getBoxById(specimen.boxId) : null;
    const batch = specimen.batchId ? getBatchById(specimen.batchId) : null;
    const complianceInfo = getComplianceStatusInfo(specimen.complianceStatus);
    const isHighRisk = HIGH_RISK_STATUSES.includes(specimen.complianceStatus);

    return (
      <div
        key={specimen.id}
        className={`card p-4 opacity-0 animate-fade-in-up ${isSelected ? 'ring-2 ring-oak-500' : ''} ${isHighRisk ? 'border-l-4 border-l-red-400' : ''} ${specimen.photographed ? 'opacity-60' : ''}`}
        style={{ animationDelay: `${idx * 0.03}s` }}
      >
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => toggleSelectSpecimen(specimen.id)}
            className="mt-1 flex-shrink-0"
          >
            <div
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isSelected
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
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="inline-block px-2 py-1 bg-oak-100 text-oak-700 text-xs font-mono rounded">
                {specimen.specimenNo}
              </span>
              {isHighRisk && (
                <span
                  className={`inline-block px-2 py-1 text-xs font-medium rounded ${complianceInfo.bgColor} ${complianceInfo.color}`}
                >
                  {complianceInfo.label}
                </span>
              )}
              {specimen.photographed && (
                <span className="inline-block px-2 py-1 bg-moss-100 text-moss-700 text-xs font-medium rounded">
                  已拍照
                </span>
              )}
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
              {(showAllInfo || groupBy !== 'box' && groupBy !== 'unassignedBox') && box && (
                <div className="flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-oak-400 flex-shrink-0" />
                  <span className="truncate">{box.name}</span>
                </div>
              )}
              {(showAllInfo || groupBy !== 'batch') && batch && (
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
            {!specimen.photographed && (
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
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderSessionModal = () => (
    <PhotographySessionModal
      isOpen={sessionModalOpen}
      onClose={() => setSessionModalOpen(false)}
      onSubmit={handleSessionSubmit}
      editingSession={editingSession}
      availableTargets={getAvailableTargets()}
      getSpecimensForTargets={getSpecimensForTargets}
    />
  );

  if (viewMode === 'sessionDetail' && selectedSession) {
    const sessionProgress = getSessionProgress(selectedSession.id);
    const sessionPriorityInfo = PRIORITY_OPTIONS.find(opt => opt.value === selectedSession.priority);

    return (
      <>
        <div className="space-y-6">
          <div className="card p-6 animate-fade-in-up">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={handleBackToSessions}
                  className="mt-1 text-oak-500 hover:text-oak-700 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <div className="flex items-center gap-3 flex-wrap mb-2">
                    <h2 className="text-xl font-semibold text-oak-800 font-serif">{selectedSession.name}</h2>
                    {sessionPriorityInfo && (
                      <span className={`tag ${sessionPriorityInfo.bgColor} ${sessionPriorityInfo.color} border ${sessionPriorityInfo.borderColor} flex items-center gap-1`}>
                        <Flag className="w-3 h-3" />
                        {sessionPriorityInfo.label}
                      </span>
                    )}
                    <span className={`tag ${selectedSession.status === 'active' ? 'bg-moss-100 text-moss-700' : selectedSession.status === 'completed' ? 'bg-oak-100 text-oak-700' : 'bg-red-100 text-red-700'}`}>
                      {selectedSession.status === 'active' ? '进行中' : selectedSession.status === 'completed' ? '已完成' : '已取消'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-oak-500 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      预计: {formatDate(selectedSession.scheduledDate)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      创建: {formatDate(selectedSession.createdAt)}
                    </span>
                  </div>
                  {selectedSession.notes && (
                    <p className="text-sm text-oak-600 mt-2 flex items-center gap-1">
                      <StickyNote className="w-4 h-4 text-oak-400" />
                      <span className="italic">"{selectedSession.notes}"</span>
                    </p>
                  )}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-oak-600">
                        进度: {sessionProgress.completed}/{sessionProgress.total} 件
                      </span>
                      <span className="font-medium text-oak-700">{sessionProgress.percentage}%</span>
                    </div>
                    <div className="h-2 bg-oak-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-moss-500 to-moss-600 rounded-full transition-all duration-500"
                        style={{ width: `${sessionProgress.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => onExportSession(selectedSession.id)}
                  className="btn-secondary text-sm py-1.5 px-3 flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  导出清单
                </button>
                {selectedSession.status === 'active' && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleEditSession(selectedSession)}
                      className="btn-secondary text-sm py-1.5 px-3 flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`确定完成会话"${selectedSession.name}"吗？剩余 ${sessionDetailUnphotographed.length} 件未拍照的标本将被标记为已拍照。`)) {
                          onCompleteSession(selectedSession.id);
                        }
                      }}
                      className="bg-moss-600 hover:bg-moss-700 text-parchment-50 text-sm py-1.5 px-3 rounded-md flex items-center gap-1.5 transition-colors"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      完成会话
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="card p-4 animate-fade-in-up">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-oak-800 font-serif">标本列表</h3>
                <p className="text-sm text-oak-500 mt-1">
                  共 {sessionDetailSpecimens.length} 件 · 待拍照 {sessionDetailUnphotographed.length} 件
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const unphotographedIds = sessionDetailUnphotographed.map(s => s.id);
                    if (selectedIds.size === unphotographedIds.length) {
                      setSelectedIds(new Set());
                    } else {
                      setSelectedIds(new Set(unphotographedIds));
                    }
                  }}
                  className="text-sm text-oak-600 hover:text-oak-800 font-medium"
                >
                  {selectedIds.size === sessionDetailUnphotographed.length ? '取消全选' : '全选待拍'}
                </button>
                <button
                  type="button"
                  onClick={handleMarkSelected}
                  disabled={selectedIds.size === 0}
                  className={`btn-primary flex items-center gap-2 text-sm py-1.5 px-3 ${selectedIds.size === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Check className="w-4 h-4" />
                  标记选中为已拍照
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {sessionDetailSpecimens.map((specimen, idx) => renderSpecimenCard(specimen, idx, true))}
            </div>
          </div>
        </div>
        {renderSessionModal()}
      </>
    );
  }

  if (viewMode === 'sessions') {
    return (
      <>
        <div className="space-y-6">
          <div className="card p-6 animate-fade-in-up">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-moss-100 flex items-center justify-center">
                  <ClipboardList className="w-6 h-6 text-moss-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-oak-800 font-serif">拍摄会话</h2>
                  <p className="text-sm text-oak-500 mt-1">
                    共 {sessions.length} 个会话 · 进行中 {activeSessions.length} 个
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => setViewMode('groups')}
                  className="text-sm text-oak-600 hover:text-oak-800 font-medium"
                >
                  查看分组视图
                </button>
                <button
                  type="button"
                  onClick={handleNewSession}
                  className="btn-primary flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  新建会话
                </button>
              </div>
            </div>
          </div>

          <PhotographySessionList
            sessions={sessions}
            activeSessions={activeSessions}
            completedSessions={completedSessions}
            cancelledSessions={cancelledSessions}
            getSessionProgress={getSessionProgress}
            onViewSession={handleViewSession}
            onEditSession={handleEditSession}
            onExportSession={onExportSession}
            onCompleteSession={onCompleteSession}
            onCancelSession={onCancelSession}
            onReactiveSession={onReactiveSession}
            onDeleteSession={onDeleteSession}
          />
        </div>
        {renderSessionModal()}
      </>
    );
  }

  if (unphotographedSpecimens.length === 0) {
    return (
      <div className="space-y-6">
        <div className="card p-6 animate-fade-in-up">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-rust-100 flex items-center justify-center">
                <Camera className="w-6 h-6 text-rust-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-oak-800 font-serif">拍照工作台</h2>
                <p className="text-sm text-oak-500 mt-1">
                  共 <span className="font-semibold text-rust-600">{unphotographedSpecimens.length}</span> 件标本待拍照
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => setViewMode('sessions')}
                className="text-sm text-oak-600 hover:text-oak-800 font-medium"
              >
                查看拍摄会话 ({sessions.length})
              </button>
            </div>
          </div>
        </div>
        <div className="card p-16 text-center animate-fade-in-up">
          <Camera className="w-20 h-20 text-moss-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-oak-700 font-serif mb-2">太棒了！所有标本都已拍照</h3>
          <p className="text-oak-500">暂无待拍照的标本任务</p>
        </div>
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
              <h2 className="text-xl font-semibold text-oak-800 font-serif">拍照工作台</h2>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <p className="text-sm text-oak-500">
                  共{' '}
                  <span className="font-semibold text-rust-600">{unphotographedSpecimens.length}</span>{' '}
                  件标本待拍照
                </p>
                {highRiskUnphotographedCount > 0 && (
                  <span className="text-sm text-red-600 font-medium flex items-center gap-1">
                    <AlertOctagon className="w-4 h-4" />
                    其中 <span className="font-bold">{highRiskUnphotographedCount}</span> 件为高风险
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setViewMode('sessions')}
              className="text-sm text-oak-600 hover:text-oak-800 font-medium"
            >
              拍摄会话 ({sessions.length})
            </button>
            <div className="flex items-center gap-2">
              <span className="text-sm text-oak-600">分组方式：</span>
              <div className="flex flex-wrap rounded-md overflow-hidden border border-oak-300">
                <button
                  type="button"
                  onClick={() => setGroupBy('box')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${groupBy === 'box' ? 'bg-oak-700 text-parchment-50' : 'bg-parchment-50 text-oak-600 hover:bg-oak-100'}`}
                >
                  <Package className="w-3.5 h-3.5" />
                  按展盒
                </button>
                <button
                  type="button"
                  onClick={() => setGroupBy('location')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${groupBy === 'location' ? 'bg-oak-700 text-parchment-50' : 'bg-parchment-50 text-oak-600 hover:bg-oak-100'}`}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  按地点
                </button>
                <button
                  type="button"
                  onClick={() => setGroupBy('batch')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${groupBy === 'batch' ? 'bg-oak-700 text-parchment-50' : 'bg-parchment-50 text-oak-600 hover:bg-oak-100'}`}
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  按批次
                </button>
                <button
                  type="button"
                  onClick={() => setGroupBy('highRisk')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${groupBy === 'highRisk' ? 'bg-oak-700 text-parchment-50' : 'bg-parchment-50 text-oak-600 hover:bg-oak-100'}`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  按高风险
                </button>
                <button
                  type="button"
                  onClick={() => setGroupBy('unassignedBox')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${groupBy === 'unassignedBox' ? 'bg-oak-700 text-parchment-50' : 'bg-parchment-50 text-oak-600 hover:bg-oak-100'}`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  未分配展盒
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
              className={`btn-primary flex items-center gap-2 ${selectedIds.size === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Check className="w-4 h-4" />
              {selectedIds.size > 0
                ? `标记 ${selectedIds.size} 件为已拍照`
                : '标记选中为已拍照'}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {groupsSorted.map((group, groupIndex) => {
          const isExpanded = expandedGroups.has(group.key);
          const allInGroupSelected = group.specimens.every((s) => selectedIds.has(s.id));
          const someInGroupSelected = group.specimens.some((s) => selectedIds.has(s.id));
          const metadata = getMetadata(group.key, groupBy);

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
                    {getGroupIcon(group.icon)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-lg font-semibold text-oak-800 font-serif decorative-underline">
                        {group.label}
                      </h3>
                      <span className="tag bg-rust-100 text-rust-700">
                        {group.specimens.length} 件待拍照
                      </span>
                      {metadata && getPriorityBadge(metadata.priority)}
                    </div>
                    {group.subtitle && (
                      <p className="text-sm text-oak-500 mt-1">{group.subtitle}</p>
                    )}
                    {metadata?.notes && (
                      <p className="text-sm text-oak-600 mt-1 flex items-center gap-1">
                        <StickyNote className="w-3.5 h-3.5 text-oak-400" />
                        <span className="italic">"{metadata.notes}"</span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEditModal(group.key, groupBy);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-oak-600 hover:text-oak-800 hover:bg-oak-100 rounded-md transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">设置</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelectGroup(group.specimens);
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-oak-600 hover:text-oak-800 hover:bg-oak-100 rounded-md transition-colors"
                    >
                      <div
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center ${allInGroupSelected
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
                      <span className="hidden sm:inline">本组全选</span>
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
                      <span className="hidden sm:inline">全部标记</span>
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
                      {group.specimens.map((specimen, idx) => renderSpecimenCard(specimen, idx))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {editingGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-parchment-50 rounded-lg shadow-xl max-w-md w-full p-6 animate-fade-in-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-oak-800 font-serif">分组设置</h3>
              <button
                type="button"
                onClick={handleCloseEditModal}
                className="text-oak-400 hover:text-oak-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-oak-700 mb-2">
                  临时优先级
                </label>
                <div className="flex gap-2 flex-wrap">
                  {PRIORITY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setEditPriority(option.value)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium border transition-all ${editPriority === option.value
                          ? `${option.bgColor} ${option.color} ${option.borderColor} border-2 ring-2 ring-offset-1`
                          : 'bg-parchment-50 text-oak-600 border border-oak-200 hover:bg-oak-50'
                        }`}
                    >
                      <Flag className="w-3.5 h-3.5" />
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-oak-700 mb-2">
                  备注
                </label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="添加临时备注，仅用于拍照工作组织..."
                  className="w-full px-3 py-2 border border-oak-300 rounded-md text-oak-900 placeholder-oak-400 focus:outline-none focus:ring-2 focus:ring-oak-500 focus:border-transparent resize-none"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={handleCloseEditModal}
                className="px-4 py-2 text-oak-600 hover:text-oak-800 font-medium"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveMetadata}
                className="btn-primary"
              >
                保存设置
              </button>
            </div>
          </div>
        </div>
      )}

      {renderSessionModal()}
    </div>
  );
}
