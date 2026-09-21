# Quietgram

A Tampermonkey userscript for a calmer, lower-pressure Instagram messaging experience.

Quietgram removes or neutralizes some of the social cues in Instagram Direct that can make messaging feel unnecessarily stressful — things like read indicators, activity status, typing indicators, profile photos, and interface motion.

It runs entirely in your browser and modifies only what **you** see.

> **Note**
> Quietgram is an independent project and is not affiliated with, endorsed by, or associated with Instagram or Meta.

## Why?

Messaging interfaces contain a surprising number of small social signals:

* Did they see my message?
* Are they online?
* Are they typing?
* Why did they stop typing?
* Why haven't they replied yet?
* Who am I talking to?
* Should I reply immediately?

For some people, those signals are useful. For others, they create unnecessary pressure.

Quietgram makes those cues optional.

The goal isn't to change how Instagram works for everyone. It's to give you a quieter version of the interface when you want one.

## Features

Quietgram currently supports:

### Neutral profile photos

Replaces profile pictures in Instagram Direct with a generic neutral avatar.

This can make conversations feel less visually personal or attention-grabbing while still preserving the structure of the interface.

### Hide seen indicators

Hides visible read-status indicators such as:

* `Seen`
* `Viewed`
* timestamped variants of those indicators
* small avatar-based read markers beneath messages

**Important:** this only hides read receipts from **your interface**.

Quietgram does **not** prevent Instagram from sending read-receipt information to other users.

There is currently no network interception involved.

### Hide activity status

Hides indicators such as:

* `Active now`
* `Active today`
* `Active yesterday`
* localized variants supported by the script

### Hide typing indicators

Hides indicators such as:

* `Typing...`
* `Digitando...`
* `Escribiendo...`

### Reduce interface motion

Disables or drastically shortens most animations and transitions while Quietgram is active.

This can make Instagram Direct feel visually quieter and less attention-demanding.

### Hide contacts sidebar

Temporarily hides the conversation list while you're inside Instagram Direct.

With fewer names, avatars, unread conversations, and other competing cues on screen, you can focus on the conversation you currently have open instead of being reminded of everything else waiting for your attention.

The sidebar can be shown again at any time, so your conversations remain easily accessible when you need them.

## Settings

Every feature can be enabled or disabled independently through the Tampermonkey menu.

Available options:

* Calm mode
* Neutral profile photos
* Hide seen indicators
* Hide activity status
* Hide typing indicators
* Reduce interface motion
* Hide contacts sidebar

Your preferences are stored locally using Tampermonkey's userscript storage.

Quietgram only activates on Instagram Direct pages.

## Installation

### 1. Install a userscript manager

Install [Tampermonkey](https://www.tampermonkey.net/) or another compatible userscript manager.

### 2. Install Quietgram

Create a new userscript in Tampermonkey and paste the contents of the Quietgram userscript into it.

Save the script and make sure it is enabled.

Once a packaged release is available, this section can instead link directly to the raw `.user.js` file.

### 3. Open Instagram Direct

Visit:

`https://www.instagram.com/direct/`

Quietgram should activate automatically.

Use the Tampermonkey extension menu to turn individual features on or off.

## Privacy

Quietgram runs locally in your browser.

The script:

* does not send your messages anywhere
* does not collect analytics
* does not include tracking
* does not communicate with an external server
* does not intercept Instagram network requests
* stores only your Quietgram preferences through Tampermonkey

Of course, Instagram itself continues to operate normally underneath the modified interface.

## How it works

Quietgram observes Instagram's dynamically rendered interface and identifies UI elements associated with profile pictures, read indicators, activity indicators, typing indicators, and animations.

Rather than deleting Instagram-owned DOM elements, Quietgram marks matching elements and hides or visually replaces them with CSS.

Because Instagram is a React application and frequently reuses DOM nodes, Quietgram periodically re-evaluates those elements as the interface changes.

The script intentionally avoids intercepting Instagram's network traffic.

## Limitations

Instagram changes its frontend frequently.

That means selectors, labels, DOM structures, and accessibility attributes used by Quietgram may change without notice.

Some features are therefore necessarily best-effort.

Quietgram currently recognizes several English, Portuguese, and Spanish status labels, with limited additional language support. Contributions improving localization are welcome.

Most importantly:

**Hiding a read indicator does not stop the other person from receiving a read receipt.**

Quietgram changes your local interface only.

## Philosophy

Quietgram follows a few simple principles:

**Local first.**
Interface modifications should happen in your browser whenever possible.

**Minimal intervention.**
Prefer hiding or neutralizing UI elements rather than modifying Instagram's underlying behavior.

**User choice.**
Every major social cue should be independently configurable.

**No dark patterns.**
No analytics, engagement tracking, ads, or unnecessary notifications.

**Calmer by default.**
The project should reduce social pressure rather than create new things to monitor.

## Development

The project is a plain userscript and does not currently require a build system.

Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/quietgram.git
cd quietgram
```

Install the userscript in Tampermonkey and point your development workflow at the local source, or copy changes into the Tampermonkey editor while developing.

When testing changes, useful cases include:

* Direct message thread list
* Individual DM conversations
* Group conversations
* Seen indicators with and without timestamps
* Avatar-based seen indicators
* Activity status
* Typing indicators
* React navigation between conversations
* Browser resizing
* Different Instagram languages
* Turning individual Quietgram settings on and off

## Contributing

Contributions are welcome.

Useful contributions include:

* fixing selectors after Instagram UI changes
* adding support for additional languages
* improving avatar detection
* reducing false positives when detecting status text
* accessibility improvements
* additional optional ways to reduce social-pressure cues

If you're proposing a new feature, please keep Quietgram's basic philosophy in mind: the goal is to make the interface quieter without unnecessarily changing Instagram's underlying behavior.

## Disclaimer

Quietgram is an unofficial third-party userscript.

Instagram is a trademark of Meta Platforms, Inc. This project is not affiliated with, sponsored by, or endorsed by Instagram or Meta.

Use userscripts at your own discretion.

## License

MIT

See [LICENSE](LICENSE) for details.
