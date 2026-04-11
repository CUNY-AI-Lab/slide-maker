# Accessibility Checklist for Web Developers

## Semantic HTML

- Use heading levels in order (h1, h2, h3)
- Use landmark elements (nav, main, aside, footer)
- Use button for actions, a for navigation
- Use lists (ul, ol) for grouped items
- Use table with proper headers for tabular data
- Use fieldset and legend for form groups
- Use label elements for all form inputs
- Use aria-label only when visible text is not available

## Color and Contrast

- Minimum 4.5:1 contrast ratio for normal text
- Minimum 3:1 contrast ratio for large text
- Do not convey information through color alone
- Test with grayscale filter
- Provide sufficient contrast for focus indicators
- Check contrast of placeholder text
- Verify link text is distinguishable from body text

## Keyboard Navigation

- All interactive elements must be keyboard accessible
- Visible focus indicators on all focusable elements
- Logical tab order follows visual layout
- No keyboard traps
- Skip navigation links for repeated content
- Escape key closes modals and popups
- Arrow keys for composite widgets (tabs, menus)
- Enter and Space activate buttons

## Images and Media

- Alt text for all informative images
- Empty alt for decorative images
- Captions for all video content
- Transcripts for audio content
- Audio descriptions for video when needed
- Avoid autoplay for media
- Provide controls for all media players

## Forms

- Labels associated with inputs
- Error messages are specific and helpful
- Required fields are clearly indicated
- Form validation happens on submit, not on blur
- Success and error states are announced to screen readers
- Autocomplete attributes for common fields
- Input types match the expected data

## ARIA

- Use native HTML before ARIA
- aria-live regions for dynamic content
- aria-expanded for collapsible sections
- aria-current for navigation state
- aria-describedby for supplementary help text
- role="alert" for important messages
- Test with actual screen readers, not just automated tools
