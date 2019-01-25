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
  pollingInterval: number,
  speechRecognition: ?string,
  messageBlacklist: Array<string>,
  fetchOptions?: RequestOptions
};
type ConnectedChatroomState = {
  messages: Array<ChatMessage>,
  localMessages: Array<ChatMessage>,
  isOpen: boolean,
  waitingForBotResponse: boolean,
  messageCounter: number
};

export default class ConnectedChatroom extends Component<
  ConnectedChatroomProps,
  ConnectedChatroomState
> {
  state = {
    messages: [],
    localMessages: [],
    isOpen: false,
    waitingForBotResponse: false,
    messageCounter: -1
  };

  static defaultProps = {
    waitingTimeout: 5000,
    pollingInterval: 1000,
    messageBlacklist: ["_restart", "_start"]
  };

  waitingForBotResponseTimer: ?TimeoutID = null;
  messageCounterInterval: ?IntervalID = null;
  _isMounted: boolean = false;
  chatroomRef = React.createRef();

  componentDidMount() {
    this._isMounted = true;
    this.poll();
  }

  componentDidUpdate(
    prevProps: ConnectedChatroomProps,
    prevState: ConnectedChatroomState
  ) {
    if (!prevState.isOpen && this.state.isOpen) {
      this.fetchMessages();
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
    if (this.waitingForBotResponseTimer != null) {
      window.clearTimeout(this.waitingForBotResponseTimer);
      this.waitingForBotResponseTimer = null;
    }
    if (this.messageCounterInterval != null) {
      window.clearInterval(this.messageCounterInterval);
      this.messageCounterInterval = null;
    }
  }

  sendMessage = async (messageText: string, payload?: string) => {
    if (messageText === "") return;

    const messageObj = {
      message: { type: "text", text: messageText },
      time: Date.now(),
      username: this.props.userId,
      uuid: uuidv4()
    };

    if (!this.props.messageBlacklist.includes(messageText)) {
      this.setState({
        localMessages: [...this.state.localMessages, messageObj],
        // Reveal all queued bot messages when the user sends a new message
        messageCounter: this.state.messages.length
      });
    }

    const getParameters = {
      message: messageObj.message.text,
      payload: payload,
      uuid: messageObj.uuid
    };
    const getParametersString = Object.keys(getParameters)
      .filter(k => getParameters[k] != null)
      .map(k => `${k}=${encodeURI(String(getParameters[k]))}`)
      .join("&");

    this.setState({ waitingForBotResponse: true });
    if (this.waitingForBotResponseTimer != null) {
      window.clearTimeout(this.waitingForBotResponseTimer);
    }
    this.waitingForBotResponseTimer = setTimeout(() => {
      if (this.state.messageCounter === this.state.messages.length) {
        this.setState({ waitingForBotResponse: false });
      }
    }, this.props.waitingTimeout);
    await fetch(
      `${this.props.host}/webhooks/chatroom/conversations/${
        this.props.userId
      }/say?${getParametersString}`,
      this.props.fetchOptions
    );

    if (window.ga != null) {
      window.ga("send", "event", "chat", "chat-message-sent");
    }
    await this.fetchMessages();
  };

  async fetchMessages() {
    const res = await fetch(
      `${this.props.host}/webhooks/chatroom/conversations/${
        this.props.userId
      }/log?nocache=${Date.now()}`,
      this.props.fetchOptions
    );
    const messages = await res.json();

    // Fix dates
    messages.forEach(m => {
      m.time = Date.parse(`${m.time}Z`);
    });

    // Remove redundant local messages
    const localMessages = this.state.localMessages.filter(
      m => !messages.some(n => n.uuid === m.uuid)
    );

    // Bot messages should be displayed in a queued manner. Not all at once
    let { messageCounter } = this.state;

    // Show all previous messages at the beginning of the session, e.g. page refresh
    if (messageCounter < 0) {
      messageCounter = messages.length;
    }
    if (messageCounter < messages.length) {
      // Increase the counter in every loop
      messageCounter++;

      // Set the counter to the last user message
      let lastUserMessageIndex = messages.length - 1;
      for (
        ;
        lastUserMessageIndex >= 0 &&
        messages[lastUserMessageIndex].username === "bot";
        lastUserMessageIndex--
      );

      messageCounter = Math.max(lastUserMessageIndex, messageCounter);
    }

    // We might still be waiting on bot responses,
    // if there are unconfirmed user messages or missing replies
    const waitingForBotResponse =
      (this.state.waitingForBotResponse &&
        messageCounter !== messages.length) ||
      (localMessages.length > 0 &&
        (messages.length === 0 ||
          messages[messages.length - 1].username !== "bot"));

    this.setState({
      messages,
      localMessages,
      waitingForBotResponse,
      messageCounter
    });
  }

  async poll() {
    while (this._isMounted) {
      try {
        if (this.state.isOpen) {
          await this.fetchMessages();
        }
      } catch (err) {
        // pass
      }
      await sleep(this.props.pollingInterval);
    }
  }

  handleButtonClick = (message: string, payload: string) => {
    this.sendMessage(message, payload);
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
    const {
      messages,
      localMessages,
      waitingForBotResponse,
      messageCounter
    } = this.state;

    const welcomeMessage =
      this.props.welcomeMessage != null
        ? {
            username: "bot",
            time: 0,
            message: {
              text: this.props.welcomeMessage,
              type: "text"
            },
            uuid: "9b9c4e2d-eb7f-4425-b23c-30c25bd7f507"
          }
        : null;

    let renderableMessages =
      welcomeMessage != null
        ? [
            welcomeMessage,
            ...messages.slice(0, Math.max(0, messageCounter)),
            ...localMessages
          ]
        : [...messages.slice(0, Math.max(0, messageCounter)), ...localMessages];

    renderableMessages = renderableMessages
      .filter(
        message =>
          message.message.type !== "text" ||
          !this.props.messageBlacklist.includes(message.message.text)
      )
      .sort((a, b) => a.time - b.time);

    return (
      <Chatroom
        messages={renderableMessages}
        title={this.props.title}
        waitingForBotResponse={waitingForBotResponse}
        isOpen={this.state.isOpen}
        speechRecognition={this.props.speechRecognition}
        onToggleChat={this.handleToggleChat}
        onButtonClick={this.handleButtonClick}
        onSendMessage={this.sendMessage}
        ref={this.chatroomRef}
      />
    );
  }
}
