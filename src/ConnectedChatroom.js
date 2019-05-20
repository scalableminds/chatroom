// @flow
import React, { Component } from "react";
import type { ElementRef } from "react";

import type { ChatMessage } from "./Chatroom";
import Chatroom from "./Chatroom";
import { sleep, uuidv4 } from "./utils";

type ConnectedChatroomProps = {
  userId: string,
  host: string,
  welcomeMessage: ?string,
  title: string,
  waitingTimeout: number,
  messageBlacklist: Array<string>,
  fetchOptions?: RequestOptions,
};
type ConnectedChatroomState = {
  messages: Array<ChatMessage>,
  messageQueue: Array<ChatMessage>,
  isOpen: boolean,
  waitingForBotResponse: boolean,
};

type RasaMessage = {
  sender_id: string,
  text?: string,
  buttons?: Object,
  image?: string,
};

export default class ConnectedChatroom extends Component<
  ConnectedChatroomProps,
  ConnectedChatroomState,
> {
  state = {
    messages: [],
    messageQueue: [],
    isOpen: false,
    waitingForBotResponse: false,
    messageCounter: -1,
  };

  static defaultProps = {
    waitingTimeout: 5000,
    messageBlacklist: ["_restart", "_start", "/restart", "/start"],
  };

  waitingForBotResponseTimer: ?TimeoutID = null;
  messageQueueInterval: ?IntervalID = null;
  chatroomRef = React.createRef();

  componentDidMount() {
    const messageDelay = 800; //delay between message in ms
    this.messageQueueInterval = window.setInterval(this.queuedMessagesInterval, messageDelay);

    if (this.props.welcomeMessage) {
      const welcomeMessage = {
        message: { type: "text", text: this.props.welcomeMessage },
        time: Date.now(),
        username: "bot",
        uuid: uuidv4(),
      };
      this.setState({ messages: [welcomeMessage] });
    }
  }

  componentWillUnmount() {
    if (this.waitingForBotResponseTimer != null) {
      window.clearTimeout(this.waitingForBotResponseTimer);
      this.waitingForBotResponseTimer = null;
    }
    if (this.messageQueueInterval != null) {
      window.clearInterval(this.messageQueueInterval);
      this.messageQueueInterval = null;
    }
  }

  sendMessage = async (messageText: string) => {
    if (messageText === "") return;

    const messageObj = {
      message: { type: "text", text: messageText },
      time: Date.now(),
      username: this.props.userId,
      uuid: uuidv4(),
    };

    if (!this.props.messageBlacklist.includes(messageText)) {
      this.setState({
        // Reveal all queued bot messages when the user sends a new message
        messages: [...this.state.messages, ...this.state.messageQueue, messageObj],
        messageQueue: [],
      });
    }

    this.setState({ waitingForBotResponse: true });
    if (this.waitingForBotResponseTimer != null) {
      window.clearTimeout(this.waitingForBotResponseTimer);
    }
    this.waitingForBotResponseTimer = setTimeout(() => {
      if (this.state.messageCounter === this.state.messages.length) {
        this.setState({ waitingForBotResponse: false });
      }
    }, this.props.waitingTimeout);

    const rasaMessageObj = {
      message: messageObj.message.text,
      sender: this.props.userId,
    };

    const fetchOptions = Object.assign({}, this.props.fetchOptions, {
      method: "POST",
      body: JSON.stringify(rasaMessageObj),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await fetch(`${this.props.host}/webhooks/rest/webhook`, fetchOptions);
    const messages = await response.json();

    this.parseMessages(messages);

    if (window.ga != null) {
      window.ga("send", "event", "chat", "chat-message-sent");
    }
  };

  async parseMessages(RasaMessages: Array<RasaMessage>) {
    const messages = RasaMessages.map(message => {
      const messageObj = {
        message: {},
        time: Date.now(),
        username: "bot",
        uuid: uuidv4(),
      };

      if (message.text) messageObj.message = { type: "text", text: message.text };

      if (message.buttons) messageObj.message = { type: "button", buttons: message.buttons };

      if (message.image) messageObj.message = { type: "image", image: message.image };

      // probably should be handled with special UI elements
      if (message.attachment) messageObj.message = { type: "text", buttons: message.attachment };

      return messageObj;
    });

    // Bot messages should be displayed in a queued manner. Not all at once
    const newState = Object.assign({}, this.state, {
      messageQueue: [...this.state.messageQueue, ...messages],
    });
    this.setState(newState);
  }

  queuedMessagesInterval = () => {
    const { messages, messageQueue } = this.state;

    if (messageQueue.length > 0) {
      const message = messageQueue.shift();
      const waitingForBotResponse = messageQueue.length > 0;

      const newState = Object.assign({}, this.state, {
        messages: [...messages, message],
        messageQueue,
        waitingForBotResponse,
      });

      this.setState(newState);
    }
  };

  handleButtonClick = (buttonTitle: string, payload: string) => {
    this.sendMessage(payload);
    if (window.ga != null) {
      window.ga("send", "event", "chat", "chat-button-click");
    }
  };

  handleToggleChat = () => {
    if (window.ga != null) {
      if (this.state.isOpen) {
        window.ga("send", "event", "chat", "chat-close");
      } else {
        window.ga("send", "event", "chat", "chat-open");
      }
    }
    this.setState({ isOpen: !this.state.isOpen });
  };

  render() {
    const { messages, waitingForBotResponse } = this.state;

    const renderableMessages = messages
      .filter(
        message =>
          message.message.type !== "text" ||
          !this.props.messageBlacklist.includes(message.message.text),
      )
      .sort((a, b) => a.time - b.time);

    return (
      <Chatroom
        messages={renderableMessages}
        title={this.props.title}
        showWaitingBubble={waitingForBotResponse}
        isOpen={this.state.isOpen}
        onToggleChat={this.handleToggleChat}
        onButtonClick={this.handleButtonClick}
        onSendMessage={this.sendMessage}
        ref={this.chatroomRef}
      />
    );
  }
}
