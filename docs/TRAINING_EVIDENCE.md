# Training recommendation evidence

Reviewed 17 September 2026; policy version `2026-09-17-v4`.

Setup step 3, the fitness profile editor, and installing a starter program for a completed
profile use the same planner. All four splits are evaluated against the profile before the
system recommends one. An explicit choice remains selected even when another split is
recommended. Exact programs are app programming decisions for generally healthy adults;
the cited organizations and studies have not medically approved the app or validated its
individual recommendations.

## Profile inputs

| Information | Effect and limits |
| --- | --- |
| Goal | Changes weekly set budgets, repetitions, effort, progression style and aerobic work. Strength prioritizes loaded compound practice; muscle building uses higher weekly budgets. No split promises weight loss. |
| Available days | Determines scheduled days and repeated sessions. Full body has up to 3 lifting days, upper/lower 4, PPL 3 or 6, bro split 5. Extra days contain aerobic activity. These are scheduling conventions, not biological cutoffs. |
| Experience | Beginners receive moderate repetitions, simpler loaded variants, smaller weekly budgets and a preference for fewer lifting days. |
| Recovery | Returning after a break / limited recovery uses the conservative prescription and smaller exercise selection, even for experienced clients. This is self-reported readiness, not a medical assessment. |
| Session time | 30, 45, 60, 75 or 90 minutes; constrains exercise selection and aerobic finishers. Time includes an estimated warm-up, setup, repetition time and rest. Actual duration varies. |
| Equipment | Explicit movement families select available variants. Home clients confirm a bench or secure stations for both rows and pull-ups. Without a bench, dumbbell pressing uses the floor. Unavailable pulling work remains a visible gap. |
| Weight / height | Recorded with the current weight unit and displayed for progress tracking and trainer assessment of equipment fit. They cannot establish strength or limb proportions, so they do not determine loads or exclude movements. |
| Sex | Optional and independent of the diagram. Female selects the feminine/glute-and-leg focus; male selects the muscular V-shape/back-and-shoulder focus; unspecified keeps balanced development. This mapping is a product physique goal, not a biological requirement. Loads are never calculated from sex. |
| Injury / limitation note | Requests trainer and, where appropriate, clinical review. Free text does not diagnose conditions or generate rehabilitation prescriptions. |

New time, recovery and equipment fields are optional for existing profiles. Defaults are
60 minutes, normal recovery, and unconfirmed home supports. Older clients remain unlocked.

## Weekly volume model

`training-volume.js` counts every scheduled occurrence, including PPL sessions repeated twice.
A directly trained muscle gets 1 set of credit; an assisting muscle gets 0.5. For example,
3 bench sets performed twice yield 6 chest sets and 3 indirect triceps sets. Three triceps
extension sets performed twice add 6 direct triceps sets: the triceps total is 9.
The 2026 Pelland meta-regression supports fractional accounting in pooled data; an exact
0.5 contribution for an individual person or exercise is not established.

The mapping in `training-movements.js` follows the **selected exercise**, including substitutes.
A row replacing a curl remains direct back / indirect biceps work. The ten muscle categories
are coarse workload estimates, not individual muscle activation measurements. Shoulder totals,
for example, do not establish equal coverage of every deltoid head. Warm-ups and aerobic work
are excluded from resistance set counts. The model assumes controlled working sets at the
suggested effort; easy practice sets do not automatically provide the same stimulus.

Starting budgets (estimated weekly sets per muscle):

| Goal | Beginner | Intermediate | Advanced | Limited recovery |
| --- | ---: | ---: | ---: | ---: |
| Muscle building | 6 | 10 | 12 | At most 6 |
| Strength | 4 | 6 | 8 | At most 4 |
| Fitness / weight loss | 4 | 6 | 6 | At most 4 |

Trunk work is capped at a starting budget of 6. Around 10 weekly sets for hypertrophy is
informed by ACSM/IUSCA. The exact experience bands, 4/6/8/12 budgets, trunk exception and
recovery reductions are conservative app defaults, **not research-derived personal optima
or mandatory minimums**. Less work can be productive. Actual response should guide later
adjustments with the trainer.

