# Animation Components

## Overview

Comprehensive animation library built with **framer-motion** for smooth, performant animations throughout the application. All animations respect user preferences for reduced motion (WCAG 2.1 compliance).

## Installation

Framer-motion is already installed:

```bash
pnpm add framer-motion
```

## Components

### FadeIn

Fades in content with optional directional slide.

**Usage:**

```tsx
import { FadeIn } from "~/components/animations";

<FadeIn direction="up" delay={0.2} duration={0.5}>
  <div>Content fades in from bottom</div>
</FadeIn>;
```

**Props:**

- `direction`: `'up' | 'down' | 'left' | 'right' | 'none'` (default: `'none'`)
- `delay`: number (default: `0`)
- `duration`: number (default: `0.5`)
- `distance`: number (default: `20`)
- `once`: boolean (default: `true`)

---

### SlideIn

Slides in content from specified direction.

**Usage:**

```tsx
import { SlideIn } from "~/components/animations";

<SlideIn direction="left" delay={0.3}>
  <div>Content slides in from right</div>
</SlideIn>;
```

**Props:**

- `direction`: `'up' | 'down' | 'left' | 'right'` (default: `'up'`)
- `delay`: number (default: `0`)
- `duration`: number (default: `0.5`)
- `distance`: number (default: `50`)
- `once`: boolean (default: `true`)

---

### ScaleOnHover

Scales element on hover and tap.

**Usage:**

```tsx
import { ScaleOnHover, PressableScale, FloatOnHover } from '~/components/animations';

// Scale on hover
<ScaleOnHover scale={1.05}>
  <button>Hover me</button>
</ScaleOnHover>

// Press effect
<PressableScale scale={0.95}>
  <button>Click me</button>
</PressableScale>

// Float effect
<FloatOnHover distance={-5}>
  <div>Hover to float</div>
</FloatOnHover>
```

**Props:**

- `scale`: number (default: `1.05`)
- `tapScale`: number (default: `0.95`)
- `duration`: number (default: `0.2`)

---

### StaggerChildren

Animates children with staggered delays.

**Usage:**

```tsx
import { StaggerChildren, StaggerItem, StaggerList } from '~/components/animations';

// Manual stagger
<StaggerChildren staggerDelay={0.1}>
  <StaggerItem>Item 1</StaggerItem>
  <StaggerItem>Item 2</StaggerItem>
  <StaggerItem>Item 3</StaggerItem>
</StaggerChildren>

// List stagger
<StaggerList
  items={listings}
  renderItem={(listing) => <ListingCard listing={listing} />}
  staggerDelay={0.15}
/>
```

**Props:**

- `staggerDelay`: number (default: `0.1`)
- `initialDelay`: number (default: `0`)

---

### PageTransition

Animates page transitions.

**Usage:**

```tsx
import { PageTransition, FadeTransition, SlideTransition } from '~/components/animations';

// In root layout
<PageTransition mode="fade" duration={0.3}>
  <Outlet />
</PageTransition>

// Or use presets
<FadeTransition>
  <Outlet />
</FadeTransition>
```

**Props:**

- `mode`: `'fade' | 'slide' | 'scale' | 'none'` (default: `'fade'`)
- `duration`: number (default: `0.3`)

---

### ModalAnimation

Animates modal/dialog entrance and exit.

**Usage:**

```tsx
import { ModalAnimation, BackdropAnimation } from '~/components/animations';

<BackdropAnimation isOpen={isOpen} onClick={onClose} />
<ModalAnimation isOpen={isOpen} variant="scale">
  <div>Modal content</div>
</ModalAnimation>
```

**Props:**

- `isOpen`: boolean (required)
- `variant`: `'fade' | 'scale' | 'slideUp' | 'slideDown'` (default: `'scale'`)
- `duration`: number (default: `0.3`)

---

### Micro-interactions

Small, delightful animations for user feedback.

**Usage:**

```tsx
import {
  Bounce,
  Shake,
  Pulse,
  Wiggle,
  ExpandOnHover,
  RotateOnHover,
  GlowOnHover,
} from '~/components/animations';

// Bounce on mount
<Bounce delay={0.2}>
  <div>Bounces once</div>
</Bounce>

// Shake on error
<Shake trigger={hasError}>
  <input />
</Shake>

// Pulse continuously
<Pulse repeat>
  <NotificationBadge />
</Pulse>

// Wiggle for attention
<Wiggle trigger={needsAttention}>
  <button>Important</button>
</Wiggle>

// Expand on hover
<ExpandOnHover expandBy={1.02}>
  <Card />
</ExpandOnHover>

// Rotate on hover
<RotateOnHover degrees={5}>
  <Icon />
</RotateOnHover>

// Glow on hover
<GlowOnHover color="rgba(59, 130, 246, 0.5)">
  <button>Hover for glow</button>
</GlowOnHover>
```

---

## Hooks

### useAnimation

Control animations programmatically.

**Usage:**

```tsx
import { useAnimation } from "~/hooks/useAnimation";

function Component() {
  const { controls, animate, shouldReduceMotion } = useAnimation();

  const handleClick = async () => {
    await animate({ scale: 1.2 });
    await animate({ scale: 1 });
  };

  return <motion.div animate={controls}>Content</motion.div>;
}
```

---

### useScrollAnimation

Trigger animations on scroll.

**Usage:**

