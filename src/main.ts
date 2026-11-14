import './styles/main.css'
import * as THREE from 'three'
import {
  SYSTEMS,
  clonePlan,
  createInitialState,
  eventFor,
  forecast,
  getBudgets,
  planTotals,
  resourceLabel,
  resourceStatus,
  simulateSol,
  type Difficulty,
  type OutpostState,
  type Plan,
  type Scenario,
  type SystemKey,
} from './game/outpost'

type View = 'dashboard' | 'notebook' | 'replay' | 'roles'

type GameApi = {
  state: OutpostState
  plan: Plan
  startMission: () => void
  simulate: () => void
}

const root = document.getElementById('ui')!
const canvas = document.getElementById('game') as HTMLCanvasElement
let state = createInitialState()
let draftPlan = clonePlan(state.plan)
let difficulty: Difficulty = 'cadet'
let scenario: Scenario = 'base'
let view: View = 'dashboard'
let started = false
let reason = 'Protect oxygen first, then preserve enough power for the farm.'

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
function setupBackdrop(): void {
  try {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    renderer.setSize(window.innerWidth, window.innerHeight, false)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.9

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0d1118')
    scene.fog = new THREE.Fog('#0d1118', 12, 32)
    const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100)
    camera.position.set(0, 0.8, 13)
    camera.lookAt(2.4, -0.8, 0)

    scene.add(new THREE.HemisphereLight('#d6efff', '#0c111a', 1.15))
    const key = new THREE.DirectionalLight('#ffd9ad', 2.2)
    key.position.set(-5, 8, 7)
    scene.add(key)
    const rim = new THREE.PointLight('#68e7c5', 8, 18, 2)
    rim.position.set(5, 0.5, 3)
    scene.add(rim)

    const stars = new THREE.BufferGeometry()
    const positions = new Float32Array(420 * 3)
    for (let i = 0; i < 420; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 34
      positions[i * 3 + 1] = (Math.random() - 0.5) * 20
      positions[i * 3 + 2] = -Math.random() * 20 - 2
    }
    stars.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: '#a7bfdc', size: 0.05, transparent: true, opacity: 0.72 })))

    const habitat = new THREE.Group()
    habitat.position.set(4.2, -1.4, -0.8)
    habitat.rotation.z = -0.08
    scene.add(habitat)

    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(3.15, 48, 32),
      new THREE.MeshStandardMaterial({ color: '#1c2b3b', roughness: 0.98, metalness: 0.02, emissive: '#0b1823', emissiveIntensity: 0.3 }),
    )
    planet.position.set(4.7, -3.7, -2.6)
    scene.add(planet)

    const moduleMaterial = new THREE.MeshStandardMaterial({ color: '#5f7180', roughness: 0.7, metalness: 0.35 })
    const windowMaterial = new THREE.MeshStandardMaterial({ color: '#82dec8', roughness: 0.32, metalness: 0.1, emissive: '#1a655a', emissiveIntensity: 0.55 })
    const panelMaterial = new THREE.MeshStandardMaterial({ color: '#283d58', roughness: 0.5, metalness: 0.45, emissive: '#0a1b2f', emissiveIntensity: 0.45 })
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.95, 0.065, 12, 96), new THREE.MeshBasicMaterial({ color: '#66e3c4', transparent: true, opacity: 0.54 }))
    ring.rotation.x = Math.PI * 0.5
    habitat.add(ring)
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 1.8, 16), moduleMaterial)
    core.rotation.z = Math.PI * 0.5
    habitat.add(core)
    for (let i = 0; i < 4; i += 1) {
      const pod = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.55, 0.8), moduleMaterial)
      const angle = i * Math.PI * 0.5
      pod.position.set(Math.cos(angle) * 1.25, Math.sin(angle) * 0.52, Math.sin(angle) * 0.5)
      pod.rotation.z = angle * 0.25
      habitat.add(pod)
      const window = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.02), windowMaterial)
      window.position.set(pod.position.x, pod.position.y + 0.02, pod.position.z + 0.41)
      habitat.add(window)
    }
    for (const x of [-2.3, -1.45, 1.45, 2.3]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.06, 0.46), panelMaterial)
      panel.position.set(x, -0.55 + Math.abs(x) * 0.05, 0)
      panel.rotation.z = x > 0 ? -0.12 : 0.12
      habitat.add(panel)
    }
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.6, 8), windowMaterial)
    antenna.position.set(0.25, 1.12, 0)
    habitat.add(antenna)
    const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), new THREE.MeshBasicMaterial({ color: '#f9c74f' }))
    antennaTip.position.set(0.25, 1.94, 0)
    habitat.add(antennaTip)

    const resize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight, false)
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', resize)
    const clock = new THREE.Clock()
    const animate = () => {
      const elapsed = clock.getElapsedTime()
      habitat.rotation.y = elapsed * 0.065
      habitat.position.y = -1.4 + Math.sin(elapsed * 0.34) * 0.08
      planet.rotation.y = elapsed * 0.012
      rim.intensity = 7.5 + Math.sin(elapsed * 1.2) * 1.1
      renderer.render(scene, camera)
      requestAnimationFrame(animate)
    }
    animate()
  } catch (error) {
    console.warn('Backdrop unavailable; continuing with the mission dashboard.', error)
    canvas.classList.add('is-unavailable')
  }
}

