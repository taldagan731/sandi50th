# Aurora Engine Usage

Add this import near the top of `app/page.tsx`:

```tsx
import AuroraEngine from "@/components/AuroraEngine";
```

Inside the cover or hero section, replace the old aurora background element with:

```tsx
<AuroraEngine intensity={0.9} speed={1} />
```

The containing section should have:

```css
position: relative;
overflow: hidden;
```

The visible text and buttons should have:

```css
position: relative;
z-index: 1;
```
