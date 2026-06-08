import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { Box, Specimen, SpecimenFormData, CollectionBatch, ComplianceStatus } from '../types';
import { COMPLIANCE_STATUS_OPTIONS, DEFAULT_COMPLIANCE_STATUS } from '../types';
import { getTodayString } from '../utils/helpers';

interface SpecimenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SpecimenFormData) => void;
  specimen: Specimen | null;
  boxes: Box[];
  batches: CollectionBatch[];
}

const getInitialFormData = (): SpecimenFormData => ({
  specimenNo: '',
  species: '',
  collectionLocation: '',
  collectionDate: getTodayString(),
  pinnedStatus: true,
  boxId: '',
  batchId: '',
  photographed: false,
  notes: '',
  complianceStatus: DEFAULT_COMPLIANCE_STATUS,
  permitNumber: '',
  permitExpiryDate: '',
  complianceNotes: '',
});

export function SpecimenModal({ isOpen, onClose, onSubmit, specimen, boxes, batches }: SpecimenModalProps) {
  const [formData, setFormData] = useState<SpecimenFormData>(getInitialFormData());
  const [errors, setErrors] = useState<Partial<Record<keyof SpecimenFormData, string>>>({});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (specimen) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sAny = specimen as any;
        setFormData({
          specimenNo: specimen.specimenNo,
          species: specimen.species,
          collectionLocation: specimen.collectionLocation,
          collectionDate: specimen.collectionDate,
          pinnedStatus: specimen.pinnedStatus,
          boxId: specimen.boxId,
          batchId: specimen.batchId,
          photographed: specimen.photographed,
          notes: specimen.notes,
          complianceStatus: sAny.complianceStatus ?? DEFAULT_COMPLIANCE_STATUS,
          permitNumber: sAny.permitNumber ?? '',
          permitExpiryDate: sAny.permitExpiryDate ?? '',
          complianceNotes: sAny.complianceNotes ?? '',
        });
      } else {
        setFormData(getInitialFormData());
      }
      setErrors({});
    }
  }, [specimen, isOpen]);

  const handleChange = (field: keyof SpecimenFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRef.current) return;
    
    const formElement = formRef.current;
    const formData = new FormData(formElement);
    
    const submitData: SpecimenFormData = {
      specimenNo: (formData.get('specimenNo') as string) || '',
      species: (formData.get('species') as string) || '',
      collectionLocation: (formData.get('collectionLocation') as string) || '',
      collectionDate: (formData.get('collectionDate') as string) || getTodayString(),
      pinnedStatus: formData.get('pinnedStatus') === 'on',
      boxId: (formData.get('boxId') as string) || '',
      batchId: (formData.get('batchId') as string) || '',
      photographed: formData.get('photographed') === 'on',
      notes: (formData.get('notes') as string) || '',
      complianceStatus: (formData.get('complianceStatus') as ComplianceStatus) ?? DEFAULT_COMPLIANCE_STATUS,
      permitNumber: (formData.get('permitNumber') as string) ?? '',
      permitExpiryDate: (formData.get('permitExpiryDate') as string) ?? '',
      complianceNotes: (formData.get('complianceNotes') as string) ?? '',
    };

    const newErrors: Partial<Record<keyof SpecimenFormData, string>> = {};
    if (!submitData.specimenNo.trim()) newErrors.specimenNo = '请输入标本编号';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    onSubmit(submitData);
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
      <div className="bg-parchment-50 rounded-xl shadow-hover max-w-lg w-full max-h-[90vh] overflow-y-auto animate-scale-in scrollbar-thin">
        <div className="sticky top-0 bg-parchment-50 border-b border-oak-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-oak-800 font-serif">
            {specimen ? '编辑标本' : '添加标本'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-oak-100 text-oak-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-oak-700 mb-1.5">
                标本编号 <span className="text-rust-600">*</span>
              </label>
              <input
                type="text"
                name="specimenNo"
                value={formData.specimenNo}
                onChange={(e) => handleChange('specimenNo', e.target.value)}
                placeholder="如: COLE-001"
                className={`input-field font-mono ${errors.specimenNo ? 'border-rust-400' : ''}`}
              />
              {errors.specimenNo && (
                <p className="text-rust-600 text-xs mt-1">{errors.specimenNo}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-oak-700 mb-1.5">
                采集日期
              </label>
              <input
                type="date"
                name="collectionDate"
                value={formData.collectionDate}
                onChange={(e) => handleChange('collectionDate', e.target.value)}
                onInput={(e) => handleChange('collectionDate', e.currentTarget.value)}
                className="input-field"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-oak-700 mb-1.5">
              物种名 <span className="text-oak-400 text-xs font-normal">(建议填写)</span>
            </label>
            <input
              type="text"
              name="species"
              value={formData.species}
              onChange={(e) => handleChange('species', e.target.value)}
              placeholder="如: 中华大扁锹"
              className={`input-field ${errors.species ? 'border-rust-400' : ''}`}
            />
            {errors.species && (
              <p className="text-rust-600 text-xs mt-1">{errors.species}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-oak-700 mb-1.5">
              采集地点
            </label>
            <input
              type="text"
              name="collectionLocation"
              value={formData.collectionLocation}
              onChange={(e) => handleChange('collectionLocation', e.target.value)}
              placeholder="如: 浙江天目山"
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-oak-700 mb-1.5">
              所属展盒 <span className="text-oak-400 text-xs font-normal">(建议填写)</span>
            </label>
            <select
              name="boxId"
              value={formData.boxId}
              onChange={(e) => handleChange('boxId', e.target.value)}
              className={`input-field ${errors.boxId ? 'border-rust-400' : ''}`}
            >
              <option value="">请选择展盒</option>
              {boxes.map((box) => (
                <option key={box.id} value={box.id}>
                  {box.name} ({box.location})
                </option>
              ))}
            </select>
            {errors.boxId && (
              <p className="text-rust-600 text-xs mt-1">{errors.boxId}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-oak-700 mb-1.5">
              采集批次
            </label>
            <select
              name="batchId"
              value={formData.batchId}
              onChange={(e) => handleChange('batchId', e.target.value)}
              className="input-field"
            >
              <option value="">未关联批次</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="pinnedStatus"
                checked={formData.pinnedStatus}
                onChange={(e) => handleChange('pinnedStatus', e.target.checked)}
                className="w-4 h-4 rounded border-oak-300 text-oak-800 focus:ring-oak-500"
              />
              <span className="text-sm font-medium text-oak-700">已针插</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="photographed"
                checked={formData.photographed}
                onChange={(e) => handleChange('photographed', e.target.checked)}
                className="w-4 h-4 rounded border-oak-300 text-oak-800 focus:ring-oak-500"
              />
              <span className="text-sm font-medium text-oak-700">已拍照</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-oak-700 mb-1.5">
              备注
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="补充描述信息..."
              rows={3}
              className="input-field resize-none"
            />
          </div>

          <div className="space-y-4 rounded-lg border border-oak-200 bg-oak-50 p-4">
            <div>
              <label className="block text-sm font-medium text-oak-700 mb-1.5">
                合规状态
              </label>
              <select
                name="complianceStatus"
                value={formData.complianceStatus}
                onChange={(e) => handleChange('complianceStatus', e.target.value)}
                className="input-field"
              >
                {COMPLIANCE_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-oak-700 mb-1.5">
                  许可证编号
                </label>
                <input
                  type="text"
                  name="permitNumber"
                  value={formData.permitNumber}
                  onChange={(e) => handleChange('permitNumber', e.target.value)}
                  placeholder="如: BH-2024-FJ-0015"
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-oak-700 mb-1.5">
                  到期日期
                </label>
                <input
                  type="date"
                  name="permitExpiryDate"
                  value={formData.permitExpiryDate}
                  onChange={(e) => handleChange('permitExpiryDate', e.target.value)}
                  className="input-field"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-oak-700 mb-1.5">
                合规备注
              </label>
              <textarea
                name="complianceNotes"
                value={formData.complianceNotes}
                onChange={(e) => handleChange('complianceNotes', e.target.value)}
                placeholder="补充保护等级、外来物种管理要求或采集许可说明..."
                rows={3}
                className="input-field resize-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-oak-200">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
            >
              取消
            </button>
            <button
              type="submit"
              className="btn-primary"
            >
              {specimen ? '保存修改' : '添加标本'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
