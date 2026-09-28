/**
 * 日出日落与黄金时刻计算。
 * 用天文年历的经典算法（Almanac for Computers），中纬度误差约一分钟，
 * 不依赖任何外部接口，纯本地计算。
 *
 * 注意：时区用城市表里的标准偏移，不处理夏令时。
 */

import type { CityInfo, SunTimes } from "@studio/shared";

const DEG = Math.PI / 180;

export type City = CityInfo;

export const CITIES: City[] = [
  { name: "北京", lat: 39.9042, lon: 116.4074, tz: 8 },
  { name: "上海", lat: 31.2304, lon: 121.4737, tz: 8 },
  { name: "广州", lat: 23.1291, lon: 113.2644, tz: 8 },
  { name: "深圳", lat: 22.5431, lon: 114.0579, tz: 8 },
  { name: "杭州", lat: 30.2741, lon: 120.1551, tz: 8 },
  { name: "南京", lat: 32.0603, lon: 118.7969, tz: 8 },
  { name: "苏州", lat: 31.2989, lon: 120.5853, tz: 8 },
  { name: "成都", lat: 30.5728, lon: 104.0668, tz: 8 },
  { name: "重庆", lat: 29.563, lon: 106.5516, tz: 8 },
  { name: "西安", lat: 34.3416, lon: 108.9398, tz: 8 },
  { name: "武汉", lat: 30.5928, lon: 114.3055, tz: 8 },
  { name: "长沙", lat: 28.2282, lon: 112.9388, tz: 8 },
  { name: "厦门", lat: 24.4798, lon: 118.0894, tz: 8 },
  { name: "青岛", lat: 36.0671, lon: 120.3826, tz: 8 },
  { name: "天津", lat: 39.3434, lon: 117.3616, tz: 8 },
  { name: "昆明", lat: 24.8801, lon: 102.8329, tz: 8 },
  { name: "大理", lat: 25.6065, lon: 100.2679, tz: 8 },
  { name: "丽江", lat: 26.8721, lon: 100.2299, tz: 8 },
  { name: "三亚", lat: 18.2528, lon: 109.5119, tz: 8 },
  { name: "桂林", lat: 25.2736, lon: 110.29, tz: 8 },
  { name: "哈尔滨", lat: 45.8038, lon: 126.535, tz: 8 },
  { name: "乌鲁木齐", lat: 43.8256, lon: 87.6168, tz: 8 },
  { name: "拉萨", lat: 29.652, lon: 91.1721, tz: 8 },
  { name: "香港", lat: 22.3193, lon: 114.1694, tz: 8 },
  { name: "台北", lat: 25.033, lon: 121.5654, tz: 8 },
  { name: "东京", lat: 35.6762, lon: 139.6503, tz: 9 },
  { name: "大阪", lat: 34.6937, lon: 135.5023, tz: 9 },
  { name: "京都", lat: 35.0116, lon: 135.7681, tz: 9 },
  { name: "札幌", lat: 43.0618, lon: 141.3545, tz: 9 },
  { name: "首尔", lat: 37.5665, lon: 126.978, tz: 9 },
  { name: "曼谷", lat: 13.7563, lon: 100.5018, tz: 7 },
  { name: "清迈", lat: 18.7883, lon: 98.9853, tz: 7 },
  { name: "普吉", lat: 7.8804, lon: 98.3923, tz: 7 },
  { name: "新加坡", lat: 1.3521, lon: 103.8198, tz: 8 },
  { name: "吉隆坡", lat: 3.139, lon: 101.6869, tz: 8 },
  { name: "巴厘岛", lat: -8.6705, lon: 115.2126, tz: 8 },
  { name: "迪拜", lat: 25.2048, lon: 55.2708, tz: 4 },
  { name: "伊斯坦布尔", lat: 41.0082, lon: 28.9784, tz: 3 },
  { name: "莫斯科", lat: 55.7558, lon: 37.6173, tz: 3 },
  { name: "巴黎", lat: 48.8566, lon: 2.3522, tz: 1 },
  { name: "伦敦", lat: 51.5074, lon: -0.1278, tz: 0 },
  { name: "米兰", lat: 45.4642, lon: 9.19, tz: 1 },
  { name: "巴塞罗那", lat: 41.3874, lon: 2.1686, tz: 1 },
  { name: "雷克雅未克", lat: 64.1466, lon: -21.9426, tz: 0 },
  { name: "纽约", lat: 40.7128, lon: -74.006, tz: -5 },
  { name: "洛杉矶", lat: 34.0522, lon: -118.2437, tz: -8 },
  { name: "悉尼", lat: -33.8688, lon: 151.2093, tz: 10 },
];

