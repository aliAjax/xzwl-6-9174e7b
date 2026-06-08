import { useState, useEffect, useMemo } from 'react';
import { X, Download, FileSpreadsheet } from 'lucide-react';
import type { Box, Specimen } from '../types';
import { generateSpecimenCsv, downloadCsv, formatDate, type ExportSpecimenData } from '../utils/helpers';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  specimens: Specimen[];
  boxes: Box[];
}

type ExportType = 'all' | 'unphotographed' | 'box';

export function ExportModal({ isOpen, onClose, specimens, boxes }: ExportModalProps) {
  const [exportType, setExportType] = useState<ExportType>('all');
  const [selectedBoxId, setSelectedBoxId] = useState<string>('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setExportType('all');
      setSelectedBoxId('');
      setError('');
    }
  }, [isOpen]);

  const exportData = useMemo((): ExportSpecimenData[] => {
    const getBoxName = (boxId: string): string => {
      if (!boxId) return '未分配';
      const box = boxes.find((b) => b.id === boxId);
      return box ? box.name : '未知展盒';
    };

    let filtered = [...specimens];

    if (exportType === 'unphotographed') {
      filtered = filtered.filter((s) => !s.photographed);
    } else if (exportType === 'box' && selectedBoxId) {
      if (selectedBoxId === '__unassigned__') {
        filtered = filtered.filter((s) => !s.boxId);
      } else {
        filtered = filtered.filter((s) => s.boxId === selectedBoxId);
      }
    }

    return filtered.map((s) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sAny = s as any;
      return {
        specimenNo: s.specimenNo,
        species: s.species,
        collectionLocation: s.collectionLocation,
        collectionDate: formatDate(s.collectionDate),
        pinnedStatus: s.pinnedStatus,
        photographed: s.photographed,
        boxName: getBoxName(s.boxId),
        notes: s.notes,
        complianceStatus: sAny.complianceStatus ?? 'not_relevant',
        permitNumber: sAny.permitNumber ?? '',
        permitExpiryDate: formatDate(sAny.permitExpiryDate ?? ''),
        complianceNotes: sAny.complianceNotes ?? '',
      };
    });
  }, [specimens, boxes, exportType, selectedBoxId]);

  const previewCount = exportData.length;

  const getBoxName = (boxId: string): string => {
    if (!boxId) return '未分配';
    const box = boxes.find((b) => b.id === boxId);
    return box ? box.name : '未知展盒';
  };

  const handleExport = () => {
    setError('');

    if (exportData.length === 0) {
      setError('没有可导出的标本数据');
      return;
    }

    try {
      const csvContent = generateSpecimenCsv(exportData);
      const today = new Date().toISOString().split('T')[0];
      let filename = `标本导出_${today}`;

      if (exportType === 'unphotographed') {
        filename = `未拍照标本_${today}`;
      } else if (exportType === 'box') {
        const boxName = getBoxName(selectedBoxId);
        filename = `${boxName}_标本_${today}`;
      }

      downloadCsv(csvContent, `${filename}.csv`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '导出失败');
    }
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
      <div className="bg-parchment-50 rounded-xl shadow-hover max-w-lg w-full overflow-hidden animate-scale-in flex flex-col">
        <div className="bg-parchment-50 border-b border-oak-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <h2 className="text-xl font-semibold text-oak-800 font-serif">导出标本数据</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-oak-100 text-oak-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 bg-rust-100 border border-rust-300 text-rust-800 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="space-y-6">
            <div className="p-4 bg-oak-50 border border-oak-200 rounded-xl">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-oak-100 flex items-center justify-center flex-shrink-0">
                  <FileSpreadsheet className="w-5 h-5 text-oak-700" />
                </div>
                <div>
                  <h3 className="font-semibold text-oak-800 font-serif">导出范围</h3>
                  <p className="text-sm text-oak-500">选择要导出的标本范围</p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 border border-oak-200 rounded-lg cursor-pointer hover:bg-oak-100 transition-colors">
                  <input
                    type="radio"
                    name="exportType"
                    checked={exportType === 'all'}
                    onChange={() => setExportType('all')}
                    className="w-4 h-4 text-rust-600"
                  />
                  <div>
                    <p className="font-medium text-oak-800">导出全部标本</p>
                    <p className="text-sm text-oak-500">导出所有 {specimens.length} 件标本</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 border border-oak-200 rounded-lg cursor-pointer hover:bg-oak-100 transition-colors">
                  <input
                    type="radio"
                    name="exportType"
                    checked={exportType === 'unphotographed'}
                    onChange={() => setExportType('unphotographed')}
                    className="w-4 h-4 text-rust-600"
                  />
                  <div>
                    <p className="font-medium text-oak-800">只导出未拍照标本</p>
                    <p className="text-sm text-oak-500">
                      共 {specimens.filter((s) => !s.photographed).length} 件未拍照
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 border border-oak-200 rounded-lg cursor-pointer hover:bg-oak-100 transition-colors">
                  <input
                    type="radio"
                    name="exportType"
                    checked={exportType === 'box'}
                    onChange={() => setExportType('box')}
                    className="w-4 h-4 text-rust-600"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-oak-800">导出指定展盒</p>
                    {exportType === 'box' && (
                      <select
                        value={selectedBoxId}
                        onChange={(e) => setSelectedBoxId(e.target.value)}
                        className="mt-2 w-full input-field"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="">请选择展盒</option>
                        <option value="__unassigned__">未分配展盒</option>
                        <option value="">---</option>
                        {boxes.map((box) => (
                          <option key={box.id} value={box.id}>
                            {box.name} ({specimens.filter((s) => s.boxId === box.id).length} 件)
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </label>
              </div>
            </div>

            <div className="p-4 bg-parchment-100 border border-oak-200 rounded-xl">
              <h4 className="font-medium text-oak-800 mb-2">导出字段</h4>
              <p className="text-sm text-oak-600">
                标本编号、物种名、采集地点、采集日期、针插状态、拍照状态、展盒名称、备注、合规状态、许可证编号、到期日期、合规备注
              </p>
            </div>

            <div className="text-center text-oak-600">
              <p className="text-lg font-semibold">
                预计导出 <span className="text-rust-600">{previewCount}</span> 条记录
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-oak-200 px-6 py-4 flex items-center justify-end gap-3 flex-shrink-0">
          <button type="button" onClick={onClose} className="btn-secondary">
            取消
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={previewCount === 0 || (exportType === 'box' && !selectedBoxId)}
            className="btn-primary flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            导出 CSV
          </button>
        </div>
      </div>
    </div>
  );
}
