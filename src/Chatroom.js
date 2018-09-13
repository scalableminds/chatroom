// @flow
import "babel-polyfill";
import React, { Component, Fragment } from "react";
import ReactDOM from "react-dom";
import isEqual from "lodash.isequal";
import classnames from "classnames";

// $FlowFixMe
import "./Chatroom.scss";

import { uuidv4 } from "./utils";
import Message, { MessageTime } from "./Message";

const REDRAW_INTERVAL = 10000;
const GROUP_INTERVAL = 60000;

export type ChatMessage = {
  message:
    | {
        type: "text",
        text: string
      }
    | { type: "image", image: string }
    | {
        type: "button",
        buttons: Array<{ payload: string, title: string, selected?: boolean }>
      },
  username: string,
  time: number,
  uuid: string
};

const WaitingBubble = () => (
  <li className="chat waiting">
    <span>●</span> <span>●</span> <span>●</span>
  </li>
);

const MessageGroup = ({ messages, onButtonClick }) => {
  const isBot = messages[0].username === "bot";
  const isButtonGroup =
    messages.length === 1 && messages[0].message.type === "button";
  return (
    <Fragment>
      {messages.map((message, i) => (
        <Message chat={message} key={i} onButtonClick={onButtonClick} />
      ))}
      {!isButtonGroup ? (
        <MessageTime time={messages[messages.length - 1].time} isBot={isBot} />
      ) : null}
    </Fragment>
  );
};

type ChatroomProps = {
  messages: Array<ChatMessage>,
  title: string,
  isOpen: boolean,
  showWaitingBubble: boolean,
  onButtonClick: (message: string, payload: string) => *,
  onSendMessage: (message: string) => *,
  onToggleChat: () => *
};

export default class Chatroom extends Component<ChatroomProps, {}> {
  lastRendered: number = 0;
  chatsRef = React.createRef();
  inputRef = React.createRef();

  componentDidMount() {
    this.scrollToBot();
  }

  componentDidUpdate(prevProps: ChatroomProps) {
    if (!isEqual(prevProps.messages, this.props.messages)) {
      this.scrollToBot();
    }
    if (!prevProps.isOpen && this.props.isOpen) {
      this.focusInput();
    }
    this.lastRendered = Date.now();
  }

  shouldComponentUpdate(nextProps: ChatroomProps) {
    return (
      !isEqual(nextProps, this.props) ||
      Date.now() > this.lastRendered + REDRAW_INTERVAL
    );
  }

  getInputRef(): HTMLInputElement {
    const { inputRef } = this;
    if (inputRef.current == null) throw new TypeError("inputRef is null.");
    return ((inputRef.current: any): HTMLInputElement);
  }

  getChatsRef(): HTMLElement {
    const { chatsRef } = this;
    if (chatsRef.current == null) throw new TypeError("chatsRef is null.");
    return ((chatsRef.current: any): HTMLElement);
  }

  scrollToBot() {
    this.getChatsRef().scrollTop = this.getChatsRef().scrollHeight;
  }

  focusInput() {
    this.getInputRef().focus();
  }

  handleSubmitMessage = async (e: SyntheticEvent<>) => {
    e.preventDefault();
    const message = this.getInputRef().value.trim();
    this.props.onSendMessage(message);
    this.getInputRef().value = "";
  };

  handleButtonClick = (message: string, payload: string) => {
    if (this.props.onButtonClick != null) {
      this.props.onButtonClick(message, payload);
    }
    this.focusInput();
  };

  groupMessages(messages: Array<ChatMessage>) {
    if (messages.length === 0) return [];

    let currentGroup = [messages[0]];
    let lastTime = messages[0].time;
    let lastUsername = messages[0].username;
    let lastType = messages[0].message.type;
    const groups = [currentGroup];

    for (const message of messages.slice(1)) {
      if (
        // Buttons always have their own group
        lastType === "button" ||
        message.message.type === "button" ||
        // Messages are grouped by user/bot
        message.username !== lastUsername ||
        // Only time-continuous messages are grouped
        message.time > lastTime + GROUP_INTERVAL
      ) {
        // new group
        currentGroup = [message];
        groups.push(currentGroup);
      } else {
        // append to group
        currentGroup.push(message);
      }
      lastTime = message.time;
      lastUsername = message.username;
      lastType = message.message.type;
    }
    return groups;
  }

  render() {
    const { messages, isOpen, showWaitingBubble } = this.props;
    const messageGroups = this.groupMessages(messages);

    return (
      <div className={classnames("chatroom", isOpen ? "open" : "closed")}>
        <h3 onClick={this.props.onToggleChat}>{this.props.title}</h3>
        <div className="chats" ref={this.chatsRef}>
          {messageGroups.map((group, i) => (
            <MessageGroup
              messages={group}
              key={i}
              onButtonClick={this.handleButtonClick}
            />
          ))}
          {showWaitingBubble ? <WaitingBubble /> : null}
        </div>
        <form className="input" onSubmit={this.handleSubmitMessage}>
          <input type="text" ref={this.inputRef} />
          <input type="submit" value="Submit" />
        </form>
      </div>
    );
  }
}
