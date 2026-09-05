import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import AdviserLayout from "../../layouts/AdviserLayout";
import adviserService from "../../services/adviserService";
import parentCommunicationService from "../../services/parentCommunicationService";

import {
  useAdviserSections,
} from "../../hooks/queries/useStudentsQueries";

import queryKeys from "../../lib/query/queryKeys";

import "../../styles/adviser/StudentManagementFaceScanning/studentAtRisk.css";

/* =========================================================
   CONSTANTS
========================================================= */

const PAGE_SIZE = 10;

/*
 * Students at Risk is based on FINALIZED attendance data,
 * so it does not need aggressive polling.
 *
 * TanStack Query gives us:
 * - request deduplication
 * - in-memory cache reuse
 * - stale-data refresh on mount/focus/reconnect
 * - targeted invalidation after mutations
 *
 * We keep only a lightweight parent-communication refresh
 * while the review modal is open because acknowledgements
 * and responses can happen externally while the Adviser is
 * viewing the same intervention.
 */

const RISK_STALE_TIME_MS =
  60_000;

const RISK_GC_TIME_MS =
  10 * 60_000;

const PREVIEW_STALE_TIME_MS =
  30_000;

const PREVIEW_GC_TIME_MS =
  10 * 60_000;

const COMMUNICATION_STALE_TIME_MS =
  15_000;

const COMMUNICATION_GC_TIME_MS =
  10 * 60_000;

const COMMUNICATION_BACKGROUND_REFRESH_MS =
  60_000;

const CONFIG_STALE_TIME_MS =
  5 * 60_000;

const CONFIG_GC_TIME_MS =
  10 * 60_000;

const RISK_FILTERS = [
  [
    "ALL",
    "All Students",
  ],
  [
    "CRITICAL",
    "Critical",
  ],
  [
    "AT_RISK",
    "At Risk",
  ],
  [
    "WARNING",
    "Warning",
  ],
  [
    "NORMAL",
    "Normal",
  ],
];

/* =========================================================
   INTERVENTION CONFIG HELPERS
========================================================= */

const createEmptyInterventionConfigForm = () => ({
  enabled: true,
  periodStart: "",
  periodEnd: "",
  warningAbsenceCount: "",
  atRiskAbsenceCount: "",
  criticalAbsenceCount: "",
  parentNotificationEnabled: true,
  allowParentAcknowledgement: true,
  allowParentResponse: true,
  defaultAdviserMessage: "",
});

const getInterventionConfigQueryKey = (
  sectionId,
) => [
  "adviser",
  "attendance-intervention",
  "config",
  String(
    sectionId ||
      "",
  ),
];

const isNotFoundError = (
  error,
) =>
  error?.response?.status ===
  404;

/* =========================================================
   GENERIC HELPERS
========================================================= */

const normalizeArray = (
  value,
) => {
  if (
    Array.isArray(
      value,
    )
  ) {
    return value;
  }

  for (
    const key of [
      "students",
      "items",
      "content",
      "risks",
      "data",
    ]
  ) {
    if (
      Array.isArray(
        value?.[
          key
        ],
      )
    ) {
      return value[
        key
      ];
    }
  }

  return [];
};

const getErrorMessage = (
  error,
  fallback,
) =>
  error?.response?.data
    ?.message ||
  error?.response?.data
    ?.error ||
  error?.response?.data
    ?.detail ||
  error?.message ||
  fallback;

const upper = (
  value,
) =>
  String(
    value ||
      "",
  )
    .trim()
    .toUpperCase();

const count = (
  value,
) => {
  const number =
    Number(
      value,
    );

  return Number.isFinite(
    number,
  )
    ? Math.max(
        0,
        number,
      )
    : 0;
};

/* =========================================================
   RISK HELPERS
========================================================= */

const getRiskLevel = (
  row,
) =>
  upper(
    row?.riskLevel ??
      row?.currentRiskLevel ??
      row?.attendanceRiskLevel ??
      row?.risk?.level,
  ) ||
  "UNKNOWN";

const getInterventionId = (
  row,
) =>
  String(
    row?.interventionId ??
      row?.currentInterventionId ??
      row?.latestInterventionId ??
      row?.intervention?.id ??
      row?.latestIntervention
        ?.id ??
      "",
  ).trim();

const getInterventionStatus = (
  row,
) =>
  upper(
    row?.interventionStatus ??
      row?.currentInterventionStatus ??
      row?.intervention
        ?.status ??
      row?.latestIntervention
        ?.status,
  );

const getNotificationMode = (
  row,
) =>
  upper(
    row?.notificationMode ??
      row?.parentNotificationMode ??
      row?.riskNotificationMode,
  );

const riskLabel = (
  risk,
) => {
  switch (
    upper(
      risk,
    )
  ) {
    case "CRITICAL":
      return "Critical";

    case "AT_RISK":
      return "At Risk";

    case "WARNING":
      return "Warning";

    case "NORMAL":
      return "Normal";

    default:
      return "Unavailable";
  }
};

const riskDescription = (
  risk,
) => {
  switch (
    upper(
      risk,
    )
  ) {
    case "CRITICAL":
      return "Immediate adviser follow-up is recommended.";

    case "AT_RISK":
      return "Attendance pattern requires active intervention.";

    case "WARNING":
      return "Early attendance warning requires monitoring.";

    case "NORMAL":
      return "No attendance intervention is currently required.";

    default:
      return "Risk status could not be resolved from the response.";
  }
};

const riskClass = (
  risk,
) =>
  upper(
    risk,
  )
    .toLowerCase()
    .replaceAll(
      "_",
      "-",
    ) ||
  "unknown";

const initial = (
  name,
) =>
  String(
    name ||
      "S",
  )
    .trim()
    .charAt(
      0,
    )
    .toUpperCase() ||
  "S";

/* =========================================================
   PREVIEW HELPERS

   Current backend preview fields:

   suggestedAdviserNote
   attendanceChangedSinceIntervention
   absences
========================================================= */

const getSuggestedAdviserNote = (
  preview,
) =>
  String(
    preview?.suggestedAdviserNote ??
      preview?.defaultAdviserMessage ??
      "",
  );

const hasAttendanceChanged = (
  preview,
) =>
  preview
    ?.attendanceChangedSinceIntervention ===
    true ||
  preview
    ?.attendanceChanged ===
    true;

const getPreviewAbsences = (
  preview,
) => {
  if (
    Array.isArray(
      preview
        ?.absences,
    )
  ) {
    return preview
      .absences;
  }

  return [];
};

/* =========================================================
   PARENT COMMUNICATION HELPERS
========================================================= */

const communicationStatusLabel = (
  value,
) => {
  switch (
    upper(
      value,
    )
  ) {
    case "PENDING":
      return "Prepared";

    case "QUEUED":
      return "Queued";

    case "SENT":
      return "Email Sent";

    case "FAILED":
      return "Delivery Failed";

    case "ACKNOWLEDGED":
      return "Acknowledged";

    case "RESPONDED":
      return "Response Received";

    default:
      return "No Activity";
  }
};

const communicationStatusClass = (
  value,
) =>
  upper(
    value,
  )
    .toLowerCase()
    .replaceAll(
      "_",
      "-",
    ) ||
  "none";

const getLatestParentResponse = (
  communications,
) =>
  normalizeArray(
    communications,
  ).find(
    (
      item,
    ) =>
      Boolean(
        String(
          item
            ?.parentResponse ??
            "",
        ).trim(),
      ) ||
      upper(
        item
          ?.status,
      ) ===
        "RESPONDED",
  ) ||
  null;

const getLatestAcknowledgement = (
  communications,
) =>
  normalizeArray(
    communications,
  ).find(
    (
      item,
    ) =>
      Boolean(
        item
          ?.acknowledgedAt,
      ),
  ) ||
  null;

const getLatestSentCommunication = (
  communications,
) =>
  normalizeArray(
    communications,
  ).find(
    (
      item,
    ) =>
      Boolean(
        item
          ?.sentAt,
      ),
  ) ||
  null;

/* =========================================================
   DATE / TIME
========================================================= */

