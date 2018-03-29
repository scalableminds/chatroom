// @flow
import "babel-polyfill";
import React from "react";
import ReactDOM from "react-dom";
import isEqual from "lodash.isequal";

import "./Chatroom.css";
import { uuidv4 } from "./utils";
import Message from "./Message";

const REDRAW_INTERVAL = 10000;

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

  render() {
    const { messages, isOpen, showWaitingBubble } = this.props;
    const chatroomClassName = `chatroom ${isOpen ? "open" : "closed"}`;

    return (
      <div className={chatroomClassName}>
        <h3 onClick={this.props.onToggleChat}>{this.props.title}</h3>
        <ul
          className="chats"
          ref={el => {
            this.chatsRef = el;
          }}
        >
          {messages.map((chat, i) => (
            <Message chat={chat} key={chat.uuid || i} onButtonClick={this.props.onButtonClick} />
          ))}
          {showWaitingBubble ? <WaitingBubble /> : null}
        </ul>
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
