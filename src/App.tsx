import { useState, useMemo } from 'react';
import type { Box, Specimen, SpecimenFormData, Filters } from './types';
import { useSpecimens } from './hooks/useSpecimens';
import { Header } from './components/Header';
import { StatsCard } from './components/StatsCard';
import { FilterBar } from './components/FilterBar';
import { BoxGroup } from './components/BoxGroup';
import { SpecimenModal } from './components/SpecimenModal';
import { BoxModal } from './components/BoxModal';
import { BatchModal } from './components/BatchModal';
import { SpecimenNoGenerator } from './components/SpecimenNoGenerator';
import { PhotographyTaskList } from './components/PhotographyTaskList';
import { Bug, ArrowLeft } from 'lucide-react';

type ViewMode = 'main' | 'photography';

const UNASSIGNED_BOX: Box = {
  id: '',
  name: '未分配展盒',
  location: '草稿标本',
  notes: '暂未指定展盒的标本草稿',
  createdAt: new Date().toISOString(),
};

function App() {
  const {
    boxes,
    specimens,
    batches,
    stats,
    addSpecimen,
    updateSpecimen,
    deleteSpecimen,
    togglePhotographed,
    markPhotographed,
    togglePinned,
    addBox,
    updateBox,
    deleteBox,
    getSpecimensCountByBoxId,
    addBatch,
    updateBatch,
    deleteBatch,
    getSpecimensCountByBatchId,
    checkSpecimenNoExists,
    addSpecimensBatch,
  } = useSpecimens();

  const [viewMode, setViewMode] = useState<ViewMode>('main');

  const [filters, setFilters] = useState<Filters>({
    search: '',
    onlyUnphotographed: false,
    boxId: '',
    batchId: '',
  });

  const [specimenModalOpen, setSpecimenModalOpen] = useState(false);
  const [editingSpecimen, setEditingSpecimen] = useState<Specimen | null>(null);
  const [boxModalOpen, setBoxModalOpen] = useState(false);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [generatorOpen, setGeneratorOpen] = useState(false);

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

      if (filters.boxId === '__unassigned__') {
        if (s.boxId) return false;
      } else if (filters.boxId && s.boxId !== filters.boxId) {
        return false;
      }

      if (filters.batchId && s.batchId !== filters.batchId) {
        return false;
      }

      return true;
    });
  }, [specimens, filters]);

  const boxesToShow = useMemo(() => {
    const unassignedSpecimens = filteredSpecimens.filter((s) => !s.boxId);
    let result = [...boxes];

    if (filters.boxId === '__unassigned__') {
      if (unassignedSpecimens.length > 0) {
        return [UNASSIGNED_BOX];
      }
      return [];
    } else if (filters.boxId) {
      result = boxes.filter((b) => b.id === filters.boxId);
    } else if (unassignedSpecimens.length > 0) {
      result = [UNASSIGNED_BOX, ...result];
    }

    return result;
  }, [boxes, filters.boxId, filteredSpecimens]);

  const getSpecimensForBox = (boxId: string) => {
    if (boxId === '') {
      return filteredSpecimens.filter((s) => !s.boxId);
    }
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
        viewMode={viewMode}
        onAddSpecimen={handleAddSpecimenClick}
        onManageBoxes={() => setBoxModalOpen(true)}
        onManageBatches={() => setBatchModalOpen(true)}
        onOpenGenerator={() => setGeneratorOpen(true)}
        onOpenPhotography={() => setViewMode('photography')}
        onBackToMain={() => setViewMode('main')}
      />

      <main className="flex-1 container px-4 py-6 md:py-8">
        {viewMode === 'photography' ? (
          <div className="space-y-6">
            <button
              type="button"
              onClick={() => setViewMode('main')}
              className="flex items-center gap-2 text-oak-600 hover:text-oak-800 font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              返回标本列表
            </button>
            <PhotographyTaskList
              specimens={specimens}
              boxes={boxes}
              batches={batches}
              onTogglePhotographed={togglePhotographed}
              onMarkPhotographed={(ids) => markPhotographed(ids, true)}
            />
          </div>
        ) : (
          <div className="space-y-6">
            <StatsCard stats={stats} />

            <FilterBar
              filters={filters}
              onFiltersChange={setFilters}
              boxes={boxes}
              batches={batches}
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
                    batches={batches}
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
        )}
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
        batches={batches}
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

      <BatchModal
        isOpen={batchModalOpen}
        onClose={() => setBatchModalOpen(false)}
        batches={batches}
        onAddBatch={addBatch}
        onUpdateBatch={updateBatch}
        onDeleteBatch={deleteBatch}
        getSpecimensCountByBatchId={getSpecimensCountByBatchId}
      />

      <SpecimenNoGenerator
        isOpen={generatorOpen}
        onClose={() => setGeneratorOpen(false)}
        boxes={boxes}
        checkSpecimenNoExists={checkSpecimenNoExists}
        addSpecimensBatch={addSpecimensBatch}
      />
    </div>
  );
}

export default App;
