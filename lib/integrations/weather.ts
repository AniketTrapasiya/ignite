/**
 * WeatherAPI integration (weatherapi.com).
 *
 * Credentials:
 *   apiKey = WeatherAPI Key
 *   chatId = Default location (city name, lat,lon, or ZIP — can be overridden per query)
 *
 * Used as a data enrichment source.
 */

const WEATHER_API = "https://api.weatherapi.com/v1";

export interface WeatherCurrent {
  location: string;
  country: string;
  tempC: number;
  tempF: number;
  condition: string;
  humidity: number;
  windKph: number;
  feelsLikeC: number;
  uv: number;
}

export interface WeatherForecastDay {
  date: string;
  maxTempC: number;
  minTempC: number;
  condition: string;
  chanceOfRain: number;
}

/**
 * Get current weather for a location.
 */
export async function getCurrentWeather(
  apiKey: string,
  location: string
): Promise<{ ok: boolean; weather?: WeatherCurrent; error?: string }> {
  try {
    const res = await fetch(
      `${WEATHER_API}/current.json?key=${apiKey}&q=${encodeURIComponent(location)}&aqi=no`,
      { cache: "no-store" }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: (err as { error?: { message: string } }).error?.message ?? `WeatherAPI HTTP ${res.status}` };
    }
    const data = await res.json() as {
      location: { name: string; country: string };
      current: {
        temp_c: number; temp_f: number; condition: { text: string };
        humidity: number; wind_kph: number; feelslike_c: number; uv: number;
      };
    };
    return {
      ok: true,
      weather: {
        location: data.location.name,
        country: data.location.country,
        tempC: data.current.temp_c,
        tempF: data.current.temp_f,
        condition: data.current.condition.text,
        humidity: data.current.humidity,
        windKph: data.current.wind_kph,
        feelsLikeC: data.current.feelslike_c,
        uv: data.current.uv,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Get 7-day weather forecast for a location.
 */
export async function getWeatherForecast(
  apiKey: string,
  location: string,
  days = 7
): Promise<{ ok: boolean; forecast?: WeatherForecastDay[]; location?: string; error?: string }> {
  try {
    const res = await fetch(
      `${WEATHER_API}/forecast.json?key=${apiKey}&q=${encodeURIComponent(location)}&days=${days}&aqi=no&alerts=no`,
      { cache: "no-store" }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: (err as { error?: { message: string } }).error?.message ?? `WeatherAPI HTTP ${res.status}` };
    }
    const data = await res.json() as {
      location: { name: string };
      forecast: {
        forecastday: Array<{
          date: string;
          day: {
            maxtemp_c: number; mintemp_c: number;
            condition: { text: string }; daily_chance_of_rain: number;
          };
        }>;
      };
    };
    const forecast: WeatherForecastDay[] = data.forecast.forecastday.map((d) => ({
      date: d.date,
      maxTempC: d.day.maxtemp_c,
      minTempC: d.day.mintemp_c,
      condition: d.day.condition.text,
      chanceOfRain: d.day.daily_chance_of_rain,
    }));
    return { ok: true, forecast, location: data.location.name };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function formatWeatherContext(weather: WeatherCurrent): string {
  return `Current weather in ${weather.location}, ${weather.country}: ${weather.condition}, ${weather.tempC}°C (feels like ${weather.feelsLikeC}°C), Humidity ${weather.humidity}%, Wind ${weather.windKph} km/h`;
}

export function formatForecastContext(forecast: WeatherForecastDay[], location: string): string {
  const lines = forecast.map(
    (d) => `  ${d.date}: ${d.condition}, ${d.minTempC}–${d.maxTempC}°C, ${d.chanceOfRain}% rain`
  );
  return `7-day forecast for ${location}:\n${lines.join("\n")}`;
}
