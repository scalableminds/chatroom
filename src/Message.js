// @flow
import React from "react";
import Markdown from "react-markdown";
import breaks from "remark-breaks";
import moment from "moment";
import classnames from "classnames";
import type { ChatMessage } from "./Chatroom";

type MessageTimeProps = {
  time: number,
  isBot: boolean
};
export const MessageTime = ({ time, isBot }: MessageTimeProps) => {
  if (time === 0) return null;

  const messageTime = Math.min(Date.now(), time);
  return (
    <li
      className={classnames("time", isBot ? "left" : "right")}
      title={new Date(messageTime).toISOString()}
    >
      {moment(messageTime).fromNow()}
    </li>
  );
};

type MessageProps = {
  chat: ChatMessage,
  onButtonClick: (title: string, payload: string) => void
};
const Message = ({ chat, onButtonClick }: MessageProps) => {
  const message = chat.message;
  const isBot = chat.username === "bot";
  switch (message.type) {
    case "button":
      return (
        <ul className="chat-buttons">
          {message.buttons.map(({ payload, title, selected }) => (
            <li
              className={classnames("chat-button", {
                "chat-button-selected": selected
              })}
              key={payload}
              onClick={() => onButtonClick(title, payload)}
            >
              <Markdown
                source={title}
                skipHtml={false}
                allowedTypses={["root", "break"]}
                renderers={{
                  paragraph: ({ children }) => <span>{children}</span>
                }}
                plugins={[breaks]}
              />
            </li>
          ))}
        </ul>
      );

    case "image":
      return (
        <li className={`chat ${isBot ? "left" : "right"} chat-img`}>
          <img src={message.image} alt="" />
        </li>
      );
    default:
      return (
        <li className={classnames("chat", isBot ? "left" : "right")}>
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
        </li>
      );
  }
};

export default Message;
