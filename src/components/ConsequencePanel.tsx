import type { ConsequenceLists } from '../game/playerGuidance'

export function ConsequencePanel({ lists }: { lists: ConsequenceLists }) {
  return (
    <div className="consequence-lists">
      <section>
        <h4>GAIN</h4>
        <ul>
          {lists.gain.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
      <section>
        <h4>KEEP</h4>
        <ul>
          {lists.keep.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
      <section>
        <h4>RESET</h4>
        <ul>
          {lists.reset.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
      {lists.change.length > 0 ? (
        <section>
          <h4>You can change</h4>
          <ul>
            {lists.change.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
