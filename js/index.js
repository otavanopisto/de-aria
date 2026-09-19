const FOCUSABLE_SELECTOR_NO_TABINDEX = [
    "a[href]",
    "button",
    "input",
    "select",
    "textarea",
    "audio[controls]",
    "video[controls]",
    "iframe",
    "summary",
    "[contenteditable]:not([contenteditable='false'])",
].join(",");

const FOCUSABLE_SELECTOR = FOCUSABLE_SELECTOR_NO_TABINDEX + "," + "[tabindex]";

const DE_ARIA_GROUP_ROLES = new Set(["group", "dialog", "alertdialog"]);

/**
 *
 * @param {Element} el 
 * @returns {boolean}
 */
function isAccessible(el) {
    if (el.hasAttribute("disabled")) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    // @ts-ignore
    if (el.dataset.deAriaText === "true") return false;
    // @ts-ignore
    // if (!el.dataset.deAriaRole && typeof el.tabIndex === "number" && el.tabIndex < 0) return false;

    // Walk up the tree checking for inert / hidden ancestors, crossing shadow root boundaries.
    // @ts-ignore
    for (let node = el; node && node !== document; node = node.parentNode) {
        // Cross shadow root boundaries: shadowRoot.parentNode is null, so jump to the host.
        if (node.nodeType === 11 /* DOCUMENT_FRAGMENT_NODE */) {
            // @ts-ignore
            node = node.host;
        }
        if (node.nodeType !== 1) continue;
        // @ts-ignore
        if (node.inert) return false;
        if (node.hasAttribute("hidden")) return false;
        const style = getComputedStyle(node);
        if (style.display === "none") return false;
        if (style.visibility === "hidden" || style.visibility === "collapse") return false;
    }

    return true;
}

/**
 * @param {any} root 
 * @param {string} selector
 * @param {string} [excludeParentSelector]
 * @returns {HTMLElement[]}
 */
function getAllElementsListBySelector(root, selector, excludeParentSelector) {
    /** @type {HTMLElement[]} */
    const foundElements = [];
    const visited = new Set();

    /**
     * Return the children at this position in the composed tree. A host's
     * exposed shadow root replaces its light-DOM children, and a slot is
     * replaced by its assigned nodes (or its fallback children).
     * @param {any} node
     * @returns {Node[]}
     */
    function getComposedChildren(node) {
        if (node?.nodeType === 1 /* ELEMENT_NODE */) {
            const el = /** @type {HTMLElement} */ (node);

            if (el.localName === "slot" && typeof /** @type {any} */ (el).assignedNodes === "function") {
                const assignedNodes = /** @type {any} */ (el).assignedNodes({ flatten: true });
                return assignedNodes.length ? Array.from(assignedNodes) : Array.from(el.childNodes);
            }

            const exposedRoot = /** @type {any} */ (el).shadowRoot || /** @type {any} */ (el).root;
            if (exposedRoot && exposedRoot !== el && exposedRoot.childNodes) {
                return Array.from(exposedRoot.childNodes);
            }
        }

        return node?.childNodes ? Array.from(node.childNodes) : [];
    }

    /**
     * @param {Node} node
     */
    function visit(node) {
        if (visited.has(node)) return;
        visited.add(node);

        if (node.nodeType !== 1 /* ELEMENT_NODE */) {
            for (const child of getComposedChildren(node)) {
                visit(child);
            }
            return;
        }

        const el = /** @type {HTMLElement} */ (node);

        if (el.matches(selector)) {
            foundElements.push(el);
        }

        const excludesChildren = Boolean(excludeParentSelector && el.matches(excludeParentSelector));
        if (excludesChildren) return;

        for (const child of getComposedChildren(el)) {
            visit(child);
        }
    }

    // The supplied root is a traversal boundary, not a candidate result or an
    // excluded parent. This lets callers inspect inside a group while still
    // excluding any nested groups.
    for (const child of getComposedChildren(root)) {
        visit(child);
    }

    return foundElements;
}

/**
 * Gets a specific element by selector, piercing shadow roots. Returns the first found matching element found in the DOM tree, or null if none is found.
 * 
 * Order is not guaranteed against shadowroots, so if multiple elements match the selector, the first one found may be in a shadow root or in the light DOM.
 * 
 * @param {any} root 
 * @param {string} selector 
 * @returns {HTMLElement | null}
 */
function getSpecificElementBySelector(root, selector) {
    const foundHere = root.querySelector(selector);
    if (foundHere) return foundHere;

    const elementsWithShadowRoots = Array.from(root.querySelectorAll("*"));
    for (const el of elementsWithShadowRoots) {
        if (el.shadowRoot || el.root) {
            const foundAtShadow = getSpecificElementBySelector(el.shadowRoot || el.root, selector);
            if (foundAtShadow) return foundAtShadow;
        }
    }
    return null;
}

/**
 * Gets a specific element by selector, traversing the composed tree through
 * exposed shadow roots and slots. Returns the last matching element in that
 * order, or null if none is found.
 * 
 * @param {any} root 
 * @param {string} selector 
 * @returns {HTMLElement | null}
 */
function getSpecificElementBySelectorLast(root, selector) {
    const matchingElements = getAllElementsListBySelector(root, selector);
    return matchingElements.length ? matchingElements[matchingElements.length - 1] : null;
}

