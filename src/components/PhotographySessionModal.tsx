import { useState, useEffect } from 'react';
import {
  X,
  Flag,
  Calendar,
  StickyNote,
  Package,
  ClipboardList,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type {
  PhotographySession,
  PhotographySessionFormData,
  PhotographySessionTarget,
  PhotographyGroupPriority,
  Specimen,
} from '../types';
import { getTodayString } from '../utils/helpers';

interface PhotographySessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: PhotographySessionFormData) => void;
  editingSession?: PhotographySession | null;
  availableTargets: {
    boxes: { id: string; name: string; count: number }[];
    batches: { id: string; name: string; count: number }[];
    highRisk: { id: string; name: string; count: number }[];
  };
  getSpecimensForTargets: (targets: PhotographySessionTarget[]) => Specimen[];
}

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

export function PhotographySessionModal({
  isOpen,
  onClose,
  onSubmit,
  editingSession,
  availableTargets,
  getSpecimensForTargets,
}: PhotographySessionModalProps) {
  const [name, setName] = useState('');
  const [priority, setPriority] = useState<PhotographyGroupPriority>('medium');
  const [notes, setNotes] = useState('');
  const [scheduledDate, setScheduledDate] = useState(getTodayString());
  const [selectedTargets, setSelectedTargets] = useState<PhotographySessionTarget[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['boxes', 'batches', 'highRisk']));

  useEffect(() => {
    if (editingSession) {
      setName(editingSession.name);
      setPriority(editingSession.priority);
      setNotes(editingSession.notes);
      setScheduledDate(editingSession.scheduledDate);
      setSelectedTargets(editingSession.targets);
    } else {
      setName('');
      setPriority('medium');
      setNotes('');
      setScheduledDate(getTodayString());
      setSelectedTargets([]);
    }
  }, [editingSession, isOpen]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const isTargetSelected = (type: PhotographySessionTarget['type'], id: string) => {
    return selectedTargets.some((t) => t.type === type && t.id === id);
  };

  const toggleTarget = (type: PhotographySessionTarget['type'], id: string, name: string) => {
    setSelectedTargets((prev) => {
      const existing = prev.find((t) => t.type === type && t.id === id);
      if (existing) {
        return prev.filter((t) => !(t.type === type && t.id === id));
      } else {
        return [...prev, { type, id, name }];
      }
    });
  };

  const estimatedCount = getSpecimensForTargets(selectedTargets).length;

  const handleSubmit = () => {
    if (!name.trim()) {
      alert('请输入会话名称');
      return;
    }
    if (selectedTargets.length === 0) {
      alert('请至少选择一个拍摄目标');
      return;
    }

    onSubmit({
      name: name.trim(),
      priority,
      notes: notes.trim(),
      scheduledDate,
      targets: selectedTargets,
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-parchment-50 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-fade-in-up flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-oak-200">
          <h3 className="text-xl font-semibold text-oak-800 font-serif">
            {editingSession ? '编辑拍摄会话' : '创建拍摄会话'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-oak-400 hover:text-oak-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-oak-700 mb-2">
              会话名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：2024年春季鞘翅目拍摄"
              className="w-full px-3 py-2 border border-oak-300 rounded-md text-oak-900 placeholder-oak-400 focus:outline-none focus:ring-2 focus:ring-oak-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-oak-700 mb-2">
              优先级
            </label>
            <div className="flex gap-2 flex-wrap">
              {PRIORITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPriority(option.value)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium border transition-all ${
                    priority === option.value
                      ? `${option.bgColor} ${option.color} ${option.borderColor} border-2 ring-2 ring-offset-1`
                      : 'bg-parchment-50 text-oak-600 border border-oak-200 hover:bg-oak-50'
                  }`}
                >
                  <Flag className="w-4 h-4" />
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-oak-700 mb-2">
              预计拍摄日期
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-oak-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-oak-300 rounded-md text-oak-900 focus:outline-none focus:ring-2 focus:ring-oak-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-oak-700 mb-2">
              选择拍摄目标 <span className="text-red-500">*</span>
            </label>
            <p className="text-sm text-oak-500 mb-3">
              选择本次要拍摄的展盒、批次或高风险分组
            </p>

            <div className="space-y-3">
              {availableTargets.boxes.length > 0 && (
                <div className="border border-oak-200 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection('boxes')}
                    className="w-full flex items-center justify-between p-3 bg-oak-50 hover:bg-oak-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-oak-600" />
                      <span className="font-medium text-oak-700">按展盒</span>
                      <span className="text-sm text-oak-500">
                        ({availableTargets.boxes.length} 个展盒可选)
                      </span>
                    </div>
                    {expandedSections.has('boxes') ? (
                      <ChevronUp className="w-4 h-4 text-oak-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-oak-400" />
                    )}
                  </button>
                  {expandedSections.has('boxes') && (
                    <div className="p-3 space-y-2 max-h-48 overflow-y-auto">
                      {availableTargets.boxes.map((box) => {
                        const selected = isTargetSelected('box', box.id);
                        return (
                          <button
                            key={box.id}
                            type="button"
                            onClick={() => toggleTarget('box', box.id, box.name)}
                            className={`w-full flex items-center justify-between p-2 rounded-md transition-colors ${
                              selected
                                ? 'bg-oak-700 text-parchment-50'
                                : 'hover:bg-oak-100 text-oak-700'
                            }`}
                          >
                            <span className="font-medium">{box.name}</span>
                            <div className="flex items-center gap-2">
                              <span className={`text-sm ${selected ? 'text-parchment-200' : 'text-oak-500'}`}>
                                {box.count} 件待拍
                              </span>
                              <div
                                className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                  selected
                                    ? 'bg-parchment-50 border-parchment-50'
                                    : 'border-oak-300'
                                }`}
                              >
                                {selected && <Check className="w-3 h-3 text-oak-700" />}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {availableTargets.batches.length > 0 && (
                <div className="border border-oak-200 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection('batches')}
                    className="w-full flex items-center justify-between p-3 bg-oak-50 hover:bg-oak-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-moss-600" />
                      <span className="font-medium text-oak-700">按批次</span>
                      <span className="text-sm text-oak-500">
                        ({availableTargets.batches.length} 个批次可选)
                      </span>
                    </div>
                    {expandedSections.has('batches') ? (
                      <ChevronUp className="w-4 h-4 text-oak-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-oak-400" />
                    )}
                  </button>
                  {expandedSections.has('batches') && (
                    <div className="p-3 space-y-2 max-h-48 overflow-y-auto">
                      {availableTargets.batches.map((batch) => {
                        const selected = isTargetSelected('batch', batch.id);
                        return (
                          <button
                            key={batch.id}
                            type="button"
                            onClick={() => toggleTarget('batch', batch.id, batch.name)}
                            className={`w-full flex items-center justify-between p-2 rounded-md transition-colors ${
                              selected
                                ? 'bg-moss-600 text-parchment-50'
                                : 'hover:bg-oak-100 text-oak-700'
                            }`}
                          >
                            <span className="font-medium">{batch.name}</span>
                            <div className="flex items-center gap-2">
                              <span className={`text-sm ${selected ? 'text-parchment-200' : 'text-oak-500'}`}>
                                {batch.count} 件待拍
                              </span>
                              <div
                                className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                  selected
                                    ? 'bg-parchment-50 border-parchment-50'
                                    : 'border-oak-300'
                                }`}
                              >
                                {selected && <Check className="w-3 h-3 text-moss-600" />}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {availableTargets.highRisk.length > 0 && (
                <div className="border border-oak-200 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection('highRisk')}
                    className="w-full flex items-center justify-between p-3 bg-oak-50 hover:bg-oak-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span className="font-medium text-oak-700">高风险分组</span>
                      <span className="text-sm text-oak-500">
                        ({availableTargets.highRisk.length} 个分组可选)
                      </span>
                    </div>
                    {expandedSections.has('highRisk') ? (
                      <ChevronUp className="w-4 h-4 text-oak-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-oak-400" />
                    )}
                  </button>
                  {expandedSections.has('highRisk') && (
                    <div className="p-3 space-y-2">
                      {availableTargets.highRisk.map((group) => {
                        const selected = isTargetSelected('highRisk', group.id);
                        return (
                          <button
                            key={group.id}
                            type="button"
                            onClick={() => toggleTarget('highRisk', group.id, group.name)}
                            className={`w-full flex items-center justify-between p-2 rounded-md transition-colors ${
                              selected
                                ? 'bg-amber-600 text-parchment-50'
                                : 'hover:bg-oak-100 text-oak-700'
                            }`}
                          >
                            <span className="font-medium">{group.name}</span>
                            <div className="flex items-center gap-2">
                              <span className={`text-sm ${selected ? 'text-parchment-200' : 'text-oak-500'}`}>
                                {group.count} 件待拍
                              </span>
                              <div
                                className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                  selected
                                    ? 'bg-parchment-50 border-parchment-50'
                                    : 'border-oak-300'
                                }`}
                              >
                                {selected && <Check className="w-3 h-3 text-amber-600" />}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {availableTargets.boxes.length === 0 &&
                availableTargets.batches.length === 0 &&
                availableTargets.highRisk.length === 0 && (
                  <div className="text-center py-8 text-oak-500">
                    <Package className="w-12 h-12 mx-auto mb-3 text-oak-300" />
                    <p>暂无可选的拍摄目标</p>
                    <p className="text-sm">所有标本都已完成拍照</p>
                  </div>
                )}
            </div>
          </div>

          {selectedTargets.length > 0 && (
            <div className="bg-oak-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-oak-700">已选择</span>
                <span className="text-sm text-oak-600">
                  {selectedTargets.length} 个目标 · 预计 {estimatedCount} 件标本
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedTargets.map((target, idx) => (
                  <span
                    key={idx}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                      target.type === 'box'
                        ? 'bg-oak-100 text-oak-700'
                        : target.type === 'batch'
                        ? 'bg-moss-100 text-moss-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {target.type === 'box' && <Package className="w-3 h-3" />}
                    {target.type === 'batch' && <ClipboardList className="w-3 h-3" />}
                    {target.type === 'highRisk' && <AlertTriangle className="w-3 h-3" />}
                    {target.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-oak-700 mb-2">
              备注
            </label>
            <div className="relative">
              <StickyNote className="w-4 h-4 text-oak-400 absolute left-3 top-3" />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="添加备注说明，如拍摄要求、注意事项等..."
                className="w-full pl-10 pr-3 py-2 border border-oak-300 rounded-md text-oak-900 placeholder-oak-400 focus:outline-none focus:ring-2 focus:ring-oak-500 focus:border-transparent resize-none"
                rows={3}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-oak-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-oak-600 hover:text-oak-800 font-medium transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!name.trim() || selectedTargets.length === 0}
            className={`btn-primary ${
              !name.trim() || selectedTargets.length === 0
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
          >
            {editingSession ? '保存修改' : '创建会话'}
          </button>
        </div>
      </div>
    </div>
  );
}
