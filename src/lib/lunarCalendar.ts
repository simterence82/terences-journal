// @ts-ignore -- lunar-javascript ships no type declarations
import { Solar } from "lunar-javascript";

export function getChineseLunarDateLabel(date: Date = new Date()): string {
  const solar = Solar.fromDate(date);
  const lunar = solar.getLunar();
  return `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`;
}