function resourceCard(key: keyof OutpostState['resources']): string {
  const value = state.resources[key]
  const status = resourceStatus(key, value)
  const barValue = key === 'radiation' ? Math.min(100, value) : key === 'temperature' ? Math.min(100, Math.max(0, value)) : value
  const unit = key === 'temperature' ? '°' : key === 'radiation' ? 'mSv' : '%'
  return `<article class="resource-card resource-${status}">
    <div class="resource-card__top"><span>${resourceLabel(key)}</span><strong>${Math.round(value)}<small>${unit}</small></strong></div>
    <div class="meter ${key === 'radiation' ? 'meter-risk' : ''}"><i style="width:${barValue}%"></i></div>
    <span class="resource-card__status">${status === 'good' ? 'within limits' : status === 'watch' ? 'watch closely' : 'critical threshold'}</span>
  </article>`
}

function headerHtml(): string {
  const event = eventFor(state.sol, state.scenario, state.difficulty)
  const phaseLabel = state.phase === 'failed' ? 'MISSION LOST' : state.phase === 'won' ? 'MISSION COMPLETE' : state.lastResult ? 'SOL DEBRIEF' : 'PLANNING WINDOW'
  return `<header class="topbar">
    <div class="brand-lockup"><div class="brand-mark"><span>O</span><i></i></div><div><div class="brand-name">OUTPOST<span>OS</span></div><div class="brand-kicker">systems thinking lab / mission 07</div></div></div>
    <div class="mission-id"><span class="eyebrow">MISSION STATUS</span><strong>${phaseLabel}</strong><span class="status-dot"></span></div>
    <div class="sol-readout"><span class="eyebrow">MARTIAN SOL</span><strong>${String(Math.min(state.sol, state.maxSols)).padStart(2, '0')} <em>/ ${state.maxSols}</em></strong><div class="sol-track"><i style="width:${Math.min(100, ((state.sol - 1) / state.maxSols) * 100)}%"></i></div></div>
    <button class="icon-button" data-action="reset" aria-label="Reset mission">↺</button>
  </header>
  <section class="resource-strip" aria-label="Outpost resources">${resourceCard('battery')}${resourceCard('oxygen')}${resourceCard('food')}${resourceCard('radiation')}${resourceCard('temperature')}</section>
  <div class="event-ticker"><span class="ticker-pip" style="background:${event.color}"></span><span class="eyebrow">NEXT SOL EVENT</span><strong>${event.label}</strong><span>${event.description}</span><span class="ticker-tag">${state.difficulty === 'cadet' ? 'CADET' : 'PILOT'} / ${scenarioLabel(scenario)}</span></div>`
}

function scenarioLabel(value: Scenario): string {
  return value === 'solarFlare' ? 'SOLAR FLARE' : value === 'dustStorm' ? 'DUST STORM' : 'BASE SETUP'
}

