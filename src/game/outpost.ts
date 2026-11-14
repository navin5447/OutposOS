export type SystemKey = 'power' | 'lifeSupport' | 'shielding' | 'food' | 'thermal'
export type Difficulty = 'cadet' | 'pilot'
export type Scenario = 'base' | 'solarFlare' | 'dustStorm'
export type MissionPhase = 'planning' | 'debrief' | 'won' | 'failed'

export type Allocation = {
  power: number
  crew: number
  mass: number
}

export type Plan = Record<SystemKey, Allocation>

export type Resources = {
  battery: number
  oxygen: number
  food: number
  radiation: number
  temperature: number
}

export type NotebookEntry = {
  sol: number
  choice: string
  reason: string
  result: string
  event: string
}

export type ReplayStep = {
  title: string
  detail: string
  tone: 'neutral' | 'good' | 'warning' | 'critical'
}

export type EventInfo = {
  id: string
  label: string
  description: string
  color: string
  powerPenalty: number
  oxygenPenalty: number
  foodPenalty: number
  radiationBoost: number
  temperatureShift: number
}

export type OutpostState = {
  sol: number
  maxSols: number
  difficulty: Difficulty
  scenario: Scenario
  phase: MissionPhase
  resources: Resources
  plan: Plan
  notebook: NotebookEntry[]
  replay: ReplayStep[]
  lastEvent: EventInfo
  lastResult: SimulationResult | null
}

export type SimulationResult = {
  state: OutpostState
  event: EventInfo
  deltas: Resources
  chain: ReplayStep[]
  headline: string
  outcome: string
}

export const SYSTEMS: Array<{ key: SystemKey; name: string; short: string; color: string; icon: string; hint: string }> = [
  { key: 'power', name: 'Power', short: 'PWR', color: '#f9c74f', icon: '◉', hint: 'Keep the grid balanced so every console has room to work.' },
  { key: 'lifeSupport', name: 'Life support', short: 'LIFE', color: '#66e3c4', icon: '◌', hint: 'Scrubbers and pumps protect the crew’s oxygen reserve.' },
  { key: 'shielding', name: 'Radiation shield', short: 'SHLD', color: '#a78bfa', icon: '⬡', hint: 'Mass buys protection, but it competes with food and power.' },
  { key: 'food', name: 'Food farm', short: 'FARM', color: '#8bd450', icon: '✳', hint: 'Grow lights turn power and crew hours into tomorrow’s meals.' },
  { key: 'thermal', name: 'Thermal control', short: 'THERM', color: '#ff8b67', icon: '△', hint: 'Radiators keep the habitat from cooking or freezing.' },
]

const BASE_PLAN: Plan = {
  power: { power: 12, crew: 2, mass: 1 },
  lifeSupport: { power: 23, crew: 6, mass: 2 },
  shielding: { power: 12, crew: 3, mass: 6 },
  food: { power: 21, crew: 6, mass: 3 },
  thermal: { power: 13, crew: 3, mass: 2 },
}

const EVENT_COLORS = {
  calm: '#66e3c4',
  flare: '#ff8b67',
  storm: '#a78bfa',
  fault: '#f9c74f',
}

const clamp = (value: number, min = 0, max = 100): number => Math.min(max, Math.max(min, value))
const round = (value: number): number => Math.round(value * 10) / 10

export function clonePlan(plan: Plan): Plan {
  return Object.fromEntries(SYSTEMS.map(({ key }) => [key, { ...plan[key] }])) as Plan
}

export function createInitialState(difficulty: Difficulty = 'cadet', scenario: Scenario = 'base'): OutpostState {
  const startingResources: Resources = difficulty === 'cadet'
    ? { battery: 72, oxygen: 86, food: 78, radiation: 16, temperature: 62 }
    : { battery: 62, oxygen: 78, food: 70, radiation: 22, temperature: 62 }
  const state: OutpostState = {
    sol: 1,
    maxSols: 30,
    difficulty,
    scenario,
    phase: 'planning',
    resources: startingResources,
    plan: clonePlan(BASE_PLAN),
    notebook: [],
    replay: [],
    lastEvent: eventFor(1, scenario, difficulty),
    lastResult: null,
  }
  return state
}

export function getBudgets(difficulty: Difficulty): { power: number; crew: number; mass: number } {
  return difficulty === 'cadet' ? { power: 86, crew: 22, mass: 15 } : { power: 82, crew: 20, mass: 13 }
}

