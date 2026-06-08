import { Bug, Plus, Package, ClipboardList, Hash, Camera, ArrowLeft, Download, Upload, MoveRight, Database, Printer, GitMerge } from 'lucide-react';

type ViewMode = 'main' | 'photography';

interface HeaderProps {
  viewMode: ViewMode;
  onAddSpecimen: () => void;
  onManageBoxes: () => void;
  onManageBatches: () => void;
  onOpenGenerator: () => void;
  onOpenPhotography: () => void;
  onOpenExport: () => void;
  onOpenImport: () => void;
  onOpenTransfer: () => void;
  onOpenBackupRestore: () => void;
  onOpenDiffMerge: () => void;
  onOpenLabelPrint: () => void;
  onBackToMain: () => void;
}

export function Header({
  viewMode,
  onAddSpecimen,
  onManageBoxes,
  onManageBatches,
  onOpenGenerator,
  onOpenPhotography,
  onOpenExport,
  onOpenImport,
  onOpenTransfer,
  onOpenBackupRestore,
  onOpenDiffMerge,
  onOpenLabelPrint,
  onBackToMain,
}: HeaderProps) {
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
            {viewMode === 'photography' ? (
              <button
                type="button"
                onClick={onBackToMain}
                className="flex items-center gap-2 px-4 py-2 bg-oak-700 hover:bg-oak-600 rounded-md transition-colors duration-200 text-sm font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">返回列表</span>
              </button>
            ) : (
              <>
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
                  onClick={onOpenTransfer}
                  className="flex items-center gap-2 px-4 py-2 bg-oak-700 hover:bg-oak-600 rounded-md transition-colors duration-200 text-sm font-medium"
                >
                  <MoveRight className="w-4 h-4" />
                  <span className="hidden sm:inline">展盒迁移</span>
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
                  onClick={onOpenImport}
                  className="flex items-center gap-2 px-4 py-2 bg-oak-700 hover:bg-oak-600 rounded-md transition-colors duration-200 text-sm font-medium"
                >
                  <Upload className="w-4 h-4" />
                  <span className="hidden sm:inline">导入数据</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenBackupRestore}
                  className="flex items-center gap-2 px-4 py-2 bg-oak-700 hover:bg-oak-600 rounded-md transition-colors duration-200 text-sm font-medium"
                >
                  <Database className="w-4 h-4" />
                  <span className="hidden sm:inline">备份恢复</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenDiffMerge}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 rounded-md transition-colors duration-200 text-sm font-medium"
                >
                  <GitMerge className="w-4 h-4" />
                  <span className="hidden sm:inline">差异合并</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenExport}
                  className="flex items-center gap-2 px-4 py-2 bg-oak-700 hover:bg-oak-600 rounded-md transition-colors duration-200 text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">导出数据</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenLabelPrint}
                  className="flex items-center gap-2 px-4 py-2 bg-moss-600 hover:bg-moss-700 rounded-md transition-colors duration-200 text-sm font-medium"
                >
                  <Printer className="w-4 h-4" />
                  <span className="hidden sm:inline">标签打印</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenPhotography}
                  className="flex items-center gap-2 px-4 py-2 bg-rust-600 hover:bg-rust-700 rounded-md transition-colors duration-200 text-sm font-medium"
                >
                  <Camera className="w-4 h-4" />
                  <span className="hidden sm:inline">拍照任务</span>
                </button>
                <button
                  type="button"
                  onClick={onAddSpecimen}
                  className="btn-primary flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>添加标本</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
