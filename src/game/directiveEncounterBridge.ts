import { directiveEncounterSpawnRateMult } from './directives'
import { setEncounterModifierProvider } from './encounterGenerator'

setEncounterModifierProvider((state) => ({
  spawnRateMultiplier: directiveEncounterSpawnRateMult(state),
  countDelta: 0,
}))
