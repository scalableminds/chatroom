> This fork is under development to enable handing off from one bot to another.
> You will need to build chatroom locally to use this capability
> see section "[Handoff to another bot/host](#setting-up-handoff-capability)"


# React-based Chatroom Component for Rasa Stack

[![CircleCI](https://circleci.com/gh/scalableminds/chatroom.svg?style=svg)](https://circleci.com/gh/scalableminds/chatroom)

<a href="https://npm-scalableminds.s3.eu-central-1.amazonaws.com/@scalableminds/chatroom@master/demo.html"><img src="https://npm-scalableminds.s3.amazonaws.com/%40scalableminds/chatroom/demo.gif" alt="Demo" width="409" height="645" /></a>

[Watch a demo of our Chatroom in action](https://npm-scalableminds.s3.eu-central-1.amazonaws.com/@scalableminds/chatroom@master/demo.html)

## Features

* React-based component
* Supports Text with Markdown formatting, Images, and Buttons
* Customizable with SASS variables
* Generates a unique session id and keeps it in `sessionStorage`
* Queues consecutive bot messages for better readability
* Speech input (only in Chrome for now)
* Text to Speech (only in Chrome for now)
* Demo mode included (ideal for scripted screencasts)
* Hosted on S3 for easy use
* Simple setup. Works with Rasa's [REST channel](https://rasa.com/docs/rasa/user-guide/connectors/your-own-website/#rest-channels)
* [Handoff to another bot/host](#setting-up-handoff-capability)

## Usage
1. Embed the `chatroom.js` in the HTML of your website and configure it to connect to your Rasa bot. Either use the S3 hosted version or build it yourself. (see below) You will have to build it yourself to use the handoff capability

```html
<head>
  <link rel="stylesheet" href="http://127.0.0.1:8080/dist/Chatroom.css" />
</head>
<body>
  <div class="chat-container"></div>

  <script src="http://127.0.0.1:8080/dist/Chatroom.js"/></script>
  <script type="text/javascript">
    var chatroom = new window.Chatroom({
      host: "http://localhost:5005",
      title: "Chat with Mike",
      container: document.querySelector(".chat-container"),
      welcomeMessage: "Hi, I am Mike. How may I help you?",
      speechRecognition: "en-US",
      voiceLang: "en-US"
    });
    chatroom.openChat();
  </script>
</body>
```


2. In your Rasa bot setup, make sure to include the Rasa [REST channel](https://rasa.com/docs/rasa/user-guide/connectors/your-own-website/#rest-channels) in your `credentials.yml` file:
```
rest:
  # pass
```

Depending on your setup you might need to start the Rasa CLI / Rasa server with the right CORS headers, e.g. `--cors "*"`.

Note, the version of the Chatroom's Javascript file is encoded in the URL. `chatroom@master` is always the latest version from the GitHub master branch. Use e.g. `chatroom@0.10.0` to load a specific release. [All Releases can be found here.](https://github.com/scalableminds/chatroom/releases)


| Chatroom Version  | Compatible Rasa Core Version |
|-------------------|------------------------------|
| 0.10.x            | 1.0                          |
| 0.9.x (Deprecated)| 0.11.4+, 0.13.7              |
| 0.8.x (Deprecated)| 0.11.4+                      |
| 0.7.8 (Deprecated)| 0.10.4+                      |

Note, versions prior to `0.10.x` used a custom Python channel to connect the chatroom frontend with a Rasa bot backend. Upgrading, from version `0.9.x` or below will require you to modify the `credentials.yml` and include the Rasa REST channel. (see installation instructions above)

## Setting up handoff capability

This version of chatroom will switch hosts on demand when it receives a bot message with `handoff_host` given in a custom json payload in a bot message. You could use this either for a human handoff (you'd need to configure whichever channel the human was chatting on seperately) or a
handoff to another bot. The examples below assume handoff to another bot.

### Chatroom configuration for handoff

If you're happy with the defaults described below, no configuration of chatroom is required to make this work, but you will need to configure
your bot(s) to send and handle the expected handoff messages.
 
The payload that will trigger a handoff can also include the title of the chat window for the new host (this is optional):
```
{
  "handoff_host":"http://localhost:5006",
  "title": "Handoff Bot"
}
```

By default, chatroom will send the following message to the handoff host upon receiving the handoff payload:

```
/handoff{"from_host":"<original host url>"}
```

You can configure which intent is sent to the handoff host by setting `handoffIntent` in the properties. e.g.

```
    var chatroom = new window.Chatroom({
...
      handoffIntent: "handoff_other",
...
    });
```

Regardless of the intent, `{"from_host":"<original host url>"}` will still be passed along with it.

### Bot configuration for handoff

To trigger a handoff from a bot, the bot needs to send a message with the payload specified above.
This could be sent from a custom action in a Rasa bot e.g.
```
    dispatcher.utter_message(json_message = {
        "handoff_host": "http://localhost:5006",
        "title": "Handoff Bot"
        })
```

or sent from a response template i.e. in `domain.yml`
```
responses:
  utter_handoff:
    custom:
      handoff_host: "http://localhost:5006"
      title: "Handoff Bot"
```

You should also make sure there is defined behaviour for whichever `handoffIntent` you define, so that the first response from the bot 
after handoff isn't a fallback or out of scope response.

You don't have to do anything with the `from_host` entity that is passed unless you want to. You would want to set a slot with it if any behaviour in your bot depends
on whether a handoff has occurred or from where a handoff occurred.

A minimal example setup for handoff from a Rasa bot would look as follows in `domain.yml`:

```
intents:
- trigger_handoff:
    triggers: utter_handoff
- handoff:
    triggers: utter_welcome
responses:
  utter_handoff:
    custom:
      handoff_host: "http://localhost:5006"
      title: "Handoff Bot"
  utter_welcome:
    text: Welcome! I'm <bot description here>
```

Then if you were to enter  `/trigger_handoff` or something that got classified as such in chatroom, the host would switch to `http://localhost:5006`.



## Development

### Install dependencies

```
yarn install
```

### Continuously build the Chatroom component

```
yarn watch
yarn serve
```

Open `http://localhost:8080/demo.html` in your browser.

## Build

```
yarn build
```

Distributable files will be created in folder `dist`.

## License

AGPL v3

Made by [scalable minds](https://scalableminds.com)
