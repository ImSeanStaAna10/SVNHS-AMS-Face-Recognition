import api from "./api";

/* =======================================================
   DEPARTMENTS
======================================================= */

const getDepartments = async () => {
  const response = await api.get("/superadmin/departments");

  return Array.isArray(response.data) ? response.data : [];
};

const createDepartment = async (data) => {
  const response = await api.post("/superadmin/departments", data);

  return response.data;
};

const updateDepartment = async (departmentId, data) => {
  const response = await api.patch(
    `/superadmin/departments/${departmentId}`,
    data,
  );

  return response.data;
};

const updateDepartmentStatus = async (departmentId, active) => {
  const response = await api.patch(
    `/superadmin/departments/${departmentId}/status`,
    {
      active,
    },
  );

  return response.data;
};

/* =======================================================
   COUNCILORS
======================================================= */

const getCouncilors = async () => {
  const response = await api.get("/superadmin/councilors");

  return Array.isArray(response.data) ? response.data : [];
};

const createCouncilor = async (data) => {
  const response = await api.post("/superadmin/councilors", data);

  return response.data;
};

const updateCouncilor = async (councilorId, data) => {
  const response = await api.patch(
    `/superadmin/councilors/${councilorId}`,
    data,
  );

  return response.data;
};

const updateCouncilorStatus = async (councilorId, active) => {
  const response = await api.patch(
    `/superadmin/councilors/${councilorId}/status`,
    {
      active,
    },
  );

  return response.data;
};

const resetCouncilorPassword = async (councilorId, newPassword) => {
  const response = await api.patch(
    `/superadmin/councilors/${councilorId}/reset-password`,
    {
      newPassword,
    },
  );

  return response.data;
};

/* =======================================================
   EXPORT
======================================================= */

export default {
  getDepartments,
  createDepartment,
  updateDepartment,
  updateDepartmentStatus,

  getCouncilors,
  createCouncilor,
  updateCouncilor,
  updateCouncilorStatus,
  resetCouncilorPassword,
};