```tsx
import { useScrollAnimation } from "~/hooks/useAnimation";

function Component() {
  const { isVisible, setIsVisible, controls } = useScrollAnimation();

  return (
    <motion.div
      animate={controls}
      variants={variants}
      onViewportEnter={() => setIsVisible(true)}
    >
      Content
    </motion.div>
  );
}
```

---

### useStaggerAnimation

Calculate stagger delays.

**Usage:**

```tsx
import { useStaggerAnimation } from "~/hooks/useAnimation";

function List({ items }) {
  const { getStaggerDelay } = useStaggerAnimation(items.length, 0.1);

  return items.map((item, index) => (
    <motion.div
      key={item.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: getStaggerDelay(index) }}
    >
      {item.content}
    </motion.div>
  ));
}
```

---

## Animation Variants

Pre-defined animation variants for consistency.

**Usage:**

```tsx
import {
  fadeInVariants,
  slideUpVariants,
  scaleInVariants,
  staggerContainerVariants,
  staggerItemVariants,
  modalVariants,
  cardHoverVariants,
} from "~/lib/animation-variants";

<motion.div variants={fadeInVariants} initial="hidden" animate="visible">
  Content
</motion.div>;
```

**Available Variants:**

- `fadeInVariants` - Simple fade in
- `slideUpVariants` - Slide up with fade
- `slideDownVariants` - Slide down with fade
- `slideLeftVariants` - Slide left with fade
- `slideRightVariants` - Slide right with fade
- `scaleInVariants` - Scale in with fade
- `staggerContainerVariants` - Container for stagger
- `staggerItemVariants` - Items in stagger
- `modalVariants` - Modal entrance/exit
- `backdropVariants` - Backdrop fade
- `drawerVariants` - Drawer slide
- `accordionVariants` - Accordion expand/collapse
- `cardHoverVariants` - Card hover effect
- `buttonPressVariants` - Button press effect
- `pulseVariants` - Pulse animation
- `shakeVariants` - Shake animation
- `bounceVariants` - Bounce animation
- `rotateVariants` - Rotate on hover
- `pageTransitionVariants` - Page transitions
- `notificationVariants` - Notification entrance

---

## Best Practices

### 1. Respect Reduced Motion

All components automatically respect `prefers-reduced-motion`:

```tsx
// ✅ Good - uses built-in components
<FadeIn>Content</FadeIn>;

// ✅ Also good - manual check
const shouldReduceMotion = prefersReducedMotion();
const duration = shouldReduceMotion ? 0 : 0.5;
```

### 2. Use Appropriate Durations

- **Fast (0.1-0.2s)**: Button presses, micro-interactions
- **Medium (0.3-0.5s)**: Fades, slides, most transitions
- **Slow (0.6-1s)**: Page transitions, complex animations

### 3. Stagger Delays

Keep stagger delays short (0.05-0.15s) for smooth cascading effects.

### 4. Performance

- Use `transform` and `opacity` for best performance
- Avoid animating `width`, `height`, `top`, `left`
- Use `will-change` sparingly

### 5. Accessibility

- Always provide `prefers-reduced-motion` fallbacks
- Don't rely solely on animation to convey information
- Ensure animations don't cause seizures (avoid rapid flashing)

---

## Examples

### Animated Listing Card

```tsx
import { FadeIn, ScaleOnHover } from "~/components/animations";

function ListingCard({ listing }) {
  return (
    <FadeIn direction="up">
      <ScaleOnHover>
        <Card>
          <CardContent>
            <h3>{listing.title}</h3>
            <p>{listing.description}</p>
          </CardContent>
        </Card>
      </ScaleOnHover>
    </FadeIn>
  );
}
```

### Animated List

```tsx
import { StaggerList } from "~/components/animations";

function ListingsList({ listings }) {
  return (
    <StaggerList
      items={listings}
      renderItem={(listing) => <ListingCard listing={listing} />}
      staggerDelay={0.1}
    />
  );
}
```

### Animated Modal

```tsx
import { ModalAnimation, BackdropAnimation } from "~/components/animations";

function Modal({ isOpen, onClose, children }) {
  return (
    <>
      <BackdropAnimation isOpen={isOpen} onClick={onClose} />
      <ModalAnimation isOpen={isOpen} variant="scale">
        <div className="modal-content">{children}</div>
      </ModalAnimation>
    </>
  );
}
```

### Page with Transitions

```tsx
import { PageTransition } from "~/components/animations";

export default function Root() {
  return (
    <PageTransition mode="fade">
      <Outlet />
    </PageTransition>
  );
}
```

---

## Demo

Visit `/animations-demo` to see all animations in action.

---

## Performance Tips

1. **Use Layout Animations Sparingly** - They can be expensive
2. **Optimize Re-renders** - Use `React.memo` for animated components
3. **Lazy Load** - Code-split animation-heavy pages
4. **GPU Acceleration** - Animations use `transform` and `opacity` by default
5. **Reduce Complexity** - Simpler animations perform better

---

## Browser Support

Framer-motion supports all modern browsers:

- Chrome/Edge 88+
- Firefox 78+
- Safari 14+
- iOS Safari 14+

---

## Resources

- [Framer Motion Docs](https://www.framer.com/motion/)
- [Animation Best Practices](https://web.dev/animations/)
- [Reduced Motion](https://web.dev/prefers-reduced-motion/)
