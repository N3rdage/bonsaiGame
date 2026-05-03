# Naming Things, Picking Things, Being a Person

The simulation has been working since the second weekend. Trees grow. Water decays. Branches sprout at probabilities weighted by vitality. Save and load round-trip the entire world to JSON. You can take cuttings, plant them, train them, watch them in 3D. By any reasonable engineering definition, the game has been finished for weeks.

It's also been, in a way I want to talk about, not a game.

A working simulation isn't the same as a game. A game is a thing a person plays. The person needs a name to call their tree by. They need to know what they're carrying. They need a way to express what they're aiming for. And — you'd think this would have been obvious — they probably shouldn't be a literal red square.

This session was about closing those gaps.

## The inventory you couldn't see

The inventory has existed since day one as `global.inventory`, a struct of key-count pairs: `clay: 5, pot: 2, wire: 10, fertilizer: 50, seed_juniper: 1, ...`. The simulation knew exactly what the player owned. The player did not.

To plant a cutting, the panel told you how many cuttings of each species you had. To skip seven days, the inspector told you whether you had enough fertilizer. Each subsystem peeled off the slice of inventory it cared about. There was no place that simply said: *here is everything*.

So we made one. Press `I` from anywhere in the 2D world, a panel appears, three sections — Resources, Seeds, Cuttings — with counts. Press `I` again or Esc to close. Items with count zero are hidden, but the section headers stay so you learn the categories even when they're empty. (You could imagine this becoming an interactable later — drop the watering can to refill, drag a pot to the planting table — but for now it's just *seeing*. Seeing is most of what the panel needed to do.)

There's a small UX moment buried in the toggle behaviour. The first version of the I-key handler just opened the panel; pressing I again did nothing because the panel was already up. The second version closes-on-second-press, which feels unambiguously better and took two extra lines. Both versions worked correctly under the spec "open inventory on I." Only one of them feels right, and the difference is that the second version assumes the player will press I a second time — that's the thing they'll do. Spec says "open." Behaviour says "open or close, depending on which makes sense." Specs are not enough.

## Naming a tree

Every `BonsaiTree` struct has had a `name` field as long as the struct has existed. Originally because I was thinking ahead to "Drew might name his trees." Then because cuttings auto-name themselves "New Juniper" and the field is the placeholder for a real name later. Then for a long time because nothing was reading or writing the field after creation, and nobody had thought about it.

The rename dialog is a small thing, in the sense that it's one modal panel with a text input and two buttons. It's also a small thing in the *other* sense — the one where giving something a name changes how you relate to it. "New Juniper #3" is inventory. "Stubborn" is a tree.

The text input uses GameMaker's `keyboard_string`, a global string that accumulates whatever the player types. The trick is initialising it on the first draw frame: the spawner sets `panel.tree = the_tree;` immediately after creating the panel, but the panel's Create event runs *before* that assignment lands. So the panel checks an `initialised = false` flag on the first draw call, copies `tree.name` into `keyboard_string` then, and subsequent frames just render whatever the player has typed. A blinking cursor is one line — toggle visibility every 500ms based on `current_time div 500 mod 2`. The 20-character limit is one line in the Step event — `string_copy(keyboard_string, 1, 20)` if it's grown too long.

Total feature: maybe 90 lines of code. Total thought required: more than that, because this is the first time the game has invited the player to *contribute* something. Up to this point the player was a consumer of the world — they could trigger things, but everything they could trigger was something the simulation already knew how to do. Naming is different. The game accepts a string from the player and stores it forever.

## Picking a style

The third feature is the one I'm most pleased about, even though it's the most quietly useless of the three. It does nothing, mechanically. You pick a target style for a tree — Formal Upright, Cascade, Windswept, one of six traditional bonsai forms — and the game stores your choice. Nothing scores against it. Nothing rewards conformance. Nothing punishes deviation.

It's a *gesture*. The kind of thing where having declared an intention changes your relationship with the tree even though no system in the game knows about it.

(Soon something will. The next big feature on the roadmap is aesthetic scoring, where the choice of target style finally gets compared against the tree's actual morphology, and the score is what closes the game's economic loop. The data model and the picker UI shipped this week so that when scoring lands, the *choice already exists*. Players who set styles now will get retroactive scoring on those trees. We didn't build a placeholder; we built the real feature, just without the scoring half.)

The picker is six rows of style name + short description. Click a row to highlight, Save to commit, Cancel to discard, Clear to empty the field. The descriptions started long — "Trunk has a gentle S-curve as it rises. The most common natural form." — and got cut to one line each, because in a list of six things you're scanning, not reading. The verbose flavour text can come back later as tooltips, when there's a tooltip system.

## A side trip through the GameMaker reserved-words list

In the middle of the styles work, the project stopped compiling. GameMaker had decided, in some recent version update, that you can't write `.id = ...` to a struct field from user code, even though you *can* read it and you *can* declare a field called `id` in a struct literal. The error was only triggered by recompiling, which in turn was triggered by an unrelated change to the `BonsaiTree` constructor.

There's an interesting principle here that I keep running into. Bugs hide behind ambient motion. A previous post in this blog was about a foliage-jitter bug that nobody noticed because every other operation that triggered a mesh rebuild also moved actual geometry. This one was the same shape. The line `_tree.branches[i].id = i;` had been latent for who knows how long. It compiled fine the day it was written, and the project was probably never recompiled hard enough to re-evaluate that line until I added an unrelated field to `BonsaiTree` and the compiler walked over everything.

The fix was three minutes — `variable_struct_set(struct, "id", i)` is the dynamic accessor that sidesteps the static check — but the diagnosis took longer than the fix, because the diagnosis required understanding that the line had been silently broken for an indeterminate window and was only just now being asked. None of the failure was in the code I'd written that day.

I keep writing a version of this post. I don't think I'll stop.

## Becoming less of a box

The last thing this session did was ask: when the player walks across the room, what does the player look like? The answer, since the project's first weekend, was *a 32×32 red square*. Drew called it a side quest. It was overdue.

The fix isn't a sprite — neither of us is going to art any time soon, and TODO #13 (Art Pass) is reserved for the day when actual art happens. The fix is a Draw event that draws shapes: a translucent shadow oval on the ground, a blue circle for the body, a smaller circle for the head, a darker circle layered slightly behind the head as hair, and a small skin-tone dot poking out in whichever direction the character is facing. The "nose" is the trick. Without it the character is just a stack of dots. With it, the character is a person who is *currently looking at something*. That's the difference between a sprite and a character.

The drop shadow is the other small thing. Without it the character feels pasted onto the room. With it, the character feels *in* the room. Twenty pixels of squashed black ellipse at 25% alpha is the entire intervention. (Game artists have been telling me this for years; I keep being surprised when it works.)

## What changed

The simulation didn't change this session. Trees grow at the same rate. Water decays the same way. Cuttings produce the same starter morphology. By any reasonable engineering metric, the game does the same things it did last week.

By every other metric, it's a different game. You can see what you have. You can name what you grow. You can declare what you're aiming for. And the person walking around the room is a person.

None of these were systems. None of them changed the world. They changed what it feels like to look at the world. The "what" was already done. This session did the "feels."

I think that's the part I keep underestimating.
