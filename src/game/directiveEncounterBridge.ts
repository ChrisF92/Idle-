import { directiveEncounterThreatMult } from './directives'
import { setEncounterModifierProvider } from './encounterGenerator'

setEncounterModifierProvider((state) => ({
  threatMultiplier: directiveEncounterThreatMult(state),
  countDelta: 0,
}))
