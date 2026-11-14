import { describe, expect, it } from 'vitest'
import { createInitialState, eventFor, getBudgets, planTotals, simulateSol, type Plan } from '../src/game/outpost'

const basePlan = (state: ReturnType<typeof createInitialState>): Plan => state.plan

describe('OutpostOS Cascade Engine', () => {
  it('starts with a balanced plan within Cadet budgets', () => {
    const state = createInitialState('cadet', 'base')
    expect(planTotals(state.plan).power).toBeLessThanOrEqual(getBudgets('cadet').power)
    expect(state.resources.oxygen).toBeGreaterThan(0)
    expect(state.phase).toBe('planning')
  })

  it('advances one sol and logs the choice and result', () => {
    const state = createInitialState('cadet', 'base')
    const result = simulateSol(state, basePlan(state), 'Protect oxygen first.')
    expect(result.state.sol).toBe(2)
    expect(result.state.notebook).toHaveLength(1)
    expect(result.state.replay.length).toBeGreaterThanOrEqual(3)
    expect(result.state.resources.oxygen).not.toBe(state.resources.oxygen)
  })

  it('keeps event selection deterministic for replay', () => {
    expect(eventFor(4, 'solarFlare', 'pilot').id).toBe('flare')
    expect(eventFor(3, 'dustStorm', 'cadet').id).toBe('storm')
    expect(eventFor(5, 'base', 'cadet').id).toBe('fault')
    expect(eventFor(1, 'base', 'pilot').id).toBe('calm')
  })
})
