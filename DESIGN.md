# Career Atelier — Documentation Website Design Guide

> Scope: a public product introduction, installation guide, and user documentation website based on the README.
> This guide does not prescribe changes to the signed-in workspace.
> Research date: 2026-09-08. This document defines design requirements for implementation; it is not a website implementation.

## 1. Design Direction

**Combine Linear's product presentation with Astro Docs' documentation navigation.**

New visitors need to understand the product, people installing it need to find their next action, and existing users need direct access to feature instructions. Pair a concise introduction homepage with documentation organized by user goals. Do not turn the entire README into one long page.

If choosing one reference from GetDesignMD, use [Linear DESIGN.md](https://getdesignmd.org/design/linear-app) as the starting point. It is an independent library analysis, not Linear's official design system. The Korean readability requirements, brand colors, and installation flow in this document take precedence over external references.

The previously recommended VoltAgent reference suits an agent control panel, but the primary purpose of this documentation website is to help non-developers understand and install the product. Do not make a terminal aesthetic the foundation of the whole site.

## 2. Reference Websites and Scope of Review

The four public websites below were opened in a browser and their first viewports were visually inspected. Their content structure was also reviewed. This was not a complete review of every page, mobile layout, or interaction. The proposed adaptations are recommendations for Career Atelier based on those observations.

| Reference | Observed characteristics | Adopt | Do not copy directly |
|---|---|---|---|
| [Linear](https://linear.app/) | Dark background, large left-aligned heading, product interface below the heading, distinct product sections | Clear heading hierarchy and showing the actual product early | Tight line heights intended for English and excessive space in the first viewport |
| [Astro Docs](https://docs.astro.build/en/getting-started/) | Top search, language and theme controls, categorized left navigation, separate entry points for installation and feature exploration | Documentation navigation and a clear installation entry point | Developer terminology presented without explanations |
| [Supabase Docs](https://supabase.com/docs) | Top documentation search, AI Prompt/CLI tabs and a copy control next to the introduction, different starting points | Manual installation versus AI-assisted installation, copyable command instructions | Requiring first-time visitors to choose between frameworks or database concepts |
| [Raycast](https://www.raycast.com/) | Dark surfaces, rounded top navigation, a one-sentence value proposition and a prominent download action | A clear primary action and consistent brand presentation | Implying that our product has a single downloadable installer |

Secondary reference: [Mintlify DESIGN.md](https://getdesignmd.org/design/mintlify). It can inform comparisons of documentation design, but does not require a Mintlify subscription or adoption of a particular documentation platform.

Do not copy external photography, trademarks, or paid fonts. The tokens below are proposed values based on Career Atelier's existing brand, not CSS values extracted from those websites.

## 3. Three Things Visitors Must Understand

1. This is a self-hosted open-source workspace for managing experiences, career records, job postings, and application essays in one place.
2. Manual data management works without AI. AI execution requires a Runner on the user's own computer and a signed-in CLI.
3. Start by installing the product and saving one experience. AI, deployment, and MCP are optional next steps.

Primary action: **Start installation** (Korean UI: **설치 시작하기**). Secondary action: **Explore features** (Korean UI: **기능 둘러보기**).

Do not present the documentation site's primary action as signing up for a shared hosted service. State in the first viewport that users install their own instance. Provide a login link only when the destination instance has actually been established.

## 4. Information Architecture

These are proposed routes for the documentation website. They do not automatically replace existing application routes.

| Route | Page title | Purpose |
|---|---|---|
| `/` | Career Atelier | Product overview, origin story, pilot introductions, installation entry point |
| `/docs/start` | First-time installation | Prerequisites → project connection → web signup → save an experience |
| `/docs/first-essay` | Complete your first application essay | Follow the path from experiences and a job posting to drafting and review |
| `/docs/features/*` | Feature guides | Find features using the application's actual menu labels |
| `/docs/ai` | Connect your AI pilots | CLI login, Runner login, device approval |
| `/docs/import` | Import from Notion and Excel | Supported formats, column mapping, previews, and limitations |
| `/docs/deploy` | Use your workspace remotely | Web deployment and local Runner requirements |
| `/docs/troubleshooting` | Troubleshooting | Solutions organized by symptoms |
| `/docs/faq` | Frequently asked questions | Costs, privacy, writing style, backups, accounts |
| `/docs/updates` | Updating | Current releases and upgrade instructions |

Limit the top navigation to `Features / Installation / User guide / FAQ / GitHub`. Keep documentation search easy to find. Korean is the default site language; offer English when the equivalent page is available. The language of this design document does not change that default.

## 5. Homepage Composition

### First Viewport

- Headline: **Your job search, in one personal workspace.** Korean UI: **흩어진 취업 준비를, 나만의 작업실 하나로.**
- Description: **From experiences in Notion to job postings, application essays, and interviews. Prepare with the AI you already use and seven dedicated pilots.** Korean UI: **Notion의 경험부터 공고, 자소서, 면접까지. 내가 쓰는 AI와 일곱 파일럿이 함께 준비합니다.**
- Primary action: Start installation. Secondary action: Explore features.
- Short qualifier: `Self-hosted · MIT open source · Manage your data without AI`.
- Place a large screenshot of the actual dashboard below or beside the heading. Explain what it shows in a caption.
- Confine space-themed decoration to the edges of this area. Keep the surfaces behind the heading and buttons visually even.
- Use starlight and existing planet/Earth imagery instead of a full-screen nebula. Do not reuse the entire login scene as the homepage background.

### Why It Exists

Explain the real motivation in no more than two paragraphs: switching between Notion, Excel, and AI conversations meant repeatedly copying the same experiences. The key message is: “An experience recorded once should remain useful for the next application.” Do not invent user counts, time savings, or testimonials.

### What Can I Do?

Present four goals with product screenshots: `Organize experiences / Track postings and schedules / Draft and review essays / Prepare for interviews`. Each section includes the menu label, the user's action, the result, and a link to detailed instructions. Use text badges to indicate whether AI is required. Enlarge the relevant interface area instead of shrinking an entire screenshot into a small card.

### Seven Pilots

| Name | Role | Linked guide |
|---|---|---|
| Lumi (루미) | Industry news | Research news from the dashboard |
| Moka (모카) | Job discovery | Find postings and manage application schedules |
| Sol (솔) | Company and role research | Research a company from the essay editor |
| Muse (뮤즈) | Experience-based drafts | Draft using evidence from personal experiences |
| Lens (렌즈) | Evidence and exaggeration review | Review and revise a draft |
| Comma (콤마) | Section headings | Generate heading suggestions |
| Echo (에코) | Interview preparation | Organize interview questions and answers |

Align existing characters to a shared ground baseline and consistent perceived height. On desktop, use a 4+3 arrangement or seven columns when space permits; use two columns on mobile. Always display names and roles. Descriptions must not require hovering over a character. Provide clearly labeled links that include the pilot's name rather than making only the illustration clickable.

### Installation Entry and FAQ

Show only a three-step installation overview on the homepage, linking to the installation page for detailed commands. Prioritize questions about costs, privacy, using only one AI provider, MCP formats, and login problems. Link to the full FAQ for other questions.

Include GitHub, Releases, contribution guidelines, the license, and security reporting in the footer. Connect the version badge to actual release data; never display a fabricated latest version if retrieval fails.

## 6. Documentation Layout

- Desktop: 248px left navigation / central reading column up to 720px / 192px right-hand page outline.
- Maximum container width: 1280px, with 32px column gaps. Below 1200px, move the right outline into a collapsible section above the article.
- Below 900px, collapse the left navigation behind an explicit “Documentation menu” button. Do not squeeze the article to preserve three columns.
- Article header: breadcrumbs, title, one-sentence purpose, prerequisites.
- Article footer: completion criteria, next step, related troubleshooting, and a GitHub edit suggestion link.
- Use one page-level heading. Match the selected navigation item to the article title.
- Search must operate on actual content. Results include document title, description, and path. Support no-results feedback, keyboard navigation, and Escape to close.
- Keep required installation instructions visible. Collapse only optional information and exceptions.

## 7. Installation Guide Rules

Use the same structure for every step: **Where to work → what to run → what success looks like → what to check if it fails → next step**.

1. Prerequisites: Git, Node.js 22.13+, a Supabase account, and Supabase CLI. Include installation links and verification commands.
2. Clone the repository in Terminal A and run `npm run setup`. Explain that users who already have the repository can skip cloning.
3. Start the web app and open the Local address printed by the server in a browser. Register the first owner using an email and password chosen by the user.
4. Save one experience card and refresh. This marks completion of the basic installation.
5. On a separate optional page, guide users through AI CLI setup → Runner in a new Terminal B → device approval in the web app.

The installation page's “Install manually / Ask a coding AI” options must lead to the same outcome. Even with AI assistance, explicitly identify the steps users must perform themselves: Supabase sign-in, first signup, and device approval.

Label command blocks with the working directory and terminal name. Copy buttons must provide success and failure feedback. Exclude shell prompt characters such as `$` from copied text. Use Windows and macOS/Linux tabs only when commands actually differ. Do not imply that reopening the browser automatically verifies installation completion.

## 8. Color Tokens

Preserve the application's existing amber and cyan identity. Purple, mentioned in an earlier recommendation, is not the current primary brand color and should not be imposed as a new one.

| Role | Dark | Light |
|---|---|---|
| Page background | `#080D16` | `#F7F8FA` |
| Article/card surface | `#0E1622` | `#FFFFFF` |
| Emphasized surface | `#172433` | `#EDF1F5` |
| Primary text | `#E6EEF7` | `#172433` |
| Secondary text | `#9DB0C4` | `#46566B` |
| Divider | `#223145` | `#D5DCE5` |
| Primary button background | `#F5A962` | `#F5A962` |
| Primary button text | `#080D16` | `#080D16` |
| Link/focus | `#58CFE4` | `#086B80` |

Use icons and text together for success, warning, and error states. Never communicate status through color alone. Check contrast for final color combinations during implementation. Dark and light themes share the same information architecture and respect both system preferences and the user's choice. Do not invert screenshot colors to match the theme.

## 9. Typography and Spacing

- Korean body text: the existing system font stack or Noto Sans KR after checking its license. Font size 16–18px; line height 1.75.
- English wordmark and short headings: the existing Space Grotesk may be used. Do not compress Korean text to mimic an English typeface.
- Code: ui-monospace, SFMono-Regular, Consolas, monospace. Font size 14px; line height 1.65.
- Hero heading: 56–64px on desktop, 34–40px on mobile; line height 1.2–1.3.
- Documentation title: 32–40px; section headings: 22–26px. Prefer normal letter spacing for body text.
- Prefer word-level wrapping for Korean headings. Prevent long URLs and code from widening the page.
- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64, 96px.
- Landing section spacing: 96px on desktop, 56px on mobile. Documentation paragraph spacing: 20–24px.
- Corner radii: buttons 8px, code blocks 10px, product screenshots 16px. Do not wrap every paragraph in a card.

## 10. Images and Motion

Existing assets:

- Dashboard: `docs/images/screens/01-dashboard.png`
- Experience exploration: `docs/images/screens/05-experiences.png`
- Application calendar: `docs/images/screens/02-calendar.png`
- Prompts: `docs/images/screens/04-prompt-lab.png`
- Interviews: `docs/images/screens/06-interviews.png`
- Characters: `docs/images/agents/agent-*.png`

Before publication, inspect screenshots for personal information such as email addresses, actual career records, or private application essays. A filename does not establish that an image is suitable for publication. Distinguish standalone character images from application sprite sheets, and preserve their original aspect ratios.

Allow only faint, irregular star twinkling in the hero. Persistent motion requires a pause control and support for `prefers-reduced-motion`. Use static backgrounds in documentation articles. Do not hijack scrolling, animate paragraphs while they are being read, or force autoplay videos.

Screenshot enlargement must support a close button, Escape, and focus restoration. Explanations shown only in images must also appear in the text. Reading the documentation must not depend on 3D rendering.

## 11. Content Sources and Accuracy

Use `README.ko.md`, `README.md`, `docs/FAQ.ko.md`, `docs/FEATURE-WALKTHROUGH.ko.md`, `docs/AUTH-TROUBLESHOOTING.md`, and `runner/mcp/README.md` as content sources. When documentation and actual behavior differ, inspect the implementation and update the affected documentation together.

Required distinctions:

- The web app stores data and requests jobs; AI execution happens in the local Runner.
- Do not omit first-owner signup or Runner device approval.
- Distinguish the web account, Supabase management account, and database password.
- Distinguish the absence of a Career Atelier subscription fee from AI and hosting providers' costs and limits.
- Do not claim that MCP understands every arbitrary format. Explain column mapping, previews, and unsupported structures.
- Current documentation describes backups every two hours while the Runner is running, not a complete recovery system. Recheck the implementation before publishing this claim.
- Do not imply that AI review guarantees factual accuracy or automatically submits applications.

Maintain a single content source where practical. Keep the README as a short introduction with a representative image, quick start, and documentation links. Update Korean and English READMEs together whenever either changes. Do not add a nonexistent deployment URL to the README before the website is published.

## 12. Implementation Acceptance Criteria

- The first viewport explains the product's purpose and that it is self-hosted.
- Installation instructions and login troubleshooting are each reachable within two clicks.
- Basic installation without AI is clearly separated from AI setup.
- Each feature guide includes the actual menu label, the button to use, and where to verify the result.
- Article text does not overflow horizontally at 360px mobile or 1280px desktop widths. Long code blocks scroll independently.
- Navigation, search, tabs, FAQ items, and image enlargement work with a keyboard alone.
- Content remains readable after theme changes, motion preference changes, and text enlargement.
- Copy buttons, search, internal links, and previous/next document navigation actually work.
- Ask beta users to start installation, save their first experience, and find help for a Runner login problem. Record completion, elapsed time, and where they get stuck. Keep target metrics separate from measured results.

## 13. Implementation Handoff Prompt

> Build Career Atelier's public documentation website using this DESIGN.md. Reference Linear's product presentation hierarchy and Astro Docs' documentation navigation while preserving the existing amber/cyan brand and seven pilots. Reorganize the README into product introduction, installation, first use, feature guides, and FAQ. For each installation step, provide the working location, commands, completion criteria, and troubleshooting links. Make AI, deployment, and MCP separate optional paths. Prioritize Korean body-text readability so general users can understand and install the product. Changes to the existing application's routing, authentication, and dashboard are not automatically included in the documentation website scope.
