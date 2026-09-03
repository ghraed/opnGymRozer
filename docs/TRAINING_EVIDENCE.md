# Training recommendation evidence

The fitness-profile builder is an evidence-informed starting-point generator for generally
healthy adults. It is not a medical assessment and cannot promise a “perfect” program.

## Rules encoded in the builder

- **Schedule:** full-body for 2–3 available days, upper/lower rotation for 4–5, and
  push/pull/legs for 6. Split and full-body routines produce similar strength and hypertrophy
  when volume is equated, so availability and repeat exposure drive this choice. The user may
  select any other available split; the builder then regenerates its exercises and
  prescriptions for the goal instead of treating the split as the goal. When a split has more
  named sessions than the user's available days, its highest-priority movements are combined
  across the available sessions so no source routine is simply omitted. Changing a default
  program later also reuses the saved profile instead of silently falling back to generic sets.
- **Strength:** multi-joint main lifts use three sets of about 5 repetitions; accessory
  movements use two sets of about 8 repetitions (three for advanced trainees). Higher loads
  produce greater improvements in maximal strength than lower loads. Exercise role is explicit,
  so an isolation movement never receives a heavy prescription merely because of list order.
- **Hypertrophy:** main movements start at three sets and use double progression over roughly
  6–8 repetitions; accessory movements start at two sets over roughly 10–12 repetitions.
  Direct upper-body work is distributed across Upper A/B to provide about 10 or more weekly
  sets for major muscle groups once direct and compound contributions are considered. Muscle
  growth occurs across a broad loading range when sets are challenging, and complete muscular
  failure is not required. Volume rises conservatively for advanced trainees.
- **Fat loss/general fitness:** multi-joint movements use 2–3 sets of about 8 repetitions and
  accessories use two sets of about 12. Plans retain at least two resistance sessions and add
  aerobic work. There is no special high-repetition “fat-loss” prescription: resistance exercise
  helps preserve fat-free mass during dietary weight loss, while exercise alone does not
  guarantee loss of body weight without an appropriate energy balance.
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
- American College of Sports Medicine, *Resistance Training Prescription for Muscle Function,
  Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews* (2026):
  https://pubmed.ncbi.nlm.nih.gov/41843416/
- Schoenfeld et al., *Strength and hypertrophy adaptations between low- vs. high-load
  resistance training: a systematic review and meta-analysis* (2017):
  https://pubmed.ncbi.nlm.nih.gov/28834797/
- Schoenfeld et al., *Dose-response relationship between weekly resistance training volume
  and increases in muscle mass* (2017): https://pubmed.ncbi.nlm.nih.gov/27433992/
- Refalo et al., *Influence of Resistance Training Proximity-to-Failure on Skeletal Muscle
  Hypertrophy* (2023): https://pubmed.ncbi.nlm.nih.gov/36334240/
- Ramos-Campo et al., *Efficacy of split versus full-body resistance training on strength and
  muscle growth* (2024): https://pubmed.ncbi.nlm.nih.gov/38595233/
- Lopez et al., *Resistance training effectiveness on body composition and body weight
  outcomes in individuals with overweight and obesity* (2022):
  https://pubmed.ncbi.nlm.nih.gov/35191588/
- Binmahfoz et al., *Effect of resistance exercise on body composition, muscle strength and
  cardiometabolic health during dietary weight loss* (2025):
  https://pubmed.ncbi.nlm.nih.gov/40909191/
