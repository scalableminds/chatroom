from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import argparse

from .bot_server_channel import BotServerInputChannel

from rasa_core.agent import Agent
from rasa_core import utils


def create_argparser():
    parser = argparse.ArgumentParser(
            description='starts the bot')

    parser.add_argument(
        '-d', '--core',
        required=True,
        type=str,
        help="core model to run")

    parser.add_argument(
        '-u', '--nlu',
        type=str,
        help="nlu model to run")

    parser.add_argument(
        '-p', '--port',
        default=5002,
        type=int,
        help="port to run the server at")

    parser.add_argument(
        '-o', '--log_file',
        type=str,
        default="rasa_core.log",
        help="store log file in specified file")

    utils.add_logging_option_arguments(parser)
    return parser


def preprocessor(message_text):
    text = message_text.strip()
    return text


if __name__ == "__main__":

    parser = create_argparser()
    cmdline_args = parser.parse_args()

    utils.configure_colored_logging(cmdline_args.loglevel)
    utils.configure_file_logging(cmdline_args.loglevel,
                                 cmdline_args.log_file)

    agent = Agent.load(cmdline_args.core, cmdline_args.nlu)
    channel = BotServerInputChannel(agent, port=cmdline_args.port)
    agent.handle_channel(channel, message_preprocessor=preprocessor)
