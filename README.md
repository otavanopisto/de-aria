# de-aria

Accessibility tools HTML websites.

Pressing and releasing **Ctrl** (tap without any combo key) shows keyboard shortcut hints for all currently interactive elements. Pressing any other key, clicking, scrolling with the mouse, or any non-hover mouse event hides them. While hints are visible, **arrow keys** scroll the active scroller without hiding the hints.

## Idea

de-aria aims to improve accessibility by providing shortcuts for all interactive elements on a page, and a scroller overlay for scrollable regions. It is designed to be used in conjunction with screenreaders and voice command accessibility suites.

Unlike most accessibility approaches, de-aria does not provide an equal experience for all users; instead it focuses on providing a clean experience for each disability type. For example, a screenreader user will not see any visual hints, but a physically disabled user with intact vision will see the hints and be able to use them.

### All Text is focusable

De-aria takes a unique concept where all text is meant to be focusable and part of the accessibility tree. This is a design choice that allows for a more natural flow of information and interaction for users with disabilities. So they can decide what text to read and what to interact with rather than being forced to read everything in a linear fashion. Screenreaders will be able to read the text as the user tabs through the elements.

### Groups are key

Unlike other accessibility approaches, de-aria groups elements together; for example a paragraph might have multiple links in them; a sighted user will not interact with links most of the time so it makes no sense to always highlight them; instead, de-aria allows the user to focus on the paragraph and move through paragraphs and then enter these "groups" to interact with the links. This allows for a more natural flow of information and interaction for users with disabilities, so they only interact with what they need; this is similar to how a signed person might interact.

For physical disabilities, these groups also allow to prevent clutter, dynamic groups are themselves receiving a keyboard shortcut, after selecting one, the internal elements will receive their own keyboard shortcuts. This prevents excessive clutter of all the shortcuts on the screen at once.

### Small Changes

De-aria aims to be a small change to existing websites, with its de-aria properties; however things to keep in mind are:

#### ReactJS, VueJS, AngularJS, SvelteJS, etc.

When using de-aria with frameworks that use virtual DOMs, you need to understand that de-aria adds custom properties to the DOM elements as they are interacted with. If the framework re-renders the DOM, these properties will be lost and de-aria will not work as expected.

TODO:

For that you need to use custom de-aria components, they will be analog to your standard html elements, but use shadow DOM to protect these custom attributes.

Using the exposed DOM is however a cleaner approach if your project does not use a framework or if using the exposed DOM works in that specific framework or case.

## Screenreaders

Screenreaders follow the application flow and are mostly unaffected since the natural flow of html allows for the usage of screenreaders easily.

De-aria however enforces the idea that visible elements should be focusable, which creates an "outline" where you can see what it is actually reading at a time; all other elements are skipped.

## Physically disabled

This is where most of the de-aria design comes into play, it enables a pattern where voice commands can be issue for those with intact or mostly intact vision but physical disability that prevents them from using the mouse or both the mouse and keyboard.

You can test with a voice driven accessibility suite, eg. like Talon.

---

## Usage

```html
<script type="module" src="js/index.js"></script>
```

Import the script as an ES module. No framework or build step required.

## HTML Attributes

These are the attributes you place on your own elements to control behaviour. All attribute names follow the `data-de-aria-*` convention.

### `data-de-aria-text=true`

Marks an element as text, meant to be tabbed and read only, not interacted with. This is for elements that are focusable but shouldn't be triggered by key presses, for example a custom dropdown built with a `<details>` element where the summary should be focused but not "clicked" when the user presses the key.

Should be added with tabindex="0" for it to function properly, screen-readers will correctly read this as a textual element.

```html
<details>
    <summary data-de-aria-text="true" tabindex="0">Choose an option</summary>
    <ul>
        <li><a href="/option1" data-de-aria-key="1">Option 1</a></li>
        <li><a href="/option2" data-de-aria-key="2">Option 2</a></li>
    </ul>
</details>
```

### `data-de-aria-key`

