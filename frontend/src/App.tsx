import './index.css'

const majors = [
  'Computer Science (BS)',
  'Information and Decision Sciences (BS)',
  'Bioengineering (BS)',
  'Architecture (BArch)',
  'Psychology (BA)',
]

export default function App() {
  return (
    <main className="page">
      <section className="hero" id="top">
        <div className="band band--top" aria-hidden="true" />
        <div className="hero__inner">
          <h1>UIC Flame Map</h1>
          <p className="lead">
            An organized visual for your degree at UIC. Explore every course and
            see prerequisites.
          </p>
          <div className="hero__actions">
            <a className="btn btn--primary" href="#flowchart">
              Create my Flowchart
            </a>
            <a className="btn btn--ghost" href="#learn">
              Learn More
            </a>
          </div>
        </div>
        <div className="band band--bottom" aria-hidden="true" />
      </section>

      <section className="section section--flow" id="flowchart">
        <div className="section__inner">
          <div className="section__header">
            <p className="eyebrow">Start Here</p>
            <h2>Choose Your Major</h2>
            <p className="section__lead">
              We'll load the courses and build your visual flowchart instantly.
            </p>
          </div>

          <div className="flow-card">
            <label htmlFor="major" className="field__label">
              Major or program
            </label>
            <div className="field__row">
              <select id="major" name="major" defaultValue="">
                <option value="" disabled>
                  Select a major
                </option>
                {majors.map((major) => (
                  <option key={major} value={major}>
                    {major}
                  </option>
                ))}
              </select>
              <button className="btn btn--primary" type="button">
                Build My Map
              </button>
            </div>
            <p className="hint">
              Need to add serch feature.
            </p>
          </div>
        </div>
      </section>

      <section className="section section--learn" id="learn">
        <div className="section__inner">
          <div className="section__header">
            <p className="eyebrow">How It Works</p>
            <h2>From Catalog to Flowchart</h2>
            <p className="section__lead">
              We pull official UIC catalog data and map out prerequisites so you
              can plan semester by semester.
            </p>
          </div>

          <div className="steps">
            <article className="step">
              <h3>1. Pick Your Program</h3>
              <p>
                Select your degree or concentration.
              </p>
            </article>
            <article className="step">
              <h3>2. See the Graph</h3>
              <p>
                An interactive map that shows which courses unlock the next
                ones.
              </p>
            </article>
            <article className="step">
              <h3>3. Plan Your Path</h3>
              <p>
                Mark completed courses to highlight what is available next.
              </p>
            </article>
          </div>
        </div>
      </section>
    </main>
  )
}
