from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from twisted.web.static import File
from twisted.web.resource import NoResource
from klein import Klein
from collections import defaultdict
from datetime import datetime
import json
import logging
from uuid import uuid4
from flask import Blueprint, jsonify, request, Flask, Response
from flask_cors import CORS

from rasa_nlu.server import check_cors
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
        self.message_store.log(recipient_id, "bot", {"type": "text", "text": message})

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
        self, agent, preprocessor=None, port=5002, static_files=None, message_store=FileMessageStore()
    ):
        logging.basicConfig(level="DEBUG")
        logging.captureWarnings(True)
        self.message_store = message_store
        self.static_files = static_files
        self.on_message = lambda x: None
        self.cors_origins = [u'*']
        self.agent = agent
        self.port = port
        self.preprocessor = preprocessor

    @classmethod
    def name(cls):
        return "chatroom"

    def blueprint(self, on_new_message):
        custom_webhook = Blueprint('custom_webhook', __name__)
        CORS(custom_webhook)

        @custom_webhook.route("/", methods=['GET'])
        def static():
            if self.static_files is None:
                return NoResource()
            else:
                return File(self.static_files)

        @custom_webhook.route("/health", methods=["GET"])
        def health():
            return "healthy"

        @custom_webhook.route("/webhook", methods=['POST'])
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

        @custom_webhook.route("/conversations/<cid>/log", methods=["GET"])
        def show_log(cid):
            return json.dumps(self.message_store[cid])

        @custom_webhook.route("/conversations/<cid>/tracker", methods=["GET"])
        def tracker(cid):
            tracker = self.agent.tracker_store.get_or_create_tracker(cid)
            tracker_state = tracker.current_state(
                should_include_events=True,
                only_events_after_latest_restart=True
            )

            return json.dumps(tracker_state)

        @custom_webhook.route("/conversations/<cid>/say", methods=["GET"])
        def say(cid):
            message = bytes(request.args.get("message"), "utf8")
            _payload = bytes(request.args.get("payload", ""), "utf8")
            _display_name = bytes(request.args.get("display_name", ""), "utf8")
            _uuid = bytes(request.args.get("uuid", ""), "utf8")
            logger.info(message)

            if len(_display_name) > 0:
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
                        _payload[0].decode("utf-8"),
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
            return "OK"

        return custom_webhook
