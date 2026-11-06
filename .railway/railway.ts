import { defineRailway, project, service, volume } from "railway/iac";

export default defineRailway(() => {
  const coachApiVolume = volume("coach-api-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "sfo", sizeMB: 500 });
  const coachApi = service("coach-api", {
    build: { buildEnvironment: "V3", builder: "DOCKERFILE" },
    healthcheck: "/healthz",
    replicas: { "sfo": 1 },
    volumeMounts: { "/data": coachApiVolume },
  });

  return project("GarminCoach", {
    variables: { managed: false },
    resources: [coachApi, coachApiVolume],
  });
});
