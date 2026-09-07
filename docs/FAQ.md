# Frequently asked questions

[Back to installation](../README.md) · [한국어](FAQ.ko.md)

- [Can other people see my cover letters?](#can-other-people-see-my-cover-letters)
- [I already pay for GPT or Claude. Do I need another AI subscription?](#i-already-pay-for-gpt-or-claude-do-i-need-another-ai-subscription)
- [Can it write in my usual voice?](#can-it-write-in-my-usual-voice)
- [Does it only work on my local computer?](#does-it-only-work-on-my-local-computer)
- [I do not know where to start, and writing takes too long.](#i-do-not-know-where-to-start-and-writing-takes-too-long)
- [I only use Codex, or only Claude. Is that enough?](#i-only-use-codex-or-only-claude-is-that-enough)
- [Can I start without a paid AI subscription?](#can-i-start-without-a-paid-ai-subscription)
- [What if I lose my Supabase data?](#what-if-i-lose-my-supabase-data)
- [Can it find postings and add their deadlines to my calendar?](#can-it-find-postings-and-add-their-deadlines-to-my-calendar)
- [The runner is connected, but the assistants are not moving.](#the-runner-is-connected-but-the-assistants-are-not-moving)
- [Is my Supabase password also my web password?](#is-my-supabase-password-also-my-web-password)
- [Must I rename every Notion or Excel column?](#must-i-rename-every-notion-or-excel-column)
- [Where do I start writing a cover letter?](#where-do-i-start-writing-a-cover-letter)

### Can other people see my cover letters?

**They are stored in your own Supabase project.** The installed owner-only signup restriction and row level security (RLS) allow the authenticated owner to read and write their records. Open-source users do not share a central application database, and publishing the repository does not publish the database contents.

When you run AI features, the experiences, drafts, and research needed for that task are sent to the selected AI provider. Private database storage and provider processing are separate; you manage your account and access permissions.

### I already pay for GPT or Claude. Do I need another AI subscription?

**Career Atelier charges no subscription or per-token API fee.** Sign in to a supported CLI with your own AI account. Use the subscription you already have for evidence-based drafting and review in one place. Your AI plan's limits still apply; Supabase and Vercel costs depend on the plans and usage you choose.

### Can it write in my usual voice?

Edit and save each assistant's prompt in the prompt studio. For example, tell Muse to use short sentences, lead with your decisions and actions, and avoid unsupported superlatives. **Saved settings are read by subsequent runs**, not injected into a task already running. You can restore earlier prompt versions.

Provider, model, and reasoning effort are also configurable per assistant. Prompts are stored per assistant, so adjust them when switching providers. This changes Career Atelier's instructions, not your personal settings on the ChatGPT or Claude website.

### Does it only work on my local computer?

[Deploy the web app to Vercel](REFERENCE.md#deploying) to sign in from another computer or mobile browser, manage records and deadlines, and write or edit drafts manually. **AI generation needs an internet-connected computer running the runner and authenticated AI CLI.** That runner processes requests sent from elsewhere. A computer that is off or asleep cannot process them, and queued jobs have a six-hour expiry.

### I do not know where to start, and writing takes too long.

Find a posting with Moka, prepare your experiences and questions, and start Sol's chain. **Company research → evidence-based draft → evidence review → section headings** run in sequence. You do not have to copy the material into another chat at every step. Check the facts and your intended meaning yourself; review does not guarantee accuracy or submit applications automatically.

### I only use Codex, or only Claude. Is that enough?

Yes. Assign all seven assistants to a provider you have signed in to, or mix providers by role. Use model names and effort settings supported by that CLI. The provider assignments in the detailed reference are defaults.

### Can I start without a paid AI subscription?

AI features require an account eligible to use your chosen CLI. Check the provider’s current terms for free access and usage limits. [OpenAI access](https://learn.chatgpt.com/docs/pricing) · [Claude Code access](https://code.claude.com/docs/en/setup)

You can also manage resume records, experience, postings, deadlines, and drafts manually without AI. The web app's manual features do not need a running AI CLI or runner.

### What if I lose my Supabase data?

Enable local folder backup in the dashboard. While running, the runner exports selected tables to JSON **every two hours**; the current implementation is not a six-hour schedule. It updates the same day's file and creates a new file on a new date. This is not complete recovery covering all resume records and attachments; check the [backup scope](REFERENCE.md#backups).

### Can it find postings and add their deadlines to my calendar?

Moka searches using your target roles, interests, and experience, then saves results. Postings with valid deadlines connect to the calendar automatically. Rolling postings without dates do not get invented deadlines. You can search from the dashboard; an approved, running runner also supports daily discovery at 15:00 KST.

### The runner is connected, but the assistants are not moving.

A connection means the runner is ready. Request a task with a run button and the assistant becomes active when it executes. If it stays queued, check device approval in the dashboard, runner terminal errors, the selected CLI's login, and usage limits in the activity log.

### Is my Supabase password also my web password?

No. Supabase dashboard credentials manage your project; the database password connects to its database. Use the email and password chosen during Career Atelier web signup for both web and runner login. [Login and signup troubleshooting](AUTH-TROUBLESHOOTING.md) (Korean)

### Must I rename every Notion or Excel column?

Use `column_map` for different column names. The current implementation does not automatically split multiple experiences in one cell or extract meaning from arbitrary prose. Inspect missing data and warnings in the preview. There is no web upload wizard yet. [Current usage](../runner/mcp/README.md) · [Extension design — not implemented](IMPORT-FORMAT-DESIGN.ko.md) (Korean)

### Where do I start writing a cover letter?

Save a posting under **지원 일정** (Applications), then choose **자소서 쓰기** or **자소서 작성 연결**. Prepare experience cards first, then enter the question and company context in the editor. [First cover-letter walkthrough](../README.md#your-first-cover-letter)