/**
 * Returns the deepest focused element, piercing shadow roots.
 * `document.activeElement` stops at the shadow host; this walks into
 * each shadow root's activeElement until there is no deeper one.
 * @returns {Element | null}
 */
function getDeepActiveElement() {
    let el = document.activeElement;
    while (el) {
        const shadow = /** @type {any} */ (el).shadowRoot || /** @type {any} */ (el).root;
        if (shadow && shadow.activeElement) {
            el = shadow.activeElement;
        } else {
            break;
        }
    }
    return el;
}

/**
 * @param {Document | HTMLElement} root 
 */
function warnAboutInvalids(root) {
    // look for elements with data-de-aria-key but does not match a focusable element, and warn about them
    const potentiallyInvalidElements = getAllElementsListBySelector(root, "[data-de-aria-key]");
    for (const el of potentiallyInvalidElements) {
        if (el.matches(FOCUSABLE_SELECTOR)) continue;
        console.warn(el, `Element ${el.tagName} has data-de-aria-key but is not a focusable element. Consider adding a focusable role or removing the data-de-aria-key attribute.`);
    }

    const potentiallyInvalidElements2 = getAllElementsListBySelector(root, "[data-de-aria-action]");
    for (const el of potentiallyInvalidElements2) {
        if (el.matches(FOCUSABLE_SELECTOR)) continue;
        console.warn(el, `Element ${el.tagName} has data-de-aria-action but is not a focusable element. Consider adding a focusable role or removing the data-de-aria-action attribute.`);
    }

    const potentiallyInvalidElements3GroupsInside = getAllElementsListBySelector(root, "[data-de-aria-group]");
    for (const el of potentiallyInvalidElements3GroupsInside) {
        if (!el.dataset.deAriaKey && el.dataset.deAriaGroup !== "static" && el.dataset.deAriaText !== "true") {
            console.warn(el, `Element ${el.tagName} has data-de-aria-group but is missing data-de-aria-key and is not a static group nor a text element with data-de-aria-text="true". Consider adding a data-de-aria-key attribute to the element or setting data-de-aria-group="static" to indicate that it is a static group or marking it as text with data-de-aria-text="true".`);
        }
        if (!el.ariaLabel && el.dataset.deAriaGroup !== "static" && el.dataset.deAriaText !== "true") {
            console.warn(el, `Element ${el.tagName} has data-de-aria-group but is missing an aria-label and is not a static group nor a text element with data-de-aria-text="true". Consider adding an aria-label attribute to the element or setting data-de-aria-group="static" to indicate that it is a static group or marking it as text with data-de-aria-text="true".`);
        }
        if (!el.matches(FOCUSABLE_SELECTOR) && el.dataset.deAriaGroup !== "static") {
            console.warn(el, `Element ${el.tagName} has data-de-aria-group but is not a focusable element. Consider adding a focusable role or removing the data-de-aria-group attribute or setting data-de-aria-group="static" to indicate that it is a static group.`);
        }
        if (el.dataset.deAriaGroup === "static" && el.dataset.deAriaKey) {
            console.warn(el, `Element ${el.tagName} has data-de-aria-group="static" but also has a data-de-aria-key attribute. Consider removing the data-de-aria-key attribute or setting data-de-aria-group to dynamic value.`);
        }
        if (el.dataset.deAriaGroup === "static" && el.dataset.deAriaText === "true") {
            console.warn(el, `Element ${el.tagName} has data-de-aria-group="static" but also has data-de-aria-text="true". Consider removing the data-de-aria-text attribute or setting data-de-aria-group to dynamic value.`);
        }
        const role = el.getAttribute("role")?.trim().toLowerCase() || "";
        if (el.dataset.deAriaGroup && el.dataset.deAriaText !== "true" && !DE_ARIA_GROUP_ROLES.has(role)) {
            console.warn(el, `Element ${el.tagName} has data-de-aria-group but does not use role="group", role="dialog", or role="alertdialog", and it is not a text element with data-de-aria-text="true". Consider adding the role that matches the element's purpose.`);
        }
    }
}

function showAccessibility() {
    warnAboutInvalids(document);

    showAccessibilityFocusables(document);

    const scroller = getAllElementsListBySelector(document, '[data-de-aria-role="scroller"]')
        .find(isAccessible) || null;

    if (scroller) {
        // @ts-ignore
        markScrollerElement(scroller);
    }
}

/**
 * @param {Document | HTMLElement} parent 
 */
function showAccessibilityFocusables(parent) {
    const focusable = getAllElementsListBySelector(parent, FOCUSABLE_SELECTOR, "[data-de-aria-group]")
        .filter(isAccessible);
    
    for (const el of focusable) {
        // @ts-ignore
        markFocusableElement(el);
    }

    handleDuplicates(focusable);
}

/**
 * @param {HTMLElement[]} focusableElements 
 */
