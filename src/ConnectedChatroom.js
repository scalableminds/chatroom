// @flow
import React from "react";

import type { ChatMessage } from "./Chatroom";
import Chatroom from "./Chatroom";
import { sleep, uuidv4 } from "./utils";

const POLLING_INTERVAL = 1000;
const MESSAGE_BLACKLIST = ["_restart"];

type ConnectedChatroomProps = {
  userId: string,
  host: string,
  welcomeMessage: ?string,
  title: string,
};
type ConnectedChatroomState = {
  messages: Array<ChatMessage>,
  localMessages: Array<ChatMessage>,
  isOpen: boolean,
};

export default class ConnectedChatroom extends React.Component<
  ConnectedChatroomProps,
  ConnectedChatroomState,
> {
  state = {
    messages: [],
    localMessages: [],
    isOpen: false,
  };
  _isMounted: boolean = false;

  componentDidMount() {
    this._isMounted = true;
    this.poll();
  }

  componentDidUpdate(prevProps: ConnectedChatroomProps, prevState: ConnectedChatroomState) {
    if (!prevState.isOpen && this.state.isOpen) {
      this.fetchMessages();
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  sendMessage = async (messageText: string, payload?: string) => {
    if (messageText === "") return;

    const messageObj = {
      message: { type: "text", text: messageText },
      time: Date.now(),
      username: this.props.userId,
      uuid: uuidv4(),
    };

    if (!MESSAGE_BLACKLIST.includes(messageText)) {
      this.setState({
        localMessages: [...this.state.localMessages, messageObj],
      });
    }

    const getParameters = {
      message: messageObj.message.text,
      payload: payload,
      uuid: messageObj.uuid,
    };
    const getParametersString = Object.keys(getParameters)
      .filter(k => getParameters[k] != null)
      .map(k => `${k}=${encodeURI(String(getParameters[k]))}`)
      .join("&");

    await fetch(`${this.props.host}/conversations/${this.props.userId}/say?${getParametersString}`);

    if (window.ga != null) {
      window.ga("send", "event", "chat", "chat-message-sent");
    }
    await this.fetchMessages();
  };

  async fetchMessages() {
    const res = await fetch(`${this.props.host}/conversations/${this.props.userId}/log`);
    const messages = await res.json();
    messages.forEach(m => {
      m.time = Date.parse(`${m.time}Z`);
    });

    // remove redundant local messages
    const localMessages = this.state.localMessages.filter(
      m => !messages.some(n => n.uuid === m.uuid),
    );

    // const messages = require("./messages.json");
    this.setState({ messages, localMessages });
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
      await sleep(POLLING_INTERVAL);
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
    const { messages, localMessages } = this.state;

    const welcomeMessage =
      this.props.welcomeMessage != null
        ? {
            username: "bot",
            time: 0,
            message: {
              text: this.props.welcomeMessage,
              type: "text",
            },
            uuid: "9b9c4e2d-eb7f-4425-b23c-30c25bd7f507",
          }
        : null;

    const renderableMessages =
      welcomeMessage != null
        ? [welcomeMessage, ...messages, ...localMessages]
        : [...messages, ...localMessages];

    renderableMessages.sort((a, b) => a.time - b.time);

    const showWaitingBubble =
      localMessages.length > 0 ||
      (renderableMessages.length > 0 &&
        renderableMessages[renderableMessages.length - 1].username != "bot");

    return (
      <Chatroom
        messages={renderableMessages}
        title={this.props.title}
        showWaitingBubble={showWaitingBubble}
        isOpen={this.state.isOpen}
        onToggleChat={this.handleToggleChat}
        onButtonClick={this.handleButtonClick}
        onSendMessage={this.sendMessage}
      />
    );
  }
}
