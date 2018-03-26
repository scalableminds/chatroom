# A Simple Chatroom component

```
var chatroom = window.SimpleChatroom({
    host: "http://localhost:5002",
    title: "Chat with Mike",
    container: document.querySelector(".container"),
    welcomeMessage: "Hi, I am Mike. How may I help you?"
});
```


## Development
Install Dependencies
```
yarn install
```

Build the Simple Chatroom
```
yarn build
// or
yarn watch
```

Open `index.html` in your browser.