# Reference DE Aria v1

In DE Aria v1, we extend the standard Aria rules with the following concepts:

## Everything is tabbable

All elements that are focusable (e.g. buttons, links, inputs) are tabbable by default. This means that you can navigate through the UI using the Tab key.

This however also includes text as part of the flow; all text elements should be tabbable by marking them with `tabindex="0"`. and data-de-aria-text attribute.

As web apps become more complex, and less focused on being sources of text to be read and instead become panels, menus, and other interactive elements which contain text in between; having text as separate from the application flow becomes more important. This is why we have the `data-de-aria-text` attribute, which allows you to mark text as being part of the flow, and not just a static element.

Most accessibility criteria still follows old ideals of web accessibility where websites are mostly a source of text to be read with buttons and links that lead to other pages. In modern web apps, this is no longer the case, and we need to adapt our accessibility criteria to reflect this.

By making everything tabbable we ensure that users can navigate through the application using the keyboard, and that they can access all interactive elements without having to use a mouse.

## Physically disabled people needs are inherently different from blind people

Blind people manipulate the application using a screen reader through two means, touch and being recited what the finger is atop and tabbing via a keyboard and focusing.

Even without de-aria, these two are easily met; physically disabled people, however, may require additional considerations such as alternative input methods and customizable keyboard shortcuts.

Physically disabled might or might not be capable of fully using a keyboard, in the case they cannot expecting them to say "tab" "tab" "tab" over and over again to navigate through the application is not reasonable. This is why de-aria introduces shortcuts, this allows users to navigate when using a voice to input system by saying things like "control alpha 2" to select something in a list while they get constant feedback in the form of badges and other visual indicators.

These visual indicators are not meant for blind people, but help in the case of physical disability; especially voice commands.

## A single page application can be broken into multiple accessible units

When a non-disabled user navigates through a standard application, having a lot of content and ignoring or glancing over pieces of information is as easy and changing the focus of their eyes at what they want to look at. For a blind person, this is not possible, and for a physically disabled person, they can become overwhelmed with the options for buttons and links to click on.

de-aria introduces the concept of accessibility groups, with data-de-aria-group="static" or particularly the data-de-aria-group="dynamic" attributes, which allows the application to be broken into multiple accessible units. This allows the user to focus on one unit at a time, and not be overwhelmed with the options for buttons and links to click on.

Each dynamic group is to be identified with an aria-label or aria-labelledby attribute, which allows the user to know what the group is about. Unless they are of the text type, in which case they are to be identified with a data-de-aria-text attribute and let be read its content.

This serves a double purpose for blind and physically disabled users; creating series of shortcuts, for example, a menu can be a whole dynamic group, so calling "control omega alpha 1" can select the menu at "control omega" then "alpha" selects the first item in the menu, and "1" selects the first item in the submenu. This allows for a more efficient navigation through the application with chained shortcuts which reduce clutter and allow for a more efficient navigation through the application.

For the case of blind users that tab, this allows them to skip over large sections of content that they are not interested in, and focus on the content that they are interested in. "tab" -> (screenreader says "menu", press enter or space to open the menu) -> "tab" -> we head to the content of the page and skip over the menu items that we are not interested in. However if enter is pressed we enter a focus trap, and the user can navigate through the menu items using "tab" and "shift tab" to go forward and backward through the menu items. As well as exiting the trap using escape or the button that will appear to escape the focus trap.