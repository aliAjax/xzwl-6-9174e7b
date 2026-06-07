import { Camera, Pin, MapPin, Calendar, Edit2, Trash2 } from 'lucide-react';
import type { Specimen } from '../types';
import { formatDate } from '../utils/helpers';

interface SpecimenCardProps {
  specimen: Specimen;
  onClick: () => void;
  onTogglePhotographed: () => void;
  onTogglePinned: () => void;
  onDelete: () => void;
  index: number;
}

export function SpecimenCard({
  specimen,
  onClick,
  onTogglePhotographed,
  onTogglePinned,
  onDelete,
  index,
}: SpecimenCardProps) {
  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className="card p-4 cursor-pointer group opacity-0 animate-fade-in-up"
      style={{ animationDelay: `${index * 0.05}s` }}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="inline-block px-2 py-1 bg-oak-100 text-oak-700 text-xs font-mono rounded mb-2">
            {specimen.specimenNo}
          </span>
          <h3 className="text-lg font-semibold text-oak-900 font-serif leading-tight">
            {specimen.species}
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
          <span className="truncate">{specimen.collectionLocation}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-oak-600">
          <Calendar className="w-4 h-4 text-oak-400 flex-shrink-0" />
          <span>{formatDate(specimen.collectionDate)}</span>
        </div>
      </div>

      {specimen.notes && (
        <p className="text-sm text-oak-500 mb-4 line-clamp-2 italic">
          "{specimen.notes}"
        </p>
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