function navHtml(): string {
  const tab = (id: View, label: string, hint: string) => `<button class="rail-button ${view === id ? 'is-active' : ''}" data-view="${id}"><span class="rail-icon">${id === 'dashboard' ? '⌘' : id === 'notebook' ? '▤' : id === 'replay' ? '↶' : '◎'}</span><span>${label}</span><small>${hint}</small></button>`
  return `<aside class="side-rail"><div class="rail-label">CONSOLE</div>${tab('dashboard', 'Mission plan', 'PLAN')}${tab('notebook', 'Engineer notebook', 'LOG')}${tab('replay', 'Failure replay', 'TRACE')}${tab('roles', 'Crew roles', 'TEAM')}<div class="rail-foot"><span class="pulse-line"></span><small>LOCAL MODE<br/>NO SIGNAL REQUIRED</small></div></aside>`
}

function planRow(system: typeof SYSTEMS[number]): string {
  const values = draftPlan[system.key]
  const slider = (field: keyof typeof values, label: string, min: number, max: number, suffix: string) => `<label class="allocation-control"><span>${label}<b data-readout="${system.key}-${field}">${values[field]}${suffix}</b></span><input type="range" min="${min}" max="${max}" value="${values[field]}" step="1" data-system="${system.key}" data-field="${field}" aria-label="${system.name} ${label}"></label>`
  return `<article class="console-row">
    <div class="system-label"><span class="system-glyph" style="--system-color:${system.color}">${system.icon}</span><div><strong>${system.name}</strong><small>${system.hint}</small></div></div>
    <div class="allocation-controls">${slider('power', 'power', 0, 32, ' u')}${slider('crew', 'crew', 0, 8, ' h')}${slider('mass', 'mass', 0, 8, ' t')}</div>
  </article>`
}

function dashboardHtml(): string {
  const budgets = getBudgets(state.difficulty)
  const totals = planTotals(draftPlan)
  const overBudget = totals.power > budgets.power || totals.crew > budgets.crew || totals.mass > budgets.mass
  const currentEvent = eventFor(state.sol, state.scenario, state.difficulty)
  const next = forecast(state)
  const result = state.lastResult
  return `<section class="dashboard-grid">
    <div class="main-column">
      ${result ? `<div class="debrief-banner ${state.phase === 'failed' ? 'is-critical' : state.phase === 'won' ? 'is-success' : ''}"><div><span class="eyebrow">${result.event.label} / SOL ${String(result.state.sol - 1).padStart(2, '0')}</span><h2>${result.headline}</h2><p>${result.outcome}</p></div><div class="debrief-actions"><button class="button button-ghost" data-view="replay">View chain</button>${state.phase === 'planning' ? '<button class="button button-primary" data-action="continue">Continue planning <span>→</span></button>' : '<button class="button button-primary" data-action="reset">Start new mission <span>→</span></button>'}</div></div>` : ''}
      <div class="section-heading"><div><span class="eyebrow">SOL LOOP / 01</span><h1>Plan the next sol</h1><p>Every slider is a trade. Spend power, crew hours and mass where the cascade needs it most.</p></div><div class="scenario-chip"><span class="chip-dot" style="background:${currentEvent.color}"></span><span>${currentEvent.label}</span></div></div>
      <div class="console-card">
        <div class="console-card__header"><div><span class="eyebrow">SHARED LIMITS</span><h2>Resource allocation</h2></div><div class="budget-readout"><span>power <b data-budget="power">${totals.power}</b> / ${budgets.power}</span><span>crew <b data-budget="crew">${totals.crew}</b> / ${budgets.crew}</span><span>mass <b data-budget="mass">${totals.mass}</b> / ${budgets.mass}</span></div></div>
        <div class="column-labels"><span>CONSOLE</span><span>POWER UNITS</span><span>CREW HOURS</span><span>MASS UNITS</span></div>
        <div class="console-rows">${SYSTEMS.map(planRow).join('')}</div>
        <div class="allocation-footer ${overBudget ? 'is-over' : ''}"><span class="budget-signal"></span><span data-plan-status>${overBudget ? 'Over budget — the cascade will punish the excess.' : 'Within budget — leave enough reserve to absorb an event.'}</span><span class="budget-spacer"></span><span class="mini-hint">Drag to tune · the model is simplified</span></div>
      </div>
      <div class="reason-card"><div class="reason-icon">↗</div><div><label for="reason">Engineer’s reason for this plan</label><input id="reason" value="${escapeHtml(reason)}" maxlength="120" /></div><span class="reason-counter">${reason.length}/120</span></div>
      <button class="simulate-button ${state.phase === 'failed' || state.phase === 'won' ? 'is-disabled' : ''}" data-action="simulate" ${state.phase === 'failed' || state.phase === 'won' ? 'disabled' : ''}><span class="simulate-index">02</span><span><strong>Simulate one sol</strong><small>Run the cascade and update the mission telemetry</small></span><span class="simulate-arrow">→</span></button>
    </div>
    <aside class="right-column">
      <div class="side-card event-card"><div class="side-card__header"><span class="eyebrow">EVENT MONITOR</span><span class="live-indicator"><i></i> LIVE</span></div><div class="event-orb" style="--event-color:${currentEvent.color}"><span>${currentEvent.id === 'calm' ? '◌' : currentEvent.id === 'flare' ? '✦' : currentEvent.id === 'storm' ? '≋' : '⚙'}</span></div><h3>${currentEvent.label}</h3><p>${currentEvent.description}</p><div class="event-note"><span>MODEL NOTE</span><strong>Directionally correct, not mission certified.</strong></div></div>
      <div class="side-card forecast-card"><div class="side-card__header"><span class="eyebrow">SHORT-TERM FORECAST</span><span class="forecast-count">3 SOLS</span></div>${next.map(item => `<div class="forecast-row"><span class="forecast-sol">${item.label}</span><span class="forecast-line"><i style="background:${item.color}"></i>${item.detail}</span></div>`).join('')}</div>
      <div class="side-card lesson-card"><span class="lesson-number">i</span><div><span class="eyebrow">MISSION SCIENCE</span><p>Real missions fail in chains. A stronger shield can steal power from the farm; a weak farm can pressure life support.</p></div></div>
    </aside>
  </section>`
}