**Required on every interactive element.**

The key code for keydown (with ignored case) that the user presses (while hints are visible) to trigger that element. Case-insensitive — always stored and matched in lower-case internally.

```html
<button data-de-aria-key="s">Save</button>
<a href="/help" data-de-aria-key="h">Help</a>
<input type="text" data-de-aria-key="n" placeholder="Name">
```

If omitted, the library falls back to the first character of the element's `textContent` and logs a warning.

---

### `data-de-aria-key-label`

**Optional.** Overrides the character shown on the visual badge indicator.

Useful when the displayed letter should differ from the trigger key (e.g. the key is `Escape` but you want the badge to show `Esc`).

```html
<button data-de-aria-key="s" data-de-aria-key-label="S">Save</button>
```

Defaults to the upper-cased value of `data-de-aria-key`.

---

### `data-de-aria-action`

**Optional.** Overrides the default action taken when the key is pressed.

| Value | Behaviour |
|---|---|
| *(omitted)* | Inferred from element type (see below) |
| `click` | Calls `.click()` |
| `focus` | Calls `.focus()` |
| `play` | Toggles `.play()` / `.pause()` on media elements |
| `none` | No action taken, useful for elements that should not respond to key presses for example a modal dialog with escape handled already as a keydown but also a button available |

**Default inference rules (when omitted):**

- `button`, `a`, `summary`, clickable `input` types (`checkbox`, `radio`, `submit`, `button`, `reset`, `image`) → `click`
- `input` (text types), `textarea`, `select`, `iframe`, `[contenteditable]` → `focus`
- `audio`, `video` → `play`/`pause` toggle
- Anything else → `focus`

```html
<audio controls data-de-aria-key="p" data-de-aria-action="play" src="..."></audio>
```

---

### `data-de-aria-offset-x` / `data-de-aria-offset-y`

**Optional.** Translates the badge indicator by the given amount via CSS `transform: translate(x, y)`. Accepts any valid CSS length unit (`px`, `em`, `%`, etc.).

```html
<a href="#" data-de-aria-key="h" data-de-aria-offset-x="-1em" data-de-aria-offset-y="1.5em">Help</a>
```

Both default to `0` if only one axis is specified.

---

### `data-de-aria-horizontal-alignment`

**Optional.** Controls where the badge indicator is anchored horizontally relative to the element. Honours writing direction (`start` and `end` flip in RTL).

| Value | Position |
|---|---|
| `end-inside` *(default)* | Flush against the trailing edge of the element, **inside** its bounding box (right edge in LTR, left in RTL) |
| `end-outside` | Just past the trailing edge of the element, **outside** its bounding box |
| `center` | Horizontally centered on the element |
| `start-inside` | Flush against the leading edge of the element, **inside** its bounding box (left edge in LTR, right in RTL) |
| `start-outside` | Just past the leading edge of the element, **outside** its bounding box |

```html
<button data-de-aria-key="s" data-de-aria-horizontal-alignment="start-outside">Save</button>
```

---

### `data-de-aria-vertical-alignment`

**Optional.** Controls where the badge indicator is anchored vertically relative to the element.

| Value | Position |
|---|---|
| `top-inside` *(default)* | Flush against the top edge of the element, **inside** its bounding box |
| `top-outside` | Just above the top edge of the element, **outside** its bounding box |
| `middle` | Vertically centered on the element |
| `bottom-inside` | Flush against the bottom edge of the element, **inside** its bounding box |
| `bottom-outside` | Just below the bottom edge of the element, **outside** its bounding box |

```html
<button data-de-aria-key="s" data-de-aria-vertical-alignment="bottom-outside">Save</button>
```

Combine with `data-de-aria-horizontal-alignment` and `data-de-aria-offset-x` / `data-de-aria-offset-y` for fine-grained control over badge placement.

---

### `data-de-aria-indicator-class`

**Optional.** Extra CSS class(es) added to the badge indicator `<span>` for this specific element, in addition to the base `de-aria-key-indicator` class. Useful for per-element styling overrides.

