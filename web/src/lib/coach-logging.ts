import { dayOffset, localDate, today, uid, parseBikeNote } from './tracking'
import { storageKey } from './mode'
import type { BikeRide, Meal, Row } from './tracking'

export type FoodMatch = { id: string; name: string; calories: number; protein: number | null; portion: string; source: string; url?: string }
export type MealRequest = { query: string; quantity: string; date: string; calories: string; protein: string; dateWarning: boolean }

// Sourced restaurant entry, not an AI estimate. Review against the current label before saving.
export const RESTAURANT_FOODS: FoodMatch[] = [{
  id: 'mcd-ca-junior-chicken', name: "McDonald's Canada · Junior Chicken", calories: 380, protein: 12,
  portion: '1 sandwich (132 g)', source: 'FatSecret Canada · checked Nov 10, 2026',
  url: 'https://mobile.fatsecret.ca/calories-nutrition/mcdonalds/junior-chicken/1-serving',
}]
export const normalizeFood = (value: string) => value.toLowerCase().replace(/[’']/g, '').replace(/\bjr\.?\b/g, 'junior').replace(/\bchickens\b/g, 'chicken').replace(/[^a-z0-9]+/g, ' ').trim()

export function loggingDate(text: string, date = today()): { date: string; warning: boolean } {
  const explicit = text.match(/\bon (\d{4}-\d{2}-\d{2})\b/i)?.[1]
  if (explicit) {
    const parsed = new Date(explicit + 'T12:00:00')
    return !Number.isNaN(parsed.valueOf()) && localDate(parsed) === explicit ? { date: explicit, warning: false } : { date: '', warning: true }
  }
  if (/\byesterday\b/i.test(text)) return { date: dayOffset(date, -1), warning: false }
  if (/\b(tomorrow|last|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|\bon\s+\w+/i.test(text)) return { date: '', warning: true }
  return { date, warning: false }
}

export function parseMealRequest(text: string, date = today()): MealRequest | null {
  const value = text.trim().replace(/[.!]+$/, '')
  if (!/^(?:i\s+(?:(?:just|also)\s+)?(?:ate|had|drank)|(?:please\s+)?(?:log|add)\s+(?!(?:a\s+)?(?:ride|bike|workout|weight)\b))/i.test(value)) return null
  const when = loggingDate(value, date)
  const calories = value.match(/\b(\d+(?:\.\d+)?)\s*(?:kcal|calories|cals)\b/i)?.[1] ?? ''
  const protein = value.match(/\b(\d+(?:\.\d+)?)\s*(?:g|grams?)\s*(?:of\s+)?protein\b/i)?.[1] ?? ''
  let query = value.replace(/^(?:i\s+(?:(?:just|also)\s+)?(?:ate|had|drank)|(?:please\s+)?(?:log|add))\s+/i, '')
    .replace(/[,;]?\s*(?:please\s+)?(?:add|log|save|put)\s+(?:that|this|it|them)\b.*$/i, '')
    .replace(/\s+(?:to|in)\s+(?:my\s+)?(?:meals?|food(?:\s+log)?|log)\b.*$/i, '')
    .replace(/\b(?:today|yesterday|on \d{4}-\d{2}-\d{2})\b/gi, '')
    .replace(/\b\d+(?:\.\d+)?\s*(?:kcal|calories|cals|(?:g|grams?)\s*(?:of\s+)?protein)\b/gi, '').trim()
  const amount = query.match(/^(\d+(?:\.\d+)?|one|two|three|four|half|an?|1\/2)\s+/i)
  const words: Record<string, string> = { a: '1', an: '1', one: '1', two: '2', three: '3', four: '4', half: '0.5', '1/2': '0.5' }
  const quantity = amount ? words[amount[1]!.toLowerCase()] ?? amount[1]! : ''
  if (amount) query = query.slice(amount[0].length)
  query = query.replace(/^[,\s]+|[,\s]+$/g, '').slice(0, 120)
  if (!query || /\b(question|workout|injury|ride|sleep|recovery|training)\b/i.test(query)) return null
  return { query, quantity, date: when.date, dateWarning: when.warning, calories, protein }
}

export function matchingFoods(query: string, meals: Row<'meal'>[]): FoodMatch[] {
  const key = normalizeFood(query.replace(/\bfrom\b/gi, ''))
  const restaurant = RESTAURANT_FOODS.filter(() => /^(?:(?:mcdonalds|mcdonald s|mcds) )?junior chicken(?: sandwich)?(?: (?:mcdonalds|mcdonald s|mcds))?$/.test(key))
  const saved = new Map<string, FoodMatch>()
  for (const row of [...meals].sort((a, b) => b.updated.localeCompare(a.updated))) {
    const m = row.data!
    if (!m.name.trim() || !key || normalizeFood(m.name) !== key) continue
    if (!saved.has(m.name.toLowerCase())) saved.set(m.name.toLowerCase(), { id: row.id, name: m.name, calories: m.calories * m.servings, protein: m.protein === null ? null : m.protein * m.servings, portion: '1 previously logged portion — check quantity', source: `Your food log · ${m.date}` })
  }
  return [...restaurant, ...saved.values()].slice(0, 8)
}

export function expandedRideText(text: string): string {
  return text.trim().replace(/[,;]?\s*(?:please\s+)?(?:add|log|save|put)\s+(?:that|this|it)\b.*$/i, '').replace(/^i\s+(?:just|also)\s+/i, 'I ').replace(/^i went (?:biking|cycling)(?: for)? /i, 'I biked ').replace(/^(i (?:biked|cycled|rode(?: my bike)?)) for /i, '$1 ').trim().replace(/[.!]+$/, '')
}

export type LogReview = {
  kind: 'meal' | 'ride'; id: string; name: string; date: string; time: string;
  amount: string; calories: string; protein: string; minutes: string;
  query: string; matches: FoodMatch[]; source: string; url?: string; portion: string;
  submitted: Meal | BikeRide | null;
}
const reviewKey = storageKey('coach-log-review-v1')
export function loadLogReview(): LogReview | null {
  try {
    const value = JSON.parse(localStorage.getItem(reviewKey) ?? 'null')
    return value && ['meal', 'ride'].includes(value.kind) && typeof value.id === 'string' && ['name', 'date', 'time', 'amount', 'calories', 'protein', 'minutes', 'query', 'source', 'portion'].every(key => typeof value[key] === 'string') && Array.isArray(value.matches) ? value : null
  } catch { return null }
}
export function persistLogReview(value: LogReview | null) {
  if (value) localStorage.setItem(reviewKey, JSON.stringify(value))
  else localStorage.removeItem(reviewKey)
}
export function applyFood(review: LogReview, food: FoodMatch): LogReview {
  return { ...review, name: food.name, amount: review.amount || '1', calories: String(food.calories), protein: food.protein === null ? '' : String(food.protein), source: food.source, url: food.url, portion: food.portion }
}


export function createLogReview(question: string, meals: Row<'meal'>[]): LogReview | null {
  const ride = parseBikeNote(expandedRideText(question))
  const meal = parseMealRequest(question)
  if (!ride && !meal) return null
  let next: LogReview = { kind: ride ? 'ride' : 'meal', id: uid(), name: meal?.query ?? '', date: ride?.date ?? meal!.date, time: new Date().toTimeString().slice(0, 5), amount: meal?.quantity ?? '1', calories: meal?.calories ?? '', protein: meal?.protein ?? '', minutes: ride ? String(ride.minutes) : '', query: meal?.query ?? '', matches: [], source: '', portion: '', submitted: null }
  if (meal) {
    next.matches = matchingFoods(meal.query, meals)
    if (meal.calories) { next.name = meal.quantity ? `${meal.quantity} × ${meal.query}` : meal.query; next.amount = '1'; next.source = 'Nutrition supplied in your message'; next.portion = 'Whole meal as described' }
    else if (next.matches.length === 1) next = applyFood(next, next.matches[0]!)
  }
  return next
}
