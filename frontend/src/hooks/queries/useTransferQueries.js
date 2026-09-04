import { useQuery } from "@tanstack/react-query";

import adviserService from "../../services/adviserService";

import cachePolicy from "../../lib/query/cachePolicy";
import queryKeys from "../../lib/query/queryKeys";

/* =========================================================
   INCOMING TRANSFERS
========================================================= */

export const useIncomingTransfers = (options = {}) =>
  useQuery({
    queryKey: queryKeys.adviser.transfers.incoming(),

    queryFn: () => adviserService.getIncomingStudentTransferRequests(),

    ...cachePolicy.transfers,

    ...options,
  });

/* =========================================================
   OUTGOING TRANSFERS
========================================================= */

export const useOutgoingTransfers = (options = {}) =>
  useQuery({
    queryKey: queryKeys.adviser.transfers.outgoing(),

    queryFn: () => adviserService.getOutgoingStudentTransferRequests(),

    ...cachePolicy.transfers,

    ...options,
  });
