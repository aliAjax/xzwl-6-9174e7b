import { useState } from 'react';
import {
  Flag,
  Calendar,
  StickyNote,
  Package,
  ClipboardList,
  AlertTriangle,
  Download,
  CheckCircle,
  XCircle,
  Play,
  Edit3,
  Trash2,
  ChevronDown,
  ChevronUp,
  Camera,
  Clock,
  CheckSquare,
  XSquare,
} from 'lucide-react';
import type {
  PhotographySession,
  PhotographyGroupPriority,
} from '../types';
import { formatDate } from '../utils/helpers';

interface PhotographySessionListProps {
  sessions: PhotographySession[];
  activeSessions: PhotographySession[];
  completedSessions: PhotographySession[];
  cancelledSessions: PhotographySession[];
  getSessionProgress: (id: string) => { total: number; completed: number; percentage: number };
  onViewSession: (session: PhotographySession) => void;
  onEditSession: (session: PhotographySession) => void;
  onExportSession: (id: string) => void;
  onCompleteSession: (id: string) => void;
  onCancelSession: (id: string) => void;
  onReactiveSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
}

const PRIORITY_OPTIONS: Record<PhotographyGroupPriority, { label: string; color: string; bgColor: string; borderColor: string }> = {
  high: { label: '高优先级', color: 'text-red-700', bgColor: 'bg-red-100', borderColor: 'border-red-300' },
  medium: { label: '中优先级', color: 'text-amber-700', bgColor: 'bg-amber-100', borderColor: 'border-amber-300' },
  low: { label: '低优先级', color: 'text-oak-600', bgColor: 'bg-oak-100', borderColor: 'border-oak-300' },
};

const STATUS_INFO = {
  active: { label: '进行中', color: 'text-moss-700', bgColor: 'bg-moss-100', icon: Play },
  completed: { label: '已完成', color: 'text-oak-700', bgColor: 'bg-oak-100', icon: CheckCircle },
  cancelled: { label: '已取消', color: 'text-red-700', bgColor: 'bg-red-100', icon: XCircle },
};

type TabType = 'active' | 'completed' | 'cancelled';

