// @flow
import React, { Component } from "react";
import ConnectedChatroom from "./ConnectedChatroom";
import { uuidv4 } from "./utils";

function without(obj, prop) {
  const copy = Object.assign({}, obj);
  delete copy[prop];
  return copy;
}

class DebuggerView extends Component {
  state = {
    tracker: null
  };
  intervalHandle = 0;
  chatroomRef = React.createRef();

  componentDidMount() {
    this.intervalHandle = window.setInterval(this.updateTrackerView, 1000);
    this.chatroomRef.current.setState({ isOpen: true });
  }

  componentWillUnmount() {
    window.clearInterval(this.intervalHandle);
    this.intervalHandle = 0;
  }

  updateTrackerView = async () => {
    const { host, userId } = this.props;
    const tracker = await fetch(`${host}/conversations/${userId}/tracker`).then(
      res => res.json()
    );
    this.setState(() => ({ tracker }));
  };

  render() {
    const { tracker } = this.state;
    return (
      <div style={{ display: "flex", margin: "50px 100px" }}>
        <div style={{ flex: 2 }}>
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
              <pre>{JSON.stringify(tracker.slots, null, 2)}</pre>
              <h3>Latest Message</h3>
              <pre>
                {JSON.stringify(
                  without(tracker.latest_message, "intent_ranking"),
                  null,
                  2
                )}
              </pre>
              <h3>Events</h3>
              <pre>{JSON.stringify(tracker.events, null, 2)}</pre>
            </div>
          ) : null}
        </div>
        <div style={{ flex: 1 }}>
          <ConnectedChatroom
            ref={this.chatroomRef}
            userId={this.props.userId}
            host={this.props.host}
            title={"Chat"}
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
