import api from "./api";

const getAdvisers = async () => {
  const response = await api.get("/users");

  return response.data;
};

const createAdviser = async ({ name, email, password }) => {
  const response = await api.post("/users/advisers", {
    name,
    email,
    password,
  });

  return response.data;
};

const getAttendanceOverview = async () => {
  const response = await api.get("/attendance-overview");

  return response.data;
};

const councilorService = {
  getAdvisers,
  createAdviser,
  getAttendanceOverview,
};

export default councilorService;
