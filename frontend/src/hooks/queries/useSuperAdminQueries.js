import { useQuery } from "@tanstack/react-query";

import superAdminService from "../../services/superAdminService";

import cachePolicy from "../../lib/query/cachePolicy";
import queryKeys from "../../lib/query/queryKeys";

/* =========================================================
   HELPERS
========================================================= */

const normalizeArray = (value) => (Array.isArray(value) ? value : []);

/* =========================================================
   DEPARTMENTS
========================================================= */

export const useSuperAdminDepartments = (options = {}) =>
  useQuery({
    queryKey: queryKeys.superadmin.departments(),

    queryFn: async () =>
      normalizeArray(await superAdminService.getDepartments()),

    /*
     * Department data changes occasionally, so the existing
     * roster cache policy gives us good reuse without keeping
     * administrative data fresh for too long.
     */
    ...cachePolicy.roster,

    ...options,
  });

/* =========================================================
   COUNCILORS
========================================================= */

export const useSuperAdminCouncilors = (options = {}) =>
  useQuery({
    queryKey: queryKeys.superadmin.councilors(),

    queryFn: async () =>
      normalizeArray(await superAdminService.getCouncilors()),

    ...cachePolicy.roster,

    ...options,
  });

export default {
  useSuperAdminDepartments,
  useSuperAdminCouncilors,
};
