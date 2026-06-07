import { Package, MapPin } from 'lucide-react';
import type { Box, Specimen, CollectionBatch } from '../types';
import { SpecimenCard } from './SpecimenCard';

interface BoxGroupProps {
  box: Box;
  specimens: Specimen[];
  batches: CollectionBatch[];
  onSpecimenClick: (specimen: Specimen) => void;
  onTogglePhotographed: (id: string) => void;
  onTogglePinned: (id: string) => void;
  onDeleteSpecimen: (id: string) => void;
  index: number;
}

export function BoxGroup({
  box,
  specimens,
  batches,
  onSpecimenClick,
  onTogglePhotographed,
  onTogglePinned,
  onDeleteSpecimen,
  index,
}: BoxGroupProps) {
  const unphotographedCount = specimens.filter(s => !s.photographed).length;

  return (
    <section
      className="opacity-0 animate-fade-in-up"
      style={{ animationDelay: `${index * 0.1 + 0.3}s` }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-oak-100 flex items-center justify-center">
          <Package className="w-5 h-5 text-oak-700" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold text-oak-800 font-serif decorative-underline">
            {box.name}
          </h2>
          <div className="flex items-center gap-4 mt-1 text-sm">
            <span className="flex items-center gap-1 text-oak-500">
              <MapPin className="w-3.5 h-3.5" />
              {box.location}
            </span>
            <span className="text-oak-500">
              共 {specimens.length} 件标本
              {unphotographedCount > 0 && (
                <span className="text-rust-600 ml-1">
                  ({unphotographedCount} 件未拍照)
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      {box.notes && (
        <p className="text-sm text-oak-500 mb-4 italic pl-13">
          {box.notes}
        </p>
      )}

      {specimens.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {specimens.map((specimen, idx) => (
            <SpecimenCard
              key={specimen.id}
              specimen={specimen}
              batch={batches.find(b => b.id === specimen.batchId)}
              onClick={() => onSpecimenClick(specimen)}
              onTogglePhotographed={() => onTogglePhotographed(specimen.id)}
              onTogglePinned={() => onTogglePinned(specimen.id)}
              onDelete={() => onDeleteSpecimen(specimen.id)}
              index={idx}
            />
          ))}
        </div>
      ) : (
        <div className="card p-8 text-center">
          <Package className="w-12 h-12 text-oak-300 mx-auto mb-2" />
          <p className="text-oak-500">此展盒暂无标本</p>
        </div>
      )}
    </section>
  );
}