function handleDuplicates(focusableElements) {
    /** @type {Record<string, HTMLElement[]>} */
    const keyMap = {};

    for (const el of focusableElements) {
        const key = el.dataset.deAriaKeyUsed;
        if (!key) continue;
        if (!keyMap[key]) keyMap[key] = [];
        keyMap[key].push(el);
    }

    for (const [key, elements] of Object.entries(keyMap)) {
        if (elements.length <= 1) continue;
        // If multiple elements share the same key, append a nesting number to the key label of each element to differentiate them.
        // the number must be zero padded to ensure no overlap between "Button 1" and "Button 11" for example.
        elements.forEach((el, index) => {
            const label = el.dataset.deAriaKeyLabelUsedOriginal;
            const assignedNumber = String(index + 1).padStart(String(elements.length).length, "0");
            if (label?.length === 1) {
                el.dataset.deAriaKeyLabelUsed = `${label}${assignedNumber}`;
            } else {
                el.dataset.deAriaKeyLabelUsed = `${label}+${assignedNumber}`;
            }

            el.dataset.deAriaKeyNestUsed = assignedNumber;

            // now update the indicator text if it exist with the new label
            const indicator = getSpecificElementBySelector(document, `.de-aria-key-indicator[data-de-aria-indicator-for="${el.dataset.deAriaId}"]`);
            if (indicator) {
                indicator.textContent = el.dataset.deAriaKeyLabelUsed;
            }
        });
    }
}

/**
 * Walk up the DOM from `el` (crossing shadow root boundaries) and return the
 * intersection of all clipping ancestors' bounding rects in viewport coords.
 * Returns null if no clipping ancestor is found (no clip needed).
 * @param {HTMLElement} el
 * @returns {{ top: number, right: number, bottom: number, left: number } | null}
 */
function getClippingRect(el) {
    let clip = { top: 0, right: window.innerWidth, bottom: window.innerHeight, left: 0 };
    let found = false;

    /** @type {any} */
    let node = el.parentNode;
    while (node && node !== document) {
        // Cross shadow root boundaries
        if (node.nodeType === 11 /* DOCUMENT_FRAGMENT_NODE */) {
            node = node.host;
            continue;
        }
        if (node.nodeType !== 1) {
            node = node.parentNode;
            continue;
        }

        const style = getComputedStyle(node);
        const overflow = style.overflow + " " + style.overflowX + " " + style.overflowY;
        const clips = overflow.includes("hidden") || overflow.includes("auto") || overflow.includes("scroll") || overflow.includes("clip");

        if (clips) {
            const r = node.getBoundingClientRect();
            clip.top    = Math.max(clip.top,    r.top);
            clip.right  = Math.min(clip.right,  r.right);
            clip.bottom = Math.min(clip.bottom, r.bottom);
            clip.left   = Math.max(clip.left,   r.left);
            found = true;
        }

        node = node.parentNode;
    }

    return found ? clip : null;
}

/**
 * @param {HTMLElement} el 
 */
