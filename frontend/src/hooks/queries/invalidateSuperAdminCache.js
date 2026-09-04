import queryKeys from "../../lib/query/queryKeys";

/* =========================================================
   COUNCILOR CACHE
========================================================= */

/**
 * Councilor mutations affect:
 * - Councilor Management
 * - Department coverage calculations
 * - SuperAdmin Dashboard
 *
 * All of those surfaces reuse the same Councilor query.
 */
export const invalidateSuperAdminCouncilorCache = async (queryClient) => {
  await queryClient.invalidateQueries({
    queryKey: queryKeys.superadmin.councilors(),
  });
};

/* =========================================================
   DEPARTMENT CACHE
========================================================= */

/**
 * Department changes can also affect department information
 * embedded in Councilor responses such as department code/name.
 *
 * For that reason, department mutations invalidate both the
 * department directory and Councilor directory.
 */
export const invalidateSuperAdminDepartmentCache = async (queryClient) => {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: queryKeys.superadmin.departments(),
    }),

    queryClient.invalidateQueries({
      queryKey: queryKeys.superadmin.councilors(),
    }),
  ]);
};

/* =========================================================
   ALL SUPERADMIN ADMINISTRATION DATA
========================================================= */

export const invalidateSuperAdminCache = async (queryClient) => {
  await queryClient.invalidateQueries({
    queryKey: queryKeys.superadmin.all,
  });
};

export default {
  invalidateSuperAdminCouncilorCache,
  invalidateSuperAdminDepartmentCache,
  invalidateSuperAdminCache,
};
