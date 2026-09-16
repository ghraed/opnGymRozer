// Sources reviewed 2026-09-17. These support programming principles, not clinical
// approval of this app, a named split, or a particular generated exercise list.
export const TRAINING_POLICY_VERSION = '2026-09-17-v4'
export const TRAINING_SOURCES = [
  { id: 'glutes2023', title: 'Plotkin et al.: hip thrust and squat training (2023)', url: 'https://pubmed.ncbi.nlm.nih.gov/37877099/',
    finding: 'Both exercises increased gluteal size similarly in untrained participants; squats produced more thigh growth. Floor bridges are a practical variation, not the exact intervention tested.' },
  { id: 'delts2025', title: 'Lateral raise training and shoulder growth (2025)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12277279/',
    finding: 'Dumbbell and cable lateral raises increased lateral deltoid size similarly in trained participants. This supports direct shoulder work, not a guaranteed V-shaped physique.' },
  { id: 'acsm2026', title: 'ACSM position stand (2026)', url: 'https://pubmed.ncbi.nlm.nih.gov/41843416/',
    finding: 'Resistance training improves strength and muscle size. Tailor load and weekly volume to the goal; training to failure is optional.' },
  { id: 'volume2026', title: 'Pelland et al.: weekly volume and frequency meta-regression (2026)', url: 'https://pubmed.ncbi.nlm.nih.gov/41343037/',
    finding: 'More weekly volume was associated with greater gains, with diminishing returns. Counting indirect work as half a set fitted the pooled data better than counting it as zero or one.' },
  { id: 'iusca2021', title: 'IUSCA hypertrophy position stand (2021)', url: 'https://journal.iusca.org/index.php/Journal/article/view/81',
    finding: 'Supports varied movements and repetition ranges, distributing higher volume across sessions, and adjusting workload to recovery.' },
  { id: 'rest2024', title: 'Singer et al.: rest intervals meta-analysis (2024)', url: 'https://pubmed.ncbi.nlm.nih.gov/39205815/',
    finding: 'Rest longer than 60 seconds may modestly help muscle growth. Evidence does not identify one exact best rest interval for everyone.' },
  { id: 'split2024', title: 'Split vs. full-body: systematic review and meta-analysis (2024)', url: 'https://pubmed.ncbi.nlm.nih.gov/38595233/',
    finding: 'Split and full-body routines produced similar results when weekly volume was matched. Schedule and preference can guide the choice.' },
  { id: 'acsm2009', title: 'ACSM progression models (2009)', url: 'https://pubmed.ncbi.nlm.nih.gov/19204579/',
    finding: 'Supports compound movements before accessories, moderate repetitions for novices, and gradual progression. Used for practical starting ranges alongside the updated 2026 guidance.' },
  { id: 'sex2025', title: 'Sex and muscle growth: systematic review and meta-analysis (2025)', url: 'https://pubmed.ncbi.nlm.nih.gov/40028215/',
    finding: 'Relative muscle growth was similar between sexes. Sex alone does not justify assigning a different split or exercise load.' },
  { id: 'niddk', title: 'NIH / NIDDK: Staying active at any size', url: 'https://www.niddk.nih.gov/health-information/weight-management/staying-active-at-any-size',
    finding: 'Start gradually, match activities to ability, use properly fitted equipment, and include aerobic activity and major muscle groups.' },
  { id: 'mayo', title: 'Mayo Clinic: Weight-training technique', url: 'https://www.mayoclinic.org/healthy-lifestyle/fitness/in-depth/weight-training/art-20045842',
    finding: 'Use controlled movement, appropriate weights, and recovery between sessions for the same muscles.' },
]

export const SEX_OPTIONS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'unspecified', label: 'Prefer not to say' },
]

export const GOAL_GUIDANCE = {
  strength: 'Practice loaded compound lifts in a lower repetition range when experienced. Beginners and returning lifters start with moderate repetitions and more effort in reserve. Each selected resistance exercise uses three working sets; available time and weekly workload guide exercise selection.',
  muscle: 'Distribute weekly work across compound and isolation exercises. The starting budget is lower for beginners and limited recovery; trained clients build around roughly 10 weekly sets per muscle and adjust to progress.',
  lose_weight: 'Combine resistance training with moderate aerobic activity. Exercise supports health and weight management; a particular split does not guarantee weight loss.',
  fitness: 'Train major muscle groups and include moderate aerobic activity. Begin with manageable sets and build consistency before adding more work.',
}
