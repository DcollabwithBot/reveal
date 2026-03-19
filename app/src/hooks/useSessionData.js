import { useEffect, useState } from 'react';
import { getLatestApprovalState, getProjectionConfig, submitAdvisoryRequest } from '../lib/api';

export function useSessionData({ nodeId, projectId, pv, spread, cv, rootEstimate }) {
  const [projectionConfig, setProjectionConfig] = useState(null);
  const [approvalState, setApprovalState] = useState(null);
  const [advisoryBusy, setAdvisoryBusy] = useState(false);
  const [advisoryError, setAdvisoryError] = useState(null);

  useEffect(() => {
    let active = true;
    const targetId = projectId || nodeId;
    if (!targetId) return () => { active = false; };

    getLatestApprovalState(targetId)
      .then((state) => {
        if (!active) return;
        setApprovalState(state || null);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [projectId, nodeId]);

  useEffect(() => {
    let active = true;
    getProjectionConfig()
      .then((data) => {
        if (!active) return;
        setProjectionConfig(data || null);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  async function sendToApprovalQueue() {
    if (advisoryBusy) return;
    setAdvisoryBusy(true);
    setAdvisoryError(null);
    try {
      const targetId = projectId || nodeId;
      const payload = {
        target_type: 'project',
        target_id: targetId,
        requested_patch: {
          status: rootEstimate >= 8 ? 'on_hold' : 'active',
          description: `Advisory fra game: est=${rootEstimate}, spread=${spread}, confidence=${cv || 'na'}`,
        },
        idempotency_key: `game:${targetId}:${Date.now()}`,
      };
      const created = await submitAdvisoryRequest(payload);
      setApprovalState(created?.state || 'pending_approval');
    } catch (err) {
      setAdvisoryError(err.message);
    } finally {
      setAdvisoryBusy(false);
    }
  }

  return {
    projectionConfig,
    approvalState,
    advisoryBusy,
    advisoryError,
    setApprovalState,
    sendToApprovalQueue,
  };
}