function notebookHtml(): string {
  return `<section class="content-panel notebook-panel"><div class="section-heading"><div><span class="eyebrow">AUTO-GENERATED LOG / REFLECTION</span><h1>Engineer notebook</h1><p>Every plan becomes evidence. Use the log to explain what changed, what caused it, and what you would try next.</p></div><div class="notebook-stamp">${state.notebook.length} ENTRIES</div></div>${state.notebook.length === 0 ? '<div class="empty-state"><span>∅</span><h2>No sols logged yet</h2><p>Run your first simulation to start the mission post-mortem.</p><button class="button button-primary" data-view="dashboard">Open mission plan →</button></div>' : `<div class="notebook-list">${[...state.notebook].reverse().map(entry => `<article class="notebook-entry"><div class="entry-sol">SOL <strong>${String(entry.sol).padStart(2, '0')}</strong><span>${entry.event}</span></div><div class="entry-body"><h3>${entry.choice}</h3><p><b>Reason:</b> ${escapeHtml(entry.reason)}</p><p><b>Result:</b> ${escapeHtml(entry.result)}</p></div><div class="entry-mark">${entry.result.includes('healthy') || entry.result.includes('logged') ? '✓' : '!'}</div></article>`).join('')}</div>`}</section>`
}

function replayHtml(): string {
  const replay = state.replay
  return `<section class="content-panel replay-panel"><div class="section-heading"><div><span class="eyebrow">DEBRIEF / CAUSE CHAIN</span><h1>Failure replay</h1><p>Rewind the last sol one link at a time. The replay is deterministic: the same plan produces the same explanation.</p></div><div class="replay-badge">${replay.length ? `TRACE ${String(state.sol - 1).padStart(2, '0')}` : 'READY'}</div></div>${replay.length === 0 ? '<div class="empty-state"><span>↶</span><h2>Replay buffer is empty</h2><p>Nothing has failed yet. That is a good sign.</p><button class="button button-primary" data-view="dashboard">Build a plan →</button></div>' : `<div class="replay-track">${replay.map((step, index) => `<article class="replay-step replay-${step.tone}"><div class="step-index">${String(index + 1).padStart(2, '0')}</div><div><span class="eyebrow">${step.tone === 'critical' ? 'BREAKPOINT' : step.tone === 'warning' ? 'LINK IN CHAIN' : step.tone === 'good' ? 'STABILIZED' : 'INPUT'}</span><h3>${step.title}</h3><p>${step.detail}</p></div></article>`).join('')}</div><div class="replay-footer"><span>Replay complete</span><button class="button button-primary" data-view="dashboard">Return to plan →</button></div>`}</section>`
}

