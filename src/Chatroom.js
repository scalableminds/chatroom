// @flow
import "babel-polyfill";
import React from "react";
import ReactDOM from "react-dom";
import isEqual from "lodash.isequal";

import "./Chatroom.css";
import { uuidv4 } from "./utils";
import Message, { MessageTime } from "./Message";

const REDRAW_INTERVAL = 10000;
const GROUP_INTERVAL = 60000;

export type ChatMessage = {
  message:
    | {
        type: "text",
        text: string,
      }
    | { type: "image", image: string }
    | { type: "button", buttons: Array<{ payload: string, title: string }> },
  username: string,
  time: number,
  uuid: string,
};

const WaitingBubble = () => (
  <li className="chat waiting">
    <span>●</span> <span>●</span> <span>●</span>
  </li>
);

const MessageGroup = ({ messages, onButtonClick }) => {
  const isBot = messages[0].username === "bot";
  return (
    <React.Fragment>
      {messages.map((message, i) => (
        <Message chat={message} key={i} onButtonClick={onButtonClick} />
      ))}
      <MessageTime time={messages[messages.length - 1].time} isBot={isBot} />
    </React.Fragment>
  );
};

type ChatroomProps = {
  messages: Array<ChatMessage>,
  title: string,
  isOpen: boolean,
  showWaitingBubble: boolean,
  onButtonClick: (message: string, payload: string) => *,
  onSendMessage: (message: string) => *,
  onToggleChat: () => *,
};

export default class Chatroom extends React.Component<ChatroomProps, {}> {
  lastRendered: number = 0;
  chatsRef: ?HTMLElement = null;
  inputRef: ?HTMLInputElement = null;

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
    return !isEqual(nextProps, this.props) || Date.now() > this.lastRendered + REDRAW_INTERVAL;
  }

  getInputRef(): HTMLInputElement {
    const { inputRef } = this;
    if (inputRef == null) throw new TypeError("inputRef is null.");
    return ((ReactDOM.findDOMNode(inputRef): any): HTMLInputElement);
  }

  getChatsRef(): HTMLElement {
    const { chatsRef } = this;
    if (chatsRef == null) throw new TypeError("chatsRef is null.");
    return ((ReactDOM.findDOMNode(chatsRef): any): HTMLElement);
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

  groupMessages(messages: Array<ChatMessage>) {
    if (messages.length === 0) return [];

    let currentGroup = [messages[0]];
    let lastTime = messages[0].time;
    let lastUsername = messages[0].username;
    const groups = [currentGroup];

    for (const message of messages.slice(1)) {
      if (message.username !== lastUsername || message.time > lastTime + GROUP_INTERVAL) {
        currentGroup = [message];
        groups.push(currentGroup);
      } else {
        currentGroup.push(message);
      }
      lastTime = message.time;
      lastUsername = message.username;
    }
    return groups;
  }

  render() {
    const { messages, isOpen, showWaitingBubble } = this.props;
    const chatroomClassName = `chatroom ${isOpen ? "open" : "closed"}`;

    const messageGroups = this.groupMessages(messages);

    return (
      <div className={chatroomClassName}>
        <h3 onClick={this.props.onToggleChat}>{this.props.title}</h3>
        <div
          className="chats"
          ref={el => {
            this.chatsRef = el;
          }}
        >
          {messageGroups.map((group, i) => (
            <MessageGroup messages={group} key={i} onButtonClick={this.props.onButtonClick} />
          ))}
          {showWaitingBubble ? <WaitingBubble /> : null}
        </div>
        <form className="input" onSubmit={this.handleSubmitMessage}>
          <input
            type="text"
            ref={el => {
              this.inputRef = el;
            }}
          />
          <input type="submit" value="Submit" />
        </form>
      </div>
    );
  }
}
