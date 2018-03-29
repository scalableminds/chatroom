// @flow
import type { ChatMessage } from "./Chatroom";

import "babel-polyfill";
import React from "react";
import ReactDOM from "react-dom";

import Chatroom from "./Chatroom";
import { noop, sleep, uuidv4 } from "./utils";
import ConnectedChatroom from "./ConnectedChatroom";

const USERID_STORAGE_KEY = "simple-chatroom-cid";

type SimpleChatroomOptions = {
  host: string,
  title?: string,
  welcomeMessage?: string,
  container: HTMLElement,
};

window.SimpleChatroom = function(options: SimpleChatroomOptions) {
  let sessionUserId = window.sessionStorage.getItem(USERID_STORAGE_KEY);

  if (sessionUserId == null) {
    sessionUserId = uuidv4();
    window.sessionStorage.setItem(USERID_STORAGE_KEY, sessionUserId);
  }

  this.ref = ReactDOM.render(
    <ConnectedChatroom
      userId={sessionUserId}
      host={options.host}
      title={options.title || "Chat"}
      welcomeMessage={options.welcomeMessage}
    />,
    options.container,
  );

  this.openChat = () => {
    this.ref.setState({ isOpen: true });
  };
};

type DemoSimpleChatroomOptions = {
  title: string,
  container: HTMLElement,
};

window.DemoSimpleChatroom = function(options: DemoSimpleChatroomOptions) {
  this.render = (messages: Array<ChatMessage>, showWaitingBubble: boolean = false) => {
    this.ref = ReactDOM.render(
      <Chatroom
        messages={messages}
        showWaitingBubble={showWaitingBubble}
        isOpen={true}
        title={options.title || "Chat"}
        onButtonClick={noop}
        onToggleChat={noop}
        onSendMessage={noop}
      />,
      options.container,
    );
  };

  this.demo = async (_messages: Array<ChatMessage>, delay: number = 1000) => {
    const messages = _messages.map((m, i) => ({
      message: m.message,
      username: m.username || "user",
      time: Date.now() + delay * i,
      uuid: uuidv4(),
    }));

    for (let i = 0; i <= messages.length; i++) {
      const showWaitingBubble = i < messages.length && messages[i].username === "bot";
      this.render(messages.slice(0, i), showWaitingBubble);
      await sleep(delay);
    }
  };
  this.render([]);
};