const formatDate = (
  value,
) => {
  if (
    !value
  ) {
    return "—";
  }

  /*
   * LocalDate values arrive as YYYY-MM-DD.
   *
   * Build a local Date manually so timezone conversion
   * cannot shift the attendance date.
   */

  if (
    typeof value ===
      "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(
      value,
    )
  ) {
    const [
      year,
      month,
      day,
    ] =
      value
        .split(
          "-",
        )
        .map(
          Number,
        );

    return new Intl.DateTimeFormat(
      "en-PH",
      {
        month:
          "short",

        day:
          "numeric",

        year:
          "numeric",
      },
    ).format(
      new Date(
        year,
        month -
          1,
        day,
      ),
    );
  }

  const parsed =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      parsed
        .getTime(),
    )
  ) {
    return String(
      value,
    );
  }

  return new Intl.DateTimeFormat(
    "en-PH",
    {
      month:
        "short",

      day:
        "numeric",

      year:
        "numeric",
    },
  ).format(
    parsed,
  );
};

const formatTime = (
  value,
) => {
  if (
    !value
  ) {
    return "—";
  }

  const match =
    String(
      value,
    ).match(
      /(?:T|\s|^)(\d{2}):(\d{2})/,
    );

  if (
    !match
  ) {
    return String(
      value,
    );
  }

  const hour24 =
    Number(
      match[
        1
      ],
    );

  return `${
    hour24 %
      12 ||
    12
  }:${
    match[
      2
    ]
  } ${
    hour24 >=
    12
      ? "PM"
      : "AM"
  }`;
};

const formatDateTime = (
  value,
) => {
  if (
    !value
  ) {
    return "—";
  }

  const parsed =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      parsed
        .getTime(),
    )
  ) {
    return String(
      value,
    );
  }

  return new Intl.DateTimeFormat(
    "en-PH",
    {
      month:
        "short",

      day:
        "numeric",

      year:
        "numeric",

      hour:
        "numeric",

      minute:
        "2-digit",

      hour12:
        true,
    },
  ).format(
    parsed,
  );
};

/* =========================================================
   PARENT NOTIFICATION HELPERS
========================================================= */

const getPreparedNotificationId = (
  value,
) =>
  String(
    value
      ?.notificationId ??
      value
        ?.id ??
      "",
  ).trim();

/* =========================================================
   RISK BADGE
========================================================= */

function RiskBadge({
  value,
}) {
  return (
    <span
      className={`students-risk-badge is-${riskClass(
        value,
      )}`}
    >
      {
        riskLabel(
          value,
        )
      }
    </span>
  );
}

/* =========================================================
   COMPONENT
========================================================= */

