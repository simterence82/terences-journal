export interface SampleForecastDay {
  day: string;
  high: number;
  low: number;
  condition: string;
}

export interface SampleWeather {
  temperature: number;
  condition: string;
  forecast: SampleForecastDay[];
}

export interface SampleHeadline {
  source: string;
  headline: string;
}

// Sample data only -- connect a live weather API (e.g. NEA Singapore) and a
// news RSS/API feed in production.
export const SAMPLE_WEATHER: SampleWeather = {
  temperature: 31,
  condition: "Partly Cloudy",
  forecast: [
    { day: "Tomorrow", high: 32, low: 26, condition: "Thunderstorms" },
    { day: "Sunday", high: 31, low: 25, condition: "Partly Cloudy" },
    { day: "Monday", high: 33, low: 26, condition: "Sunny" },
    { day: "Tuesday", high: 30, low: 25, condition: "Showers" },
  ],
};

export const SAMPLE_HEADLINES: SampleHeadline[] = [
  { source: "Reuters", headline: "Global markets steady as central banks weigh rate paths" },
  { source: "BBC", headline: "Trade talks resume between major economies this week" },
  { source: "Bloomberg", headline: "Asian tech stocks rally on strong earnings outlook" },
  { source: "CNA", headline: "Singapore unveils new initiatives to support SMEs" },
];