function markFocusableElement(el) {
    const keyToUse = el.dataset.deAriaKey?.toLowerCase() || el.textContent?.trim()?.[0]?.toLowerCase() || "?";
    const keyToUseLabel = (el.dataset.deAriaKeyLabel || keyToUse.toUpperCase());

    if (!el.dataset.deAriaKey) {
        console.warn(`Element ${el.tagName} is missing data-de-aria-key attribute, using "${keyToUse}" as fallback. Consider adding a specific key for better accessibility.`);
    }

    const randomId = Math.random().toString(36).slice(2);

    el.classList.add("de-aria-marked");
    el.setAttribute("data-de-aria-key-used", keyToUse);
    el.setAttribute("data-de-aria-next-key-to-trigger", keyToUse);
    el.setAttribute("data-de-aria-key-label-used", keyToUseLabel);
    el.setAttribute("data-de-aria-key-label-used-original", keyToUseLabel);
    el.setAttribute("data-de-aria-key-nest-used", "");
    el.setAttribute("data-de-aria-id", randomId);

    // these offset values can come in any unit (e.g. "10px", "1em", "5%") and should be applied as CSS variables in the stylesheet to position the key indicators accordingly
    let offsetX = el.dataset.deAriaOffsetX;
    const offsetY = el.dataset.deAriaOffsetY;

    // Determine writing direction so the indicator sits on the trailing edge of the element.
    const direction = getComputedStyle(el).direction === "rtl" ? "rtl" : "ltr";

    const indicator = document.createElement("span");
    indicator.className = `${el.dataset.deAriaIndicatorClass || ""} de-aria-key-indicator`.trim();
    indicator.setAttribute("aria-hidden", "true");
    indicator.dataset.deAriaIndicatorFor = randomId;
    indicator.dataset.deAriaDirection = direction;
    indicator.textContent = keyToUseLabel;

    const position = el.dataset.deAriaHorizontalAlignment || "end-inside";
    const positionV = el.dataset.deAriaVerticalAlignment || "top-inside";

    // Append next to the element first, so the indicator gets an offsetParent
    // we can use as its containing block. With position:absolute the parent's
    // overflow:hidden naturally clips the indicator visually — no clip-path
    // needed — while the indicator stays in the DOM so key triggering still
    // works even when it isn't visible.
    indicator.style.position = "absolute";
    indicator.style.visibility = "hidden"; // hide until positioned to avoid flash
    (el.parentElement || document.body).appendChild(indicator);

    if (el.parentElement) {
        // check that the position is relative or absolute, if not emit a warning that the indicator may be misaligned and suggest adding `position: relative` to the parent element or using `data-de-aria-indicator-class` to specify a custom class for better control over indicator positioning
        const parentStyle = getComputedStyle(el.parentElement);
        if (parentStyle.position !== "relative" && parentStyle.position !== "absolute" && parentStyle.position !== "fixed" && parentStyle.position !== "sticky") {
            console.error(`Parent element of ${el.tagName} with data-de-aria-key should have position: relative, absolute, fixed, or sticky for correct indicator alignment. Consider adding "position: relative" to the parent`);
            console.log("Parent element:", el.parentElement);
        }
    }

    // The containing block for an absolutely-positioned element is its
    // offsetParent's padding edge (or the initial containing block if none).
    /** @type {HTMLElement} */
    // @ts-ignore
    const cb = indicator.offsetParent || document.body;

    if (!indicator.offsetParent) {
        console.error(`Indicator for ${el.tagName} with data-de-aria-key is not in the DOM or has no offsetParent. This most certainly will cause misalignment, if the element is in a shadow root, consider giving it a parent container`);
        console.log("Element:", el.parentElement);
    }

    const cbRect = cb.getBoundingClientRect();
    const cbWidth = cb.clientWidth;
    const cbHeight = cb.clientHeight;

    // Convert the element's viewport-space rect into the containing block's
    // coordinate space (origin = top-left of unscrolled content of cb).
    const rect = el.getBoundingClientRect();
    const elTop    = rect.top - cbRect.top;
    const elLeft   = rect.left - cbRect.left;
    const elBottom = elTop  + rect.height;
    const elRight  = elLeft + rect.width;

    if (positionV === "top-inside") {
        indicator.style.top = `${elTop}px`;
    } else if (positionV === "top-outside") {
        indicator.style.bottom = `${cbHeight - elTop}px`;
    } else if (positionV === "bottom-inside") {
        indicator.style.bottom = `${cbHeight - elBottom}px`;
    } else if (positionV === "bottom-outside") {
        indicator.style.top = `${elBottom}px`;
    } else if (positionV === "middle") {
        // Centre by placing the top edge at the element's vertical centre minus
        // half the indicator's own height (measured now that it is in the DOM).
        indicator.style.top = `${(elTop + elBottom) / 2 - indicator.offsetHeight / 2}px`;
        indicator.style.marginTop = "0px";
        indicator.style.marginBottom = "0px";
    }

    if (direction === "rtl" && offsetX) {
        offsetX = `calc(-1 * ${offsetX})`;
    }

    if (position === "center") {
        // Centre by placing the left edge at the element's horizontal centre minus
        // half the indicator's own width (measured now that it is in the DOM).
        indicator.style.left = `${(elLeft + elRight) / 2 - indicator.offsetWidth / 2}px`;
        indicator.style.marginLeft = "0px";
        indicator.style.marginRight = "0px";
    } else if (direction === "rtl") {
        if (position === "end-inside") {
            indicator.style.left = `${elLeft}px`;
        } else if (position === "end-outside") {
            indicator.style.right = `${cbWidth - elLeft}px`;
        } else if (position === "start-inside") {
            indicator.style.right = `${cbWidth - elRight}px`;
        } else if (position === "start-outside") {
            indicator.style.left = `${elRight}px`;
        }
    } else {
        if (position === "end-inside") {
            indicator.style.right = `${cbWidth - elRight}px`;
        } else if (position === "end-outside") {
            indicator.style.left = `${elRight}px`;
        } else if (position === "start-inside") {
            indicator.style.left = `${elLeft}px`;
        } else if (position === "start-outside") {
            indicator.style.right = `${cbWidth - elLeft}px`;
        }
    }

    if (offsetX || offsetY) {
        indicator.style.transform = `translate(${offsetX || "0"}, ${offsetY || "0"})`;
    }

    indicator.style.visibility = "";
}

/**
 * @param {HTMLElement} el 
 */
function triggerFocusableElement(el) {

    if (el.dataset.deAriaKeyNestUsed) {
        // If this element is part of a nested group, trigger the next element in the group instead of this one.
        const nextNestNumber = el.dataset.deAriaKeyNestUsed[0];
        const newNestNumber = el.dataset.deAriaKeyNestUsed.slice(1);

        el.dataset.deAriaKeyNestUsed = newNestNumber;
        el.dataset.deAriaNextKeyToTrigger = nextNestNumber;

        const indicator = getSpecificElementBySelector(document, `.de-aria-key-indicator[data-de-aria-indicator-for="${el.dataset.deAriaId}"]`);
        if (indicator) {
            indicator.textContent = nextNestNumber + newNestNumber;
        }
        return {continueAccessibility: true, continueAccessibilityOnGroup: null, ranFocus: false};
    }

    const action = el.dataset.deAriaAction || "default";

    if (action === "none") {
        return {continueAccessibility: false, continueAccessibilityOnGroup: null, ranFocus: false};
    }

    if (action === "click" || action === "default" && isClickable(el)) {
        el.click();
        return {continueAccessibility: false, continueAccessibilityOnGroup: null, ranFocus: false};
    }

    if (action === "focus" || action === "default" && isFocusInput(el)) {
        el.focus();
        return {continueAccessibility: false, continueAccessibilityOnGroup: null, ranFocus: true};
    }

    if (action === "play" || action === "default" && isMedia(el)) {
        const media = /** @type {HTMLMediaElement} */ (el);
        if (media.paused) media.play();
        else media.pause();
        return {continueAccessibility: false, continueAccessibilityOnGroup: null, ranFocus: false};
    }

    if (typeof el.dataset.deAriaGroup !== "undefined") {
        // if this element represents a group, then show the accessibility within it
        return {continueAccessibility: false, continueAccessibilityOnGroup: el, ranFocus: false};
    } else {
        // Final fallback for "default" — just focus the element.
        el.focus();

        return {continueAccessibility: false, continueAccessibilityOnGroup: null, ranFocus: true};
    }
}

