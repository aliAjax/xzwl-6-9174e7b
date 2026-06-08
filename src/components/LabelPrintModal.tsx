import { useState, useMemo, useEffect } from 'react';
import { X, Printer, FileText, Search, Check, Filter, AlertTriangle, Grid3X3, LayoutGrid, Settings, Eye } from 'lucide-react';
import type { Box, Specimen, CollectionBatch, Filters, LabelTemplateType, PaperSizeType, LabelPrintSettings, SpecimenLabelData, LabelFieldCheckResult } from '../types';
import { LABEL_TEMPLATES, PAPER_SIZES } from '../types';
import { formatDate } from '../utils/common';
import { getSpecimenLabelData, batchCheckLabelFields, generateLabelPages, getPrintStyles } from '../utils/labelPrint';
import { useLocalStorage } from '../hooks/useLocalStorage';

interface LabelPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  boxes: Box[];
  specimens: Specimen[];
  batches: CollectionBatch[];
  currentFilters: Filters;
  filteredSpecimens: Specimen[];
}

const UNASSIGNED_BOX: Box = {
  id: '',
  name: '未分配展盒',
  location: '草稿标本',
  notes: '暂未指定展盒的标本草稿',
  createdAt: new Date().toISOString(),
};

const FONT_SIZE_CLASSES = {
  small: 'text-[8px]',
  medium: 'text-[10px]',
  large: 'text-[12px]',
};

const FONT_SIZE_LABELS = {
  small: '小号',
  medium: '中号',
  large: '大号',
};

