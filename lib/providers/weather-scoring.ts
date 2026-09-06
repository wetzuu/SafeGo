function precipitationScore(millimetersPerHour: number) {
  if (millimetersPerHour >= 15) return 90;
  if (millimetersPerHour >= 7.5) return 70;
  if (millimetersPerHour >= 2.5) return 45;
  if (millimetersPerHour >= 0.5) return 25;
  if (millimetersPerHour >= 0.1) return 10;
  return 0;
}

function gustScore(kilometersPerHour: number) {
  if (kilometersPerHour >= 100) return 95;
  if (kilometersPerHour >= 75) return 75;
  if (kilometersPerHour >= 50) return 55;
  if (kilometersPerHour >= 35) return 35;
  if (kilometersPerHour >= 20) return 15;
  return 0;
}

function weatherCodeScore(code: number) {
  if ([96, 99].includes(code)) return 95;
  if (code === 95) return 80;
  if ([65, 67, 82].includes(code)) return 70;
  if ([63, 66, 81].includes(code)) return 55;
  if ([61, 80].includes(code)) return 40;
  if ([55, 57].includes(code)) return 45;
  if ([53, 56].includes(code)) return 35;
  if (code === 51) return 25;
  if ([45, 48].includes(code)) return 20;
  if ([1, 2, 3].includes(code)) return 5;
  return 0;
}

export function scoreWeatherConditions(input: {
  weatherCode: number;
  precipitationMillimeters: number;
  windGustKph: number;
}) {
  return Math.max(
    weatherCodeScore(input.weatherCode),
    precipitationScore(input.precipitationMillimeters),
    gustScore(input.windGustKph),
  );
}

export function weatherCodeLabel(code: number) {
  if (code === 0) return "Clear";
  if ([1, 2, 3].includes(code)) return "Partly cloudy";
  if ([45, 48].includes(code)) return "Foggy";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([80, 81, 82].includes(code)) return "Rain showers";
  if ([95, 96, 99].includes(code)) return "Thunderstorm";
  return "Unknown conditions";
}