/**
 * @param {HTMLElement} el
 * @returns {boolean}
 */
function isClickable(el) {
    if (el.tagName === "BUTTON" || el.getAttribute("role") === "button") return true;
    if (el.tagName === "A" || el.getAttribute("role") === "link") return true;
    if (el.tagName === "SUMMARY") return true;
    if (el.tagName === "INPUT") {
        const type = /** @type {HTMLInputElement} */ (el).type;
        return type === "checkbox" || type === "radio" || type === "submit" || type === "button" || type === "reset" || type === "image";
    }
    if (el.dataset.deAriaAction === "click") return true;
    return false;
}

/**
 * Returns whether the browser already provides keyboard activation for this
 * element. Calling `.click()` for Enter or Space on these elements would run
 * their action in addition to the browser's native activation.
 * @param {HTMLElement} el
 * @returns {boolean}
 */
function hasNativeKeyboardActivation(el) {
    if (el.tagName === "BUTTON" || el.tagName === "SUMMARY") return true;
    if (el.tagName === "A" && el.hasAttribute("href")) return true;
    if (el.tagName === "INPUT") {
        const type = /** @type {HTMLInputElement} */ (el).type;
        return type === "checkbox" || type === "radio" || type === "submit" || type === "button" || type === "reset" || type === "image";
    }
    return false;
}

/**
 * @param {HTMLElement} el
 * @returns {boolean}
 */
function isFocusInput(el) {
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.tagName === "IFRAME") return true;
    if (el.isContentEditable) return true;
    return false;
}

/**
 * @param {HTMLElement} el
 * @returns {boolean}
 */
function isMedia(el) {
    return el.tagName === "AUDIO" || el.tagName === "VIDEO";
}

/**
 * @param {HTMLElement} el 
 */
function markScrollerElement(el) {
    el.classList.add("de-aria-scroll-marked");

    // Reuse the existing overlay box if this element has already been marked, otherwise build it.
    /** @type {HTMLElement | null} */
    let box = getSpecificElementBySelector(document, ".de-aria-scroller");
    if (!box) {
        box = document.createElement("div");
        box.className = `${el.dataset.deAriaScrollerClass || ""} de-aria-scroller`.trim();
        box.setAttribute("aria-hidden", "true");
        box.style.position = "fixed";
        box.style.pointerEvents = "none";
        box.style.display = "grid";
        box.style.gridTemplateColumns = "1fr 1fr 1fr";
        box.style.gridTemplateRows = "1fr 1fr 1fr";
        box.style.placeItems = "center";

        const directions = /** @type {const} */ ([
            ["up", "▲", { row: "1", col: "2" }],
            ["down", "▼", { row: "3", col: "2" }],
            ["left", "◀", { row: "2", col: "1" }],
            ["right", "▶", { row: "2", col: "3" }],
        ]);

        for (const [name, glyph, pos] of directions) {
            const arrow = document.createElement("div");
            arrow.className = `de-aria-scroller-arrow de-aria-scroller-arrow-${name}`;
            arrow.textContent = glyph;
            arrow.style.gridRow = pos.row;
            arrow.style.gridColumn = pos.col;
            box.appendChild(arrow);
        }

        document.body.appendChild(box);
    }

    // Determine what is currently scrollable in each direction.
    const canUp = el.scrollTop > 0;
    const canDown = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    const canLeft = el.scrollLeft > 0;
    const canRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;

    const hasVertical = canUp || canDown;
    const hasHorizontal = canLeft || canRight;

    // If nothing is scrollable in any direction, hide the box entirely.
    if (!hasVertical && !hasHorizontal) {
        box.style.display = "none";
        el.classList.remove("de-aria-scroll-marked");
        return;
    }

    // Collapse axes that have no scroll, so the box only shows the relevant axis.
    box.style.display = "grid";
    box.style.gridTemplateColumns = hasHorizontal ? "1fr 1fr 1fr" : "1fr";
    box.style.gridTemplateRows = hasVertical ? "1fr 1fr 1fr" : "1fr";

    // Centre the box over the scrollable area. Size is left to CSS (width/height/padding
    // on .de-aria-scroller, or on the user-supplied scroller class). We just anchor
    // the centre point and let CSS decide how big it is.
    const rect = el.getBoundingClientRect();
    box.style.left = `${rect.left + rect.width / 2}px`;
    box.style.top = `${rect.top + rect.height / 2}px`;
    box.style.transform = "translate(-50%, -50%)";

    // Toggle arrow visibility based on what is currently scrollable in each direction.
    /** @type {Record<string, { visible: boolean, row: string, col: string }>} */
    const layout = {
        up: { visible: canUp, row: "1", col: hasHorizontal ? "2" : "1" },
        down: { visible: canDown, row: hasVertical ? "3" : "1", col: hasHorizontal ? "2" : "1" },
        left: { visible: canLeft, row: hasVertical ? "2" : "1", col: "1" },
        right: { visible: canRight, row: hasVertical ? "2" : "1", col: hasHorizontal ? "3" : "1" },
    };
    for (const [name, info] of Object.entries(layout)) {
        const arrow = /** @type {HTMLElement | null} */ (
            box.querySelector(`.de-aria-scroller-arrow-${name}`)
        );
        if (!arrow) continue;
        // Use display:none for axis-collapsed arrows so they don't take grid space; visibility:hidden
        // for arrows on an active axis but currently not scrollable (keeps layout stable).
        const onActiveAxis = (name === "up" || name === "down") ? hasVertical : hasHorizontal;
        if (!onActiveAxis) {
            arrow.style.display = "none";
        } else {
            arrow.style.display = "";
            arrow.style.gridRow = info.row;
            arrow.style.gridColumn = info.col;
            arrow.style.visibility = info.visible ? "visible" : "hidden";
        }
    }
}

