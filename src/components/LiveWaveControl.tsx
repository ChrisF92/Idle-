interface LiveWaveControlProps {
  wave: number
  onReturn: () => void
}

/** Compact return-to-Sortie control while browsing a paused live run. */
export function LiveWaveControl({ wave, onReturn }: LiveWaveControlProps) {
  return (
    <div className="live-wave-bar">
      <button type="button" className="live-wave-btn" onClick={onReturn}>
        <span className="live-wave-kicker">{`SORTIE PAUSED · W${wave}`}</span>
        <span>Return to Sortie</span>
      </button>
    </div>
  )
}
