import { useState, useMemo, useCallback } from 'react';
import { X, Hash, AlertTriangle, CheckCircle, Copy } from 'lucide-react';
import type { SpecimenFormData, Box } from '../types';
import { getTodayString } from '../utils/helpers';

const ORDER_PREFIXES = [
  { value: 'COLE', label: 'COLE - 鞘翅目 (Coleoptera)', example: 'COLE-001' },
  { value: 'LEPI', label: 'LEPI - 鳞翅目 (Lepidoptera)', example: 'LEPI-001' },
  { value: 'HYME', label: 'HYME - 膜翅目 (Hymenoptera)', example: 'HYME-001' },
  { value: 'DIPT', label: 'DIPT - 双翅目 (Diptera)', example: 'DIPT-001' },
  { value: 'ORTH', label: 'ORTH - 直翅目 (Orthoptera)', example: 'ORTH-001' },
  { value: 'HEMI', label: 'HEMI - 半翅目 (Hemiptera)', example: 'HEMI-001' },
  { value: 'ODON', label: 'ODON - 蜻蜓目 (Odonata)', example: 'ODON-001' },
  { value: 'MANTO', label: 'MANTO - 螳螂目 (Mantodea)', example: 'MANTO-001' },
  { value: 'BLATT', label: 'BLATT - 蜚蠊目 (Blattodea)', example: 'BLATT-001' },
  { value: 'OTHER', label: '自定义前缀', example: 'XXXX-001' },
];

interface PreviewItem {
  specimenNo: string;
  exists: boolean;
}

interface SpecimenNoGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  boxes: Box[];
  checkSpecimenNoExists: (no: string) => boolean;
  addSpecimensBatch: (data: SpecimenFormData[]) => void;
}