/**
 * @param {HTMLElement[]} preventHidingElements 
 */
function hideFocusableElements(preventHidingElements = []) {
    getAllElementsListBySelector(document, ".de-aria-marked").forEach(el => {
        if (preventHidingElements.includes(el)) return;

        const indicator = getSpecificElementBySelector(document, `.de-aria-key-indicator[data-de-aria-indicator-for="${el.dataset.deAriaId}"]`);
        if (indicator) indicator.remove();

        el.classList.remove("de-aria-marked");
        el.removeAttribute("data-de-aria-key-used");
        el.removeAttribute("data-de-aria-next-key-to-trigger");
        el.removeAttribute("data-de-aria-key-label-used");
        el.removeAttribute("data-de-aria-key-label-used-original");
        el.removeAttribute("data-de-aria-key-nest-used");
        el.removeAttribute("data-de-aria-id");
    });
    removeOrphanedIndicators();
}

export function removeOrphanedIndicators() {
    // In case some indicators are left orphaned (e.g. by a hot reload during development), remove them.
    getAllElementsListBySelector(document, ".de-aria-key-indicator").forEach(indicator => {
        const forId = indicator.dataset.deAriaIndicatorFor;
        if (!forId || !getSpecificElementBySelector(document, `[data-de-aria-id="${forId}"]`)) {
            indicator.remove();
        }
    });
}

function hideScroller() {
    getAllElementsListBySelector(document, ".de-aria-scroller").forEach(el => el.remove());
    getAllElementsListBySelector(document, ".de-aria-scroll-marked").forEach(el => el.classList.remove("de-aria-scroll-marked"));
}

/**
 * @param {HTMLElement[]} preventHidingElements 
 */
function hideAccessibility(preventHidingElements = []) {
    hideFocusableElements(preventHidingElements);
    if (preventHidingElements.length === 0) {
        hideScroller();
    }
}

/**
 * Tracks rAF watchers per scroller element so multiple scrollElement calls
 * (e.g. arrow key auto-repeat) don't create duplicate polling loops, and so
 * we don't rely on the flaky `scrollend` event with smooth scrolling.
 * @type {WeakMap<HTMLElement, number>}
 */
const SCROLLER_WATCH_FRAMES = new WeakMap();

/**
 * @param {HTMLElement} el 
 * @param {"ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight"} direction 
 */
function scrollElement(el, direction) {
    //hideFocusableElements();
    el.scrollBy({
        top: direction === "ArrowDown" ? 100 : direction === "ArrowUp" ? -100 : 0,
        left: direction === "ArrowRight" ? 100 : direction === "ArrowLeft" ? -100 : 0,
        behavior: "smooth",
    });

    // Cancel any prior watcher so we don't have multiple polling loops fighting.
    const existing = SCROLLER_WATCH_FRAMES.get(el);
    if (existing) cancelAnimationFrame(existing);

    // Poll with rAF until the scroll position stops changing for a few frames.
    // This is robust against interrupted smooth scrolls where `scrollend` is
    // unreliable across browsers.
    let lastTop = el.scrollTop;
    let lastLeft = el.scrollLeft;
    let stableFrames = 0;
    const STABLE_FRAMES_NEEDED = 3;

    const tick = () => {
        // Re-mark every frame so the box reflects current scrollability in real time.
        markScrollerElement(el);

        //hideFocusableElements();
        //showAccessibilityFocusables();

        const currentTop = el.scrollTop;
        const currentLeft = el.scrollLeft;
        if (currentTop === lastTop && currentLeft === lastLeft) {
            stableFrames++;
        } else {
            stableFrames = 0;
            lastTop = currentTop;
            lastLeft = currentLeft;
        }

        if (stableFrames >= STABLE_FRAMES_NEEDED) {
            SCROLLER_WATCH_FRAMES.delete(el);
            return;
        }

        SCROLLER_WATCH_FRAMES.set(el, requestAnimationFrame(tick));
    };
    SCROLLER_WATCH_FRAMES.set(el, requestAnimationFrame(tick));
}