export function PhotographySessionList({
  sessions,
  activeSessions,
  completedSessions,
  cancelledSessions,
  getSessionProgress,
  onViewSession,
  onEditSession,
  onExportSession,
  onCompleteSession,
  onCancelSession,
  onReactiveSession,
  onDeleteSession,
}: PhotographySessionListProps) {
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  const getCurrentSessions = () => {
    switch (activeTab) {
      case 'active':
        return activeSessions;
      case 'completed':
        return completedSessions;
      case 'cancelled':
        return cancelledSessions;
      default:
        return [];
    }
  };

  const currentSessions = getCurrentSessions();

  const toggleExpand = (id: string) => {
    setExpandedSessionId((prev) => (prev === id ? null : id));
  };

  const sortedSessions = [...currentSessions].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const orderA = priorityOrder[a.priority];
    const orderB = priorityOrder[b.priority];
    if (orderA !== orderB) return orderA - orderB;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const getTargetIcon = (type: string) => {
    switch (type) {
      case 'box':
        return <Package className="w-3 h-3" />;
      case 'batch':
        return <ClipboardList className="w-3 h-3" />;
      case 'highRisk':
        return <AlertTriangle className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const getTargetBgColor = (type: string) => {
    switch (type) {
      case 'box':
        return 'bg-oak-100 text-oak-700';
      case 'batch':
        return 'bg-moss-100 text-moss-700';
      case 'highRisk':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-oak-100 text-oak-700';
    }
  };

  if (sessions.length === 0) {
    return (
      <div className="card p-12 text-center animate-fade-in-up">
        <Camera className="w-16 h-16 text-oak-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-oak-700 font-serif mb-2">
          暂无拍摄会话
        </h3>
        <p className="text-oak-500 mb-4">
          点击上方"新建会话"按钮创建您的第一个拍摄任务
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-oak-200">
        <button
          type="button"
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 font-medium text-sm transition-colors relative ${
            activeTab === 'active'
              ? 'text-oak-800'
              : 'text-oak-500 hover:text-oak-700'
          }`}
        >
          进行中 ({activeSessions.length})
          {activeTab === 'active' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-oak-700" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('completed')}
          className={`px-4 py-2 font-medium text-sm transition-colors relative ${
            activeTab === 'completed'
              ? 'text-oak-800'
              : 'text-oak-500 hover:text-oak-700'
          }`}
        >
          已完成 ({completedSessions.length})
          {activeTab === 'completed' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-oak-700" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('cancelled')}
          className={`px-4 py-2 font-medium text-sm transition-colors relative ${
            activeTab === 'cancelled'
              ? 'text-oak-800'
              : 'text-oak-500 hover:text-oak-700'
          }`}
        >
          已取消 ({cancelledSessions.length})
          {activeTab === 'cancelled' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-oak-700" />
          )}
        </button>
      </div>

      {sortedSessions.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-oak-500">
            {activeTab === 'active' && '暂无进行中的会话'}
            {activeTab === 'completed' && '暂无已完成的会话'}
            {activeTab === 'cancelled' && '暂无已取消的会话'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedSessions.map((session, idx) => {
            const progress = getSessionProgress(session.id);
            const isExpanded = expandedSessionId === session.id;
            const priorityInfo = PRIORITY_OPTIONS[session.priority];
            const statusInfo = STATUS_INFO[session.status];
            const StatusIcon = statusInfo.icon;

            return (
              <div
                key={session.id}
                className="card overflow-hidden animate-fade-in-up"
                style={{ animationDelay: `${idx * 0.05}s` }}
              >
                <div
                  className="p-4 cursor-pointer hover:bg-oak-50 transition-colors"
                  onClick={() => toggleExpand(session.id)}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-oak-100 flex items-center justify-center flex-shrink-0">
                      <Camera className="w-6 h-6 text-oak-600" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap mb-1">
                        <h3 className="text-lg font-semibold text-oak-800 font-serif">
                          {session.name}
                        </h3>
                        <span
                          className={`tag ${priorityInfo.bgColor} ${priorityInfo.color} border ${priorityInfo.borderColor} flex items-center gap-1`}
                        >
                          <Flag className="w-3 h-3" />
                          {priorityInfo.label}
                        </span>
                        <span
                          className={`tag ${statusInfo.bgColor} ${statusInfo.color} flex items-center gap-1`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {statusInfo.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-oak-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          预计: {formatDate(session.scheduledDate)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          创建: {formatDate(session.createdAt)}
                        </span>
                        {session.completedAt && (
                          <span className="flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" />
                            完成: {formatDate(session.completedAt)}
                          </span>
                        )}
                      </div>

                      <div className="mt-3">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-oak-600">
                            进度: {progress.completed}/{progress.total} 件
                          </span>
                          <span className="font-medium text-oak-700">
                            {progress.percentage}%
                          </span>
                        </div>
                        <div className="h-2 bg-oak-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-moss-500 to-moss-600 rounded-full transition-all duration-500"
                            style={{ width: `${progress.percentage}%` }}
                          />
                        </div>
                      </div>

                      {session.notes && (
                        <p className="text-sm text-oak-600 mt-2 flex items-center gap-1">
                          <StickyNote className="w-3.5 h-3.5 text-oak-400" />
                          <span className="italic">"{session.notes}"</span>
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-oak-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-oak-400" />
                      )}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-oak-100 p-4 bg-oak-50/50">
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-oak-700 mb-2">拍摄目标</h4>
                      <div className="flex flex-wrap gap-2">
                        {session.targets.map((target, idx) => (
                          <span
                            key={idx}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getTargetBgColor(target.type)}`}
                          >
                            {getTargetIcon(target.type)}
                            {target.name}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewSession(session);
                        }}
                        className="btn-secondary text-sm py-1.5 px-3 flex items-center gap-1.5"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        查看标本
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onExportSession(session.id);
                        }}
                        className="btn-secondary text-sm py-1.5 px-3 flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        导出清单
                      </button>

                      {session.status === 'active' && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditSession(session);
                            }}
                            className="btn-secondary text-sm py-1.5 px-3 flex items-center gap-1.5"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            编辑
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`确定完成会话"${session.name}"吗？剩余未拍照的标本将被标记为已拍照。`)) {
                                onCompleteSession(session.id);
                              }
                            }}
                            className="bg-moss-600 hover:bg-moss-700 text-parchment-50 text-sm py-1.5 px-3 rounded-md flex items-center gap-1.5 transition-colors"
                          >
                            <CheckSquare className="w-3.5 h-3.5" />
                            完成会话
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`确定取消会话"${session.name}"吗？`)) {
                                onCancelSession(session.id);
                              }
                            }}
                            className="bg-amber-600 hover:bg-amber-700 text-parchment-50 text-sm py-1.5 px-3 rounded-md flex items-center gap-1.5 transition-colors"
                          >
                            <XSquare className="w-3.5 h-3.5" />
                            取消会话
                          </button>
                        </>
                      )}

                      {session.status !== 'active' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`确定重新激活会话"${session.name}"吗？`)) {
                              onReactiveSession(session.id);
                            }
                          }}
                          className="bg-moss-600 hover:bg-moss-700 text-parchment-50 text-sm py-1.5 px-3 rounded-md flex items-center gap-1.5 transition-colors"
                        >
                          <Play className="w-3.5 h-3.5" />
                          重新激活
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`确定删除会话"${session.name}"吗？此操作不会删除标本数据。`)) {
                            onDeleteSession(session.id);
                          }
                        }}
                        className="bg-red-600 hover:bg-red-700 text-parchment-50 text-sm py-1.5 px-3 rounded-md flex items-center gap-1.5 transition-colors ml-auto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        删除
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
