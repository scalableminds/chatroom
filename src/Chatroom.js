import "babel-polyfill";
import React from "react";
import ReactDOM from "react-dom";
import Markdown from "react-markdown";
import breaks from "remark-breaks";
import moment from "moment";
import isEqual from "lodash.isequal";

import "./Chatroom.css";

const Message = ({ chat, user }) => {
  const messageTime = Math.min(Date.now(), Date.parse(`${chat.time}Z`));
  return (
    <li className={`chat ${user === chat.username ? "right" : "left"}`}>
      <Markdown
        source={chat.message.text}
        skipHtml={false}
        allowedTypes={[
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
          paragraph: ({ children }) => <span>{children}</span>
        }}
        plugins={[breaks]}
      />
      <span className="time" title={`${chat.time}Z`}>
        {moment(messageTime).fromNow()}
      </span>
    </li>
  );
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class Chatroom extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      messages: [],
      isOpen: false
    };

    this.submitMessage = this.submitMessage.bind(this);
    this._isMounted = false;
    this.lastRendered = 0;
  }

  componentDidMount() {
    this._isMounted = true;
    this.scrollToBot();
    this.poll();
  }

  componentDidUpdate(prevProps, prevState) {
    this.scrollToBot();
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
      Date.now() > this.lastRendered + 10000
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
    this.setState({ messages });
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
      await sleep(1000);
    }
  }

  async submitMessage(e) {
    e.preventDefault();

    const message = ReactDOM.findDOMNode(this.refs.msg).value.trim();

    if (message === "") return;

    await fetch(
      `${this.props.host}/conversations/${
        this.props.cid
      }/say?message=${encodeURI(ReactDOM.findDOMNode(this.refs.msg).value)}`
    );
    await this.fetchMessages();

    ReactDOM.findDOMNode(this.refs.msg).value = "";
  }

  render() {
    const { messages, isOpen } = this.state;
    const chatroomClassName = `chatroom ${isOpen ? "open" : "closed"}`;

    return (
      <div className={chatroomClassName}>
        <h3
          onClick={() => {
            this.setState({ isOpen: !isOpen });
          }}
        >
          {this.props.title}
        </h3>
        <ul className="chats" ref="chats">
          {messages.map((chat, i) => (
            <Message chat={chat} user={this.props.cid} key={i} />
          ))}
        </ul>
        <form className="input" onSubmit={e => this.submitMessage(e)}>
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
  ReactDOM.render(
    <Chatroom
      cid={sessionCid}
      host={options.host}
      title={options.title || "Chat"}
    />,
    options.container
  );
};
