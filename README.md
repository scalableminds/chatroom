# React-based Chatroom Component for Rasa Stack

[![CircleCI](https://circleci.com/gh/scalableminds/simple-chatroom.svg?style=svg)](https://circleci.com/gh/scalableminds/simple-chatroom)

<a href="https://npm-scalableminds.s3.eu-central-1.amazonaws.com/@scalableminds/simple-chatroom@master/demo.html"><img src="https://npm-scalableminds.s3.amazonaws.com/%40scalableminds/simple-chatroom/demo.gif" alt="Demo" width="409" height="645" /></a>

[Watch our Chatroom in action](https://npm-scalableminds.s3.eu-central-1.amazonaws.com/@scalableminds/simple-chatroom@master/demo.html)

[Try a chatbot](https://scalableminds.com/)

## Features

* React-based component
* Markdown, Images, Buttons
* Customizable with SASS variables
* Queues consecutive bot messages for better readability
* Demo mode included (for scripted screencasts)
* Hosted on S3 for easy use

## Usage

```html
<head>
  <link rel="stylesheet" href="https://npm-scalableminds.s3.eu-central-1.amazonaws.com/@scalableminds/simple-chatroom@master/dist/Chatroom.css" />
</head>
<body>
  <div class="chat-container"></div>

  <script src="https://npm-scalableminds.s3.eu-central-1.amazonaws.com/@scalableminds/simple-chatroom@master/dist/Chatroom.js"/></script>
  <script type="text/javascript">
    var chatroom = window.SimpleChatroom({
      host: "https://mike.bots.scm.io",
      title: "Chat with Mike",
      container: document.querySelector(".container"),
      welcomeMessage: "Hi, I am Mike. How may I help you?"
    });
  </script>
</body>
```

## Development

### Install Dependencies

```
yarn install
```

### Build the Simple Chatroom

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
