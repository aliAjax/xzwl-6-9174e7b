import { useCallback, useMemo } from 'react';
import type {
  PhotographySession,
  PhotographySessionFormData,
  PhotographySessionTarget,
  PhotographySessionExportRow,
  Specimen,
  Box,
  CollectionBatch,
} from '../types';
import { HIGH_RISK_STATUSES, COMPLIANCE_STATUS_OPTIONS } from '../types';
import { useLocalStorage } from './useLocalStorage';
import { generateId, escapeCsvField, downloadCsv } from '../utils/helpers';

const SESSIONS_KEY = 'photography_sessions';

export function usePhotographySessions(
  specimens: Specimen[],
  boxes: Box[],
  batches: CollectionBatch[],
  markPhotographed: (ids: string[], photographed?: boolean) => void
) {
  const [sessions, setSessions] = useLocalStorage<PhotographySession[]>(SESSIONS_KEY, []);

  const getSpecimensForTargets = useCallback(
    (targets: PhotographySessionTarget[]): Specimen[] => {
      const matchedSpecimens = new Set<string>();

      targets.forEach((target) => {
        specimens.forEach((specimen) => {
          if (specimen.photographed) return;

          let matches = false;

          if (target.type === 'box') {
            matches = specimen.boxId === target.id;
          } else if (target.type === 'batch') {
            matches = specimen.batchId === target.id;
          } else if (target.type === 'highRisk') {
            matches = HIGH_RISK_STATUSES.includes(specimen.complianceStatus);
          }

          if (matches) {
            matchedSpecimens.add(specimen.id);
          }
        });
      });

      return specimens.filter((s) => matchedSpecimens.has(s.id));
    },
    [specimens]
  );

  const updateSessionProgress = useCallback(
    (sessionId: string) => {
      setSessions((prev) =>
        prev.map((session) => {
          if (session.id !== sessionId) return session;

          const sessionSpecimens = specimens.filter((s) => session.specimenIds.includes(s.id));
          const completedCount = sessionSpecimens.filter((s) => s.photographed).length;

          const isCompleted = sessionSpecimens.length > 0 && completedCount === sessionSpecimens.length;
          const now = new Date().toISOString();

          return {
            ...session,
            completedCount,
            status: isCompleted ? 'completed' : session.status,
            completedAt: isCompleted && session.status !== 'completed' ? now : session.completedAt,
            updatedAt: now,
          };
        })
      );
    },
    [specimens, setSessions]
  );

  const createSession = useCallback(
    (data: PhotographySessionFormData) => {
      const targetSpecimens = getSpecimensForTargets(data.targets);
      const now = new Date().toISOString();

      const newSession: PhotographySession = {
        id: generateId(),
        name: data.name,
        priority: data.priority,
        notes: data.notes,
        scheduledDate: data.scheduledDate,
        status: 'active',
        targets: data.targets,
        specimenIds: targetSpecimens.map((s) => s.id),
        completedCount: 0,
        createdAt: now,
        updatedAt: now,
      };

      setSessions((prev) => [...prev, newSession]);
      return newSession;
    },
    [getSpecimensForTargets, setSessions]
  );

  const updateSession = useCallback(
    (id: string, data: Partial<PhotographySessionFormData>) => {
      const now = new Date().toISOString();

      setSessions((prev) =>
        prev.map((session) => {
          if (session.id !== id) return session;

          const updatedSession = { ...session, ...data, updatedAt: now };

          if (data.targets) {
            const targetSpecimens = getSpecimensForTargets(data.targets);
            updatedSession.specimenIds = targetSpecimens.map((s) => s.id);
            updatedSession.completedCount = targetSpecimens.filter((s) => s.photographed).length;
          }

          return updatedSession;
        })
      );
    },
    [getSpecimensForTargets, setSessions]
  );

  const deleteSession = useCallback(
    (id: string) => {
      setSessions((prev) => prev.filter((s) => s.id !== id));
    },
    [setSessions]
  );

  const completeSession = useCallback(
    (id: string) => {
      const session = sessions.find((s) => s.id === id);
      if (!session) return;

      const unphotographedIds = session.specimenIds.filter((sid) => {
        const specimen = specimens.find((s) => s.id === sid);
        return specimen && !specimen.photographed;
      });

      if (unphotographedIds.length > 0) {
        markPhotographed(unphotographedIds, true);
      }

      const now = new Date().toISOString();
      setSessions((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                status: 'completed',
                completedCount: s.specimenIds.length,
                completedAt: now,
                updatedAt: now,
              }
            : s
        )
      );
    },
    [sessions, specimens, markPhotographed, setSessions]
  );

  const cancelSession = useCallback(
    (id: string) => {
      const now = new Date().toISOString();
      setSessions((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, status: 'cancelled', updatedAt: now }
            : s
        )
      );
    },
    [setSessions]
  );

  const reactiveSession = useCallback(
    (id: string) => {
      const now = new Date().toISOString();
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== id) return s;
          const sessionSpecimens = specimens.filter((sp) => s.specimenIds.includes(sp.id));
          const completedCount = sessionSpecimens.filter((sp) => sp.photographed).length;
          return {
            ...s,
            status: 'active',
            completedCount,
            completedAt: undefined,
            updatedAt: now,
          };
        })
      );
    },
    [specimens, setSessions]
  );

  const getSessionSpecimens = useCallback(
    (sessionId: string): Specimen[] => {
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) return [];
      return specimens.filter((s) => session.specimenIds.includes(s.id));
    },
    [sessions, specimens]
  );

  const getSessionProgress = useCallback(
    (sessionId: string): { total: number; completed: number; percentage: number } => {
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) return { total: 0, completed: 0, percentage: 0 };

      const total = session.specimenIds.length;
      const completed = session.completedCount;
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

      return { total, completed, percentage };
    },
    [sessions]
  );

  const exportSessionChecklist = useCallback(
    (sessionId: string): void => {
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) return;

      const sessionSpecimens = getSessionSpecimens(sessionId);

      const exportRows: PhotographySessionExportRow[] = sessionSpecimens.map((specimen) => {
        const box = boxes.find((b) => b.id === specimen.boxId);
        const batch = batches.find((b) => b.id === specimen.batchId);
        const complianceOption = COMPLIANCE_STATUS_OPTIONS.find(
          (opt) => opt.value === specimen.complianceStatus
        );

        return {
          specimenNo: specimen.specimenNo,
          species: specimen.species,
          boxName: box?.name || '未分配展盒',
          batchName: batch?.name || '未分配批次',
          complianceStatus: complianceOption?.label || specimen.complianceStatus,
          notes: specimen.notes || '',
          photographed: specimen.photographed,
        };
      });

      const headers = [
        '标本编号',
        '物种名',
        '展盒',
        '批次',
        '合规风险',
        '备注',
        '拍照状态',
      ];

      const rows = exportRows.map((row) => [
        row.specimenNo,
        row.species,
        row.boxName,
        row.batchName,
        row.complianceStatus,
        row.notes,
        row.photographed ? '已拍照' : '未拍照',
      ]);

      const csvContent = [headers, ...rows]
        .map((row) => row.map((cell) => escapeCsvField(cell)).join(','))
        .join('\n');

      const today = new Date().toISOString().split('T')[0];
      const filename = `拍摄清单_${session.name}_${today}.csv`;

      downloadCsv('\uFEFF' + csvContent, filename);
    },
    [sessions, boxes, batches, getSessionSpecimens]
  );

  const activeSessions = useMemo(
    () => sessions.filter((s) => s.status === 'active'),
    [sessions]
  );

  const completedSessions = useMemo(
    () => sessions.filter((s) => s.status === 'completed'),
    [sessions]
  );

  const cancelledSessions = useMemo(
    () => sessions.filter((s) => s.status === 'cancelled'),
    [sessions]
  );

  const updateAllSessionsProgress = useCallback(() => {
    sessions.forEach((session) => {
      if (session.status === 'active') {
        updateSessionProgress(session.id);
      }
    });
  }, [sessions, updateSessionProgress]);

  const getAvailableTargets = useCallback((): {
    boxes: { id: string; name: string; count: number }[];
    batches: { id: string; name: string; count: number }[];
    highRisk: { id: string; name: string; count: number }[];
  } => {
    const unphotographed = specimens.filter((s) => !s.photographed);

    const boxMap = new Map<string, number>();
    const batchMap = new Map<string, number>();
    let highRiskCount = 0;

    unphotographed.forEach((s) => {
      if (s.boxId) {
        boxMap.set(s.boxId, (boxMap.get(s.boxId) || 0) + 1);
      }
      if (s.batchId) {
        batchMap.set(s.batchId, (batchMap.get(s.batchId) || 0) + 1);
      }
      if (HIGH_RISK_STATUSES.includes(s.complianceStatus)) {
        highRiskCount++;
      }
    });

    const availableBoxes = boxes
      .filter((b) => boxMap.has(b.id))
      .map((b) => ({
        id: b.id,
        name: b.name,
        count: boxMap.get(b.id) || 0,
      }));

    const availableBatches = batches
      .filter((b) => batchMap.has(b.id))
      .map((b) => ({
        id: b.id,
        name: b.name,
        count: batchMap.get(b.id) || 0,
      }));

    const highRisk = highRiskCount > 0
      ? [{ id: '__high_risk__', name: '合规高风险', count: highRiskCount }]
      : [];

    return { boxes: availableBoxes, batches: availableBatches, highRisk };
  }, [specimens, boxes, batches]);

  return {
    sessions,
    activeSessions,
    completedSessions,
    cancelledSessions,
    createSession,
    updateSession,
    deleteSession,
    completeSession,
    cancelSession,
    reactiveSession,
    getSessionSpecimens,
    getSessionProgress,
    exportSessionChecklist,
    updateSessionProgress,
    updateAllSessionsProgress,
    getSpecimensForTargets,
    getAvailableTargets,
  };
}
