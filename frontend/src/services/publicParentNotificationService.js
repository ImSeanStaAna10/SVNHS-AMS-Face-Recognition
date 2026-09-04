import publicApi from "./publicApi";

const encodeToken = (token) =>
  encodeURIComponent(
    String(token || "").trim(),
  );

const getNotice = async (token) => {
  const response =
    await publicApi.get(
      `/public/parent-notifications/${encodeToken(
        token,
      )}`,
    );

  return response.data;
};

const acknowledgeNotice = async (
  token,
) => {
  const response =
    await publicApi.post(
      `/public/parent-notifications/${encodeToken(
        token,
      )}/acknowledge`,
    );

  return response.data;
};

const submitResponse = async (
  token,
  parentResponse,
) => {
  const response =
    await publicApi.post(
      `/public/parent-notifications/${encodeToken(
        token,
      )}/response`,
      {
        response: parentResponse,
      },
    );

  return response.data;
};

const publicParentNotificationService = {
  getNotice,
  acknowledgeNotice,
  submitResponse,
};

export default publicParentNotificationService;