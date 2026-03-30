---
name: frontend-design
description: "Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when tasked with building web components, pages, or applications to ensure modern, elegant, minimalism. Generates creative, polished code that avoids generic AI aesthetics."
allowed-tools:
  - read_file
  - bash-exec
---

This skill guides the creation of distinctive, production-grade frontend interfaces that strictly avoid generic "AI slop" aesthetics. All frontend code created must adhere to the high-quality benchmarks defined here and in `docs/FRONTEND_DESIGN_CONVENTIONS.md`.

When the user provides frontend requirements (a component, page, application, or interface to build), implement real, working code with exceptional attention to aesthetic details and creative choices.

## Design Thinking

Before coding anything frontend-related, understand the context and commit to a BOLD, premium aesthetic direction governed by our core tone: **Modern, Elegant, Minimalistic**.

- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone Alignment**: You MUST adhere to minimalism, elegance, and modernity while supporting both Dark and Light themes. Avoid noise. Embrace simplicity.
- **Constraints**: Follow technical requirements (Tailwind CSS, React, semantic HTML, accessibility).
- **Differentiation**: What makes this specific interface UNFORGETTABLE? Focus on typography, spacing, or a subtle animation rather than chaotic colors.

**CRITICAL**: Execute minimalism with precision. Restraint, extreme precision, and careful attention to spacing and typography are the keys. Elegance comes from executing a restrained vision perfectly.

## Frontend Aesthetics Guidelines

Focus heavily on:
- **Typography**: Choose fonts that are beautiful, unique, and interesting. Differentiate headings from body copy using extreme weight or tracking contrast.
- **Color & Theme**: Stick to a cohesive aesthetic (Indigo/Blue palette is heavily favored here). Use Tailwind's CSS variables and semantic variants (`dark:`, `hover:`, `focus:`). Dominant neutral/deep background colors with sharp, deliberate accents outperform timid palettes.
- **Motion**: Use animations for effects and micro-interactions. Emphasize CSS-only solutions (`transition-all`). Focus on high-impact moments like staggered reveals (`animation-delay`) rather than chaotic bounce effects. Utilize subtle scaling and blur transitions on hover.
- **Spatial Composition**: Rely on generous negative space and controlled density. Unexpected layouts, asymmetrical alignments, and breaking the grid are encouraged to make minimalism feel dynamic.
- **Backgrounds & Visual Details**: Use glassmorphism (`backdrop-blur-md`, `bg-white/10`, `dark:bg-black/20`) over flat color planes for depth. Apply creative touches like incredibly subtle grain overlays, elegant borders (`border-transparent dark:border-white/5`), and deep, diffuse shadows. Every element should feel layered and placed with intent.

## The "Never Do This" List

- **NEVER** use generic AI-generated aesthetics (e.g., clichéd purple gradients on white backgrounds, standard card layouts without edge treatments, or flat, uninspired system fonts if custom is available).
- **NEVER** ignore dark mode or light mode context. Provide solutions for both seamlessly.
- **NEVER** clutter the viewport. Modern elegance implies air. Let the layout breathe.
- **NEVER** rush the micro-interactions.

Remember: as an agent, you represent extraordinary creative capability. Do not default back to generic dashboard templates. Make it premium and tailored to the exact context requested.
