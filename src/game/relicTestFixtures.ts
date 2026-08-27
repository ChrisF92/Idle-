/**
 * Non-production Relic descriptors for generic engine tests.
 * Never added to RELIC_FAMILIES.
 */

import {
  clearTestRelicDescriptors,
  registerTestRelicDescriptor,
  type RelicDescriptor,
} from './relicCatalogue'

export const FIXTURE_POWER_STANDARD: RelicDescriptor = {
  id: 'fixture-power-standard',
  name: 'Fixture Power Standard',
  kind: 'standard',
  socket: 'power',
  socketStatus: 'authored',
  fabricationStatus: 'ready',
  effectStatus: 'authored',
  effectBlurb: 'Test-only authored Power Relic.',
}

export const FIXTURE_SHIELD_STANDARD: RelicDescriptor = {
  id: 'fixture-shield-standard',
  name: 'Fixture Shield Standard',
  kind: 'standard',
  socket: 'shield',
  socketStatus: 'authored',
  fabricationStatus: 'ready',
  effectStatus: 'authored',
  effectBlurb: 'Test-only authored Shield Relic.',
}

export const FIXTURE_OPTICAL_STANDARD: RelicDescriptor = {
  id: 'fixture-optical-standard',
  name: 'Fixture Optical Standard',
  kind: 'standard',
  socket: 'optical',
  socketStatus: 'authored',
  fabricationStatus: 'ready',
  effectStatus: 'authored',
  effectBlurb: 'Test-only authored Optical Relic.',
}

export const FIXTURE_BALLISTIC_STANDARD: RelicDescriptor = {
  id: 'fixture-ballistic-standard',
  name: 'Fixture Ballistic Standard',
  kind: 'standard',
  socket: 'ballistic',
  socketStatus: 'authored',
  fabricationStatus: 'ready',
  effectStatus: 'authored',
  effectBlurb: 'Test-only authored Ballistic Relic.',
}

export const FIXTURE_UNIVERSAL_STANDARD: RelicDescriptor = {
  id: 'fixture-universal-standard',
  name: 'Fixture Universal Standard',
  kind: 'standard',
  socket: 'universal',
  socketStatus: 'authored',
  fabricationStatus: 'ready',
  effectStatus: 'authored',
  effectBlurb: 'Test-only authored Universal-class Relic. Does not fit every typed socket.',
}

export const FIXTURE_POWER_BEHAVIOURAL: RelicDescriptor = {
  id: 'fixture-power-behavioural',
  name: 'Fixture Power Behavioural',
  kind: 'behavioural',
  socket: 'power',
  socketStatus: 'authored',
  fabricationStatus: 'ready',
  effectStatus: 'authored',
  effectBlurb: 'Test-only authored Behavioural Power Relic.',
}

export const FIXTURE_OPTICAL_BEHAVIOURAL: RelicDescriptor = {
  id: 'fixture-optical-behavioural',
  name: 'Fixture Optical Behavioural',
  kind: 'behavioural',
  socket: 'optical',
  socketStatus: 'authored',
  fabricationStatus: 'ready',
  effectStatus: 'authored',
  effectBlurb: 'Test-only authored Behavioural Optical Relic.',
}

export const AUTHORED_RELIC_FIXTURES: RelicDescriptor[] = [
  FIXTURE_POWER_STANDARD,
  FIXTURE_SHIELD_STANDARD,
  FIXTURE_OPTICAL_STANDARD,
  FIXTURE_BALLISTIC_STANDARD,
  FIXTURE_UNIVERSAL_STANDARD,
  FIXTURE_POWER_BEHAVIOURAL,
  FIXTURE_OPTICAL_BEHAVIOURAL,
]

export function installAuthoredRelicFixtures(): void {
  for (const def of AUTHORED_RELIC_FIXTURES) registerTestRelicDescriptor(def)
}

export function resetRelicTestFixtures(): void {
  clearTestRelicDescriptors()
}