function rolesHtml(): string {
  const roles = [
    ['POWER LEAD', 'Power console', '#f9c74f', 'Protect the reserve. Negotiate what can be switched off before the grid gets strained.'],
    ['LIFE SUPPORT', 'Life support console', '#66e3c4', 'Watch oxygen and thermal drift. A small shortfall compounds across the crew.'],
    ['SHIELD OFFICER', 'Shield console', '#a78bfa', 'Mass is protection. Ask the farm what it can spare before adding shielding.'],
    ['FARM LEAD', 'Food console', '#8bd450', 'Keep grow lights alive without draining the battery needed for tomorrow.'],
  ]
  return `<section class="content-panel roles-panel"><div class="section-heading"><div><span class="eyebrow">CO-OP READY / FOUR CONSOLES</span><h1>Share the outpost</h1><p>Assign one role per student. The team wins by negotiating the shared limits, not by maxing every slider.</p></div><div class="roles-chip">CADET → PILOT</div></div><div class="role-grid">${roles.map(([role, title, color, detail], i) => `<article class="role-card" style="--role-color:${color}"><div class="role-number">0${i + 1}</div><span class="role-console">${role}</span><h3>${title}</h3><p>${detail}</p><div class="role-footer"><span style="background:${color}"></span>${i === 0 ? 'Reserve discipline' : i === 1 ? 'Crew health' : i === 2 ? 'Radiation dose' : 'Food continuity'}</div></article>`).join('')}</div><div class="classroom-note"><strong>Teacher prompt</strong><span>Ask each console lead to defend one slider change with evidence from the previous sol.</span></div></section>`
}

function render(): void {
  if (!started) {
    root.innerHTML = `<main class="launch-screen"><div class="launch-copy"><div class="brand-lockup brand-lockup--hero"><div class="brand-mark"><span>O</span><i></i></div><div><div class="brand-name">OUTPOST<span>OS</span></div><div class="brand-kicker">systems thinking lab / offline classroom edition</div></div></div><span class="eyebrow launch-eyebrow">MISSION CONTROL SIMULATION / 01</span><h1>Keep the crew<br/><em>healthy for 30 sols.</em></h1><p class="launch-lede">A playable systems-thinking lab where every engineering decision creates a cascade. Plan with your team, run one sol, and trace the chain.</p><div class="launch-controls"><div class="choice-block"><span class="eyebrow">DIFFICULTY</span><div class="choice-row"><button class="choice ${difficulty === 'cadet' ? 'is-selected' : ''}" data-difficulty="cadet"><strong>CADET</strong><small>Hints + fewer surprises</small></button><button class="choice ${difficulty === 'pilot' ? 'is-selected' : ''}" data-difficulty="pilot"><strong>PILOT</strong><small>Full coupling + events</small></button></div></div><div class="choice-block"><span class="eyebrow">SCENARIO</span><div class="choice-row"><button class="choice ${scenario === 'base' ? 'is-selected' : ''}" data-scenario="base"><strong>BASE SETUP</strong><small>Learn the loop</small></button><button class="choice ${scenario === 'solarFlare' ? 'is-selected' : ''}" data-scenario="solarFlare"><strong>SOLAR FLARE</strong><small>Charged-particle hit</small></button><button class="choice ${scenario === 'dustStorm' ? 'is-selected' : ''}" data-scenario="dustStorm"><strong>DUST STORM</strong><small>Low solar input</small></button></div></div></div><button class="launch-button" data-action="start"><span>Launch mission</span><b>↗</b></button><div class="launch-note"><span class="pulse-line"></span><span>Runs locally in your browser · no account · simplified science model</span></div></div><div class="launch-aside"><div class="launch-orbit-card"><span class="eyebrow">THE SOL LOOP</span><div class="orbit-line"><div class="orbit-node is-active"><b>01</b><span>PLAN</span></div><i></i><div class="orbit-node"><b>02</b><span>SIMULATE</span></div><i></i><div class="orbit-node"><b>03</b><span>DEBRIEF</span></div></div><p>Make the trade-off visible. Then rewind it.</p></div><div class="launch-fact"><span>5</span><div><strong>linked systems</strong><small>power · life · shield · farm · thermal</small></div></div><div class="launch-fact"><span>30</span><div><strong>sols to survive</strong><small>one 20-minute classroom session</small></div></div></div></main>`
    return
  }
  root.innerHTML = `<main class="app-shell">${headerHtml()}<div class="app-body">${navHtml()}<div class="view-container">${view === 'dashboard' ? dashboardHtml() : view === 'notebook' ? notebookHtml() : view === 'replay' ? replayHtml() : rolesHtml()}</div></div><footer class="app-footer"><span>OUTPOSTOS / classroom prototype</span><span>MODEL STATUS: <b>SIMPLIFIED</b></span><span>LOCAL SAVE: <b>READY</b></span></footer></main>`
}