document.addEventListener("DOMContentLoaded", () => {

    let lastKeyDownAccessibilityVisible = false;
    /**
     * @type {string | null}
     */
    let lastKeyDown = null;

    const arrowKeys = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

    document.addEventListener("keydown", (e) => {
        const isAccessibilityVisible = getSpecificElementBySelector(document, ".de-aria-key-indicator") !== null || getSpecificElementBySelector(document, ".de-aria-scroll-marked") !== null;
        if (e.key === "Control") {
            makeShadowRootsAdoptAccessibilityStyles(figureConstructedSheets(), document);
        }

        lastKeyDownAccessibilityVisible = isAccessibilityVisible;
        lastKeyDown = e.key;

        const currentlyFocused = getDeepActiveElement();

        // get all the html elements that have the attribute data-de-aria-key-used equal to the pressed key
        const matchingElements = getAllElementsListBySelector(document, `[data-de-aria-next-key-to-trigger="${e.key.toLowerCase()}"]`);

        let accessibilityContinuesIntoNested = false;
        /**
         * @type {HTMLElement | null}
         */
        let accessibilityContinuesOnGroup = null;
        let shouldPreventDefault = false;
        let shouldStopPropagation = false;
        if (matchingElements) {
            for (const el of matchingElements) {
                const triggerInfo = triggerFocusableElement(el);
                if (triggerInfo.continueAccessibility) {
                    accessibilityContinuesIntoNested = true;
                }
                if (triggerInfo.continueAccessibilityOnGroup) {
                    accessibilityContinuesOnGroup = triggerInfo.continueAccessibilityOnGroup;
                }
                if (triggerInfo.ranFocus || triggerInfo.continueAccessibility) {
                    shouldPreventDefault = true;
                    shouldStopPropagation = true;
                }
            }
        }

        if (shouldPreventDefault) {
            e.preventDefault();
        }
        if (shouldStopPropagation) {
            e.stopPropagation();
        }

        if (!arrowKeys.has(e.key)) {
            hideAccessibility(accessibilityContinuesIntoNested ? matchingElements : []);
        }

        if (accessibilityContinuesOnGroup) {
            showAccessibilityFocusables(accessibilityContinuesOnGroup);
        }

        const currentScroller = getSpecificElementBySelector(document, ".de-aria-scroll-marked");
        if (arrowKeys.has(e.key) && currentScroller) {
            // @ts-ignore
            scrollElement(currentScroller, e.key);
        }

        const isActivationKey = e.key === "Enter" || e.key === " ";
        const focusedIsDeAriaGroup = currentlyFocused && typeof currentlyFocused.dataset.deAriaGroup !== "undefined";

        if (
            currentlyFocused &&
            isActivationKey &&
            !focusedIsDeAriaGroup &&
            // @ts-ignore
            isClickable(currentlyFocused) &&
            // @ts-ignore
            !hasNativeKeyboardActivation(currentlyFocused)
        ) {
            e.preventDefault();
            // @ts-ignore
            currentlyFocused.click();
        }

        if (
            currentlyFocused &&
            isActivationKey &&
            focusedIsDeAriaGroup
        ) {
            const currentlyActiveDeAriaGroup = getSpecificElementBySelectorLast(document, `[data-de-aria-group-active]`);
            if (currentlyActiveDeAriaGroup !== currentlyFocused) {
                e.preventDefault();
                if (currentlyActiveDeAriaGroup) delete currentlyActiveDeAriaGroup.dataset.deAriaGroupActive;
                currentlyFocused.dataset.deAriaGroupActive = "";
                setTimeout(() => {
                    getSpecificElementBySelector(currentlyFocused, FOCUSABLE_SELECTOR)?.focus();
                }, 100);
            }
        }

        if (e.key === "Escape") {
            const currentlyActiveDeAriaGroup = getSpecificElementBySelectorLast(document, `[data-de-aria-group-active]`);
            if (currentlyActiveDeAriaGroup) {
                const isStatic = currentlyActiveDeAriaGroup.dataset.deAriaGroup === "static";
                if (!isStatic) {
                    delete currentlyActiveDeAriaGroup.dataset.deAriaGroupActive;
                    e.stopImmediatePropagation();
                    e.stopPropagation();
                    e.preventDefault();
                    currentlyActiveDeAriaGroup.focus();
                }
            }
        }
    }, { capture: true });

    document.addEventListener("keyup", (e) => {
        if (lastKeyDown === "Control" && !lastKeyDownAccessibilityVisible) {
            showAccessibility();
            e.stopImmediatePropagation();
            e.stopPropagation();
            e.preventDefault();
        }
    }, { capture: true });

    const mouseHideEvents = ["mousedown", "mouseup", "click", "contextmenu", "wheel", "pointerdown", "pointerup"];
    for (const event of mouseHideEvents) {
        document.addEventListener(event, hideAccessibility.bind(null, []), { passive: true });
    }
}, { once: true });

/**
 * @type {Record<string, CSSStyleSheet>}
 */