function StudentsAtRisk() {
  const location =
    useLocation();

  const navigate =
    useNavigate();

  const queryClient =
    useQueryClient();

  const notificationOpenRef =
    useRef(
      "",
    );

  /* =======================================================
     SECTION QUERY
  ======================================================= */

  const sectionsQuery =
    useAdviserSections();

  const section =
    useMemo(
      () => {
        const sections =
          normalizeArray(
            sectionsQuery
              .data,
          );

        return (
          sections.find(
            (
              item,
            ) =>
              item
                ?.active !==
              false,
          ) ||
          sections[
            0
          ] ||
          null
        );
      },
      [
        sectionsQuery
          .data,
      ],
    );

  const sectionId =
    section?.id ||
    "";

  const sectionName =
    section?.name ||
    "No assigned section";

  /* =======================================================
     INTERVENTION CONFIGURATION

     A section can exist without intervention settings.

     This commonly happens after:
     - a fresh database
     - a database cleanup
     - creating a brand-new section

     We intentionally check configuration BEFORE the risk
     endpoint so a missing config becomes a first-time setup
     state instead of a raw 404 error page.
  ======================================================= */

  const interventionConfigQueryKey =
    useMemo(
      () =>
        getInterventionConfigQueryKey(
          sectionId,
        ),
      [
        sectionId,
      ],
    );

  const [
    configForm,
    setConfigForm,
  ] =
    useState(
      createEmptyInterventionConfigForm,
    );

  const [
    configSaving,
    setConfigSaving,
  ] =
    useState(
      false,
    );

  const [
    configSaveError,
    setConfigSaveError,
  ] =
    useState(
      "",
    );

  const configQuery =
    useQuery({
      queryKey:
        interventionConfigQueryKey,

      queryFn:
        () =>
          adviserService
            .getAttendanceInterventionConfig(
              sectionId,
            ),

      enabled:
        Boolean(
          sectionId,
        ),

      staleTime:
        CONFIG_STALE_TIME_MS,

      gcTime:
        CONFIG_GC_TIME_MS,

      retry:
        (
          failureCount,
          error,
        ) => {
          if (
            isNotFoundError(
              error,
            )
          ) {
            return false;
          }

          return failureCount <
            1;
        },

      refetchOnMount:
        true,

      refetchOnWindowFocus:
        true,

      refetchOnReconnect:
        true,
    });

  const configMissing =
    Boolean(
      sectionId,
    ) &&
    isNotFoundError(
      configQuery
        .error,
    );

  const configReady =
    Boolean(
      sectionId,
    ) &&
    configQuery
      .isSuccess;

  useEffect(
    () => {
      setConfigForm(
        createEmptyInterventionConfigForm(),
      );

      setConfigSaving(
        false,
      );

      setConfigSaveError(
        "",
      );
    },
    [
      sectionId,
    ],
  );

  /* =======================================================
     CACHED ATTENDANCE RISK QUERY
  ======================================================= */

  const risksQuery =
    useQuery({
      queryKey:
        queryKeys
          .adviser
          .attendanceIntervention
          .risks(
            sectionId,
          ),

      queryFn:
        () =>
          adviserService
            .getAttendanceRisksBySection(
              sectionId,
            ),

      enabled:
        Boolean(
          sectionId &&
            configReady,
        ),

      staleTime:
        RISK_STALE_TIME_MS,

      gcTime:
        RISK_GC_TIME_MS,

      retry:
        1,

      /*
       * No interval polling here.
       *
       * Fresh cached data is reused when returning to this page.
       * Stale data is refreshed naturally on mount/focus/reconnect.
       */

      refetchOnMount:
        true,

      refetchOnWindowFocus:
        true,

      refetchOnReconnect:
        true,
    });

  const rows =
    useMemo(
      () =>
        normalizeArray(
          risksQuery
            .data,
        ),
      [
        risksQuery
          .data,
      ],
    );

  /* =======================================================
     TABLE STATE
  ======================================================= */

  const [
    search,
    setSearch,
  ] =
    useState(
      "",
    );

  const [
    filter,
    setFilter,
  ] =
    useState(
      "ALL",
    );

  const [
    page,
    setPage,
  ] =
    useState(
      1,
    );

  /* =======================================================
     MODAL STATE
  ======================================================= */

  const [
    selectedRow,
    setSelectedRow,
  ] =
    useState(
      null,
    );

  const [
    preview,
    setPreview,
  ] =
    useState(
      null,
    );

  const [
    previewLoading,
    setPreviewLoading,
  ] =
    useState(
      false,
    );

  const [
    previewError,
    setPreviewError,
  ] =
    useState(
      "",
    );

  const [
    adviserNote,
    setAdviserNote,
  ] =
    useState(
      "",
    );

  const [
    prepared,
    setPrepared,
  ] =
    useState(
      null,
    );

  const [
    preparing,
    setPreparing,
  ] =
    useState(
      false,
    );

  const [
    queueing,
    setQueueing,
  ] =
    useState(
      false,
    );

  const [
    queued,
    setQueued,
  ] =
    useState(
      false,
    );

  const [
    actionError,
    setActionError,
  ] =
    useState(
      "",
    );

  const [
    actionSuccess,
    setActionSuccess,
  ] =
    useState(
      "",
    );

  const modalBusy =
    previewLoading ||
    preparing ||
    queueing;

  const selectedInterventionId =
    getInterventionId(
      selectedRow,
    );

  /* =======================================================
     CACHED PARENT COMMUNICATION QUERY

     This is intentionally separate from the risk query.

     The response is cached per intervention.

     A lightweight 60-second refresh is kept ONLY while the
     modal is open because acknowledgement and response can
     happen externally.
  ======================================================= */

  const communicationQuery =
    useQuery({
      queryKey:
        queryKeys
          .adviser
          .attendanceIntervention
          .parentCommunications(
            selectedInterventionId,
          ),

      queryFn:
        () =>
          parentCommunicationService
            .getByIntervention(
              selectedInterventionId,
            ),

      enabled:
        Boolean(
          selectedInterventionId,
        ),

      staleTime:
        COMMUNICATION_STALE_TIME_MS,

      gcTime:
        COMMUNICATION_GC_TIME_MS,

      retry:
        1,

      refetchOnMount:
        true,

      refetchOnWindowFocus:
        true,

      refetchOnReconnect:
        true,

      /*
       * The risk table does NOT poll.
       *
       * Only communication activity checks periodically,
       * and only while an intervention modal is currently open.
       */

      refetchInterval:
        selectedInterventionId
          ? COMMUNICATION_BACKGROUND_REFRESH_MS
          : false,

      refetchIntervalInBackground:
        false,
    });

  const communications =
    useMemo(
      () =>
        normalizeArray(
          communicationQuery
            .data,
        ),
      [
        communicationQuery
          .data,
      ],
    );

  const latestCommunication =
    communications[
      0
    ] ||
    null;

  const latestParentResponse =
    useMemo(
      () =>
        getLatestParentResponse(
          communications,
        ),
      [
        communications,
      ],
    );

  const latestAcknowledgement =
    useMemo(
      () =>
        getLatestAcknowledgement(
          communications,
        ),
      [
        communications,
      ],
    );

  const latestSentCommunication =
    useMemo(
      () =>
        getLatestSentCommunication(
          communications,
        ),
      [
        communications,
      ],
    );

  const communicationStatus =
    upper(
      latestCommunication
        ?.status,
    );

  const communicationInProgress =
    communicationStatus ===
      "PENDING" ||
    communicationStatus ===
      "QUEUED";

  /* =======================================================
     MODAL RESET
  ======================================================= */

  const resetModal =
    () => {
      setPreview(
        null,
      );

      setPreviewLoading(
        false,
      );

      setPreviewError(
        "",
      );

      setAdviserNote(
        "",
      );

      setPrepared(
        null,
      );

      setPreparing(
        false,
      );

      setQueueing(
        false,
      );

      setQueued(
        false,
      );

      setActionError(
        "",
      );

      setActionSuccess(
        "",
      );
    };

  const closeModal =
    () => {
      if (
        modalBusy
      ) {
        return;
      }

      setSelectedRow(
        null,
      );

      resetModal();
    };

  /* =======================================================
     MODAL SIDE EFFECTS
  ======================================================= */

  useEffect(
    () => {
      if (
        !selectedRow
      ) {
        return undefined;
      }

      const previous =
        document
          .body
          .style
          .overflow;

      document
        .body
        .style
        .overflow =
        "hidden";

      const onKeyDown =
        (
          event,
        ) => {
          if (
            event
              .key ===
              "Escape" &&
            !modalBusy
          ) {
            setSelectedRow(
              null,
            );

            resetModal();
          }
        };

      window
        .addEventListener(
          "keydown",
          onKeyDown,
        );

      return () => {
        document
          .body
          .style
          .overflow =
          previous;

        window
          .removeEventListener(
            "keydown",
            onKeyDown,
          );
      };
    },
    [
      selectedRow,
      modalBusy,
    ],
  );

  /* =======================================================
     SUMMARY
  ======================================================= */

  const summary =
    useMemo(
      () => {
        const result = {
          total:
            rows.length,

          normal:
            0,

          warning:
            0,

          atRisk:
            0,

          critical:
            0,
        };

        rows.forEach(
          (
            row,
          ) => {
            const risk =
              getRiskLevel(
                row,
              );

            if (
              risk ===
              "NORMAL"
            ) {
              result
                .normal +=
                1;
            }

            if (
              risk ===
              "WARNING"
            ) {
              result
                .warning +=
                1;
            }

            if (
              risk ===
              "AT_RISK"
            ) {
              result
                .atRisk +=
                1;
            }

            if (
              risk ===
              "CRITICAL"
            ) {
              result
                .critical +=
                1;
            }
          },
        );

        result
          .needsAttention =
          result
            .warning +
          result
            .atRisk +
          result
            .critical;

        return result;
      },
      [
        rows,
      ],
    );

  /* =======================================================
     FILTERING
  ======================================================= */

  const filteredRows =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLowerCase();

        return rows.filter(
          (
            row,
          ) => {
            const risk =
              getRiskLevel(
                row,
              );

            if (
              filter !==
                "ALL" &&
              risk !==
                filter
            ) {
              return false;
            }

            if (
              !query
            ) {
              return true;
            }

            return [
              row
                ?.studentName,
              row
                ?.studentNumber,
              risk,
            ]
              .filter(
                Boolean,
              )
              .join(
                " ",
              )
              .toLowerCase()
              .includes(
                query,
              );
          },
        );
      },
      [
        rows,
        search,
        filter,
      ],
    );

  /* =======================================================
     RESET PAGE AFTER FILTER CHANGE
  ======================================================= */

  useEffect(
    () => {
      setPage(
        1,
      );
    },
    [
      search,
      filter,
      sectionId,
    ],
  );

  /* =======================================================
     PAGINATION
  ======================================================= */

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredRows
          .length /
          PAGE_SIZE,
      ),
    );

  const safePage =
    Math.min(
      page,
      totalPages,
    );

  const start =
    (
      safePage -
      1
    ) *
    PAGE_SIZE;

  const pageRows =
    filteredRows
      .slice(
        start,
        start +
          PAGE_SIZE,
      );

  /* =======================================================
     OPEN PARENT NOTICE PREVIEW

     Preview data is cached per intervention.

     fetchQuery behavior:
     - fresh cache -> returned immediately
     - stale / missing cache -> backend request
  ======================================================= */

  const openReview =
    async (
      row,
    ) => {
      const interventionId =
        getInterventionId(
          row,
        );

      if (
        !interventionId
      ) {
        return;
      }

      resetModal();

      setSelectedRow(
        row,
      );

      setPreviewLoading(
        true,
      );

      try {
        const data =
          await queryClient
            .fetchQuery({
              queryKey:
                queryKeys
                  .adviser
                  .attendanceIntervention
                  .preview(
                    interventionId,
                  ),

              queryFn:
                () =>
                  adviserService
                    .getParentNotificationPreview(
                      interventionId,
                    ),

              staleTime:
                PREVIEW_STALE_TIME_MS,

              gcTime:
                PREVIEW_GC_TIME_MS,
            });

        setPreview(
          data,
        );

        /*
         * Backend currently returns:
         *
         * suggestedAdviserNote
         */

        setAdviserNote(
          getSuggestedAdviserNote(
            data,
          ),
        );
      } catch (
        error
      ) {
        console.error(
          "Unable to load parent notification preview:",
          error,
        );

        setPreviewError(
          getErrorMessage(
            error,
            "Unable to prepare the parent notification preview.",
          ),
        );
      } finally {
        setPreviewLoading(
          false,
        );
      }
    };

  /* =======================================================
     OPEN FROM NOTIFICATION

     notificationService navigates here with:

     {
       openAttendanceNotice: true,
       interventionId,
       notificationType
     }

     The exact communication cache is invalidated before
     opening because acknowledgement / response may have
     happened externally.
  ======================================================= */

  useEffect(
    () => {
      const shouldOpen =
        location
          ?.state
          ?.openAttendanceNotice ===
        true;

      const interventionId =
        String(
          location
            ?.state
            ?.interventionId ??
            "",
        ).trim();

      if (
        !shouldOpen ||
        !interventionId ||
        risksQuery
          .isLoading
      ) {
        return;
      }

      const stateKey =
        `${interventionId}:${String(
          location
            ?.state
            ?.notificationType ??
            "",
        )}`;

      if (
        notificationOpenRef
          .current ===
        stateKey
      ) {
        return;
      }

      const rowIndex =
        rows
          .findIndex(
            (
              row,
            ) =>
              getInterventionId(
                row,
              ) ===
              interventionId,
          );

      /*
       * Usually the notification references the intervention
       * currently attached to a risk row.
       *
       * If the student already moved to another intervention,
       * we still open the historical intervention.
       */

      const row =
        rowIndex >=
        0
          ? rows[
              rowIndex
            ]
          : {
              interventionId,
            };

      notificationOpenRef
        .current =
        stateKey;

      if (
        rowIndex >=
        0
      ) {
        setSearch(
          "",
        );

        setFilter(
          "ALL",
        );

        setPage(
          Math.floor(
            rowIndex /
              PAGE_SIZE,
          ) +
            1,
        );
      }

      void queryClient
        .invalidateQueries({
          queryKey:
            queryKeys
              .adviser
              .attendanceIntervention
              .parentCommunications(
                interventionId,
              ),
        });

      void openReview(
        row,
      );

      navigate(
        location
          .pathname,
        {
          replace:
            true,

          state:
            null,
        },
      );
    },
    [
      location
        .pathname,
      location
        .state,
      navigate,
      queryClient,
      risksQuery
        .isLoading,
      rows,
    ],
  );

  /* =======================================================
     PREPARE NOTICE
  ======================================================= */

  const prepareNotice =
    async () => {
      if (
        !preview ||
        preparing ||
        queueing
      ) {
        return;
      }

      const interventionId =
        String(
          preview
            ?.interventionId ||
            getInterventionId(
              selectedRow,
            ) ||
            "",
        ).trim();

      if (
        !interventionId
      ) {
        setActionError(
          "Attendance intervention ID is unavailable.",
        );

        return;
      }

      try {
        setPreparing(
          true,
        );

        setActionError(
          "",
        );

        setActionSuccess(
          "",
        );

        const result =
          await adviserService
            .createParentNotification(
              interventionId,
              {
                adviserNote,
              },
            );

        setPrepared(
          result,
        );

        setActionSuccess(
          "The notice snapshot is ready. Review it once more, then queue the parent email.",
        );

        /*
         * Only this intervention's communication history
         * changed.
         */

        await queryClient
          .invalidateQueries({
            queryKey:
              queryKeys
                .adviser
                .attendanceIntervention
                .parentCommunications(
                  interventionId,
                ),
          });
      } catch (
        error
      ) {
        console.error(
          "Unable to create parent notification:",
          error,
        );

        setActionError(
          getErrorMessage(
            error,
            "Unable to prepare the parent notification.",
          ),
        );
      } finally {
        setPreparing(
          false,
        );
      }
    };

  /* =======================================================
     QUEUE NOTICE
  ======================================================= */

  const queueNotice =
    async () => {
      if (
        !prepared ||
        queueing ||
        queued
      ) {
        return;
      }

      const notificationId =
        getPreparedNotificationId(
          prepared,
        );

      if (
        !notificationId
      ) {
        setActionError(
          "The prepared notification ID is unavailable.",
        );

        return;
      }

      try {
        setQueueing(
          true,
        );

        setActionError(
          "",
        );

        setActionSuccess(
          "",
        );

        await adviserService
          .queueParentNotification(
            notificationId,
          );

        setQueued(
          true,
        );

        setActionSuccess(
          "Parent notification queued successfully. The outbox worker will handle email delivery.",
        );

        /*
         * Targeted invalidation only.
         *
         * No broad ["adviser"] reset.
         */

        await Promise.all([
          queryClient
            .invalidateQueries({
              queryKey:
                queryKeys
                  .adviser
                  .attendanceIntervention
                  .risks(
                    sectionId,
                  ),
            }),

          queryClient
            .invalidateQueries({
              queryKey:
                queryKeys
                  .adviser
                  .attendanceIntervention
                  .parentCommunications(
                    selectedInterventionId,
                  ),
            }),
        ]);
      } catch (
        error
      ) {
        console.error(
          "Unable to queue parent notification:",
          error,
        );

        setActionError(
          getErrorMessage(
            error,
            "Unable to queue the parent notification.",
          ),
        );
      } finally {
        setQueueing(
          false,
        );
      }
    };

  /* =======================================================
     SAVE FIRST-TIME INTERVENTION CONFIGURATION
  ======================================================= */

  const saveInterventionConfig =
    async (
      event,
    ) => {
      event
        ?.preventDefault?.();

      if (
        !sectionId ||
        configSaving
      ) {
        return;
      }

      const periodStart =
        String(
          configForm
            .periodStart ||
            "",
        ).trim();

      const periodEnd =
        String(
          configForm
            .periodEnd ||
            "",
        ).trim();

      const warning =
        Number(
          configForm
            .warningAbsenceCount,
        );

      const atRisk =
        Number(
          configForm
            .atRiskAbsenceCount,
        );

      const critical =
        Number(
          configForm
            .criticalAbsenceCount,
        );

      if (
        !periodStart ||
        !periodEnd
      ) {
        setConfigSaveError(
          "Choose the start and end dates for attendance-risk monitoring.",
        );

        return;
      }

      if (
        periodStart >
        periodEnd
      ) {
        setConfigSaveError(
          "The risk period start date cannot be after the end date.",
        );

        return;
      }

      if (
        !Number.isInteger(
          warning,
        ) ||
        !Number.isInteger(
          atRisk,
        ) ||
        !Number.isInteger(
          critical,
        ) ||
        warning <
          1 ||
        atRisk <
          1 ||
        critical <
          1
      ) {
        setConfigSaveError(
          "All risk thresholds must be whole numbers of at least 1 absence.",
        );

        return;
      }

      if (
        warning >=
        atRisk ||
        atRisk >=
        critical
      ) {
        setConfigSaveError(
          "Thresholds must follow Warning < At Risk < Critical.",
        );

        return;
      }

      const defaultAdviserMessage =
        String(
          configForm
            .defaultAdviserMessage ||
            "",
        ).trim();

      try {
        setConfigSaving(
          true,
        );

        setConfigSaveError(
          "",
        );

        const saved =
          await adviserService
            .saveAttendanceInterventionConfig(
              sectionId,
              {
                enabled:
                  Boolean(
                    configForm
                      .enabled,
                  ),

                periodStart,
                periodEnd,

                warningAbsenceCount:
                  warning,

                atRiskAbsenceCount:
                  atRisk,

                criticalAbsenceCount:
                  critical,

                parentNotificationEnabled:
                  Boolean(
                    configForm
                      .parentNotificationEnabled,
                  ),

                /*
                 * MANUAL is the current safe/default mode in
                 * the backend entity. We do not invent any
                 * unsupported enum values in the setup UI.
                 */
                warningNotificationMode:
                  "MANUAL",

                atRiskNotificationMode:
                  "MANUAL",

                criticalNotificationMode:
                  "MANUAL",

                allowParentAcknowledgement:
                  Boolean(
                    configForm
                      .allowParentAcknowledgement,
                  ),

                allowParentResponse:
                  Boolean(
                    configForm
                      .allowParentResponse,
                  ),

                defaultAdviserMessage:
                  defaultAdviserMessage ||
                  null,
              },
            );

        queryClient
          .setQueryData(
            interventionConfigQueryKey,
            saved,
          );

        await queryClient
          .invalidateQueries({
            queryKey:
              queryKeys
                .adviser
                .attendanceIntervention
                .risks(
                  sectionId,
                ),
          });
      } catch (
        error
      ) {
        console.error(
          "Unable to save attendance intervention configuration:",
          error,
        );

        setConfigSaveError(
          getErrorMessage(
            error,
            "Unable to save attendance intervention settings.",
          ),
        );
      } finally {
        setConfigSaving(
          false,
        );
      }
    };

  /* =======================================================
     PAGE STATUS
  ======================================================= */

  const loading =
    sectionsQuery
      .isLoading ||
    (
      Boolean(
        sectionId,
      ) &&
      configQuery
        .isLoading
    ) ||
    (
      Boolean(
        sectionId &&
          configReady,
      ) &&
      risksQuery
        .isLoading
    );

  const pageError =
    sectionsQuery
      .error
      ? getErrorMessage(
          sectionsQuery
            .error,
          "Unable to load the assigned section.",
        )
      : configQuery
          .error &&
        !configMissing
        ? getErrorMessage(
            configQuery
              .error,
            "Unable to load attendance intervention settings.",
          )
        : risksQuery
            .error
          ? getErrorMessage(
              risksQuery
                .error,
              "Unable to load attendance-risk information.",
            )
          : "";

  /* =======================================================
     PREVIEW DERIVED DATA
  ======================================================= */

  const previewAbsences =
    getPreviewAbsences(
      preview,
    );

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <AdviserLayout
      title="Students at Risk"
      eyebrow="ATTENDANCE INTERVENTION"
      description="Review finalized attendance patterns and coordinate parent follow-up"
    >
      <section className="students-risk-page">
        {/* =================================================
            HERO
        ================================================= */}

        <section className="students-risk-hero">
          <div>
            <span>
              ATTENDANCE INTERVENTION
            </span>

            <h2>
              Identify attendance concerns before they become harder to recover.
            </h2>

            <p>
              Review finalized attendance records, prioritize students by risk level,
              and prepare secure guardian communication when follow-up is needed.
            </p>
          </div>

          <aside>
            <span>
              ASSIGNED SECTION
            </span>

            <strong>
              {
                sectionsQuery
                  .isLoading
                  ? "Loading..."
                  : sectionName
              }
            </strong>

            <small>
              Signal Village National High School
            </small>
          </aside>
        </section>

        {/* =================================================
            PAGE ERROR

            Try Again stays ONLY as error recovery.
            It is not a normal manual refresh action.
        ================================================= */}

        {pageError && (
          <div
            className="students-risk-alert"
            role="alert"
          >
            <span>
              !
            </span>

            <div>
              <strong>
                Attendance intervention unavailable
              </strong>

              <p>
                {
                  pageError
                }
              </p>
            </div>

            {sectionId && (
              <button
                type="button"
                onClick={
                  () => {
                    if (
                      configQuery
                        .error &&
                      !configMissing
                    ) {
                      void configQuery
                        .refetch();

                      return;
                    }

                    void risksQuery
                      .refetch();
                  }
                }
              >
                Try Again
              </button>
            )}
          </div>
        )}

        {/* =================================================
            NO SECTION
        ================================================= */}

        {!sectionsQuery
          .isLoading &&
        !section ? (
          <section className="students-risk-empty">
            <span>
              ◇
            </span>

            <h3>
              No assigned section
            </h3>

            <p>
              Attendance-risk monitoring becomes available after a section is assigned.
            </p>
          </section>
        ) : section &&
          configMissing ? (
          <section className="students-risk-panel students-risk-config-panel">
            <header className="students-risk-panel-head">
              <div>
                <span>
                  FIRST-TIME SETUP
                </span>

                <h3>
                  Set up Attendance Risk Monitoring
                </h3>

                <p>
                  This section exists, but it does not have attendance intervention settings yet. Configure the monitoring period and absence thresholds once to activate Students at Risk.
                </p>
              </div>
            </header>

            <form
              className="students-risk-config-form"
              onSubmit={
                (
                  event,
                ) =>
                  void saveInterventionConfig(
                    event,
                  )
              }
            >
              <div className="students-risk-config-grid">
                <label>
                  <span>
                    PERIOD START
                  </span>

                  <input
                    type="date"
                    required
                    value={
                      configForm
                        .periodStart
                    }
                    onChange={
                      (
                        event,
                      ) => {
                        setConfigForm(
                          (
                            current,
                          ) => ({
                            ...current,
                            periodStart:
                              event
                                .target
                                .value,
                          }),
                        );

                        setConfigSaveError(
                          "",
                        );
                      }
                    }
                  />
                </label>

                <label>
                  <span>
                    PERIOD END
                  </span>

                  <input
                    type="date"
                    required
                    value={
                      configForm
                        .periodEnd
                    }
                    onChange={
                      (
                        event,
                      ) => {
                        setConfigForm(
                          (
                            current,
                          ) => ({
                            ...current,
                            periodEnd:
                              event
                                .target
                                .value,
                          }),
                        );

                        setConfigSaveError(
                          "",
                        );
                      }
                    }
                  />
                </label>

                <label>
                  <span>
                    WARNING
                  </span>

                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    placeholder="e.g. 2"
                    value={
                      configForm
                        .warningAbsenceCount
                    }
                    onChange={
                      (
                        event,
                      ) => {
                        setConfigForm(
                          (
                            current,
                          ) => ({
                            ...current,
                            warningAbsenceCount:
                              event
                                .target
                                .value,
                          }),
                        );

                        setConfigSaveError(
                          "",
                        );
                      }
                    }
                  />

                  <small>
                    Absences before early intervention
                  </small>
                </label>

                <label>
                  <span>
                    AT RISK
                  </span>

                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    placeholder="e.g. 4"
                    value={
                      configForm
                        .atRiskAbsenceCount
                    }
                    onChange={
                      (
                        event,
                      ) => {
                        setConfigForm(
                          (
                            current,
                          ) => ({
                            ...current,
                            atRiskAbsenceCount:
                              event
                                .target
                                .value,
                          }),
                        );

                        setConfigSaveError(
                          "",
                        );
                      }
                    }
                  />

                  <small>
                    Must be higher than Warning
                  </small>
                </label>

                <label>
                  <span>
                    CRITICAL
                  </span>

                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    placeholder="e.g. 6"
                    value={
                      configForm
                        .criticalAbsenceCount
                    }
                    onChange={
                      (
                        event,
                      ) => {
                        setConfigForm(
                          (
                            current,
                          ) => ({
                            ...current,
                            criticalAbsenceCount:
                              event
                                .target
                                .value,
                          }),
                        );

                        setConfigSaveError(
                          "",
                        );
                      }
                    }
                  />

                  <small>
                    Must be higher than At Risk
                  </small>
                </label>
              </div>

              <section className="students-risk-config-options">
                <label>
                  <input
                    type="checkbox"
                    checked={
                      configForm
                        .enabled
                    }
                    onChange={
                      (
                        event,
                      ) =>
                        setConfigForm(
                          (
                            current,
                          ) => ({
                            ...current,
                            enabled:
                              event
                                .target
                                .checked,
                          }),
                        )
                    }
                  />

                  <span>
                    <strong>
                      Enable attendance-risk monitoring
                    </strong>

                    <small>
                      Finalized attendance inside the selected period will be evaluated.
                    </small>
                  </span>
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={
                      configForm
                        .parentNotificationEnabled
                    }
                    onChange={
                      (
                        event,
                      ) =>
                        setConfigForm(
                          (
                            current,
                          ) => ({
                            ...current,
                            parentNotificationEnabled:
                              event
                                .target
                                .checked,
                          }),
                        )
                    }
                  />

                  <span>
                    <strong>
                      Enable parent notifications
                    </strong>

                    <small>
                      Warning, At Risk, and Critical notifications start in Manual mode.
                    </small>
                  </span>
                </label>

                <label>
                  <input
                    type="checkbox"
                    disabled={
                      !configForm
                        .parentNotificationEnabled
                    }
                    checked={
                      configForm
                        .allowParentAcknowledgement
                    }
                    onChange={
                      (
                        event,
                      ) =>
                        setConfigForm(
                          (
                            current,
                          ) => ({
                            ...current,
                            allowParentAcknowledgement:
                              event
                                .target
                                .checked,
                          }),
                        )
                    }
                  />

                  <span>
                    <strong>
                      Allow parent acknowledgement
                    </strong>

                    <small>
                      Guardians may confirm that they reviewed the secure attendance notice.
                    </small>
                  </span>
                </label>

                <label>
                  <input
                    type="checkbox"
                    disabled={
                      !configForm
                        .parentNotificationEnabled
                    }
                    checked={
                      configForm
                        .allowParentResponse
                    }
                    onChange={
                      (
                        event,
                      ) =>
                        setConfigForm(
                          (
                            current,
                          ) => ({
                            ...current,
                            allowParentResponse:
                              event
                                .target
                                .checked,
                          }),
                        )
                    }
                  />

                  <span>
                    <strong>
                      Allow parent response
                    </strong>

                    <small>
                      Guardians may submit a response through the secure attendance notice.
                    </small>
                  </span>
                </label>
              </section>

              <label className="students-risk-config-message">
                <div>
                  <span>
                    DEFAULT ADVISER MESSAGE
                  </span>

                  <small>
                    {
                      configForm
                        .defaultAdviserMessage
                        .length
                    }
                    /2000
                  </small>
                </div>

                <textarea
                  rows="4"
                  maxLength="2000"
                  value={
                    configForm
                      .defaultAdviserMessage
                  }
                  placeholder="Optional default message for parent attendance notices..."
                  onChange={
                    (
                      event,
                    ) => {
                      setConfigForm(
                        (
                          current,
                        ) => ({
                          ...current,
                          defaultAdviserMessage:
                            event
                              .target
                              .value,
                        }),
                      );

                      setConfigSaveError(
                        "",
                      );
                    }
                  }
                />
              </label>

              {configSaveError && (
                <div
                  className="students-risk-feedback is-error"
                  role="alert"
                >
                  <span>
                    !
                  </span>

                  <p>
                    {
                      configSaveError
                    }
                  </p>
                </div>
              )}

              <footer className="students-risk-config-actions">
                <div>
                  <span>
                    SECTION
                  </span>

                  <strong>
                    {
                      sectionName
                    }
                  </strong>

                  <small>
                    Configuration is saved once per section and can be updated later through the same backend endpoint.
                  </small>
                </div>

                <button
                  type="submit"
                  disabled={
                    configSaving
                  }
                >
                  {
                    configSaving
                      ? "Saving..."
                      : "Save & Start Monitoring"
                  }
                </button>
              </footer>
            </form>
          </section>
        ) : section ? (
          <>
            {/* =============================================
                SUMMARY
            ============================================= */}

            <section
              className="students-risk-summary"
              aria-label="Attendance risk summary"
            >
              <article>
                <span>
                  STUDENTS
                </span>

                <strong>
                  {
                    loading
                      ? "—"
                      : summary
                          .total
                  }
                </strong>

                <p>
                  Active students evaluated
                </p>
              </article>

              <article className="is-warning">
                <span>
                  WARNING
                </span>

                <strong>
                  {
                    loading
                      ? "—"
                      : summary
                          .warning
                  }
                </strong>

                <p>
                  Early intervention
                </p>
              </article>

              <article className="is-at-risk">
                <span>
                  AT RISK
                </span>

                <strong>
                  {
                    loading
                      ? "—"
                      : summary
                          .atRisk
                  }
                </strong>

                <p>
                  Active follow-up
                </p>
              </article>

              <article className="is-critical">
                <span>
                  CRITICAL
                </span>

                <strong>
                  {
                    loading
                      ? "—"
                      : summary
                          .critical
                  }
                </strong>

                <p>
                  Highest priority
                </p>
              </article>
            </section>

            {/* =============================================
                RISK REGISTER
            ============================================= */}

            <section className="students-risk-panel">
              <header className="students-risk-panel-head">
                <div>
                  <span>
                    STUDENT MONITORING
                  </span>

                  <h3>
                    Attendance Risk Register
                  </h3>

                  <p>
                    {
                      loading
                        ? "Loading finalized attendance data..."
                        : `${summary.needsAttention} student${
                            summary
                              .needsAttention ===
                            1
                              ? ""
                              : "s"
                          } currently require attendance follow-up.`
                    }
                  </p>
                </div>
              </header>

              {/* ===========================================
                  TOOLBAR
              =========================================== */}

              <div className="students-risk-toolbar">
                <label>
                  <span>
                    ⌕
                  </span>

                  <input
                    type="search"
                    value={
                      search
                    }
                    placeholder="Search student name or number..."
                    onChange={
                      (
                        event,
                      ) =>
                        setSearch(
                          event
                            .target
                            .value,
                        )
                    }
                  />

                  {search && (
                    <button
                      type="button"
                      aria-label="Clear search"
                      onClick={
                        () =>
                          setSearch(
                            "",
                          )
                      }
                    >
                      ×
                    </button>
                  )}
                </label>

                <div>
                  {
                    RISK_FILTERS
                      .map(
                        ([
                          value,
                          label,
                        ]) => (
                          <button
                            key={
                              value
                            }
                            type="button"
                            className={
                              filter ===
                              value
                                ? "is-active"
                                : ""
                            }
                            onClick={
                              () =>
                                setFilter(
                                  value,
                                )
                            }
                          >
                            {
                              label
                            }
                          </button>
                        ),
                      )
                  }
                </div>
              </div>

              {/* ===========================================
                  TABLE BODY
              =========================================== */}

              {loading ? (
                <div className="students-risk-loading">
                  {
                    Array.from(
                      {
                        length:
                          6,
                      },
                      (
                        _,
                        index,
                      ) => (
                        <span
                          key={
                            index
                          }
                        />
                      ),
                    )
                  }
                </div>
              ) : !pageError &&
                rows.length ===
                  0 ? (
                <div className="students-risk-empty is-panel">
                  <span>
                    ✓
                  </span>

                  <h3>
                    No risk data yet
                  </h3>

                  <p>
                    Finalized sessions inside the configured intervention period will appear here.
                  </p>
                </div>
              ) : !pageError &&
                filteredRows
                  .length ===
                  0 ? (
                <div className="students-risk-empty is-panel">
                  <span>
                    ⌕
                  </span>

                  <h3>
                    No matching students
                  </h3>

                  <p>
                    Change the search term or risk filter to view other records.
                  </p>
                </div>
              ) : !pageError ? (
                <>
                  <div className="students-risk-table-wrap">
                    <table className="students-risk-table">
                      <thead>
                        <tr>
                          <th>
                            Student
                          </th>

                          <th>
                            Sessions
                          </th>

                          <th>
                            Present
                          </th>

                          <th>
                            Late
                          </th>

                          <th>
                            Absent
                          </th>

                          <th>
                            Risk
                          </th>

                          <th>
                            Parent Follow-up
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {
                          pageRows
                            .map(
                              (
                                row,
                              ) => {
                                const risk =
                                  getRiskLevel(
                                    row,
                                  );

                                const interventionId =
                                  getInterventionId(
                                    row,
                                  );

                                const interventionStatus =
                                  getInterventionStatus(
                                    row,
                                  );

                                const notificationMode =
                                  getNotificationMode(
                                    row,
                                  );

                                const canReview =
                                  ![
                                    "NORMAL",
                                    "UNKNOWN",
                                  ].includes(
                                    risk,
                                  ) &&
                                  Boolean(
                                    interventionId,
                                  );

                                return (
                                  <tr
                                    key={
                                      row
                                        ?.studentId ||
                                      row
                                        ?.studentNumber
                                    }
                                  >
                                    <td>
                                      <div className="students-risk-student">
                                        <span>
                                          {
                                            initial(
                                              row
                                                ?.studentName,
                                            )
                                          }
                                        </span>

                                        <div>
                                          <strong>
                                            {
                                              row
                                                ?.studentName ||
                                              "Unnamed Student"
                                            }
                                          </strong>

                                          <small>
                                            {
                                              row
                                                ?.studentNumber ||
                                              "No student number"
                                            }
                                          </small>
                                        </div>
                                      </div>
                                    </td>

                                    <td>
                                      {
                                        count(
                                          row
                                            ?.sessionCount,
                                        )
                                      }
                                    </td>

                                    <td className="is-present">
                                      {
                                        count(
                                          row
                                            ?.presentCount,
                                        )
                                      }
                                    </td>

                                    <td className="is-late">
                                      {
                                        count(
                                          row
                                            ?.lateCount,
                                        )
                                      }
                                    </td>

                                    <td className="is-absent">
                                      {
                                        count(
                                          row
                                            ?.absentCount,
                                        )
                                      }
                                    </td>

                                    <td>
                                      <RiskBadge
                                        value={
                                          risk
                                        }
                                      />

                                      <small className="students-risk-risk-copy">
                                        {
                                          riskDescription(
                                            risk,
                                          )
                                        }
                                      </small>
                                    </td>

                                    <td>
                                      {canReview ? (
                                        <button
                                          className="students-risk-review"
                                          type="button"
                                          onClick={
                                            () =>
                                              void openReview(
                                                row,
                                              )
                                          }
                                        >
                                          Review Notice →
                                        </button>
                                      ) : (
                                        <span className="students-risk-muted">
                                          {
                                            risk ===
                                            "NORMAL"
                                              ? "No action required"
                                              : "Intervention unavailable"
                                          }
                                        </span>
                                      )}

                                      {(interventionStatus ||
                                        notificationMode) && (
                                        <small className="students-risk-meta">
                                          {
                                            [
                                              interventionStatus &&
                                                `Intervention: ${interventionStatus.replaceAll(
                                                  "_",
                                                  " ",
                                                )}`,

                                              notificationMode &&
                                                `Mode: ${notificationMode.replaceAll(
                                                  "_",
                                                  " ",
                                                )}`,
                                            ]
                                              .filter(
                                                Boolean,
                                              )
                                              .join(
                                                " • ",
                                              )
                                          }
                                        </small>
                                      )}
                                    </td>
                                  </tr>
                                );
                              },
                            )
                        }
                      </tbody>
                    </table>
                  </div>

                  {/* =======================================
                      PAGINATION
                  ======================================= */}

                  <footer className="students-risk-pagination">
                    <p>
                      Showing{" "}
                      <strong>
                        {
                          filteredRows
                            .length
                            ? start +
                              1
                            : 0
                        }
                      </strong>
                      –
                      <strong>
                        {
                          Math.min(
                            start +
                              PAGE_SIZE,
                            filteredRows
                              .length,
                          )
                        }
                      </strong>{" "}
                      of{" "}
                      <strong>
                        {
                          filteredRows
                            .length
                        }
                      </strong>
                    </p>

                    <div>
                      <button
                        type="button"
                        disabled={
                          safePage <=
                          1
                        }
                        onClick={
                          () =>
                            setPage(
                              (
                                current,
                              ) =>
                                Math.max(
                                  1,
                                  current -
                                    1,
                                ),
                            )
                        }
                      >
                        ← Previous
                      </button>

                      <span>
                        Page{" "}
                        <strong>
                          {
                            safePage
                          }
                        </strong>{" "}
                        of{" "}
                        <strong>
                          {
                            totalPages
                          }
                        </strong>
                      </span>

                      <button
                        type="button"
                        disabled={
                          safePage >=
                          totalPages
                        }
                        onClick={
                          () =>
                            setPage(
                              (
                                current,
                              ) =>
                                Math.min(
                                  totalPages,
                                  current +
                                    1,
                                ),
                            )
                        }
                      >
                        Next →
                      </button>
                    </div>
                  </footer>
                </>
              ) : null}
            </section>
          </>
        ) : null}

        {/* =================================================
            PARENT NOTICE MODAL
        ================================================= */}

        {selectedRow && (
          <div
            className="students-risk-modal-backdrop"
            role="presentation"
            onMouseDown={
              (
                event,
              ) => {
                if (
                  event
                    .target ===
                    event
                      .currentTarget &&
                  !modalBusy
                ) {
                  closeModal();
                }
              }
            }
          >
            <section
              className="students-risk-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="risk-notice-title"
            >
              {/* ===========================================
                  MODAL HEADER
              =========================================== */}

              <header>
                <div>
                  <span>
                    SECURE PARENT COMMUNICATION
                  </span>

                  <h2 id="risk-notice-title">
                    Attendance Intervention Review
                  </h2>

                  <p>
                    {
                      communications
                        .length >
                      0
                        ? "Review attendance evidence, delivery status, acknowledgement, and parent responses in one place."
                        : "Review the attendance evidence before preparing secure parent communication."
                    }
                  </p>
                </div>

                <button
                  type="button"
                  aria-label="Close"
                  disabled={
                    modalBusy
                  }
                  onClick={
                    closeModal
                  }
                >
                  ×
                </button>
              </header>

              {/* ===========================================
                  LOADING
              =========================================== */}

              {previewLoading ? (
                <div className="students-risk-modal-loading">
                  <span />

                  <strong>
                    Loading secure notification preview...
                  </strong>
                </div>
              ) : previewError ? (
                <div className="students-risk-modal-error">
                  <span>
                    !
                  </span>

                  <div>
                    <strong>
                      Notice cannot be prepared
                    </strong>

                    <p>
                      {
                        previewError
                      }
                    </p>
                  </div>
                </div>
              ) : preview ? (
                <div className="students-risk-modal-body">
                  {/* =======================================
                      STUDENT / GUARDIAN
                  ======================================= */}

                  <section className="students-risk-notice-identity">
                    <div>
                      <span>
                        STUDENT
                      </span>

                      <strong>
                        {
                          preview
                            ?.studentName ||
                          "Student"
                        }
                      </strong>

                      <small>
                        {
                          preview
                            ?.studentNumber ||
                          "—"
                        }
                      </small>
                    </div>

                    <div>
                      <span>
                        PRIMARY GUARDIAN
                      </span>

                      <strong>
                        {
                          preview
                            ?.guardianName ||
                          "Guardian"
                        }
                      </strong>

                      <small>
                        {
                          preview
                            ?.guardianEmail ||
                          "Email unavailable"
                        }
                      </small>
                    </div>
                  </section>

                  {/* =======================================
                      SUMMARY
                  ======================================= */}

                  <section className="students-risk-notice-summary">
                    <div>
                      <span>
                        RISK
                      </span>

                      <RiskBadge
                        value={
                          getRiskLevel(
                            preview,
                          )
                        }
                      />
                    </div>

                    <div>
                      <span>
                        ABSENCES
                      </span>

                      <strong>
                        {
                          count(
                            preview
                              ?.currentAbsenceCount,
                          )
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        THRESHOLD
                      </span>

                      <strong>
                        {
                          count(
                            preview
                              ?.thresholdAbsenceCount,
                          )
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        PERIOD
                      </span>

                      <strong>
                        {
                          formatDate(
                            preview
                              ?.periodStart,
                          )
                        }{" "}
                        –{" "}
                        {
                          formatDate(
                            preview
                              ?.periodEnd,
                          )
                        }
                      </strong>
                    </div>
                  </section>

                  {/* =======================================
                      ATTENDANCE CHANGED WARNING
                  ======================================= */}

                  {
                    hasAttendanceChanged(
                      preview,
                    ) && (
                      <div className="students-risk-warning">
                        <span>
                          !
                        </span>

                        <p>
                          <strong>
                            Attendance changed after this intervention.
                          </strong>{" "}
                          Review the current finalized absence list before preparing the notice.
                        </p>
                      </div>
                    )
                  }

                  {/* =======================================
                      SUBJECT
                  ======================================= */}

                  <section className="students-risk-subject">
                    <span>
                      EMAIL SUBJECT
                    </span>

                    <strong>
                      {
                        preview
                          ?.subject ||
                        "Attendance Notice"
                      }
                    </strong>
                  </section>

                  {/* =======================================
                      FINALIZED ABSENCES
                  ======================================= */}

                  <section className="students-risk-absences">
                    <header>
                      <div>
                        <span>
                          FINALIZED RECORDS
                        </span>

                        <h3>
                          Attendance Details
                        </h3>
                      </div>

                      <strong>
                        {
                          count(
                            preview
                              ?.currentAbsenceCount,
                          )
                        }{" "}
                        absence
                        {
                          count(
                            preview
                              ?.currentAbsenceCount,
                          ) ===
                          1
                            ? ""
                            : "s"
                        }
                      </strong>
                    </header>

                    <div>
                      {
                        previewAbsences
                          .length >
                        0 ? (
                          previewAbsences
                            .map(
                              (
                                absence,
                                index,
                              ) => (
                                <article
                                  key={
                                    absence
                                      ?.attendanceRecordId ||
                                    `${absence?.attendanceDate}-${index}`
                                  }
                                >
                                  <div>
                                    <span>
                                      DATE
                                    </span>

                                    <strong>
                                      {
                                        formatDate(
                                          absence
                                            ?.attendanceDate,
                                        )
                                      }
                                    </strong>
                                  </div>

                                  <div>
                                    <span>
                                      SESSION
                                    </span>

                                    <strong>
                                      {
                                        formatTime(
                                          absence
                                            ?.sessionStartedAt,
                                        )
                                      }{" "}
                                      –{" "}
                                      {
                                        formatTime(
                                          absence
                                            ?.sessionEndedAt,
                                        )
                                      }
                                    </strong>
                                  </div>

                                  <em>
                                    {
                                      upper(
                                        absence
                                          ?.status,
                                      ) ||
                                      "ABSENT"
                                    }
                                  </em>
                                </article>
                              ),
                            )
                        ) : (
                          <div className="students-risk-no-absence-details">
                            No finalized absence details are available.
                          </div>
                        )
                      }
                    </div>
                  </section>

                  {/* =======================================
                      PARENT COMMUNICATION
                  ======================================= */}

                  <section className="students-risk-communication">
                    <header>
                      <div>
                        <span>
                          PARENT COMMUNICATION
                        </span>

                        <h3>
                          Delivery & Response Activity
                        </h3>

                        <p>
                          Communication activity is cached and checked periodically while this review is open.
                        </p>
                      </div>

                      {latestCommunication ? (
                        <span
                          className={`students-risk-communication-status is-${communicationStatusClass(
                            latestCommunication
                              ?.status,
                          )}`}
                        >
                          {
                            communicationStatusLabel(
                              latestCommunication
                                ?.status,
                            )
                          }
                        </span>
                      ) : (
                        <span className="students-risk-communication-status is-none">
                          Not contacted
                        </span>
                      )}
                    </header>

                    {
                      communicationQuery
                        .isLoading ? (
                        <div className="students-risk-communication-loading">
                          <span />

                          <p>
                            Loading parent communication activity...
                          </p>
                        </div>
                      ) : communicationQuery
                          .error ? (
                        <div className="students-risk-communication-error">
                          <span>
                            !
                          </span>

                          <p>
                            {
                              getErrorMessage(
                                communicationQuery
                                  .error,
                                "Unable to load parent communication activity.",
                              )
                            }
                          </p>
                        </div>
                      ) : communications
                          .length ===
                        0 ? (
                        <div className="students-risk-communication-empty">
                          <span>
                            ✉
                          </span>

                          <div>
                            <strong>
                              No parent notice has been sent yet
                            </strong>

                            <p>
                              Prepare a notice below when parent follow-up is appropriate.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="students-risk-communication-flow">
                            <article
                              className={
                                latestSentCommunication
                                  ? "is-complete"
                                  : ""
                              }
                            >
                              <span>
                                ✓
                              </span>

                              <div>
                                <small>
                                  EMAIL DELIVERY
                                </small>

                                <strong>
                                  {
                                    latestSentCommunication
                                      ? "Sent to guardian"
                                      : "Not sent yet"
                                  }
                                </strong>

                                <p>
                                  {
                                    latestSentCommunication
                                      ? formatDateTime(
                                          latestSentCommunication
                                            ?.sentAt,
                                        )
                                      : "Waiting for email delivery"
                                  }
                                </p>
                              </div>
                            </article>

                            <article
                              className={
                                latestAcknowledgement
                                  ? "is-complete"
                                  : ""
                              }
                            >
                              <span>
                                ✓
                              </span>

                              <div>
                                <small>
                                  PARENT REVIEW
                                </small>

                                <strong>
                                  {
                                    latestAcknowledgement
                                      ? "Notice acknowledged"
                                      : "Awaiting acknowledgement"
                                  }
                                </strong>

                                <p>
                                  {
                                    latestAcknowledgement
                                      ? formatDateTime(
                                          latestAcknowledgement
                                            ?.acknowledgedAt,
                                        )
                                      : "No acknowledgement received yet"
                                  }
                                </p>
                              </div>
                            </article>

                            <article
                              className={
                                latestParentResponse
                                  ? "is-complete is-response"
                                  : ""
                              }
                            >
                              <span>
                                ✓
                              </span>

                              <div>
                                <small>
                                  PARENT RESPONSE
                                </small>

                                <strong>
                                  {
                                    latestParentResponse
                                      ? "Response received"
                                      : "No response yet"
                                  }
                                </strong>

                                <p>
                                  {
                                    latestParentResponse
                                      ? formatDateTime(
                                          latestParentResponse
                                            ?.respondedAt,
                                        )
                                      : "The parent may respond through the secure notice"
                                  }
                                </p>
                              </div>
                            </article>
                          </div>

                          {latestParentResponse && (
                            <div className="students-risk-parent-response">
                              <header>
                                <div>
                                  <span>
                                    LATEST PARENT RESPONSE
                                  </span>

                                  <strong>
                                    {
                                      latestParentResponse
                                        ?.recipientName ||
                                      preview
                                        ?.guardianName ||
                                      "Parent or guardian"
                                    }
                                  </strong>
                                </div>

                                <small>
                                  {
                                    formatDateTime(
                                      latestParentResponse
                                        ?.respondedAt,
                                    )
                                  }
                                </small>
                              </header>

                              <blockquote>
                                {
                                  String(
                                    latestParentResponse
                                      ?.parentResponse ||
                                      "Response received.",
                                  )
                                }
                              </blockquote>

                              <footer>
                                <span>
                                  Related notice
                                </span>

                                <strong>
                                  {
                                    latestParentResponse
                                      ?.subject ||
                                    preview
                                      ?.subject ||
                                    "Attendance Notice"
                                  }
                                </strong>
                              </footer>
                            </div>
                          )}

                          <details className="students-risk-communication-history">
                            <summary>
                              <span>
                                Communication history
                              </span>

                              <strong>
                                {
                                  communications
                                    .length
                                }{" "}
                                notice
                                {
                                  communications
                                    .length ===
                                  1
                                    ? ""
                                    : "s"
                                }
                              </strong>
                            </summary>

                            <div>
                              {
                                communications
                                  .slice(
                                    0,
                                    8,
                                  )
                                  .map(
                                    (
                                      item,
                                      index,
                                    ) => (
                                      <article
                                        key={
                                          item
                                            ?.notificationId ||
                                          `${item?.createdAt}-${index}`
                                        }
                                      >
                                        <span
                                          className={`is-${communicationStatusClass(
                                            item
                                              ?.status,
                                          )}`}
                                        />

                                        <div>
                                          <strong>
                                            {
                                              communicationStatusLabel(
                                                item
                                                  ?.status,
                                              )
                                            }
                                          </strong>

                                          <small>
                                            {
                                              item
                                                ?.recipientEmail ||
                                              "Guardian email unavailable"
                                            }
                                          </small>
                                        </div>

                                        <time>
                                          {
                                            formatDateTime(
                                              item
                                                ?.respondedAt ||
                                                item
                                                  ?.acknowledgedAt ||
                                                item
                                                  ?.sentAt ||
                                                item
                                                  ?.queuedAt ||
                                                item
                                                  ?.createdAt,
                                            )
                                          }
                                        </time>
                                      </article>
                                    ),
                                  )
                              }
                            </div>
                          </details>
                        </>
                      )
                    }
                  </section>

                  {/* =======================================
                      ADVISER NOTE
                  ======================================= */}

                  <label className="students-risk-note">
                    <div>
                      <span>
                        ADVISER NOTE
                      </span>

                      <small>
                        {
                          adviserNote
                            .length
                        }
                        /2000
                      </small>
                    </div>

                    <textarea
                      rows="5"
                      maxLength="2000"
                      value={
                        adviserNote
                      }
                      disabled={
                        Boolean(
                          prepared,
                        )
                      }
                      placeholder="Add a clear and respectful note for the parent or guardian..."
                      onChange={
                        (
                          event,
                        ) => {
                          setAdviserNote(
                            event
                              .target
                              .value,
                          );

                          setActionError(
                            "",
                          );
                        }
                      }
                    />

                    <small>
                      Once prepared, this note is frozen into the notification snapshot.
                    </small>
                  </label>

                  {/* =======================================
                      PREPARED
                  ======================================= */}

                  {prepared && (
                    <div className="students-risk-prepared">
                      <span>
                        ✓
                      </span>

                      <div>
                        <strong>
                          Notification snapshot prepared
                        </strong>

                        <p>
                          Recipient, student, risk, note, and absence details are now frozen.
                        </p>
                      </div>

                      <em>
                        {
                          upper(
                            prepared
                              ?.status,
                          ) ||
                          "PENDING"
                        }
                      </em>
                    </div>
                  )}

                  {/* =======================================
                      ACTION ERROR
                  ======================================= */}

                  {actionError && (
                    <div
                      className="students-risk-feedback is-error"
                      role="alert"
                    >
                      <span>
                        !
                      </span>

                      <p>
                        {
                          actionError
                        }
                      </p>
                    </div>
                  )}

                  {/* =======================================
                      ACTION SUCCESS
                  ======================================= */}

                  {actionSuccess && (
                    <div
                      className="students-risk-feedback is-success"
                      role="status"
                    >
                      <span>
                        ✓
                      </span>

                      <p>
                        {
                          actionSuccess
                        }
                      </p>
                    </div>
                  )}
                </div>
              ) : null}

              {/* ===========================================
                  MODAL ACTIONS
              =========================================== */}

              <footer className="students-risk-modal-actions">
                <div>
                  <span>
                    DELIVERY FLOW
                  </span>

                  <strong>
                    {
                      queued
                        ? "Queued for delivery"
                        : prepared
                          ? "Prepared → Queue Email"
                          : communicationInProgress
                            ? communicationStatus ===
                              "QUEUED"
                              ? "Notice queued — delivery pending"
                              : "Prepared notice already exists"
                            : latestParentResponse
                              ? "Parent response received"
                              : latestCommunication
                                ? "Follow-up available"
                                : "Preview → Prepare"
                    }
                  </strong>
                </div>

                <div>
                  <button
                    type="button"
                    className="is-secondary"
                    disabled={
                      modalBusy
                    }
                    onClick={
                      closeModal
                    }
                  >
                    {
                      queued
                        ? "Done"
                        : "Close"
                    }
                  </button>

                  {!previewError &&
                    preview &&
                    !prepared && (
                      <button
                        type="button"
                        className="is-primary"
                        disabled={
                          modalBusy ||
                          communicationInProgress
                        }
                        onClick={
                          () =>
                            void prepareNotice()
                        }
                      >
                        {
                          preparing
                            ? "Preparing..."
                            : communicationInProgress
                              ? "Notice Already In Progress"
                              : latestCommunication
                                ? "Prepare Follow-up Notice"
                                : "Prepare Notice"
                        }
                      </button>
                    )}

                  {prepared &&
                    !queued && (
                      <button
                        type="button"
                        className="is-primary"
                        disabled={
                          modalBusy
                        }
                        onClick={
                          () =>
                            void queueNotice()
                        }
                      >
                        {
                          queueing
                            ? "Queueing..."
                            : "Queue Parent Email"
                        }
                      </button>
                    )}
                </div>
              </footer>
            </section>
          </div>
        )}
      </section>
    </AdviserLayout>
  );
}

export default StudentsAtRisk;