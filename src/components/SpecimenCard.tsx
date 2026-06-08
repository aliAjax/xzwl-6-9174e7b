import { Camera, Pin, MapPin, Calendar, Edit2, Trash2, ClipboardList, FileEdit, Shield, Clock } from 'lucide-react';
import type { Specimen, CollectionBatch } from '../types';
import { COMPLIANCE_STATUS_OPTIONS } from '../types';
import { formatDate } from '../utils/helpers';

interface SpecimenCardProps {
  specimen: Specimen;
  batch: CollectionBatch | undefined;
  onClick: () => void;
  onTogglePhotographed: () => void;
  onTogglePinned: () => void;
  onDelete: () => void;
  index: number;
}

export function SpecimenCard({
  specimen,
  batch,
  onClick,
  onTogglePhotographed,
  onTogglePinned,
  onDelete,
  index,
}: SpecimenCardProps) {
  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const isDraft = !specimen.species.trim();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sAny = specimen as any;
  const permitNumber = sAny.permitNumber ?? '';
  const permitExpiryDate = sAny.permitExpiryDate ?? '';
  const complianceStatus = sAny.complianceStatus ?? 'not_relevant';

  return (
    <div
      className={`card p-4 cursor-pointer group opacity-0 animate-fade-in-up ${
        isDraft ? 'border-dashed border-oak-300' : ''
      }`}
      style={{ animationDelay: `${index * 0.05}s` }}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-block px-2 py-1 bg-oak-100 text-oak-700 text-xs font-mono rounded">
              {specimen.specimenNo}
            </span>
            {isDraft && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded">
                <FileEdit className="w-3 h-3" />
                草稿
              </span>
            )}
          </div>
          <h3 className="text-lg font-semibold text-oak-900 font-serif leading-tight">
            {isDraft ? (
              <span className="text-oak-400 italic">待鉴定物种...</span>
            ) : (
              specimen.species
            )}
          </h3>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => {
              handleActionClick(e);
              onClick();
            }}
            className="p-1.5 rounded-md hover:bg-oak-100 text-oak-500 hover:text-oak-700 transition-colors"
            title="编辑"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              handleActionClick(e);
              onDelete();
            }}
            className="p-1.5 rounded-md hover:bg-rust-100 text-oak-500 hover:text-rust-700 transition-colors"
            title="删除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm text-oak-600">
          <MapPin className="w-4 h-4 text-oak-400 flex-shrink-0" />
          <span className="truncate">
            {specimen.collectionLocation || (
              <span className="text-oak-400 italic">未填写采集地点</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-oak-600">
          <Calendar className="w-4 h-4 text-oak-400 flex-shrink-0" />
          <span>{formatDate(specimen.collectionDate)}</span>
        </div>
        {batch && (
          <div className="flex items-center gap-2 text-sm text-oak-600">
            <ClipboardList className="w-4 h-4 text-moss-500 flex-shrink-0" />
            <span className="truncate font-medium text-moss-700">{batch.name}</span>
          </div>
        )}
      </div>

      {specimen.notes && (
        <p className="text-sm text-oak-500 mb-4 line-clamp-2 italic">
          "{specimen.notes}"
        </p>
      )}

      {complianceStatus && complianceStatus !== 'not_relevant' && (
        <div className="mb-4">
          {(() => {
            const statusOption = COMPLIANCE_STATUS_OPTIONS.find(opt => opt.value === complianceStatus);
            if (!statusOption) return null;
            return (
              <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${statusOption.bgColor} ${statusOption.color} border ${statusOption.borderColor}`}>
                <Shield className="w-3 h-3" />
                {statusOption.label}
              </div>
            );
          })()}
        </div>
      )}

      {(permitNumber || permitExpiryDate) && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
          <div className="flex items-center gap-2 text-xs text-blue-700 font-medium mb-2">
            <Shield className="w-4 h-4" />
            许可证信息
          </div>
          {permitNumber && (
            <div className="flex items-center gap-2 text-sm text-blue-600 mb-1">
              <span className="text-blue-400">编号:</span>
              <span className="font-mono">{permitNumber}</span>
            </div>
          )}
          {permitExpiryDate && (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <Clock className="w-3 h-3 text-blue-400" />
              <span className="text-blue-400">有效期至:</span>
              <span>{formatDate(permitExpiryDate)}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-oak-100">
        <button
          type="button"
          onClick={(e) => {
            handleActionClick(e);
            onTogglePinned();
          }}
          className={`tag transition-all duration-200 ${
            specimen.pinnedStatus
              ? 'bg-moss-100 text-moss-700'
              : 'bg-oak-100 text-oak-500'
          }`}
        >
          <Pin className="w-3 h-3 mr-1" />
          {specimen.pinnedStatus ? '已针插' : '未针插'}
        </button>

        <button
          type="button"
          onClick={(e) => {
            handleActionClick(e);
            onTogglePhotographed();
          }}
          className={`tag transition-all duration-200 ${
            specimen.photographed
              ? 'bg-moss-100 text-moss-700'
              : 'bg-rust-100 text-rust-700'
          }`}
        >
          <Camera className="w-3 h-3 mr-1" />
          {specimen.photographed ? '已拍照' : '未拍照'}
        </button>
      </div>
    </div>
  );
}