Every generated resistance exercise, including the unpersonalized starter templates,
uses **exactly 3 working sets**, per the product
requirement. The planner never reduces a selected exercise to 1–2 sets or increases it to
4–5. No exercise-specific study requiring a fourth set has been adopted; a future exception
would need an explicit evidence review. Three sets is the required default, not a claim
that research establishes a universal minimum or optimal prescription.

Allocation selects complete three-set exercises to reduce combined normalized weekly
muscle deficits per estimated minute. It also gives a preference to distinct movement
patterns and sessions without a resistance exercise. This preserves variety beyond coarse
muscle totals, for example lateral raises versus overhead pressing. Repeated routines count
on every scheduled occurrence. When time or recovery is limited, the planner selects fewer
exercises; it never reduces their set count. A muscle gets at most 10 counted sets in one
session. This remains a planning cap, not a proven safety threshold. The three-set blocks
can take weekly totals above a starting budget; that budget is not an exact set quota.

The estimate uses 5 minutes warm-up, 1 minute setup per movement, 3 seconds per repetition,
and prescribed rest **between** sets. These time assumptions are not study findings.
The preview reports direct, weighted indirect and total sets, session counts, starting
budgets, and shortfalls. It explains each exercise's own weekly sets alongside its target
muscles' totals. Missing muscle work and sessions without suitable exercises are disclosed.
The app does not silently exceed the time limit or claim every split meets every budget.

Split ranking sums normalized muscle shortfalls, adds a penalty for empty sessions, and
uses availability/experience preferences to resolve similarly feasible options. Novice or
limited-recovery schedules with more than three lifting days receive an additional penalty.
These score weights are transparent scheduling heuristics, not a clinically validated ranking.
Two-day variants merge named split sessions. Full-body lifting has recovery days between
sessions, including at the weekly boundary. Low-frequency split choices are identified.

## Movement and repetition choices

The movement registry includes pushes, horizontal/vertical pulls, squat/knee extension,
hip hinge, single-leg work, shoulders, arms, calves and trunk work. Unmapped exercises are
omitted rather than selected by an arbitrary catalogue search. Each family has source IDs
supporting the movement-selection principles, not certification of a demonstration or variant.
Duplicate exercises are removed within each routine. Missing equipment does not turn a
horizontal row into a vertical pull, or a glute bridge into a direct hamstring curl.

| Prescription | Repetitions | Rest | Effort in reserve |
| --- | --- | --- | --- |
| Beginner or limited recovery | 8–12 | 120 sec compound / 90 sec accessory | About 3–4 good repetitions |
| Experienced strength, loaded compound | 4–6 | 180 sec | About 2–3 good repetitions |
| Experienced muscle building, compound | 6–12 | 120 sec | About 2–3 good repetitions |
| Experienced muscle building, accessory | 10–15; lateral/rear raises 12–20 | 90 sec | About 2–3 good repetitions |
| Other work | 8–15 | 120 sec compound / 90 sec accessory | About 2–3 good repetitions |

These ranges apply by actual movement role, not list position. Broad loading ranges can
produce hypertrophy; no study requires every accessory to use one exact range. Strength
practice favors heavier loads, without requiring a maximum test or assigning a load from
body size or sex. Rest choices allow recovery and consistent technique; the rest review
does not establish 90/120/180 seconds as universal optima. Workout logging uses the saved
prescription and its rest timer. Load starts unprescribed; progress gradually when the
range is comfortable with controlled technique.

Fitness and weight-loss sessions include aerobic finishers, bounded by one quarter of the
session time. Beginners/returners start with up to 10 minutes. Separate aerobic days use
10 minutes for beginners/returners, otherwise up to 30. These are starting choices, not
complete individualized aerobic prescriptions. Cycling/elliptical work is used in a full
gym; walking otherwise. The preview explains gradual progress toward 150 moderate minutes
per week and counts repeated sessions. Zero speed means no fixed pace, preserved by logging.

## Evidence links