const CONSTRUCTED_SHEETS = {};
function figureConstructedSheets() {
    const sheets = Array.from(document.querySelectorAll("[data-de-aria-stylesheet=\"true\"]")).map(el => {
        // @ts-ignore
        return el.sheet;
    }).filter(sheet => sheet) /** @type {CSSStyleSheet[]} */;

    const finalSheets = [];
    for (const sheet of sheets) {
        if (!CONSTRUCTED_SHEETS[sheet.href]) {
            const constructedSheet = new CSSStyleSheet();
            const css = Array.from(sheet.cssRules)
                .map(rule => rule.cssText)
                .join('\n');
            constructedSheet.replaceSync(css);
            CONSTRUCTED_SHEETS[sheet.href] = constructedSheet;
        }
        finalSheets.push(CONSTRUCTED_SHEETS[sheet.href]);
    }

    return finalSheets;
}

/**
 * @param {CSSStyleSheet[]} sheets
 * @param {any} root 
 */
function makeShadowRootsAdoptAccessibilityStyles(sheets, root) {
    const elementsWithShadowRoots = root.querySelectorAll("*");
    for (const el of elementsWithShadowRoots) {
        if (el.shadowRoot || el.root) {
            const shadow = el.shadowRoot || el.root;
            for (const sheet of sheets) {
                if (shadow.adoptedStyleSheets && !shadow.adoptedStyleSheets.includes(sheet)) {
                    // @ts-ignore
                    shadow.adoptedStyleSheets = [...(shadow.adoptedStyleSheets || []), sheet];
                }
            }
            makeShadowRootsAdoptAccessibilityStyles(sheets, shadow);
        }
    }
}

/**
 * @param {Document | HTMLElement} root
 * @param {{
 *    groupActive: Document | HTMLElement,
 *    groupActiveUseInert: boolean
 * } | null} info
 */
function ensureConsistencyOfDOM(root, info = null) {
    if (!info) {
        const groupActive = getSpecificElementBySelectorLast(document, `[data-de-aria-group-active]`) || document;
        info = {
            groupActive: groupActive,
            // @ts-ignore
            groupActiveUseInert: groupActive !== document ? typeof groupActive.dataset.deAriaGroupUseInert !== "undefined" : false,
        };
    }

    // we do not filter here because we don't care if they are accessible or not
    // we want to disable all
    const focusableElements = getAllElementsListBySelector(root, FOCUSABLE_SELECTOR, "[data-de-aria-group]");

    const isActiveGroup = root === info.groupActive;

    for (const el of focusableElements) {
        if (isActiveGroup || info.groupActiveUseInert) {
            const expectedTabIndex = el.dataset.dataDeAriaGroupOriginalTabIndex ? Number(el.dataset.dataDeAriaGroupOriginalTabIndex) : (el.tabIndex >= 0 ? el.tabIndex : 0);
            if (el.tabIndex !== expectedTabIndex) {
                el.tabIndex = expectedTabIndex;
            }
        } else {
            const expectedTabIndex = -1;
            if (el.tabIndex !== expectedTabIndex) {
                el.dataset.dataDeAriaGroupOriginalTabIndex = String(el.tabIndex);
                el.tabIndex = -1;
            }
        }

        if (isActiveGroup || !info.groupActiveUseInert) {
            const expectedInert = el.dataset.dataDeAriaGroupOriginalInert === "true" ? true : false;
            if (el.inert !== expectedInert) {
                el.inert = expectedInert;
            }
        } else {
            const expectedInert = true;
            if (el.inert !== expectedInert) {
                el.dataset.dataDeAriaGroupOriginalInert = String(el.inert);
                if (el.textContent === "Failed to initialize the inference adapter. Please check your API key and host configuration, and ensure that your API key has the necessary permissions.") {
                    debugger;
                }
                el.inert = true;
            }
        }
    }

    const childGroups = getAllElementsListBySelector(root, "[data-de-aria-group]", "[data-de-aria-group]");

    for (const group of childGroups) {
        debugger;
        ensureConsistencyOfDOM(group, info);
    }
}

ensureConsistencyOfDOM(document);

/**
 * @param {MutationRecord[]} mutationsList
 */
function realMutationObserverCallback(mutationsList) {
    ensureConsistencyOfDOM(document);
}

/** @type {WeakSet<Node>} */
const observedRoots = new WeakSet();

const observer = new MutationObserver((mutationsList) => {
    // Newly added elements may contain more exposed shadow roots.
    for (const mutation of mutationsList) {
        for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                observeShadowRoots(/** @type {Element} */ (node));
            }
        }
    }

    realMutationObserverCallback(mutationsList);
});

/**
 * Observes every exposed shadow root below `root`.
 *
 * @param {Document | Element | ShadowRoot} root
 */
function observeShadowRoots(root) {
    const elements = root instanceof Element
        ? [root, ...root.querySelectorAll("*")]
        : root.querySelectorAll("*");

    for (const el of elements) {
        const shadow = /** @type {any} */ (el).shadowRoot || /** @type {any} */ (el).root;
        if (!shadow || observedRoots.has(shadow)) continue;

        observedRoots.add(shadow);
        observer.observe(shadow, {
            attributes: true,
            characterData: true,
            childList: true,
            subtree: true,
        });
        observeShadowRoots(shadow);
    }
}

observer.observe(document, {
    attributes: true,
    characterData: true,
    childList: true,
    subtree: true,
});
observeShadowRoots(document);
