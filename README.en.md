# Conversation History

A **History** tab for DeepSeek Harness. Find something you discussed earlier and read its context without leaving the current view.

[中文](README.md) · [Installation](#installation) · [How-it-works](#how-it-works) · [Development](#development)

![Search results with an in-place conversation preview](docs/images/search-en.jpg)

*Rendered from the actual plugin component. Every conversation, title and message shown is fictional.*

## Features

- Search across conversations, with separate title and message matches.
- Read surrounding messages in a side pane, then open the original conversation when needed.
- Highlight phrases and move between occurrences.
- Reuse local dialogue caches instead of parsing unchanged logs for every query.
- Show progress during the initial build and update results automatically.
- Follow the Harness language setting: English or Simplified Chinese.

Search includes user and assistant text. It excludes tool output, injected messages, fenced code and subagent conversations. Matching is literal, case-insensitive and flexible about whitespace between words; it is not semantic search.

## Installation

In DeepSeek Harness, open **Plugins**, choose to add a plugin, and use this GitHub install specification:

```text
github:michaelfeng/dsh-conversation-history#v1.1.0
```

Enable both the bundle and its **Conversation History component**. Open a conversation and select **History**.

For a local checkout:

```sh
git clone https://github.com/michaelfeng/dsh-conversation-history.git
cd dsh-conversation-history
```

Choose the local-directory option in the Harness plugin menu and select the cloned folder. Alternatively, use the Harness plugin-management tool's `install_bundle` action with the checkout's absolute path as `target`.

This is an independent third-party plugin, not an official DeepSeek project. Integration was checked against the desktop plugin interfaces in Harness **0.2.1-rc.3**. Other versions may require changes. The plugin depends on Harness session, connection and UI services; it is not a standalone web app.

If you previously installed an `@local/dsh-conversation-history` development copy, disable or remove it before installing this package to avoid duplicate component registration.

## Usage

Enter at least two characters, such as `release notes`. Select a message excerpt to preview its context, or select a title match to see recent messages. Use the previous/next controls to move between phrase occurrences, and **Open conversation** to return to the full conversation.

Each matching conversation contributes its latest matching message. Results are sorted by that message's timestamp. Responses include up to 100 conversations and indicate truncation. Regular expressions and fuzzy matching are not supported.

## How it works

When the component starts, it begins reading sessions through the public Harness persistence API and saving a disposable projection of dialogue text. Later searches reconcile source revisions and reuse those projections.

Unchanged sessions reuse memory or disk caches. Live sessions project new events incrementally. Changed persisted sessions may require a full read, depending on the storage backend. Concurrent searches share indexing work, and progress polls consume a completed build instead of starting it again. Search and context loading have independent settling deadlines.

Large histories take longer to index initially. Query latency depends on corpus size, text volume and storage; no fixed millisecond performance is promised. The plugin does not require or change the host's global full-text index configuration.

### Local data

The plugin makes no external network requests, calls no model, requires no additional API key and includes no telemetry. The UI communicates with its backend over the Harness connection channel; remote deployments inherit the host's connection and storage boundaries.

Derived caches live under `$DSH_HOME/cache/conversation-history/` and contain conversation text. They are not encrypted: protect them like the original history. Original session logs are never modified. To rebuild, turn the component off, remove its derived cache, then turn it back on.

## Development

Node.js 22 or newer is required for local checks. No additional npm dependencies are needed.

```sh
npm test
npm run check:release
```

Tests use fictional fixtures and cover cache reuse, changed/deleted sessions, concurrency, progress polling, timeouts, long messages, highlighting and UI rendering.

To render the static previews used for the screenshots:

```sh
npm run demo
```

Open the loopback URL printed in the terminal. This renders the real component with fixed sample data and never reads local Harness settings or conversation history. It is a screenshot/layout fixture, not an interactive Harness installation.

| File | Purpose |
|---|---|
| `index.js` | Search/context endpoints and plugin lifecycle |
| `dialogue-index.js` | Source reconciliation, dialogue projection and caching |
| `dialogue.js` | Text extraction, phrase matching and snippets |
| `client.js` | History UI and language dictionaries |
| `cordis.patch.yml` | Component registration and cache location |
| `tests/` | Synthetic regression fixtures |
| `scripts/` | Demo rendering and release-content checks |

For bug reports, include the Harness/plugin versions, reproduction steps and a minimal sanitized error in an [issue](https://github.com/michaelfeng/dsh-conversation-history/issues). Do not attach raw conversations, account settings or credentials.

## License

[MIT](LICENSE)