export function planTotals(plan: Plan): { power: number; crew: number; mass: number } {
  return SYSTEMS.reduce((total, { key }) => {
    total.power += plan[key].power
    total.crew += plan[key].crew
    total.mass += plan[key].mass
    return total
  }, { power: 0, crew: 0, mass: 0 })
}

export function normalizePlan(plan: Plan): Plan {
  const next = clonePlan(plan)
  for (const { key } of SYSTEMS) {
    next[key].power = Math.round(clamp(next[key].power, 0, 32))
    next[key].crew = Math.round(clamp(next[key].crew, 0, 8))
    next[key].mass = Math.round(clamp(next[key].mass, 0, 8))
  }
  return next
}

export function eventFor(sol: number, scenario: Scenario, difficulty: Difficulty): EventInfo {
  if (scenario === 'solarFlare' && sol % 4 === 0) {
    return { id: 'flare', label: 'Solar flare', description: 'A burst of charged particles is hitting the habitat.', color: EVENT_COLORS.flare, powerPenalty: difficulty === 'pilot' ? 14 : 10, oxygenPenalty: 2, foodPenalty: 0, radiationBoost: difficulty === 'pilot' ? 7 : 5, temperatureShift: 2 }
  }
  if (scenario === 'dustStorm' && sol % 3 === 0) {
    return { id: 'storm', label: 'Dust storm', description: 'Dust is dimming the solar array and clogging the intake.', color: EVENT_COLORS.storm, powerPenalty: difficulty === 'pilot' ? 16 : 12, oxygenPenalty: 3, foodPenalty: 1, radiationBoost: 2, temperatureShift: -4 }
  }
  if (sol % 5 === 0) {
    return { id: 'fault', label: 'Pump fault', description: 'A circulation pump is running below its safe efficiency.', color: EVENT_COLORS.fault, powerPenalty: 8, oxygenPenalty: difficulty === 'pilot' ? 7 : 4, foodPenalty: 0, radiationBoost: 1, temperatureShift: -2 }
  }
  return { id: 'calm', label: 'Quiet orbit', description: 'No major event. This is a good sol to build reserve.', color: EVENT_COLORS.calm, powerPenalty: 0, oxygenPenalty: 0, foodPenalty: 0, radiationBoost: 0, temperatureShift: 0 }
}

export function forecast(state: OutpostState): Array<{ label: string; detail: string; color: string }> {
  return [1, 2, 3].map(offset => {
    const event = eventFor(state.sol + offset, state.scenario, state.difficulty)
    return { label: `Sol ${String(state.sol + offset).padStart(2, '0')}`, detail: event.label, color: event.color }
  })
}

function healthScore(resources: Resources): number {
  const oxygen = clamp(resources.oxygen)
  const food = clamp(resources.food)
  const battery = clamp(resources.battery)
  const radiation = clamp(100 - resources.radiation)
  const temperature = clamp(100 - Math.abs(resources.temperature - 62) * 2.1)
  return Math.round(Math.min(oxygen, food, battery, radiation, temperature))
}

