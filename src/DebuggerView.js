// @flow
import React, { Component } from "react";
import ConnectedChatroom from "./ConnectedChatroom";
import { uuidv4 } from "./utils";

function without(obj, prop) {
  const copy = Object.assign({}, obj);
  delete copy[prop];
  return copy;
}

type TrackerState = {
  slots: Object,
  latest_event_time: number,
  paused: boolean,
  sender_id: string,
  latest_message: Object,
  events: Array<Object>
};

type DebuggerViewProps = {
  userId: string,
  host: string,
  welcomeMessage: ?string,
  title: string,
  waitingTimeout?: number,
  pollingInterval?: number,
  speechRecognition: ?string,
  messageBlacklist?: Array<string>,
  fetchOptions?: RequestOptions
};
type DebuggerViewState = {
  tracker: ?TrackerState
};
class DebuggerView extends Component<DebuggerViewProps, DebuggerViewState> {
  state = {
    tracker: null
  };
  intervalHandle = 0;
  chatroomRef = React.createRef();

  componentDidMount() {
    this.intervalHandle = window.setInterval(this.updateTrackerView, 1000);
    this.getChatroom().setState({ isOpen: true });
  }

  componentWillUnmount() {
    window.clearInterval(this.intervalHandle);
    this.intervalHandle = 0;
  }

  getChatroom() {
    if (this.chatroomRef.current == null)
      throw new TypeError("chatroomRef is null.");
    return this.chatroomRef.current;
  }

  fetchTracker(): Promise<TrackerState> {
    const { host, userId } = this.props;
    return fetch(`${host}/conversations/${userId}/tracker`).then(res =>
      res.json()
    );
  }

  updateTrackerView = async () => {
    const tracker = await this.fetchTracker();
    this.setState(() => ({ tracker }));
  };

  render() {
    const { tracker } = this.state;
    const preStyle = {
      fontFamily: "Monaco, Consolas, Courier, monospace",
      fontSize: "10pt"
    };

    return (
      <div style={{ display: "flex", margin: "5vh 5vw", height: "90vh" }}>
        <div style={{ flex: 2, overflowY: "auto" }}>
          <div>
            <p>
              Bot address: <strong>{this.props.host}</strong>
            </p>
            <p>
              Session Id: <strong>{this.props.userId}</strong>
            </p>
          </div>
          {tracker != null ? (
            <div>
              <h3>Slots</h3>
              <pre style={preStyle}>
                {JSON.stringify(tracker.slots, null, 2)}
              </pre>
              <h3>Latest Message</h3>
              <pre style={preStyle}>
                {JSON.stringify(
                  without(tracker.latest_message, "intent_ranking"),
                  null,
                  2
                )}
              </pre>
              <h3>Events</h3>
              <pre style={preStyle}>
                {JSON.stringify(tracker.events, null, 2)}
              </pre>
            </div>
          ) : null}
        </div>
        <div style={{ flex: 1 }}>
          <ConnectedChatroom
            ref={this.chatroomRef}
            userId={this.props.userId}
            host={this.props.host}
            title={"Chat"}
            speechRecognition={this.props.speechRecognition}
            welcomeMessage={this.props.welcomeMessage}
            waitingTimeout={this.props.waitingTimeout}
            pollingInterval={this.props.pollingInterval}
            fetchOptions={this.props.fetchOptions}
          />
        </div>
      </div>
    );
  }
}

export default DebuggerView;
