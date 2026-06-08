import { useCallback } from 'react';
import type { Filters, FilterView } from '../types';
import { useLocalStorage } from './useLocalStorage';

const STORAGE_KEY = 'xzwl_filter_views';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export function useFilterViews() {
  const [views, setViews] = useLocalStorage<FilterView[]>(STORAGE_KEY, []);

  const saveView = useCallback((name: string, filters: Filters, existingId?: string): FilterView => {
    const now = new Date().toISOString();

    if (existingId) {
      const updatedViews = views.map(v =>
        v.id === existingId
          ? { ...v, name, filters, updatedAt: now }
          : v
      );
      setViews(updatedViews);
      const updated = updatedViews.find(v => v.id === existingId);
      return updated!;
    }

    const newView: FilterView = {
      id: generateId(),
      name,
      filters,
      createdAt: now,
      updatedAt: now,
    };

    setViews(prev => [...prev, newView]);
    return newView;
  }, [views, setViews]);

  const deleteView = useCallback((id: string) => {
    setViews(prev => prev.filter(v => v.id !== id));
  }, [setViews]);

  const renameView = useCallback((id: string, name: string) => {
    setViews(prev => prev.map(v =>
      v.id === id
        ? { ...v, name, updatedAt: new Date().toISOString() }
        : v
    ));
  }, [setViews]);

  const isFiltersEmpty = (filters: Filters): boolean => {
    return !filters.search &&
      !filters.onlyUnphotographed &&
      !filters.boxId &&
      !filters.batchId &&
      !filters.complianceStatus &&
      !filters.onlyHighRisk;
  };

  const getViewLabel = (view: FilterView): string => {
    const parts: string[] = [];
    const { filters } = view;

    if (filters.search) parts.push(`搜索: ${filters.search}`);
    if (filters.onlyUnphotographed) parts.push('未拍照');
    if (filters.boxId === '__unassigned__') parts.push('未分配展盒');
    if (filters.batchId) parts.push('指定批次');
    if (filters.complianceStatus) parts.push('指定合规状态');
    if (filters.onlyHighRisk) parts.push('高风险');

    return parts.length > 0 ? parts.join(' · ') : '全部标本';
  };

  return {
    views,
    saveView,
    deleteView,
    renameView,
    isFiltersEmpty,
    getViewLabel,
  };
}
