import api from "./api";

/* =========================================================
   ACCOUNT SECURITY
========================================================= */

const changePassword = async ({ currentPassword, newPassword }) => {
  const response = await api.patch("/users/me/password", {
    currentPassword,
    newPassword,
  });

  return response.data;
};

/* =========================================================
   EXPORT
========================================================= */

const accountService = {
  changePassword,
};

export default accountService;
