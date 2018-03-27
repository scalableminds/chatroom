import "babel-polyfill";
import React from "react";
import ReactDOM from "react-dom";
import Markdown from "react-markdown";
import breaks from "remark-breaks";
import moment from "moment";
import isEqual from "lodash.isequal";

import "./Chatroom.css";

const POLLING_INTERVAL = 1000;
const REDRAW_INTERVAL = 10000;

function renderMessageTime(_messageTime) {
  if (_messageTime === 0) return;

  const messageTime = Math.min(Date.now(), _messageTime);
  return (
    <span className="time" title={new Date(messageTime).toISOString()}>
      {moment(messageTime).fromNow()}
    </span>
  );
}

const Message = ({ chat, user, onButtonClick }) => {
  const message = chat.message;
  switch (message.type) {
    case "button":
      return (
        <ul className="chat-buttons">
          {chat.message.buttons.map(({ payload, title }) => (
            <li
              className="chat-button"
              key={payload}
              onClick={() => onButtonClick(payload)}
            >
              {title}
            </li>
          ))}
        </ul>
      );

    case "image":
      return (
        <li
          className={`chat ${
            user === chat.username ? "right" : "left"
          } chat-img`}
        >
          <img src={message.image} alt="" />
          {renderMessageTime(chat.time)}
        </li>
      );
    default:
      return (
        <li className={`chat ${user === chat.username ? "right" : "left"}`}>
          <Markdown
            className="text"
            source={message.text}
            skipHtml={false}
            allowedTypses={[
              "root",
              "break",
              "paragraph",
              "emphasis",
              "strong",
              "link",
              "list",
              "listItem",
              "image"
            ]}
            renderers={{
              paragraph: ({ children }) => <span>{children}</span>,
              link: ({ href, children }) => (
                <a href={href} target="_blank">
                  {children}
                </a>
              )
            }}
            plugins={[breaks]}
          />
          {renderMessageTime(chat.time)}
        </li>
      );
  }
};

const WaitingBubble = () => (
  <li className={`chat waiting`}>
    <span>●</span> <span>●</span> <span>●</span>
  </li>
);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class Chatroom extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      messages: [],
      localMessages: [],
      isOpen: false
    };

    this.handleSubmitMessage = this.handleSubmitMessage.bind(this);
    this.handleToggleChat = this.handleToggleChat.bind(this);
    this.handleButtonClick = this.handleButtonClick.bind(this);
    this._isMounted = false;
    this.lastRendered = 0;
  }

  componentDidMount() {
    this._isMounted = true;
    this.scrollToBot();
    this.poll();
  }

  componentDidUpdate(prevProps, prevState) {
    if (
      !isEqual(prevState.messages, this.state.messages) ||
      !isEqual(prevState.localMessages, this.state.localMessages)
    ) {
      this.scrollToBot();
    }
    if (!prevState.isOpen && this.state.isOpen) {
      this.fetchMessages();
      this.focusInput();
    }
    this.lastRendered = Date.now();
  }

  shouldComponentUpdate(nextProps, nextState) {
    return (
      !isEqual(nextProps, this.props) ||
      !isEqual(nextState, this.state) ||
      Date.now() > this.lastRendered + REDRAW_INTERVAL
    );
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  scrollToBot() {
    ReactDOM.findDOMNode(this.refs.chats).scrollTop = ReactDOM.findDOMNode(
      this.refs.chats
    ).scrollHeight;
  }

  focusInput() {
    ReactDOM.findDOMNode(this.refs.msg).focus();
  }

  async fetchMessages() {
    const res = await fetch(
      `${this.props.host}/conversations/${this.props.cid}/log`
    );
    const messages = await res.json();
    messages.forEach(m => {
      m.time = Date.parse(`${m.time}Z`);
    });

    // remove redundant local messages
    const localMessages = this.state.localMessages.filter(
      m => messages.find(n => n.uuid === m.uuid) == null
    );

    // const messages = require("./messages.json");
    this.setState({ messages, localMessages });
  }

  async sendMessage(messageText) {
    if (messageText === "") return;

    const messageObj = {
      message: { text: messageText },
      time: Date.now(),
      username: this.props.cid,
      uuid: uuidv4()
    };

    if (messageText !== "_restart") {
      this.setState({
        localMessages: [...this.state.localMessages, messageObj]
      });
    }

    await fetch(
      `${this.props.host}/conversations/${
        this.props.cid
      }/say?message=${encodeURI(messageObj.message.text)}&uuid=${
        messageObj.uuid
      }`
    );
    // await this.fetchMessages();
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

  handleToggleChat(e) {
    if (window.ga != null) {
      if (this.state.isOpen) {
        window.ga("send", "event", "chat", "chat-close");
      } else {
        window.ga("send", "event", "chat", "chat-open");
      }
    }
    this.setState({ isOpen: !this.state.isOpen });
  }

  async handleSubmitMessage(e) {
    e.preventDefault();

    const message = ReactDOM.findDOMNode(this.refs.msg).value.trim();
    this.sendMessage(message);
    ReactDOM.findDOMNode(this.refs.msg).value = "";

    if (window.ga != null) {
      window.ga("send", "event", "chat", "chat-message-sent");
    }
  }

  handleButtonClick(message) {
    this.sendMessage(message);
    if (window.ga != null) {
      window.ga("send", "event", "chat", "chat-button-click");
    }
  }

  render() {
    const { messages, localMessages, isOpen } = this.state;
    const chatroomClassName = `chatroom ${isOpen ? "open" : "closed"}`;

    const welcomeMessage =
      this.props.welcomeMessage != null
        ? {
            username: "bot",
            time: 0,
            message: {
              text: this.props.welcomeMessage,
              type: "text"
            }
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
      <div className={chatroomClassName}>
        <h3 onClick={this.handleToggleChat}>{this.props.title}</h3>
        <ul className="chats" ref="chats">
          {renderableMessages.map((chat, i) => (
            <Message
              chat={chat}
              user={this.props.cid}
              key={i}
              onButtonClick={this.handleButtonClick}
            />
          ))}
          {showWaitingBubble ? <WaitingBubble /> : null}
        </ul>
        <form className="input" onSubmit={e => this.handleSubmitMessage(e)}>
          <input type="text" ref="msg" />
          <input type="submit" value="Submit" />
        </form>
      </div>
    );
  }
}

const CID_STORAGE_KEY = "simple-chatroom-cid";

function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

window.SimpleChatroom = function(options) {
  let sessionCid = window.sessionStorage.getItem(CID_STORAGE_KEY);

  if (sessionCid == null) {
    sessionCid = uuidv4();
    window.sessionStorage.setItem(CID_STORAGE_KEY, sessionCid);
  }

  const welcomeMessage =
    options.welcomeMessage !== null ? options.welcomeMessage : null;

  ReactDOM.render(
    <Chatroom
      cid={sessionCid}
      host={options.host}
      title={options.title || "Chat"}
      welcomeMessage={welcomeMessage}
    />,
    options.container
  );
};
