import { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, MapPin, Calendar, Users, ClipboardList } from 'lucide-react';
import type { CollectionBatch, CollectionBatchFormData } from '../types';
import { getTodayString } from '../utils/helpers';

interface BatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  batches: CollectionBatch[];
  onAddBatch: (data: CollectionBatchFormData) => void;
  onUpdateBatch: (id: string, data: Partial<CollectionBatchFormData>) => void;
  onDeleteBatch: (id: string) => void;
  getSpecimensCountByBatchId: (id: string) => number;
}

const initialFormData: CollectionBatchFormData = {
  name: '',
  collectionDate: getTodayString(),
  location: '',
  participants: '',
  notes: '',
};

export function BatchModal({
  isOpen,
  onClose,
  batches,
  onAddBatch,
  onUpdateBatch,
  onDeleteBatch,
  getSpecimensCountByBatchId,
}: BatchModalProps) {
  const [formData, setFormData] = useState<CollectionBatchFormData>(initialFormData);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingId(null);
    setShowForm(false);
    setError('');
  };

  const handleEdit = (batch: CollectionBatch) => {
    setFormData({
      name: batch.name,
      collectionDate: batch.collectionDate,
      location: batch.location,
      participants: batch.participants,
      notes: batch.notes,
    });
    setEditingId(batch.id);
    setShowForm(true);
    setError('');
  };

  const handleDelete = (batch: CollectionBatch) => {
    const count = getSpecimensCountByBatchId(batch.id);
    if (count > 0) {
      setError('无法删除包含标本的采集批次，请先移除或迁移标本');
      return;
    }
    if (confirm(`确定要删除采集批次 "${batch.name}" 吗？`)) {
      try {
        onDeleteBatch(batch.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : '删除失败');
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('请输入批次名称');
      return;
    }
    if (!formData.collectionDate) {
      setError('请选择采集日期');
      return;
    }

    if (editingId) {
      onUpdateBatch(editingId, formData);
    } else {
      onAddBatch(formData);
    }
    resetForm();
  };

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
      <div className="bg-parchment-50 rounded-xl shadow-hover max-w-2xl w-full max-h-[85vh] overflow-hidden animate-scale-in flex flex-col">
        <div className="bg-parchment-50 border-b border-oak-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <h2 className="text-xl font-semibold text-oak-800 font-serif">采集批次管理</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-oak-100 text-oak-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto scrollbar-thin flex-1">
          {error && (
            <div className="mb-4 p-3 bg-rust-100 border border-rust-300 text-rust-800 rounded-lg text-sm">
              {error}
            </div>
          )}

          {!showForm ? (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="w-full mb-6 p-4 border-2 border-dashed border-oak-300 rounded-xl text-oak-600 hover:border-oak-500 hover:text-oak-800 hover:bg-oak-50 transition-all duration-200 flex items-center justify-center gap-2 font-medium"
            >
              <Plus className="w-5 h-5" />
              添加新采集批次
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="mb-6 p-5 bg-oak-50 border border-oak-200 rounded-xl">
              <h3 className="text-lg font-semibold text-oak-800 font-serif mb-4">
                {editingId ? '编辑采集批次' : '添加采集批次'}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-oak-700 mb-1.5">
                    批次名称 <span className="text-rust-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="如: 2024年夏季天目山考察"
                    className="input-field"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-oak-700 mb-1.5">
                      采集日期 <span className="text-rust-600">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.collectionDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, collectionDate: e.target.value }))}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-oak-700 mb-1.5">
                      采集地点
                    </label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                      placeholder="如: 浙江天目山"
                      className="input-field"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-oak-700 mb-1.5">
                    参与人员
                  </label>
                  <input
                    type="text"
                    value={formData.participants}
                    onChange={(e) => setFormData(prev => ({ ...prev, participants: e.target.value }))}
                    placeholder="如: 张三、李四、王五"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-oak-700 mb-1.5">
                    备注
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="批次描述、采集方法等..."
                    rows={2}
                    className="input-field resize-none"
                  />
                </div>
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="btn-secondary"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                  >
                    {editingId ? '保存' : '添加'}
                  </button>
                </div>
              </div>
            </form>
          )}

          <div className="space-y-3">
            {batches.length === 0 ? (
              <div className="text-center py-12">
                <ClipboardList className="w-16 h-16 text-oak-300 mx-auto mb-3" />
                <p className="text-oak-500">暂无采集批次，点击上方按钮添加</p>
              </div>
            ) : (
              batches.map((batch) => {
                const count = getSpecimensCountByBatchId(batch.id);
                return (
                  <div
                    key={batch.id}
                    className="card p-4 flex items-start justify-between"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-moss-100 flex items-center justify-center flex-shrink-0">
                        <ClipboardList className="w-5 h-5 text-moss-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-oak-800 font-serif">
                          {batch.name}
                        </h4>
                        {batch.location && (
                          <p className="text-sm text-oak-600 flex items-center gap-1 mt-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {batch.location}
                          </p>
                        )}
                        {batch.collectionDate && (
                          <p className="text-sm text-oak-600 flex items-center gap-1 mt-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {batch.collectionDate}
                          </p>
                        )}
                        {batch.participants && (
                          <p className="text-sm text-oak-600 flex items-center gap-1 mt-1">
                            <Users className="w-3.5 h-3.5" />
                            {batch.participants}
                          </p>
                        )}
                        {batch.notes && (
                          <p className="text-sm text-oak-500 mt-1 italic">
                            {batch.notes}
                          </p>
                        )}
                        <p className="text-xs text-oak-400 mt-2">
                          包含 {count} 件标本
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 ml-4">
                      <button
                        type="button"
                        onClick={() => handleEdit(batch)}
                        className="p-2 rounded-md hover:bg-oak-100 text-oak-500 hover:text-oak-700 transition-colors"
                        title="编辑"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(batch)}
                        className={`p-2 rounded-md transition-colors ${
                          count > 0
                            ? 'text-oak-300 cursor-not-allowed'
                            : 'hover:bg-rust-100 text-oak-500 hover:text-rust-700'
                        }`}
                        title={count > 0 ? '批次非空，无法删除' : '删除'}
                        disabled={count > 0}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