export function LabelPrintModal({
  isOpen,
  onClose,
  boxes,
  specimens,
  batches,
  currentFilters,
  filteredSpecimens,
}: LabelPrintModalProps) {
  const [step, setStep] = useState<'select' | 'settings' | 'preview'>('select');
  const [selectedSpecimenIds, setSelectedSpecimenIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [boxFilter, setBoxFilter] = useState<string>('');
  const [fieldCheckResults, setFieldCheckResults] = useState<LabelFieldCheckResult[]>([]);
  const [showFieldCheck, setShowFieldCheck] = useState(false);
  const [showFieldCompletionAlert, setShowFieldCompletionAlert] = useState(false);
  const [pendingNextStep, setPendingNextStep] = useState<'settings' | 'preview' | null>(null);
  const [settings, setSettings] = useLocalStorage<LabelPrintSettings>('label-print-settings', {
    templateType: 'pin',
    paperSize: 'A4',
    showGrid: true,
    fontSize: 'small',
  });

  const allBoxes = useMemo(() => {
    const unassignedExists = specimens.some(s => !s.boxId);
    return unassignedExists ? [UNASSIGNED_BOX, ...boxes] : boxes;
  }, [boxes, specimens]);

  const filteredSpecimensForPrint = useMemo(() => {
    let result = specimens;

    if (boxFilter === '__unassigned__') {
      result = result.filter(s => !s.boxId);
    } else if (boxFilter) {
      result = result.filter(s => s.boxId === boxFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(s =>
        s.specimenNo.toLowerCase().includes(query) ||
        s.species.toLowerCase().includes(query)
      );
    }

    return result;
  }, [specimens, boxFilter, searchQuery]);

  const selectedSpecimens = useMemo(() => {
    return specimens.filter(s => selectedSpecimenIds.has(s.id));
  }, [specimens, selectedSpecimenIds]);

  const hasActiveFilters = currentFilters.search || currentFilters.onlyUnphotographed || currentFilters.boxId || currentFilters.batchId;

  useEffect(() => {
    if (isOpen) {
      setStep('select');
      setSelectedSpecimenIds(new Set());
      setSearchQuery('');
      setBoxFilter('');
      setShowFieldCheck(false);
      setShowFieldCompletionAlert(false);
      setPendingNextStep(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedSpecimens.length > 0) {
      const { results } = batchCheckLabelFields(selectedSpecimens, boxes);
      setFieldCheckResults(results);
    } else {
      setFieldCheckResults([]);
    }
  }, [selectedSpecimens, boxes]);

  const selectAllFromFiltered = () => {
    setSelectedSpecimenIds(new Set(filteredSpecimens.map(s => s.id)));
  };

  const toggleSelectSpecimen = (id: string) => {
    setSelectedSpecimenIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedSpecimenIds(new Set(filteredSpecimensForPrint.map(s => s.id)));
  };

  const clearSelection = () => {
    setSelectedSpecimenIds(new Set());
  };

  const getBatchById = (id: string) => batches.find(b => b.id === id);

  const handlePrint = () => {
    const styleEl = document.createElement('style');
    styleEl.innerHTML = getPrintStyles();
    document.head.appendChild(styleEl);

    setTimeout(() => {
      window.print();
      document.head.removeChild(styleEl);
    }, 100);
  };

  const handleClose = () => {
    setStep('select');
    setSelectedSpecimenIds(new Set());
    setSearchQuery('');
    setBoxFilter('');
    setShowFieldCheck(false);
    setShowFieldCompletionAlert(false);
    setPendingNextStep(null);
    onClose();
  };

  const updateSetting = <K extends keyof LabelPrintSettings>(
    key: K,
    value: LabelPrintSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleNextWithFieldCheck = (nextStep: 'settings' | 'preview') => {
    if (invalidResults.length > 0) {
      setPendingNextStep(nextStep);
      setShowFieldCompletionAlert(true);
    } else {
      setStep(nextStep);
    }
  };

  const handleSkipIncompleteSpecimens = () => {
    const invalidSpecimenIds = new Set(invalidResults.map(r => r.specimenId));
    setSelectedSpecimenIds(prev => {
      const next = new Set(prev);
      invalidSpecimenIds.forEach(id => next.delete(id));
      return next;
    });
    setShowFieldCompletionAlert(false);
    if (pendingNextStep) {
      setStep(pendingNextStep);
    }
    setPendingNextStep(null);
  };

  const handleContinueWithIncomplete = () => {
    setShowFieldCompletionAlert(false);
    if (pendingNextStep) {
      setStep(pendingNextStep);
    }
    setPendingNextStep(null);
  };

  const template = LABEL_TEMPLATES[settings.templateType];
  const paperSize = PAPER_SIZES[settings.paperSize];
  const labelsPerPage = template.perPage[settings.paperSize];
  const labelsPerRow = template.perRow[settings.paperSize];

  const labelDataList = useMemo(() => {
    return selectedSpecimens.map(s => getSpecimenLabelData(s, boxes));
  }, [selectedSpecimens, boxes]);

  const labelPages = useMemo(() => {
    return generateLabelPages(labelDataList, labelsPerPage);
  }, [labelDataList, labelsPerPage]);

  const invalidResults = useMemo(() => {
    return fieldCheckResults.filter(r => !r.isValid);
  }, [fieldCheckResults]);

  const renderLabel = (labelData: SpecimenLabelData, index: number) => {
    if (settings.templateType === 'pin') {
      return (
        <div
          key={index}
          className={`label-item flex flex-col justify-between p-1 bg-white border border-black/30 ${FONT_SIZE_CLASSES[settings.fontSize]}`}
          style={{
            width: `${template.width}mm`,
            height: `${template.height}mm`,
          }}
        >
          <div className="flex justify-between items-center">
            <span className="font-mono font-bold">{labelData.specimenNo}</span>
            <span className={`px-0.5 rounded text-[6px] ${labelData.photographed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {labelData.photographed ? '已拍' : '未拍'}
            </span>
          </div>
          <div className="font-bold font-serif text-center leading-tight">
            {labelData.species}
          </div>
          <div className="text-[7px] text-center truncate">
            {labelData.collectionLocation}
          </div>
          <div className="flex justify-between text-[6px]">
            <span>{formatDate(labelData.collectionDate)}</span>
            <span className="truncate max-w-[50%]">{labelData.boxLocation || '-'}</span>
          </div>
        </div>
      );
    }

    return (
      <div
        key={index}
        className={`label-item flex flex-col p-1.5 bg-white border border-black/30 ${FONT_SIZE_CLASSES[settings.fontSize]}`}
        style={{
          width: `${template.width}mm`,
          height: `${template.height}mm`,
        }}
      >
        <div className="flex justify-between items-start mb-0.5">
          <span className="font-mono font-bold">{labelData.specimenNo}</span>
          <span className={`px-1 rounded ${labelData.photographed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {labelData.photographed ? '已拍' : '未拍'}
          </span>
        </div>
        <div className="font-bold font-serif mb-0.5">{labelData.species}</div>
        <div className="flex justify-between text-[8px]">
          <span>采集: {labelData.collectionLocation}</span>
          <span>日期: {formatDate(labelData.collectionDate)}</span>
        </div>
        <div className="flex justify-between text-[8px] mt-0.5">
          <span>展盒: {labelData.boxName}</span>
          <span>位置: {labelData.boxLocation || '-'}</span>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-parchment-50 rounded-2xl shadow-2xl w-full max-w-7xl max-h-[95vh] flex flex-col animate-fade-in">
        <div className="flex items-center justify-between p-6 border-b border-oak-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-oak-100 flex items-center justify-center">
              <Printer className="w-5 h-5 text-oak-700" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-oak-800 font-serif">
                标签打印
              </h2>
              <p className="text-sm text-oak-500">
                {step === 'select' && '选择需要打印标签的标本'}
                {step === 'settings' && '配置标签模板和纸张规格'}
                {step === 'preview' && '预览并打印标签'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-oak-100 text-oak-500 hover:text-oak-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-4 px-6 py-3 border-b border-oak-200 bg-oak-50">
          {[
            { key: 'select', label: '选择标本', icon: FileText },
            { key: 'settings', label: '打印设置', icon: Settings },
            { key: 'preview', label: '预览打印', icon: Eye },
          ].map(({ key, label, icon: Icon }) => {
            const targetStep = key as typeof step;
            const stepOrder = ['select', 'settings', 'preview'];
            const currentIndex = stepOrder.indexOf(step);
            const targetIndex = stepOrder.indexOf(targetStep);
            const isForward = targetIndex > currentIndex;

            const handleStepClick = () => {
              if (selectedSpecimens.length === 0 && key !== 'select') return;
              if (key === 'select') {
                setStep(targetStep);
              } else if (isForward) {
                handleNextWithFieldCheck(targetStep as 'settings' | 'preview');
              } else {
                setStep(targetStep);
              }
            };

            return (
              <button
                key={key}
                type="button"
                onClick={handleStepClick}
                disabled={key !== 'select' && selectedSpecimens.length === 0}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
                  step === key
                    ? 'bg-oak-700 text-parchment-50'
                    : selectedSpecimens.length > 0 || key === 'select'
                    ? 'bg-parchment-50 text-oak-700 hover:bg-oak-100 border border-oak-300'
                    : 'bg-oak-100 text-oak-400 cursor-not-allowed border border-oak-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            );
          })}
          <div className="flex-1" />
          {selectedSpecimens.length > 0 && (
            <>
              <span className="tag bg-oak-100 text-oak-700">
                已选 {selectedSpecimens.length} 件标本
              </span>
              {invalidResults.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowFieldCheck(!showFieldCheck)}
                  className={`tag ${showFieldCheck ? 'bg-rust-500 text-parchment-50' : 'bg-rust-100 text-rust-700 hover:bg-rust-200'}`}
                >
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {invalidResults.length} 件字段缺失
                </button>
              )}
            </>
          )}
        </div>

        {showFieldCheck && invalidResults.length > 0 && (
          <div className="bg-rust-50 border-b border-rust-200 p-4">
            <h4 className="text-sm font-semibold text-rust-800 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              以下标本存在必填字段缺失，标签内容可能不完整：
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-32 overflow-y-auto scrollbar-thin">
              {invalidResults.map(result => (
                <div key={result.specimenId} className="text-xs text-rust-700 bg-rust-100 p-2 rounded">
                  <span className="font-mono font-medium">{result.specimenNo}</span>
                  <span className="text-rust-500"> 缺少: {result.missingFields.join('、')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          {step === 'select' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-oak-700 whitespace-nowrap">
                    展盒筛选:
                  </label>
                  <select
                    value={boxFilter}
                    onChange={(e) => setBoxFilter(e.target.value)}
                    className="input-field max-w-48"
                  >
                    <option value="">全部展盒</option>
                    <option value="__unassigned__">未分配展盒</option>
                    <option value="">---</option>
                    {allBoxes.map((box) => (
                      <option key={box.id || '__unassigned__'} value={box.id || '__unassigned__'}>
                        {box.name} ({specimens.filter(s => s.boxId === box.id).length} 件)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="relative flex-1 min-w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-oak-400" />
                  <input
                    type="text"
                    placeholder="搜索标本编号或物种名..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input-field pl-10"
                  />
                </div>

                <div className="flex items-center gap-2">
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={selectAllFromFiltered}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-oak-100 text-oak-700 rounded-md hover:bg-oak-200 transition-colors"
                    >
                      <Filter className="w-4 h-4" />
                      选择当前筛选结果 ({filteredSpecimens.length} 件)
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-sm text-oak-600 hover:text-oak-800 font-medium px-3 py-2"
                  >
                    全选 ({filteredSpecimensForPrint.length} 件)
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="text-sm text-oak-600 hover:text-oak-800 font-medium px-3 py-2"
                  >
                    清空
                  </button>
                </div>
              </div>

              {filteredSpecimensForPrint.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[60vh] overflow-y-auto p-1 scrollbar-thin">
                  {filteredSpecimensForPrint.map((specimen, idx) => {
                    const isSelected = selectedSpecimenIds.has(specimen.id);
                    const batch = specimen.batchId ? getBatchById(specimen.batchId) : null;
                    const fieldResult = fieldCheckResults.find(r => r.specimenId === specimen.id);
                    const hasMissingFields = fieldResult && !fieldResult.isValid;

                    return (
                      <div
                        key={specimen.id}
                        className={`card p-3 cursor-pointer transition-all ${
                          isSelected ? 'ring-2 ring-oak-500 bg-oak-50' : 'hover:bg-oak-50'
                        } ${hasMissingFields ? 'border-rust-300' : ''}`}
                        onClick={() => toggleSelectSpecimen(specimen.id)}
                        style={{ animationDelay: `${idx * 0.02}s` }}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                              isSelected
                                ? 'bg-oak-700 border-oak-700'
                                : 'border-oak-300 hover:border-oak-500'
                            }`}
                          >
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-parchment-50" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="inline-block px-2 py-0.5 bg-oak-100 text-oak-700 text-xs font-mono rounded">
                                {specimen.specimenNo}
                              </span>
                              {hasMissingFields && (
                                <span className="text-rust-500">
                                  <AlertTriangle className="w-3 h-3" />
                                </span>
                              )}
                            </div>
                            <h4 className="font-semibold text-oak-900 font-serif text-sm leading-tight mb-1">
                              {specimen.species || (
                                <span className="text-oak-400 italic">待鉴定物种...</span>
                              )}
                            </h4>
                            <div className="text-xs text-oak-600">
                              <span>采集: {specimen.collectionLocation || '未填写'}</span>
                            </div>
                            {batch && (
                              <div className="text-xs text-moss-600 font-medium">
                                批次: {batch.name}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="card p-12 text-center">
                  <Search className="w-12 h-12 text-oak-300 mx-auto mb-2" />
                  <p className="text-oak-500">
                    {searchQuery || boxFilter ? '未找到匹配的标本' : '暂无标本数据'}
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 'settings' && (
            <div className="space-y-6 max-w-3xl mx-auto">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-oak-800 font-serif flex items-center gap-2">
                  <LayoutGrid className="w-5 h-5" />
                  选择标签模板
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(['pin', 'box'] as LabelTemplateType[]).map(type => {
                    const t = LABEL_TEMPLATES[type];
                    const isSelected = settings.templateType === type;
                    return (
                      <div
                        key={type}
                        onClick={() => updateSetting('templateType', type)}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-oak-500 bg-oak-50'
                            : 'border-oak-200 bg-parchment-50 hover:border-oak-300'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`flex-shrink-0 border border-black/30 bg-white ${
                              type === 'pin' ? 'w-28 h-20' : 'w-32 h-20'
                            }`}
                          >
                            {type === 'pin' ? (
                              <div className="w-full h-full flex flex-col justify-between p-1 text-[7px]">
                                <div className="flex justify-between items-center">
                                  <span className="font-mono font-bold">NO.001</span>
                                  <span className="px-0.5 bg-green-100 text-green-700 rounded text-[5px]">已拍</span>
                                </div>
                                <div className="font-bold text-center">物种名</div>
                                <div className="text-center truncate">采集地点</div>
                                <div className="flex justify-between text-[6px]">
                                  <span>2024-01-15</span>
                                  <span>位置A</span>
                                </div>
                              </div>
                            ) : (
                              <div className="w-full h-full flex flex-col p-1 text-[8px]">
                                <div className="flex justify-between">
                                  <span className="font-mono font-bold">NO.001</span>
                                  <span className="px-0.5 bg-green-100 text-green-700 rounded">已拍</span>
                                </div>
                                <div className="font-bold">物种名</div>
                                <div>采集: 采集地</div>
                                <div>展盒: 展盒名</div>
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-oak-800">{t.label}</h4>
                            <p className="text-sm text-oak-500 mt-1">{t.description}</p>
                            <div className="mt-2 text-xs text-oak-600">
                              尺寸: {t.width}mm × {t.height}mm
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-oak-800 font-serif flex items-center gap-2">
                  <Grid3X3 className="w-5 h-5" />
                  纸张规格
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(['A4', 'A5'] as PaperSizeType[]).map(size => {
                    const ps = PAPER_SIZES[size];
                    const isSelected = settings.paperSize === size;
                    const perPage = LABEL_TEMPLATES[settings.templateType].perPage[size];
                    const perRow = LABEL_TEMPLATES[settings.templateType].perRow[size];
                    return (
                      <div
                        key={size}
                        onClick={() => updateSetting('paperSize', size)}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-oak-500 bg-oak-50'
                            : 'border-oak-200 bg-parchment-50 hover:border-oak-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold text-oak-800">{size}</h4>
                            <p className="text-sm text-oak-500">{ps.label}</p>
                          </div>
                          <div className="text-right text-xs text-oak-600">
                            <div>每行 {perRow} 个标签</div>
                            <div>每页 {perPage} 个标签</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-oak-800 font-serif">其他设置</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-oak-700">字体大小</label>
                    <div className="flex gap-2">
                      {(['small', 'medium', 'large'] as const).map(size => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => updateSetting('fontSize', size)}
                          className={`flex-1 px-4 py-2 rounded-md transition-all ${
                            settings.fontSize === size
                              ? 'bg-oak-700 text-parchment-50'
                              : 'bg-parchment-50 border border-oak-300 text-oak-700 hover:bg-oak-50'
                          }`}
                        >
                          {FONT_SIZE_LABELS[size]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-oak-700">显示选项</label>
                    <button
                      type="button"
                      onClick={() => updateSetting('showGrid', !settings.showGrid)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all w-full justify-center ${
                        settings.showGrid
                          ? 'bg-oak-700 text-parchment-50'
                          : 'bg-parchment-50 border border-oak-300 text-oak-700 hover:bg-oak-50'
                      }`}
                    >
                      <Grid3X3 className="w-4 h-4" />
                      {settings.showGrid ? '显示裁切参考线' : '隐藏裁切参考线'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-oak-50 rounded-xl p-4 border border-oak-200">
                <h4 className="font-semibold text-oak-800 mb-2">打印信息预览</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-oak-500">已选标本</span>
                    <div className="font-semibold text-oak-800">{selectedSpecimens.length} 件</div>
                  </div>
                  <div>
                    <span className="text-oak-500">纸张规格</span>
                    <div className="font-semibold text-oak-800">{settings.paperSize}</div>
                  </div>
                  <div>
                    <span className="text-oak-500">标签模板</span>
                    <div className="font-semibold text-oak-800">{template.label}</div>
                  </div>
                  <div>
                    <span className="text-oak-500">需打印页数</span>
                    <div className="font-semibold text-oak-800">{labelPages.length} 页</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div id="label-print-area" className="space-y-6">
              <div className="bg-oak-100 border border-oak-300 rounded-xl p-4 mb-6 print:hidden">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-oak-800">{labelDataList.length}</div>
                      <div className="text-sm text-oak-600">最终打印标签数</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-oak-800">{labelPages.length}</div>
                      <div className="text-sm text-oak-600">总页数</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-oak-800">{labelsPerPage}</div>
                      <div className="text-sm text-oak-600">每页标签数</div>
                    </div>
                    {invalidResults.length > 0 && (
                      <div className="text-center">
                        <div className="text-2xl font-bold text-rust-600">{invalidResults.length}</div>
                        <div className="text-sm text-rust-600">字段缺失标本</div>
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-oak-600">
                    已选 {selectedSpecimens.length} 件标本
                    {invalidResults.length > 0 && (
                      <span className="text-rust-600 ml-2">
                        （{invalidResults.length} 件存在字段缺失，将打印不完整的标签）
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mb-4 print:hidden">
                <div className="text-sm text-oak-600">
                  共 {labelPages.length} 页，{labelDataList.length} 个标签
                </div>
              </div>

              {labelPages.map((page, pageIndex) => (
                <div
                  key={pageIndex}
                  className="label-page bg-white shadow-lg mx-auto p-4"
                  style={{
                    width: `${paperSize.width}mm`,
                    minHeight: `${paperSize.height}mm`,
                  }}
                >
                  <div
                    className="grid gap-1"
                    style={{
                      gridTemplateColumns: `repeat(${labelsPerRow}, 1fr)`,
                      justifyItems: 'center',
                    }}
                  >
                    {page.map((labelData, idx) => (
                      <div
                        key={idx}
                        className="relative"
                        style={{
                          padding: settings.showGrid ? '2mm' : '0',
                        }}
                      >
                        {settings.showGrid && (
                          <div className="absolute inset-0 border border-dashed border-oak-300 pointer-events-none" />
                        )}
                        {renderLabel(labelData, pageIndex * labelsPerPage + idx)}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-oak-200 bg-parchment-100">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-oak-600">
              {step === 'select' && selectedSpecimens.length > 0 && (
                <span>
                  已选择 <strong className="text-oak-800">{selectedSpecimens.length}</strong> 件标本
                  {invalidResults.length > 0 && (
                    <span className="text-rust-600 ml-2">
                      （{invalidResults.length} 件存在字段缺失）
                    </span>
                  )}
                </span>
              )}
              {step === 'settings' && (
                <span>
                  将打印 <strong className="text-oak-800">{selectedSpecimens.length}</strong> 个标签，
                  共 <strong className="text-oak-800">{labelPages.length}</strong> 页
                </span>
              )}
              {step === 'preview' && (
                <span>
                  请确认预览内容，然后点击"开始打印"
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {step === 'select' && (
                <>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="btn-secondary"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNextWithFieldCheck('settings')}
                    disabled={selectedSpecimens.length === 0}
                    className={`btn-primary ${
                      selectedSpecimens.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    下一步
                  </button>
                </>
              )}
              {step === 'settings' && (
                <>
                  <button
                    type="button"
                    onClick={() => setStep('select')}
                    className="btn-secondary"
                  >
                    上一步
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNextWithFieldCheck('preview')}
                    className="btn-primary"
                  >
                    预览标签
                  </button>
                </>
              )}
              {step === 'preview' && (
                <>
                  <button
                    type="button"
                    onClick={() => setStep('settings')}
                    className="btn-secondary"
                  >
                    返回设置
                  </button>
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="btn-primary flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    开始打印 {labelDataList.length} 张标签
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {showFieldCompletionAlert && invalidResults.length > 0 && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-parchment-50 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-fade-in">
            <div className="flex items-center justify-between p-6 border-b border-oak-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-rust-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-rust-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-oak-800 font-serif">
                    字段补全提醒
                  </h3>
                  <p className="text-sm text-oak-500">
                    以下 {invalidResults.length} 件标本存在必填字段缺失
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowFieldCompletionAlert(false);
                  setPendingNextStep(null);
                }}
                className="p-2 rounded-lg hover:bg-oak-100 text-oak-500 hover:text-oak-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="bg-rust-50 border border-rust-200 rounded-xl p-4 mb-4">
                <h4 className="text-sm font-semibold text-rust-800 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  缺少以下必填字段的标本将无法打印完整标签：
                </h4>
                <p className="text-sm text-rust-700">
                  采集地点、采集日期、展盒位置、物种名
                </p>
              </div>

              <div className="space-y-2 max-h-[40vh] overflow-y-auto scrollbar-thin">
                {invalidResults.map((result, idx) => (
                  <div
                    key={result.specimenId}
                    className="flex items-center justify-between p-3 bg-rust-50 border border-rust-200 rounded-lg"
                    style={{ animationDelay: `${idx * 0.02}s` }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-block px-2 py-0.5 bg-rust-100 text-rust-700 text-xs font-mono rounded">
                        {result.specimenNo}
                      </span>
                      <span className="text-sm text-oak-700">
                        {specimens.find(s => s.id === result.specimenId)?.species || '未知物种'}
                      </span>
                    </div>
                    <div className="text-xs text-rust-600">
                      缺少: {result.missingFields.join('、')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-oak-200 bg-oak-50">
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm text-oak-600">
                  已选择 <strong className="text-oak-800">{selectedSpecimens.length}</strong> 件标本，
                  其中 <strong className="text-rust-600">{invalidResults.length}</strong> 件字段缺失
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowFieldCompletionAlert(false);
                      setPendingNextStep(null);
                    }}
                    className="btn-secondary"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleSkipIncompleteSpecimens}
                    className="flex items-center gap-2 px-4 py-2 bg-oak-200 text-oak-800 rounded-lg hover:bg-oak-300 transition-colors font-medium"
                  >
                    跳过缺字段标本
                    <span className="text-xs">
                      (打印 {selectedSpecimens.length - invalidResults.length} 张)
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleContinueWithIncomplete}
                    className="btn-primary flex items-center gap-2"
                  >
                    继续打印
                    <span className="text-xs opacity-80">
                      (全部 {selectedSpecimens.length} 张)
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
