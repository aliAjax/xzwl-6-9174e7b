import { useState, useMemo } from 'react';
import type { Specimen, SpecimenFormData, Filters } from './types';
import { useSpecimens } from './hooks/useSpecimens';
import { Header } from './components/Header';
import { StatsCard } from './components/StatsCard';
import { FilterBar } from './components/FilterBar';
import { BoxGroup } from './components/BoxGroup';
import { SpecimenModal } from './components/SpecimenModal';
import { BoxModal } from './components/BoxModal';
import { Bug } from 'lucide-react';

function App() {
  const {
    boxes,
    specimens,
    stats,
    addSpecimen,
    updateSpecimen,
    deleteSpecimen,
    togglePhotographed,
    togglePinned,
    addBox,
    updateBox,
    deleteBox,
    getSpecimensCountByBoxId,
  } = useSpecimens();

  const [filters, setFilters] = useState<Filters>({
    search: '',
    onlyUnphotographed: false,
    boxId: '',
  });

  const [specimenModalOpen, setSpecimenModalOpen] = useState(false);
  const [editingSpecimen, setEditingSpecimen] = useState<Specimen | null>(null);
  const [boxModalOpen, setBoxModalOpen] = useState(false);

  const filteredSpecimens = useMemo(() => {
    return specimens.filter((s) => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesNo = s.specimenNo.toLowerCase().includes(searchLower);
        const matchesSpecies = s.species.toLowerCase().includes(searchLower);
        if (!matchesNo && !matchesSpecies) return false;
      }

      if (filters.onlyUnphotographed && s.photographed) {
        return false;
      }

      if (filters.boxId && s.boxId !== filters.boxId) {
        return false;
      }

      return true;
    });
  }, [specimens, filters]);

  const boxesToShow = useMemo(() => {
    if (filters.boxId) {
      return boxes.filter((b) => b.id === filters.boxId);
    }
    return boxes;
  }, [boxes, filters.boxId]);

  const getSpecimensForBox = (boxId: string) => {
    return filteredSpecimens.filter((s) => s.boxId === boxId);
  };

  const handleAddSpecimenClick = () => {
    setEditingSpecimen(null);
    setSpecimenModalOpen(true);
  };

  const handleSpecimenClick = (specimen: Specimen) => {
    setEditingSpecimen(specimen);
    setSpecimenModalOpen(true);
  };

  const handleSpecimenSubmit = (data: SpecimenFormData) => {
    if (editingSpecimen) {
      updateSpecimen(editingSpecimen.id, data);
    } else {
      addSpecimen(data);
    }
    setSpecimenModalOpen(false);
    setEditingSpecimen(null);
  };

  const handleDeleteSpecimen = (id: string) => {
    const specimen = specimens.find((s) => s.id === id);
    if (specimen && confirm(`确定要删除标本 "${specimen.species}" (${specimen.specimenNo}) 吗？`)) {
      deleteSpecimen(id);
    }
  };

  const hasFilteredResults = boxesToShow.some((box) => getSpecimensForBox(box.id).length > 0);

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        onAddSpecimen={handleAddSpecimenClick}
        onManageBoxes={() => setBoxModalOpen(true)}
      />

      <main className="flex-1 container px-4 py-6 md:py-8">
        <div className="space-y-6">
          <StatsCard stats={stats} />

          <FilterBar
            filters={filters}
            onFiltersChange={setFilters}
            boxes={boxes}
          />

          {!hasFilteredResults && filteredSpecimens.length === 0 ? (
            <div className="card p-12 text-center">
              <Bug className="w-16 h-16 text-oak-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-oak-700 font-serif mb-2">
                未找到匹配的标本
              </h3>
              <p className="text-oak-500 mb-4">
                请尝试调整筛选条件，或添加新的标本记录
              </p>
              <button
                type="button"
                onClick={handleAddSpecimenClick}
                className="btn-primary"
              >
                添加第一件标本
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {boxesToShow.map((box, index) => (
                <BoxGroup
                  key={box.id}
                  box={box}
                  specimens={getSpecimensForBox(box.id)}
                  onSpecimenClick={handleSpecimenClick}
                  onTogglePhotographed={togglePhotographed}
                  onTogglePinned={togglePinned}
                  onDeleteSpecimen={handleDeleteSpecimen}
                  index={index}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-oak-200 bg-parchment-50 py-4 mt-8">
        <div className="container px-4 text-center text-oak-500 text-sm">
          昆虫标本管理系统 · 数据存储于本地浏览器
        </div>
      </footer>

      <SpecimenModal
        isOpen={specimenModalOpen}
        onClose={() => {
          setSpecimenModalOpen(false);
          setEditingSpecimen(null);
        }}
        onSubmit={handleSpecimenSubmit}
        specimen={editingSpecimen}
        boxes={boxes}
      />

      <BoxModal
        isOpen={boxModalOpen}
        onClose={() => setBoxModalOpen(false)}
        boxes={boxes}
        onAddBox={addBox}
        onUpdateBox={updateBox}
        onDeleteBox={deleteBox}
        getSpecimensCountByBoxId={getSpecimensCountByBoxId}
      />
    </div>
  );
}

export default App;
