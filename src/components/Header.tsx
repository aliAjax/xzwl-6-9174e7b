import { Bug, Plus, Package, ClipboardList, Hash } from 'lucide-react';

interface HeaderProps {
  onAddSpecimen: () => void;
  onManageBoxes: () => void;
  onManageBatches: () => void;
  onOpenGenerator: () => void;
}

export function Header({ onAddSpecimen, onManageBoxes, onManageBatches, onOpenGenerator }: HeaderProps) {
  return (
    <header className="bg-oak-800 text-parchment-50 shadow-lg sticky top-0 z-40">
      <div className="container px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-oak-700 flex items-center justify-center">
              <Bug className="w-6 h-6 text-parchment-100" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-wide">昆虫标本管理系统</h1>
              <p className="text-oak-300 text-xs font-sans">Insect Specimen Manager</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onManageBoxes}
              className="flex items-center gap-2 px-4 py-2 bg-oak-700 hover:bg-oak-600 rounded-md transition-colors duration-200 text-sm font-medium"
            >
              <Package className="w-4 h-4" />
              <span className="hidden sm:inline">展盒管理</span>
            </button>
            <button
              type="button"
              onClick={onManageBatches}
              className="flex items-center gap-2 px-4 py-2 bg-oak-700 hover:bg-oak-600 rounded-md transition-colors duration-200 text-sm font-medium"
            >
              <ClipboardList className="w-4 h-4" />
              <span className="hidden sm:inline">批次管理</span>
            </button>
            <button
              type="button"
              onClick={onOpenGenerator}
              className="flex items-center gap-2 px-4 py-2 bg-oak-700 hover:bg-oak-600 rounded-md transition-colors duration-200 text-sm font-medium"
            >
              <Hash className="w-4 h-4" />
              <span className="hidden sm:inline">编号生成</span>
            </button>
            <button
              type="button"
              onClick={onAddSpecimen}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>添加标本</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