/** 支持"上海市""上海 "这类写法 */
export function lookupCity(input: string): City | null {
  const cleaned = input
    .trim()
    .replace(/[省市区县]$/g, "")
    .replace(/\s+/g, "");
  if (!cleaned) {
    return null;
  }
  const exact = CITIES.find((city) => city.name === cleaned);
  if (exact) {
    return exact;
  }
  return (
    CITIES.find((city) => cleaned.startsWith(city.name) || city.name.startsWith(cleaned)) ?? null
  );
}

function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((date.getTime() - start) / 86_400_000);
}

/**
 * 求太阳到达指定天顶角（90 减去太阳高度角）的时刻，返回当地小时数。
 * 极昼极夜时返回 null。
 */
function eventHour(
  doy: number,
  latDeg: number,
  lonDeg: number,
  zenithDeg: number,
  rising: boolean,
): number | null {
  const lat = latDeg * DEG;
  const zenith = zenithDeg * DEG;
  const lonHour = lonDeg / 15;

  const t = doy + ((rising ? 6 : 18) - lonHour) / 24;

  const M = 0.9856 * t - 3.289;
  const Mrad = M * DEG;
  let L = M + 1.916 * Math.sin(Mrad) + 0.02 * Math.sin(2 * Mrad) + 282.634;
  L = ((L % 360) + 360) % 360;

  let RA = Math.atan(0.91764 * Math.tan(L * DEG)) / DEG;
  RA = ((RA % 360) + 360) % 360;
  const lQuadrant = Math.floor(L / 90) * 90;
  const raQuadrant = Math.floor(RA / 90) * 90;
  RA = (RA + (lQuadrant - raQuadrant)) / 15;

  const sinDec = 0.39782 * Math.sin(L * DEG);
  const cosDec = Math.cos(Math.asin(sinDec));

  const cosH = (Math.cos(zenith) - sinDec * Math.sin(lat)) / (cosDec * Math.cos(lat));
  if (cosH > 1 || cosH < -1) {
    return null;
  }
  const H = Math.acos(cosH) / DEG;
  const hourAngle = (rising ? 360 - H : H) / 15;

  const T = hourAngle + RA - 0.06571 * t - 6.622;
  const ut = ((T - lonHour) % 24 + 24) % 24;
  return ut;
}

function toLocal(utHour: number | null, tz: number): number | null {
  if (utHour === null) {
    return null;
  }
  return (utHour + tz + 24) % 24;
}

function format(hour: number | null): string | null {
  if (hour === null) {
    return null;
  }
  const totalMinutes = Math.round(hour * 60);
  const hh = Math.floor(totalMinutes / 60) % 24;
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function computeSunTimes(dateISO: string, city: City): SunTimes {
  const date = new Date(`${dateISO}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("日期格式不对，应该是 YYYY-MM-DD");
  }
  const doy = dayOfYear(date);
  const at = (zenith: number, rising: boolean) =>
    toLocal(eventHour(doy, city.lat, city.lon, zenith, rising), city.tz);

  const sunriseUt = eventHour(doy, city.lat, city.lon, 90.833, true);
  const sunsetUt = eventHour(doy, city.lat, city.lon, 90.833, false);
  const sunrise = toLocal(sunriseUt, city.tz);
  const sunset = toLocal(sunsetUt, city.tz);

  let solarNoon: number | null = null;
  let dayLength: string | null = null;
  if (sunriseUt !== null && sunsetUt !== null) {
    // 日出到日落的 UTC 时刻可能跨零点，所以用「从日出向前推到日落」的算法，
    // 直接取平均在跨零点时会偏掉整整半天
    const daylightUt = (((sunsetUt - sunriseUt) % 24) + 24) % 24;
    const noonUt = (sunriseUt + daylightUt / 2) % 24;
    solarNoon = toLocal(noonUt, city.tz);
    const hh = Math.floor(daylightUt);
    const mm = Math.round((daylightUt - hh) * 60);
    dayLength = `${hh} 小时 ${String(mm).padStart(2, "0")} 分`;
  }

  const goldenMorningStart = at(94, true);
  const goldenMorningEnd = at(84, true);
  const goldenEveningStart = at(84, false);
  const goldenEveningEnd = at(94, false);
  const blueMorningStart = at(96, true);
  const blueEveningEnd = at(96, false);

  const pair = (
    start: number | null,
    end: number | null,
  ): [string, string] | null => {
    const a = format(start);
    const b = format(end);
    return a && b ? [a, b] : null;
  };

  return {
    sunrise: format(sunrise),
    sunset: format(sunset),
    solarNoon: format(solarNoon),
    goldenMorning: pair(goldenMorningStart, goldenMorningEnd),
    goldenEvening: pair(goldenEveningStart, goldenEveningEnd),
    blueMorning: pair(blueMorningStart, goldenMorningStart),
    blueEvening: pair(goldenEveningEnd, blueEveningEnd),
    dayLength,
  };
}
