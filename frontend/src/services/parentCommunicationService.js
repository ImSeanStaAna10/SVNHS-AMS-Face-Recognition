import api from "./api";

/* =========================================================
   HELPERS
========================================================= */

const requireId = (value, message) => {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    throw new Error(message);
  }

  return normalized;
};

const normalizeArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (Array.isArray(value?.content)) {
    return value.content;
  }

  if (Array.isArray(value?.items)) {
    return value.items;
  }

  if (Array.isArray(value?.data)) {
    return value.data;
  }

  return [];
};

/* =========================================================
   PARENT COMMUNICATION HISTORY

   Authenticated Adviser endpoint.

   GET
   /api/attendance-interventions/{interventionId}
   /parent-communications
========================================================= */

const getByIntervention = async (interventionId) => {
  const normalizedInterventionId = requireId(
    interventionId,
    "Attendance intervention ID is required to load parent communication activity.",
  );

  const response = await api.get(
    `/attendance-interventions/${normalizedInterventionId}/parent-communications`,
  );

  return normalizeArray(response.data);
};

const parentCommunicationService = {
  getByIntervention,
};

export default parentCommunicationService;
