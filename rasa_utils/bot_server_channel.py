from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from collections import defaultdict
from datetime import datetime
import json
import logging
from uuid import uuid4
from flask import Blueprint, jsonify, request, Flask, Response, make_response
from flask_cors import CORS

from rasa_core.channels.channel import UserMessage
from rasa_core.channels.channel import InputChannel, OutputChannel
from rasa_core.events import SlotSet

logger = logging.getLogger()


class FileMessageStore:

    DEFAULT_FILENAME = "message_store.json"

    def __init__(self, filename=DEFAULT_FILENAME):
        self._store = defaultdict(list)
        self._filename = filename
        try:
            for k, v in json.load(open(self._filename, "r")).items():
                self._store[k] = v
        except IOError:
            pass

    def log(self, cid, username, message, uuid=None):
        if uuid is None:
            uuid = str(uuid4())
        self._store[cid].append(
            {
                "time": datetime.utcnow().isoformat(),
                "username": username,
                "message": message,
                "uuid": uuid,
            }
        )
        self.save()

    def clear(self, cid):
        self._store[cid] = []
        self.save()

    def save(self):
        json.dump(self._store, open(self._filename, "w"))

    def __getitem__(self, key):
        return self._store[key]


class BotServerOutputChannel(OutputChannel):
    def __init__(self, message_store):
        self.message_store = message_store

    def send_text_message(self, recipient_id, message):
        for message_part in message.split("\n\n"):
            self.message_store.log(
                recipient_id, "bot", {"type": "text", "text": message_part}
            )

    def send_text_with_buttons(self, recipient_id, message, buttons, **kwargs):
        # type: (Text, Text, List[Dict[Text, Any]], **Any) -> None
        """Sends buttons to the output.
        Default implementation will just post the buttons as a string."""

        self.send_text_message(recipient_id, message)
        self.message_store.log(
            recipient_id, "bot", {"type": "button", "buttons": buttons}
        )

    def send_image_url(self, recipient_id, image_url):
        # type: (Text, Text) -> None
        """Sends an image. Default will just post the url as a string."""

        self.message_store.log(
            recipient_id, "bot", {"type": "image", "image": image_url}
        )


class BotServerInputChannel(InputChannel):

    def __init__(
        self, agent=None, preprocessor=None, port=5002, message_store=FileMessageStore()
    ):
        logging.basicConfig(level="DEBUG")
        logging.captureWarnings(True)
        self.message_store = message_store
        self.on_message = lambda x: None
        self.cors_origins = [u'*']
        self.agent = agent
        self.port = port
        self.preprocessor = preprocessor

    @classmethod
    def name(cls):
        return "chatroom"

    def blueprint(self, on_new_message):
        bot_server_webhook = Blueprint('bot_server_webhook', __name__)
        CORS(bot_server_webhook)

        @bot_server_webhook.route("/health", methods=["GET"])
        def health():
            return "healthy"

        @bot_server_webhook.route("/webhook", methods=['POST'])
        def receive():
            sender_id = self._extract_sender(request)
            text = self._extract_message(request)
            should_use_stream = utils.bool_arg("stream", default=False)

            if should_use_stream:
                return Response(
                        self.stream_response(on_new_message, text, sender_id),
                        content_type='text/event-stream')
            else:
                collector = CollectingOutputChannel()
                on_new_message(UserMessage(text, collector, sender_id))
                return json.dumps(collector.messages)

        @bot_server_webhook.route("/conversations/<cid>/log", methods=["GET"])
        def show_log(cid):
            return json.dumps(self.message_store[cid])

        @bot_server_webhook.route("/conversations/<cid>/tracker", methods=["GET"])
        def tracker(cid):
            if self.agent:
                tracker = self.agent.tracker_store.get_or_create_tracker(cid)
                tracker_state = tracker.current_state(
                    should_include_events=True,
                    only_events_after_latest_restart=True
                )

                return json.dumps(tracker_state)
            else:
                return make_response("Could not access agent", 400)

        @bot_server_webhook.route("/conversations/<cid>/say", methods=["GET"])
        def say(cid):
            message = bytes(request.args.get("message", default=""), "utf8")
            _payload = bytes(request.args.get("payload", default=""), "utf8")
            _display_name = bytes(request.args.get("display_name", default=""), "utf8")
            _uuid = bytes(request.args.get("uuid", default=""), "utf8")
            logger.info(message)

            if len(_display_name) > 0 and self.agent:
                display_name, = _display_name
                tracker = self.agent.tracker_store.get_or_create_tracker(cid)
                if (
                    "display_name" in tracker.current_slot_values()
                    and tracker.get_slot("display_name") != display_name
                ):
                    tracker.update(SlotSet("display_name", display_name.decode("utf-8")))
                    self.agent.tracker_store.save(tracker)

            if message == "_restart":
                self.message_store.clear(cid)
            else:
                if len(_uuid) > 0:
                    self.message_store.log(
                        cid,
                        cid,
                        {"type": "text", "text": message.decode("utf-8")},
                        _uuid.decode("utf-8"),
                    )
            if len(_payload) > 0:
                on_new_message(
                    UserMessage(
                        _payload.decode("utf-8"),
                        output_channel=BotServerOutputChannel(self.message_store),
                        sender_id=cid,
                    ),
                    preprocessor=self.preprocessor
                )
            else:
                on_new_message(
                    UserMessage(
                        message.decode("utf-8"),
                        output_channel=BotServerOutputChannel(self.message_store),
                        sender_id=cid,
                    ),
                    preprocessor=self.preprocessor
                )
            return make_response("OK", 200)

        return bot_server_webhook