export function SpecimenNoGenerator({
  isOpen,
  onClose,
  boxes,
  checkSpecimenNoExists,
  addSpecimensBatch,
}: SpecimenNoGeneratorProps) {
  const [orderPrefix, setOrderPrefix] = useState('COLE');
  const [customPrefix, setCustomPrefix] = useState('');
  const [startNumber, setStartNumber] = useState(1);
  const [quantity, setQuantity] = useState(10);
  const [numberPadding, setNumberPadding] = useState(3);
  const [defaultBoxId, setDefaultBoxId] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);

  const padNumber = (num: number, padding: number) => {
    return num.toString().padStart(padding, '0');
  };

  const generateSpecimenNo = useCallback((index: number) => {
    const prefix = orderPrefix === 'OTHER' ? customPrefix.toUpperCase() : orderPrefix;
    const number = startNumber + index;
    return `${prefix}-${padNumber(number, numberPadding)}`;
  }, [orderPrefix, customPrefix, startNumber, numberPadding]);

  const previewList = useMemo((): PreviewItem[] => {
    if (!isOpen) return [];
    const list: PreviewItem[] = [];
    for (let i = 0; i < quantity; i++) {
      const specimenNo = generateSpecimenNo(i);
      list.push({
        specimenNo,
        exists: checkSpecimenNoExists(specimenNo),
      });
    }
    return list;
  }, [quantity, generateSpecimenNo, checkSpecimenNoExists, isOpen]);

  const conflictCount = useMemo(() => {
    return previewList.filter(p => p.exists).length;
  }, [previewList]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleCreateDraft = () => {
    const newSpecimens: SpecimenFormData[] = previewList
      .filter(p => !p.exists)
      .map(p => ({
        specimenNo: p.specimenNo,
        species: '',
        collectionLocation: '',
        collectionDate: getTodayString(),
        pinnedStatus: false,
        boxId: defaultBoxId,
        batchId: '',
        photographed: false,
        notes: '',
      }));

    if (newSpecimens.length > 0) {
      addSpecimensBatch(newSpecimens);
    }

    setCreatedCount(newSpecimens.length);
    setSkippedCount(conflictCount);
    setShowSuccess(true);

    setTimeout(() => {
      setShowSuccess(false);
      onClose();
    }, 2000);
  };

  const handleCopyNumbers = () => {
    const numbers = previewList.map(p => p.specimenNo).join('\n');
    navigator.clipboard.writeText(numbers);
  };

  const resetForm = () => {
    setOrderPrefix('COLE');
    setCustomPrefix('');
    setStartNumber(1);
    setQuantity(10);
    setNumberPadding(3);
    setDefaultBoxId('');
    setShowSuccess(false);
    setCreatedCount(0);
    setSkippedCount(0);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  const effectivePrefix = orderPrefix === 'OTHER' ? customPrefix.toUpperCase() : orderPrefix;

  return (
    <div
      className="fixed inset-0 bg-oak-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-parchment-50 rounded-xl shadow-hover max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-scale-in scrollbar-thin">
        <div className="sticky top-0 bg-parchment-50 border-b border-oak-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-oak-100 flex items-center justify-center">
              <Hash className="w-5 h-5 text-oak-700" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-oak-800 font-serif">标本编号生成器</h2>
              <p className="text-sm text-oak-500">批量生成编号并创建空白草稿</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-oak-100 text-oak-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {showSuccess ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-moss-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-moss-600" />
            </div>
            <h3 className="text-xl font-semibold text-oak-800 font-serif mb-2">创建完成</h3>
            <p className="text-oak-600 mb-1">成功创建 {createdCount} 个标本草稿</p>
            {skippedCount > 0 && (
              <p className="text-rust-600 text-sm">跳过 {skippedCount} 个已存在的编号</p>
            )}
          </div>
        ) : (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-oak-700 mb-1.5">
                  目级前缀 <span className="text-rust-600">*</span>
                </label>
                <select
                  value={orderPrefix}
                  onChange={(e) => setOrderPrefix(e.target.value)}
                  className="input-field"
                >
                  {ORDER_PREFIXES.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {orderPrefix === 'OTHER' && (
                <div>
                  <label className="block text-sm font-medium text-oak-700 mb-1.5">
                    自定义前缀 <span className="text-rust-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={customPrefix}
                    onChange={(e) => setCustomPrefix(e.target.value.replace(/[^a-zA-Z]/g, ''))}
                    placeholder="如: CUST"
                    maxLength={10}
                    className="input-field font-mono uppercase"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-oak-700 mb-1.5">
                  起始序号 <span className="text-rust-600">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={99999}
                  value={startNumber}
                  onChange={(e) => setStartNumber(Math.max(1, parseInt(e.target.value) || 1))}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-oak-700 mb-1.5">
                  生成数量 <span className="text-rust-600">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Math.min(1000, parseInt(e.target.value) || 1)))}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-oak-700 mb-1.5">
                  序号位数
                </label>
                <select
                  value={numberPadding}
                  onChange={(e) => setNumberPadding(parseInt(e.target.value))}
                  className="input-field"
                >
                  <option value={2}>2 位 (如: 01)</option>
                  <option value={3}>3 位 (如: 001)</option>
                  <option value={4}>4 位 (如: 0001)</option>
                  <option value={5}>5 位 (如: 00001)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-oak-700 mb-1.5">
                  默认展盒
                </label>
                <select
                  value={defaultBoxId}
                  onChange={(e) => setDefaultBoxId(e.target.value)}
                  className="input-field"
                >
                  <option value="">暂不指定</option>
                  {boxes.map((box) => (
                    <option key={box.id} value={box.id}>
                      {box.name} ({box.location})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {conflictCount > 0 && (
              <div className="flex items-start gap-3 p-4 bg-rust-50 border border-rust-200 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-rust-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-rust-800">
                    检测到 {conflictCount} 个编号冲突
                  </p>
                  <p className="text-sm text-rust-600">
                    标红的编号已存在，创建时将自动跳过
                  </p>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-oak-800">
                  编号预览
                  <span className="ml-2 text-sm font-normal text-oak-500">
                    (共 {quantity} 个)
                  </span>
                </h3>
                <button
                  type="button"
                  onClick={handleCopyNumbers}
                  className="flex items-center gap-1.5 text-sm text-oak-600 hover:text-oak-800 transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  复制全部
                </button>
              </div>

              <div className="border border-oak-200 rounded-lg bg-parchment-50 max-h-64 overflow-y-auto scrollbar-thin">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 p-3">
                  {previewList.map((item, idx) => (
                    <div
                      key={idx}
                      className={`px-3 py-2 rounded-md font-mono text-sm text-center transition-colors ${
                        item.exists
                          ? 'bg-rust-100 text-rust-700 line-through'
                          : 'bg-oak-50 text-oak-700'
                      }`}
                      title={item.exists ? '该编号已存在' : ''}
                    >
                      {item.specimenNo}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex items-center gap-4 text-sm text-oak-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-oak-50 border border-oak-200"></span>
                  可创建: {quantity - conflictCount}
                </span>
                {conflictCount > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-rust-100 border border-rust-200"></span>
                    已存在: {conflictCount}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-oak-200">
              <button
                type="button"
                onClick={handleClose}
                className="btn-secondary"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleCreateDraft}
                disabled={quantity - conflictCount === 0}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                一键创建 {quantity - conflictCount} 个草稿
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
