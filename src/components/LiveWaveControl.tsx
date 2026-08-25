interface LiveWaveControlProps {
  wave: number
  onReturn: () => void
}

/** Compact return-to-Sortie control. Replaces the global bottom nav during a live run. */
export function LiveWaveControl({ wave, onReturn }: LiveWaveControlProps) {
  return (
    <div className="live-wave-bar">
      <button type="button" className="live-wave-btn" onClick={onReturn}>
        <span className="live-wave-kicker">LIVE</span>
        <span>Wave {wave}</span>
      </button>
    </div>
  )
}
