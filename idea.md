I think we can make something genuinely useful. I'd keep it intentionally simple instead of trying to outsmart OGame.

## MVP

A Tampermonkey userscript that adds a small floating panel.

```
──────────────
 Colony Queue
──────────────
✓ Metal Mine 4
✓ Crystal Mine 3

➡ Metal Mine 5

Next
Crystal Mine 4
Solar Plant 5
Metal Mine 6

[Done]
[Edit]
[Import]
```

When you finish a building:

* Click **Done**.
* It advances to the next item.
* Queue is saved in `localStorage`.

No optimization. No API. Just a checklist.

---

## Better version

Instead of clicking **Done**, it watches the page.

When you're on `supplies`, it can read the building levels from the DOM.

Example:

Current:

```
Metal Mine      8
Crystal Mine    7
Solar Plant     9
```

Queue:

```
Metal 8
Crystal 7
Solar 9
Metal 9
Crystal 8
```

It automatically marks completed items.

So if Metal reaches 9:

```
✓ Metal 9
➡ Crystal 8
```

No interaction required.

---

## Nice features

### Multiple planets

```
Planet 3

Metal 12
Crystal 10
Solar 13

Planet 4

Metal 8
Crystal 7
Solar 8
```

Automatically switches queues when you change planets.

---

### Import

Paste

```
M10
C8
S10
M11
C9
R2
SY1
```

and it builds the queue.

---

### Templates

```
New Colony

M1
C1
S1
M2
C2
S2
...
```

One click.

---

### Highlight

Instead of searching the page...

Metal Mine gets a green outline.

```
🟢 BUILD THIS
```

---

### Notifications

When construction completes:

```
Metal Mine complete

Next:
Crystal Mine 8
```

---

## Tech stack

* Tampermonkey
* Plain JavaScript
* `localStorage`
* `MutationObserver` (watch for building completion)
* Small floating HTML panel
* Zero dependencies

---

## File structure

```
ogame-build-queue.user.js
```

Everything in one userscript.

---

I also have an idea that I think is much cooler than a static queue.

Instead of storing:

```
M10
C8
S10
```

Store **rules**:

```yaml
new_colony:
  repeat:
    - Metal = Crystal + 2
    - Solar >= ceil((Metal + Crystal)/2)
  until:
    Metal = 22

then:
  Robotics = 4
  Shipyard = 2
```

The script continuously evaluates your current colony and always tells you the next upgrade. If you accidentally build Crystal first, it recalculates instead of the whole plan becoming "off by one."

I'd probably start with the simple queue (a few hundred lines), then evolve it into the rule-based planner once the UI is solid. I think the rule engine would be unique—I've never seen an OGame tool do that.

