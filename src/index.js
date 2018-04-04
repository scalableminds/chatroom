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
  this.demoIsPlaying = false;

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

  this.demo = async (
    _messages: Array<ChatMessage>,
    delay: number = 1000,
    keyDelay: number = 100,
  ) => {
    if (this.demoIsPlaying) return;
    this.demoIsPlaying = true;

    if (_messages.length === 0) return;

    const messages = _messages.map((m, i) => ({
      message: m.message,
      username: m.username || "user",
      time: Date.now() + delay * i,
      uuid: uuidv4(),
    }));

    for (let i = -1; i < messages.length; i++) {
      if (i < 0 && messages[0].username === "bot") {
        this.render([], true);
      } else {
        const currentMessage = messages[i];

        // Show waiting when next message is a bot message
        const showWaitingBubble = i + 1 < messages.length && messages[i + 1].username === "bot";

        // Show typing animation if current message is a user message
        if (currentMessage.username !== "bot" && currentMessage.message.type === "text") {
          const messageText = currentMessage.message.text;
          this.ref.getInputRef().focus();
          for (let j = 0; j < messageText.length; j++) {
            this.ref.getInputRef().value = messageText.substring(0, j + 1);
            await sleep(keyDelay);
          }
          await sleep(delay);
          this.ref.getInputRef().value = "";
          this.ref.getInputRef().blur();
        }
        this.render(messages.slice(0, i + 1), showWaitingBubble);
      }
      await sleep(delay);
    }

    this.demoIsPlaying = false;
  };
  this.render([]);
};
