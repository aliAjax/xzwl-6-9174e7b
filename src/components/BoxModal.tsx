import { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, MapPin, Package } from 'lucide-react';
import type { Box, BoxFormData } from '../types';

interface BoxModalProps {
  isOpen: boolean;
  onClose: () => void;
  boxes: Box[];
  onAddBox: (data: BoxFormData) => void;
  onUpdateBox: (id: string, data: Partial<BoxFormData>) => void;
  onDeleteBox: (id: string) => void;
  getSpecimensCountByBoxId: (id: string) => number;
}

const initialFormData: BoxFormData = {
  name: '',
  location: '',
  notes: '',
};

export function BoxModal({
  isOpen,
  onClose,
  boxes,
  onAddBox,
  onUpdateBox,
  onDeleteBox,
  getSpecimensCountByBoxId,
}: BoxModalProps) {
  const [formData, setFormData] = useState<BoxFormData>(initialFormData);
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

  const handleEdit = (box: Box) => {
    setFormData({
      name: box.name,
      location: box.location,
      notes: box.notes,
    });
    setEditingId(box.id);
    setShowForm(true);
    setError('');
  };

  const handleDelete = (box: Box) => {
    const count = getSpecimensCountByBoxId(box.id);
    if (count > 0) {
      setError('无法删除包含标本的展盒，请先移除或迁移标本');
      return;
    }
    if (confirm(`确定要删除展盒 "${box.name}" 吗？`)) {
      try {
        onDeleteBox(box.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : '删除失败');
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('请输入展盒名称');
      return;
    }

    if (editingId) {
      onUpdateBox(editingId, formData);
    } else {
      onAddBox(formData);
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
          <h2 className="text-xl font-semibold text-oak-800 font-serif">展盒管理</h2>
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
              添加新展盒
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="mb-6 p-5 bg-oak-50 border border-oak-200 rounded-xl">
              <h3 className="text-lg font-semibold text-oak-800 font-serif mb-4">
                {editingId ? '编辑展盒' : '添加展盒'}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-oak-700 mb-1.5">
                    展盒名称 <span className="text-rust-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="如: 鞘翅目展盒 A"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-oak-700 mb-1.5">
                    存放位置
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="如: A柜-第1层"
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
                    placeholder="展盒描述..."
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
            {boxes.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-oak-300 mx-auto mb-3" />
                <p className="text-oak-500">暂无展盒，点击上方按钮添加</p>
              </div>
            ) : (
              boxes.map((box) => {
                const count = getSpecimensCountByBoxId(box.id);
                return (
                  <div
                    key={box.id}
                    className="card p-4 flex items-start justify-between"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-oak-100 flex items-center justify-center flex-shrink-0">
                        <Package className="w-5 h-5 text-oak-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-oak-800 font-serif">
                          {box.name}
                        </h4>
                        {box.location && (
                          <p className="text-sm text-oak-600 flex items-center gap-1 mt-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {box.location}
                          </p>
                        )}
                        {box.notes && (
                          <p className="text-sm text-oak-500 mt-1 italic">
                            {box.notes}
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
                        onClick={() => handleEdit(box)}
                        className="p-2 rounded-md hover:bg-oak-100 text-oak-500 hover:text-oak-700 transition-colors"
                        title="编辑"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(box)}
                        className={`p-2 rounded-md transition-colors ${
                          count > 0
                            ? 'text-oak-300 cursor-not-allowed'
                            : 'hover:bg-rust-100 text-oak-500 hover:text-rust-700'
                        }`}
                        title={count > 0 ? '展盒非空，无法删除' : '删除'}
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
