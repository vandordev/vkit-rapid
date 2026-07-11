# UI Rules

- UI libraries are project-level choices, not backend architecture requirements.
- The current web baseline uses Mantine because it provides the existing theme, provider, and dashboard primitives.
- A project may switch to shadcn/ui when it needs Tailwind-based, source-owned primitives and more styling control.
- Choose one primary UI system per project. Do not install Mantine and shadcn as competing primitive systems in the baseline.
- When switching to shadcn, remove Mantine providers, dependencies, and theme code instead of keeping both systems active.
- Keep UI components inside `apps/web`; do not create `packages/ui` until multiple apps genuinely share the same implementation.
- Shared UI primitives belong in `apps/web/components/ui`; feature-specific components stay close to their route or feature.
- Preserve the selected system's accessibility, responsive behavior, loading states, error states, and interaction conventions.