```html
<button data-de-aria-key="d" data-de-aria-indicator-class="danger-badge">Delete</button>
```

---

### `data-de-aria-scroller-class`

**Optional. Place on a `[data-de-aria-role="scroller"]` element.** Extra CSS class(es) added to the scroller overlay box, in addition to the base `de-aria-scroller` class.

```html
<div data-de-aria-role="scroller" data-de-aria-scroller-class="my-scroll-overlay">...</div>
```

---

### `data-de-aria-role="scroller"`

Marks an element as the scrollable region. The library finds the first accessible element with this attribute and shows the arrow-key overlay on top of it.

The element must also be actually scrollable (i.e. have `overflow: auto` or `overflow: scroll` and content that overflows).

```html
<div data-de-aria-role="scroller" style="overflow: auto; height: 300px;">
    <!-- scrollable content -->
</div>
```

Arrow directions are shown or hidden based on whether scrolling in that direction is currently possible. If neither axis is scrollable the overlay is not shown at all.

---

### `data-de-aria-group`

Groups represent a set of elements that are related to each other, webapps can get complex and have multiple elements for example a navigation bar can have multiple links, a paragraph can have multiple links, etc. de-aria allows to group these elements together and then allow the user to focus on the group and then enter the group to interact with the internal elements.

#### Dynamic groups

Dynamic groups are escapable, meaning that the user can enter the group and then exit the group to go back to the main flow of the application.

In the example below at first you can tab upon two elements, a paragraph and the div; the screenreader will read the paragraph and then read "Navigation Links, press enter to choose one", another tab will go back to the paragraph, but if you press enter on the div, the focus will shift to the first link and then you can tab through the links and then exit the group by pressing escape.

```html
<p data-de-aria-text="true" tabindex="0">This paragraph is tabbable and can be read by screenreaders, but if you enter the dynamic group below, the focus will shift to the group.</p>
<div data-de-aria-group="dynamic" tabindex="0" data-de-aria-key="g" aria-label="Navigation Links, press enter to choose one" role="group">
    <a href="/home" data-de-aria-key="h">Home</a>
    <a href="/about" data-de-aria-key="a">About</a>
    <a href="/contact" data-de-aria-key="c">Contact</a>
</div>
```

#### Dynamic groups, but text

A dynamic group that doesn't need an aria label because it is already a text element

In this example below at first you can tab upon two elements, a paragraph and the p; the screenreader will read the paragraph and then read "If you need help, please contact us at Contact or visit our Help page.", another tab will go back to the paragraph, but if you press enter on the p, the focus will shift to the first link and then you can tab through the links and then exit the group by pressing escape, so Contact and Help in that internal case.

```html
<p data-de-aria-text="true" tabindex="0">This paragraph is tabbable and can be read by screenreaders, but if you enter the dynamic group below, the focus will shift to the group.</p>
<p data-de-aria-group="dynamic" data-de-aria-text="true" tabindex="0">
    If you need help, please contact us at <a href="/contact" data-de-aria-key="c">Contact</a> or visit our <a href="/help" data-de-aria-key="h">Help</a> page.
</p>
```

#### Static groups

Static groups are mostly used for pop-in dialogs or other layers, like a modal dialog or an overlay. These groups are not escapable, meaning that the user cannot exit the group to go back to the main flow of the application.

By default however the group is not active unless data-de-aria-group-active is set, this is a html boolean and does not have to be set to true or false, just the presence of the attribute is enough to make the group active.

A static group should not have a tabindex, since it is not meant to be focused, but rather acts like a focus trap.

```html
<p data-de-aria-text="true" tabindex="0">This paragraph is not tabbable because the focus trap is active.</p>
<div data-de-aria-group="static" data-de-aria-group-active role="group">
    <h2 data-de-aria-text="true" tabindex="0">Focus Trap</h2>
    <p data-de-aria-text="true" tabindex="0">This is a focus trap. You cannot exit this group until you close the trap.</p>
    <button data-de-aria-key="c">Close Trap</button>
</div>
<p data-de-aria-text="true" tabindex="0">This paragraph is also not tabbable because the focus trap is active.</p>
```