function updateReadouts(): void {
  const budgets = getBudgets(difficulty)
  const totals = planTotals(draftPlan)
  for (const system of SYSTEMS) {
    for (const field of ['power', 'crew', 'mass'] as const) {
      const el = root.querySelector<HTMLElement>(`[data-readout="${system.key}-${field}"]`)
      if (el) el.textContent = `${draftPlan[system.key][field]}${field === 'power' ? ' u' : field === 'crew' ? ' h' : ' t'}`
    }
  }
  for (const key of ['power', 'crew', 'mass'] as const) root.querySelector<HTMLElement>(`[data-budget="${key}"]`)!.textContent = String(totals[key])
  const overBudget = totals.power > budgets.power || totals.crew > budgets.crew || totals.mass > budgets.mass
  const status = root.querySelector<HTMLElement>('[data-plan-status]')
  if (status) status.textContent = overBudget ? 'Over budget — the cascade will punish the excess.' : 'Within budget — leave enough reserve to absorb an event.'
  root.querySelector('.allocation-footer')?.classList.toggle('is-over', overBudget)
  const counter = root.querySelector<HTMLElement>('.reason-counter')
  if (counter) counter.textContent = `${reason.length}/120`
}

function startMission(): void {
  started = true
  state = createInitialState(difficulty, scenario)
  draftPlan = clonePlan(state.plan)
  view = 'dashboard'
  render()
}

function simulateMission(): void {
  if (state.phase === 'failed' || state.phase === 'won') return
  state = simulateSol(state, draftPlan, reason).state
  draftPlan = clonePlan(state.plan)
  view = 'dashboard'
  render()
}

root.addEventListener('click', event => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action], [data-view], [data-difficulty], [data-scenario]')
  if (!target) return
  const action = target.dataset.action
  if (action === 'start') startMission()
  else if (action === 'simulate') simulateMission()
  else if (action === 'reset') {
    started = false
    render()
  } else if (action === 'continue') {
    state = { ...state, lastResult: null, phase: 'planning' }
    render()
  }
  if (target.dataset.view) {
    view = target.dataset.view as View
    render()
  }
  if (target.dataset.difficulty) {
    difficulty = target.dataset.difficulty as Difficulty
    render()
  }
  if (target.dataset.scenario) {
    scenario = target.dataset.scenario as Scenario
    render()
  }
})

root.addEventListener('input', event => {
  const target = event.target as HTMLInputElement
  if (target.id === 'reason') {
    reason = target.value
    updateReadouts()
    return
  }
  const system = target.dataset.system as SystemKey | undefined
  const field = target.dataset.field as keyof Plan[SystemKey] | undefined
  if (!system || !field) return
  draftPlan[system][field] = Number(target.value)
  updateReadouts()
})

setupBackdrop()
render()

const api: GameApi = {
  get state() { return state },
  get plan() { return draftPlan },
  startMission,
  simulate: simulateMission,
}
;(window as unknown as { __game: { game: GameApi } }).__game = { game: api }
