# Training recommendation evidence

The fitness-profile builder is an evidence-informed starting-point generator for generally
healthy adults. It is not a medical assessment and cannot promise a “perfect” program.

## Rules encoded in the builder

- **Schedule:** full-body for 2–3 available days, upper/lower rotation for 4–5, and
  push/pull/legs for 6. Split and full-body routines produce similar strength and hypertrophy
  when volume is equated, so availability and repeat exposure drive this choice. The user may
  select another split that still fits the chosen number of days; the builder then regenerates
  its exercises and prescriptions for the goal instead of treating the split as the goal.
- **Strength:** main lifts use heavier sets of about 5 repetitions. Higher loads produce
  greater improvements in maximal strength than lower loads.
- **Hypertrophy:** multiple working sets use mostly 8–12 repetitions, with volume increasing
  conservatively by experience. Hypertrophy responds to a broad loading range and weekly
  volume shows a dose-response relationship, with diminishing returns.
- **Fat loss/general fitness:** plans retain at least two resistance sessions and add aerobic
  work. Resistance exercise during dietary weight loss helps preserve fat-free mass; exercise
  does not guarantee loss of body weight without an appropriate energy balance.
- **General health:** the result names any shortfall from 150 minutes of moderate aerobic
  activity per week. WHO also recommends muscle-strengthening activity on at least two days.
- **Equipment:** unavailable exercises are replaced only by movements permitted by the chosen
  equipment and matching the same body part/primary target where possible.
- **Limitations:** free-text injury or limitation notes are never interpreted as a diagnosis.
  The UI asks for review by a qualified professional before the plan is used.

## Sources

- WHO, *Guidelines on physical activity and sedentary behaviour* (2020):
  https://iris.who.int/handle/10665/336656
- Currier et al., *Resistance training prescription for muscle strength and hypertrophy in
  healthy adults: a systematic review and Bayesian network meta-analysis* (2023):
  https://pubmed.ncbi.nlm.nih.gov/37414459/
- Schoenfeld et al., *Strength and hypertrophy adaptations between low- vs. high-load
  resistance training: a systematic review and meta-analysis* (2017):
  https://pubmed.ncbi.nlm.nih.gov/28834797/
- Schoenfeld et al., *Dose-response relationship between weekly resistance training volume
  and increases in muscle mass* (2017): https://pubmed.ncbi.nlm.nih.gov/27433992/
- Ramos-Campo et al., *Efficacy of split versus full-body resistance training on strength and
  muscle growth* (2024): https://pubmed.ncbi.nlm.nih.gov/38595233/
- Lopez et al., *Resistance training effectiveness on body composition and body weight
  outcomes in individuals with overweight and obesity* (2022):
  https://pubmed.ncbi.nlm.nih.gov/35191588/