- [ACSM position stand, Currier et al. (2026)](https://pubmed.ncbi.nlm.nih.gov/41843416/),
  DOI `10.1249/MSS.0000000000003897`: goal-specific load/volume, varied equipment, optional
  failure training. [Official summary](https://acsm.org/resistance-training-guidelines-update-2026/).
- [Pelland et al. (2026), volume/frequency dose-response meta-regression](https://pubmed.ncbi.nlm.nih.gov/41343037/),
  DOI `10.1007/s40279-025-02344-w`: fractional indirect-set accounting and diminishing returns
  with increasing volume. Published online December 2025; journal issue February 2026.
- [IUSCA hypertrophy position stand (2021)](https://journal.iusca.org/index.php/Journal/article/view/81),
  DOI `10.47206/ijsc.v1i1.81`: exercise variety, loading ranges, distributing volume and recovery.
- [Singer et al. (2024), rest-interval meta-analysis](https://pubmed.ncbi.nlm.nih.gov/39205815/),
  DOI `10.3389/fspor.2024.1429789`: modest possible benefit beyond 60 seconds, with uncertainty.
- [ACSM progression models (2009)](https://pubmed.ncbi.nlm.nih.gov/19204579/),
  DOI `10.1249/MSS.0b013e3181915670`: novice practice, movement order and gradual progression,
  interpreted alongside the newer position stand.
- [Ramos-Campo et al. (2024), split/full-body meta-analysis](https://pubmed.ncbi.nlm.nih.gov/38595233/),
  DOI `10.1519/JSC.0000000000004774`: similar outcomes when volume was equated; does not establish
  equivalence of the app's generated routines.
- [Sex differences in muscle growth, review/meta-analysis (2025)](https://pubmed.ncbi.nlm.nih.gov/40028215/):
  similar relative responses; does not establish sex-specific split or load rules.
- [NIH/NIDDK: Staying active at any size](https://www.niddk.nih.gov/health-information/weight-management/staying-active-at-any-size):
  gradual activity, appropriate equipment and major muscle groups.
- [Mayo Clinic: Weight-training technique](https://www.mayoclinic.org/healthy-lifestyle/fitness/in-depth/weight-training/art-20045842):
  controlled movement, appropriate load and recovery.

The in-app source metadata is in `training-evidence.js`. Saved profiles retain the policy
version and generation assessment, while entries retain sources and volume explanations.
This assessment describes the plan **when generated**; later manual edits do not automatically
recompute it. Existing assigned schedules are preserved unless replacement is explicitly
chosen. Past routines and workout history remain saved. Tests cover profile combinations,
independent direct/indirect arithmetic, actual substitutions, time and set caps, recovery,
effort/rest, source coverage and persistence.

## Physique emphasis (v4)

The requested female/male mapping changes generated plans across all four splits and goals.
Female prioritizes glutes, hamstrings and quadriceps; male prioritizes back and shoulders.
The remaining muscle targets stay in place, as do goal-specific cardio and strength work.
All split candidates are evaluated using the same emphasis; picking another split does not
remove it. Existing plans remain preserved unless the user chooses regeneration.

Priority muscles have twice the deficit weight in exercise allocation and split scoring.
Experienced clients with normal recovery receive a target one three-set block higher for
those muscles; beginners/returners keep the original target with changed selection priority.
These exact priorities and additions are product heuristics, not study-derived sex formulas.
Time, equipment and per-session caps still apply and unmet targets remain visible.

Lower-body sessions can offer floor hip extensions alongside squats and hinges. Back days
can offer vertical pulling and rear-shoulder work; upper-body sessions can offer lateral
raises. Full-body templates can offer both patterns. Substitution still uses reviewed
movement families and actual muscle credits. No unavailable equipment is silently assumed.

- [Plotkin et al. (2023)](https://pubmed.ncbi.nlm.nih.gov/37877099/): in 34 untrained
  participants, nine weeks of squat or hip-thrust training produced similar glute growth,
  while squats produced more thigh growth. Floor bridges are a practical adaptation;
  they were not the tested hip-thrust intervention.
- [Lateral raise trial (2025)](https://pmc.ncbi.nlm.nih.gov/articles/PMC12277279/):
  dumbbell and cable lateral raises both increased lateral-deltoid size in trained adults.
  Supports direct shoulder work, not a specific guaranteed silhouette.
- [Sex meta-analysis (2025)](https://pubmed.ncbi.nlm.nih.gov/40028215/): similar relative
  hypertrophy potential supports using shared training principles. Neither this review nor
  the trials validate sex-based aesthetic restrictions or guarantee body proportions.

Labels describe the selected goal. They do not promise changes to skeletal structure,
spot fat reduction, or removal of all training for other muscle groups.
