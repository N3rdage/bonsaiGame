# Simplifications

A catalogue of things the simulation deliberately **doesn't** model. Each entry is a candidate for a future "Realism" / "Hardcore" / "Sim Depth" toggle — most are simplifications made to keep the prototype playable while the core loop is being built, and many would add depth (with corresponding difficulty) if re-enabled later.

Distinct from [TODO.md](TODO.md): TODO is the planned-work queue (things we *will* do soon). This file is the "could-do-later" inventory — items that aren't on the roadmap but should be remembered.

Entries should record:

- **What's simplified** — concise statement of the gap
- **Real-world behaviour** — what an unsimplified version would model
- **Notes** — implementation hooks, related TODO items, or rationale for the simplification

---

## Lifecycle / vigor

- **Vigor doesn't drift.** Currently static; only changes when repotting resets it to 50. Real-world: pots become root-bound over 2–3 years, soil compacts, drainage degrades, vigor falls. Notes: makes repotting (#2b) cosmetic until #2c lands; see also the dedicated TODO entry.
- **Trees never die.** Vitality stalls growth at 0 but the tree persists indefinitely. Real-world: prolonged neglect (or shock from poor training) kills the tree, struct should soft-delete to a "dead" location prefix.
- **Wire scarring is binary.** A branch either springs back or holds the bend, based on time-on-tree. Real-world: wire cuts into bark over weeks, leaves visible scars that take years to grow over, and can girdle a branch entirely.

## Watering / nutrients

- **Watering is binary.** Click resets water to 100. Real-world: partial watering, soil moisture varies by drainage + pot size, over-watering causes root rot.
- **Fertilizer is a 7-day window.** Boolean "fertilized or not." Real-world: NPK ratios, slow-vs-fast release, depletion curves over weeks, over-fertilizing burns roots.
- **Soil composition is flat.** Only the pot tier (standard / fancy) matters. Real-world: akadama / lava rock / pumice mix percentages affect drainage, water retention, root health.

## Environment

- **No pests or diseases.** Real-world: spider mites, aphids, scale insects, root rot, powdery mildew — all common and demanding response.
- **No weather stress.** Real-world: frost damage on tender species, leaf burn from harsh sun, wind desiccation, hail.
- **No light / shade system.** All locations grow trees identically. Real-world: shade-preferring species suffer in full sun, sun-lovers etiolate in shade.

## Propagation

- **Cuttings root immediately and always succeed.** Real-world: 2–8 week rooting period, species-dependent success rate (juniper ~50–70%, harder species much lower), failure leaves a wasted cutting.
- **Only cuttings (juniper) implemented; seeds in [#3](TODO.md).** Real-world: also air layering, grafting, division. Each unlocks different morphology starting points.

## Morphology / growth

- **Branch spawn is uniform random, capped at 15.** No species-specific branching habits, no apical-dominance gradient, no inhibition from neighbouring branches.
- **No branch dieback.** Real-world: shaded interior branches die back naturally as the canopy thickens — a major design lever for stylists.
- **No back-budding.** Hard cuts don't trigger latent buds to break. Real-world: a controlled hard prune is *how* you densify a tree.
- **No nebari (root flare) modelling.** Trunk base is uniform. Real-world: surface roots are one of the most-judged style criteria.

## Seasons / climate

- **Seasonal timing is global and calendar-locked.** Every tree of a species shifts colour / drops foliage on the same calendar day. Real-world: individual variation by tree health, microclimate, hemisphere.
- **No weather variation.** Spring is spring. Real-world: late frosts, hot summers, dry autumns — each year is different and matters.

## Trade / display

- **Shop catalogue is static.** Prices and inventory never change. Real-world: seasonal availability (pots scarce in spring, etc.), supplier reputation.
- **Display revenue is flat per day.** Real-world: audience fatigue (same tree shown too long loses appeal), seasonal interest peaks (autumn maple shows fetch more in autumn).
- **No collector reputation / commission system.** Real-world: a hobbyist economy runs on relationships, themed shows, judged competitions.

---

When adding a new entry: keep it to 2–3 lines. If it grows enough to need real explanation, it probably wants a design doc instead.
