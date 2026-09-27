process.env.SAFEGO_DATA_MODE = "mock";
process.env.SAFEGO_WEATHER_PROVIDER = "disabled";
process.env.SAFEGO_DEMO_ROUTE_FALLBACK = "true";

console.log("Starting SafeGo in offline demo mode.");
console.log("Use the built-in example trip; arbitrary searches still require geocoding and routing services.\n");

await import("./dev.mjs");