#### Which group is currently active?

If two groups are active, the library will use the last deepest one in the DOM tree, this allows for nested active groups.

---

## Styling

All visual elements are plain DOM nodes with stable CSS classes. None of the base styles are injected by the library — you provide them entirely.

### Badge indicator: `.de-aria-key-indicator`

A `<span>` appended to `<body>`, positioned with `position: fixed` adjacent to the marked element's bounding box. The badge sits on the **trailing edge** of the element (right for LTR, left for RTL).

```css
.de-aria-key-indicator {
    background: #222;
    color: #ffd54a;
    font-weight: bold;
    font-size: 0.85rem;
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid #ffd54a;
    font-family: ui-monospace, monospace;
    pointer-events: none;
    z-index: 9999;
}
```

Additional data attributes available for CSS hooks:

| Attribute | Values | Description |
|---|---|---|
| `data-de-aria-direction` | `ltr` \| `rtl` | Writing direction of the source element |
| `data-de-aria-indicator-for` | key character | The trigger key this badge belongs to |

### Marked elements: `.de-aria-marked`

Added to every interactive element while hints are visible. Use this to show a highlight ring or similar.

```css
.de-aria-marked {
    outline: 2px dashed #ffd54a;
    outline-offset: 2px;
}
```

### Scroller overlay: `.de-aria-scroller`

A `<div>` appended to `<body>`, centered over the scrollable element. Uses CSS grid internally. `pointer-events: none` is set inline.

```css
.de-aria-scroller {
    background: rgba(0, 0, 0, 0.65);
    border: 2px solid #ffd54a;
    border-radius: 12px;
    z-index: 9999;
}
```

### Scroller arrows: `.de-aria-scroller-arrow`

Individual directional arrow `<div>`s inside the overlay. Each also has a directional class.

```css
.de-aria-scroller-arrow {
    color: #ffd54a;
    font-size: 1.2rem;
    text-shadow: 0 1px 2px black;
}

/* Per-direction overrides */
.de-aria-scroller-arrow-up    { }
.de-aria-scroller-arrow-down  { }
.de-aria-scroller-arrow-left  { }
.de-aria-scroller-arrow-right { }
```

Arrows whose direction is not currently scrollable are hidden via `visibility: hidden` (preserving layout) or `display: none` (when the entire axis is inactive).

### Marked scroller element: `.de-aria-scroll-marked`

Added to the `[data-de-aria-role="scroller"]` element itself while the overlay is active.

```css
.de-aria-scroll-marked {
    outline: 2px solid #ffd54a;
}
```

---

## Shadow DOM Support

The library allows to pierce the shadow DOM so as long as the root is exposed inside the property of `.shadowRoot` or `.root`

## Stylesheets in Shadow DOM

The library supports piercing stylesheets in shadow DOM. To do this, add the `data-de-aria-stylesheet="true"` attribute to any `<link rel="stylesheet">` element you want to be supported in shadow DOM. The library will find these, construct new `CSSStyleSheet` instances from their rules, and adopt them into shadow roots when accessibility hints are shown.

## Accessibility & Layering

The library respects the standard browser accessibility tree. An element is considered interactive only if it passes all of these checks:

- Not `disabled`
- Not `aria-hidden="true"`
- Not a negative `tabindex`
- No ancestor with `inert`, `hidden`, `display: none`, or `visibility: hidden/collapse`
- Has a layout box (not detached), unless `position: fixed`

This means that when a modal dialog is open and you set `inert` on the background, only the dialog's elements will receive hint badges — the background is automatically excluded with no extra configuration needed.

```js
// On open: make everything behind the dialog inert
document.getElementById('app').inert = true;

// On close: restore
document.getElementById('app').inert = false;
```
