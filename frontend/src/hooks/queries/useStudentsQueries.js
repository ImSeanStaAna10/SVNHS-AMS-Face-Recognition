import { useQuery } from "@tanstack/react-query";

import adviserService from "../../services/adviserService";

import cachePolicy from "../../lib/query/cachePolicy";
import queryKeys from "../../lib/query/queryKeys";

/* =========================================================
   ADVISER SECTIONS

   Current service:
   adviserService.getSections()

   Sections change relatively rarely, so we use the
   longer-lived "static" cache policy.
========================================================= */

export const useAdviserSections = (options = {}) =>
  useQuery({
    queryKey: queryKeys.adviser.sections(),

    queryFn: () => adviserService.getSections(),

    ...cachePolicy.static,

    ...options,
  });

/* =========================================================
   ADVISER STUDENTS

   Current service:
   adviserService.getStudents()

   Important:
   The current Student Management page does NOT pass a
   sectionId to getStudents().

   Because of that, we cache the actual API response under:

   ["adviser", "students"]

   Then Student Management can continue scoping the roster
   to the assigned section locally.
========================================================= */

export const useAdviserStudents = (options = {}) =>
  useQuery({
    queryKey: queryKeys.adviser.allStudents(),

    queryFn: () => adviserService.getStudents(),

    ...cachePolicy.roster,

    ...options,
  });

/* =========================================================
   EXPORTS
========================================================= */

export default {
  useAdviserSections,
  useAdviserStudents,
};