export function simulateSol(input: OutpostState, requestedPlan: Plan, reason: string): SimulationResult {
  const plan = normalizePlan(requestedPlan)
  const event = eventFor(input.sol, input.scenario, input.difficulty)
  const budgets = getBudgets(input.difficulty)
  const totals = planTotals(plan)
  const previous = input.resources
  const chain: ReplayStep[] = [
    { title: 'Plan locked', detail: `${totals.power} power units, ${totals.crew} crew hours and ${totals.mass} mass units committed.`, tone: 'neutral' },
  ]
  const powerStrain = totals.power + event.powerPenalty - budgets.power
  const batteryDelta = round((budgets.power - totals.power - event.powerPenalty) * 0.48)
  const life = plan.lifeSupport
  const farm = plan.food
  const shield = plan.shielding
  const thermal = plan.thermal
  const oxygenDelta = round((life.power - 21) * 0.48 + (life.crew - 5) * 0.55 - event.oxygenPenalty)
  const foodDelta = round((farm.power - 19) * 0.38 + (farm.crew - 5) * 0.5 - event.foodPenalty)
  const radiationDelta = round(2.8 - shield.power * 0.11 - shield.mass * 0.43 + event.radiationBoost)
  const temperatureDelta = round((thermal.power - 13) * 0.42 + (thermal.crew - 3) * 0.35 + event.temperatureShift)
  const next: Resources = {
    battery: round(clamp(previous.battery + batteryDelta)),
    oxygen: round(clamp(previous.oxygen + oxygenDelta)),
    food: round(clamp(previous.food + foodDelta)),
    radiation: round(clamp(previous.radiation + radiationDelta)),
    temperature: round(clamp(previous.temperature + temperatureDelta)),
  }
  if (powerStrain > 0) {
    chain.push({ title: 'Power bus overloaded', detail: `The plan plus ${event.label.toLowerCase()} exceeded the ${budgets.power}-unit grid by ${powerStrain}. Battery reserve fell ${Math.abs(batteryDelta)} points.`, tone: 'warning' })
  } else {
    chain.push({ title: 'Power budget balanced', detail: `${Math.abs(round(budgets.power - totals.power - event.powerPenalty))} units stayed in reserve for the next sol.`, tone: 'good' })
  }
  if (event.id !== 'calm') chain.push({ title: event.label, detail: event.description, tone: event.id === 'flare' ? 'critical' : 'warning' })
  if (oxygenDelta < 0) {
    chain.push({ title: 'Life support cascade', detail: `Oxygen fell ${Math.abs(oxygenDelta)} points because scrubber capacity and crew hours could not cover consumption.`, tone: 'warning' })
  } else {
    chain.push({ title: 'Life support held', detail: `Scrubbers added ${oxygenDelta} oxygen points after crew demand.`, tone: 'good' })
  }
  if (radiationDelta > 0.2) {
    chain.push({ title: 'Shield trade-off', detail: `Radiation dose rose ${radiationDelta} points; more shielding mass would protect the crew but squeeze the farm.`, tone: 'warning' })
  } else {
    chain.push({ title: 'Shielding paid off', detail: `Radiation dose changed by ${radiationDelta} points with the current mass allocation.`, tone: 'good' })
  }
  const score = healthScore(next)
  let phase: MissionPhase = 'planning'
  let headline = `Sol ${String(input.sol).padStart(2, '0')} complete`
  let outcome = `Crew health index ${score}/100. Your choices are logged for review.`
  if (next.oxygen <= 0 || next.food <= 0 || next.battery <= 0 || next.radiation >= 100 || next.temperature <= 0 || next.temperature >= 100) {
    phase = 'failed'
    headline = 'Mission cascade detected'
    outcome = failureOutcome(next)
    chain.push({ title: 'Mission lost', detail: outcome, tone: 'critical' })
  } else if (input.sol >= input.maxSols) {
    phase = 'won'
    headline = '30 sols survived'
    outcome = 'The crew stayed healthy for the full mission window. Systems thinking wins.'
    chain.push({ title: 'Mission complete', detail: outcome, tone: 'good' })
  }
  const notebookEntry: NotebookEntry = {
    sol: input.sol,
    choice: `${totals.power} PWR / ${totals.crew} crew / ${totals.mass} mass`,
    reason: reason.trim() || 'Balanced the five consoles using the current forecast.',
    result: outcome,
    event: event.label,
  }
  const nextState: OutpostState = {
    ...input,
    sol: input.sol + 1,
    phase,
    resources: next,
    plan,
    notebook: [...input.notebook, notebookEntry],
    replay: chain,
    lastEvent: event,
    lastResult: null,
  }
  const result: SimulationResult = { state: nextState, event, deltas: { battery: batteryDelta, oxygen: oxygenDelta, food: foodDelta, radiation: radiationDelta, temperature: temperatureDelta }, chain, headline, outcome }
  nextState.lastResult = result
  return result
}

function failureOutcome(resources: Resources): string {
  if (resources.oxygen <= 0) return 'Oxygen reserve reached zero. Life support was the first link to break.'
  if (resources.battery <= 0) return 'Battery reserve reached zero. The outpost lost the power needed to recover.'
  if (resources.food <= 0) return 'Food reserve reached zero. The farm could not replace crew consumption.'
  if (resources.radiation >= 100) return 'Radiation dose exceeded the safe limit. Shielding needed more mass.'
  return 'Thermal control crossed the safe range. The habitat could not regulate its heat.'
}

export function resourceStatus(key: keyof Resources, value: number): 'good' | 'watch' | 'critical' {
  if (key === 'radiation') return value >= 50 ? 'critical' : value >= 32 ? 'watch' : 'good'
  if (key === 'temperature') return value < 40 || value > 84 ? 'critical' : value < 50 || value > 76 ? 'watch' : 'good'
  return value <= 18 ? 'critical' : value <= 38 ? 'watch' : 'good'
}

export function resourceLabel(key: keyof Resources): string {
  return ({ battery: 'Battery', oxygen: 'Oxygen', food: 'Food', radiation: 'Radiation dose', temperature: 'Thermal balance' })[key]
}

export function formatDelta(value: number): string {
  return `${value > 0 ? '+' : ''}${value}`
}
