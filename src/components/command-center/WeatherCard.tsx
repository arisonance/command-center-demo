"use client";
import { useEffect, useState } from "react";

interface WeatherData {
  temp: number;
  high: number;
  low: number;
  condition: string;
  wind: string;
  humidity: number;
  precip: number;
  uv: number;
  sunrise: string;
  sunset: string;
  icon: "sun" | "cloud" | "rain" | "cloudy";
}

function WeatherIcon({ icon, size = 36 }: { icon: WeatherData["icon"]; size?: number }) {
  if (icon === "sun") return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--accent-amber)" strokeWidth="1.5">
      <circle cx="12" cy="12" r="4" fill="var(--accent-amber)" opacity="0.3" /><circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="22" />
      <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" /><line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
      <line x1="2" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" /><line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
    </svg>
  );
  if (icon === "rain") return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#78B4F0" strokeWidth="1.5">
      <path d="M20 17.58A5 5 0 0018 8h-1.26A8 8 0 104 16.25" /><line x1="8" y1="19" x2="8" y2="21" />
      <line x1="8" y1="13" x2="8" y2="15" /><line x1="16" y1="19" x2="16" y2="21" />
      <line x1="16" y1="13" x2="16" y2="15" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="12" y1="15" x2="12" y2="17" />
    </svg>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#B8B8B8" strokeWidth="1.5">
      <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" />
    </svg>
  );
}

export function WeatherCard() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("https://wttr.in/San+Clemente,CA?format=j1")
      .then(r => r.json())
      .then(data => {
        const cur = data.current_condition?.[0];
        const today = data.weather?.[0];
        if (!cur || !today) { setError(true); return; }

        const desc = cur.weatherDesc?.[0]?.value || "";
        const icon: WeatherData["icon"] = /rain|drizzle|shower/i.test(desc) ? "rain"
          : /cloud|overcast|mist|fog/i.test(desc) ? (Math.random() > 0.5 ? "cloud" : "cloudy")
          : "sun";

        setWeather({
          temp: Math.round(parseInt(cur.temp_F)),
          high: Math.round(parseInt(today.maxtempF)),
          low: Math.round(parseInt(today.mintempF)),
          condition: desc,
          wind: `${cur.windspeedMiles} mph ${cur.winddir16Point}`,
          humidity: parseInt(cur.humidity),
          precip: Math.round(parseFloat(today.hourly?.[4]?.chanceofrain || "0")),
          uv: parseInt(cur.uvIndex || "0"),
          sunrise: today.astronomy?.[0]?.sunrise || "—",
          sunset: today.astronomy?.[0]?.sunset || "—",
          icon,
        });
      })
      .catch(() => setError(true));
  }, []);

  return (
    <section className="glass-card anim-card relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[rgba(212,164,76,0.08)] to-transparent pointer-events-none" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-text-muted text-sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
            </svg>
            <span>San Clemente, CA</span>
          </div>
          <WeatherIcon icon={weather?.icon ?? "sun"} />
        </div>

        {error ? (
          <div className="text-sm text-text-muted py-2">Weather unavailable</div>
        ) : !weather ? (
          <div className="animate-pulse space-y-2">
            <div className="h-8 bg-white/5 rounded w-24" />
            <div className="h-4 bg-white/5 rounded w-36" />
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-3xl font-semibold text-text-heading">{weather.temp}°F</span>
              <span className="text-text-muted text-sm">H:{weather.high}° L:{weather.low}°</span>
            </div>
            <p className="text-sm text-text-body mb-1">{weather.condition}</p>
            <p className="text-xs text-text-muted mb-4">Winds {weather.wind} · {weather.temp}°F now</p>
            <div className="grid grid-cols-5 gap-3">
              {[
                { label: "Precip", value: `${weather.precip}%` },
                { label: "Humidity", value: `${weather.humidity}%` },
                { label: "UV", value: `${weather.uv}` },
                { label: "Sunrise", value: weather.sunrise },
                { label: "Sunset", value: weather.sunset },
              ].map((d) => (
                <div key={d.label} className="text-center">
                  <div className="text-[10px] uppercase tracking-wider text-text-muted mb-0.5">{d.label}</div>
                  <div className="text-sm font-medium text-text-heading">{d.value}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
